import { type MultipartTextField, readMultipartTextFields, replaceMultipartBytes } from './multipart.ts'

// Prefix scanned for routing fields when the full body fails to JSON.parse.
const ROUTING_FALLBACK_PREFIX_BYTES = 16 * 1024
export const MAX_PROXY_BODY_BYTES = 10 * 1024 * 1024

export type PreparedProxyBody = {
  parsedBody: Record<string, unknown> | null
  bodyText: string | null
  isMultipart: boolean
  multipartBytes: Uint8Array | null
  multipartModelField: MultipartTextField | null
}

export type ProxyBodySnapshot = PreparedProxyBody & {
  hasBody: boolean
  reqModel: string | null
}

export type ProxyBodyTransformResult = {
  body: Record<string, unknown> | null
  mutated: boolean
}

export type ProxyForwardBody = ReadableStream<Uint8Array> | Uint8Array | ArrayBuffer | string | undefined

const MULTIPART_ROUTING_FIELDS = new Set(['model', 'stream'])

export async function prepareProxyBody(request: Request, method: string): Promise<ProxyBodySnapshot> {
  const hasBody = method !== 'GET' && method !== 'HEAD'
  const contentType = request.headers.get('content-type') ?? ''
  const isMultipart = hasBody && contentType.includes('multipart/form-data')

  if (!hasBody) {
    return snapshot(
      {
        parsedBody: null,
        bodyText: null,
        isMultipart: false,
        multipartBytes: null,
        multipartModelField: null,
      },
      hasBody,
    )
  }

  if (isMultipart) return snapshot(await prepareMultipartBody(request, contentType), hasBody)

  const { text, prefix } = await readBody(request, MAX_PROXY_BODY_BYTES)
  let parsedBody: Record<string, unknown> | null = null
  try {
    parsedBody = JSON.parse(text)
  } catch {
    parsedBody = parseRoutingPrefix(prefix)
  }

  return snapshot(
    {
      parsedBody,
      bodyText: text,
      isMultipart: false,
      multipartBytes: null,
      multipartModelField: null,
    },
    hasBody,
  )
}

export function applyProxyBodyTransform(
  body: ProxyBodySnapshot,
  transform: ProxyBodyTransformResult,
): ProxyBodySnapshot {
  if (!transform.body) return body
  if (body.isMultipart) return applyMultipartModel(body, transform.body)
  return snapshot(
    {
      ...body,
      parsedBody: transform.body,
      bodyText: transform.mutated ? JSON.stringify(transform.body) : body.bodyText,
    },
    body.hasBody,
  )
}

export function getProxyForwardBody(body: ProxyBodySnapshot): ProxyForwardBody {
  if (!body.hasBody) return undefined
  if (body.isMultipart) return body.multipartBytes ?? undefined
  return body.bodyText || undefined
}

export function getProxyLoggedBody(body: ProxyBodySnapshot): string | null {
  return body.isMultipart ? null : body.bodyText
}

export function applyProxyBodyHeaders(body: ProxyBodySnapshot, headers: Record<string, string>) {
  if (!body.isMultipart && body.bodyText) {
    headers['content-length'] = String(Buffer.byteLength(body.bodyText, 'utf8'))
  } else if (body.multipartBytes) {
    headers['content-length'] = String(body.multipartBytes.byteLength)
  }
}

function snapshot(body: PreparedProxyBody, hasBody: boolean): ProxyBodySnapshot {
  return { ...body, hasBody, reqModel: extractModel(body.parsedBody) }
}

function extractModel(parsedBody: Record<string, unknown> | null): string | null {
  return parsedBody && typeof parsedBody.model === 'string' ? parsedBody.model : null
}

// Buffered (within the same hard limit as JSON) so the model can be read for
// routing, allow-lists, aliases, and logging. The bytes are forwarded as-is
// unless the model is rewritten.
async function prepareMultipartBody(request: Request, contentType: string): Promise<PreparedProxyBody> {
  assertContentLengthWithinLimit(request.headers)
  const bytes = await readLimitedBytes(request, MAX_PROXY_BODY_BYTES)
  const fields = readMultipartTextFields(bytes, contentType, MULTIPART_ROUTING_FIELDS)
  return {
    parsedBody: fields ? multipartRoutingBody(fields) : null,
    bodyText: null,
    isMultipart: true,
    multipartBytes: bytes,
    multipartModelField: fields?.get('model') ?? null,
  }
}

function multipartRoutingBody(fields: Map<string, MultipartTextField>): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  const model = fields.get('model')
  const stream = fields.get('stream')
  if (model) body.model = model.value
  if (stream) body.stream = stream.value === 'true'
  return body
}

function applyMultipartModel(body: ProxyBodySnapshot, transformed: Record<string, unknown>): ProxyBodySnapshot {
  const field = body.multipartModelField
  const model = transformed.model
  if (!field || !body.multipartBytes || typeof model !== 'string' || model === field.value) {
    return snapshot({ ...body, parsedBody: transformed }, body.hasBody)
  }
  return snapshot(
    {
      ...body,
      parsedBody: transformed,
      multipartBytes: replaceMultipartBytes(body.multipartBytes, field, model),
      multipartModelField: null,
    },
    body.hasBody,
  )
}

async function readBody(request: Request, maxBytes: number): Promise<{ text: string; prefix: string }> {
  assertContentLengthWithinLimit(request.headers)
  const text = new TextDecoder().decode(await readLimitedBytes(request, maxBytes))
  return { text, prefix: text.slice(0, ROUTING_FALLBACK_PREFIX_BYTES) }
}

export async function readLimitedBytes(request: Request, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const reader = request.body?.getReader()
  if (!reader) return new Uint8Array(0)

  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => {})
      throw new Error(`Request body exceeds ${maxBytes} bytes`)
    }
    chunks.push(value)
  }

  const combined = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return combined
}

export function assertContentLengthWithinLimit(headers: Headers) {
  const raw = headers.get('content-length')
  if (!raw) return
  const size = Number(raw)
  if (Number.isFinite(size) && size > MAX_PROXY_BODY_BYTES) {
    throw new Error(`Request body exceeds ${MAX_PROXY_BODY_BYTES} bytes`)
  }
}

function parseRoutingPrefix(prefix: string): Record<string, unknown> | null {
  const model = prefix.match(/"model"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/)
  const stream = prefix.match(/"stream"\s*:\s*(true|false)/)
  if (!model && !stream) return null
  return {
    ...(model ? { model: JSON.parse(`"${model[1]}"`) } : {}),
    ...(stream ? { stream: stream[1] === 'true' } : {}),
  }
}
