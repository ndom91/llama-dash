const PRE_AUTH_PREFIX_BYTES = 16 * 1024
export const MAX_PROXY_BODY_BYTES = 10 * 1024 * 1024

export type PreparedProxyBody = {
  parsedBody: Record<string, unknown> | null
  bodyText: string | null
  multipartFormData: FormData | null
  isMultipart: boolean
}

export type ProxyBodySnapshot = PreparedProxyBody & {
  hasBody: boolean
  reqModel: string | null
}

export type ProxyBodyTransformResult = {
  body: Record<string, unknown> | null
  mutated: boolean
}

export async function prepareProxyBody(request: Request, method: string): Promise<ProxyBodySnapshot> {
  const hasBody = method !== 'GET' && method !== 'HEAD'
  const contentType = request.headers.get('content-type') ?? ''
  const isMultipart = hasBody && contentType.includes('multipart/form-data')

  if (!hasBody) {
    return snapshot({ parsedBody: null, bodyText: null, multipartFormData: null, isMultipart: false }, hasBody)
  }

  if (isMultipart) {
    return snapshot(await prepareMultipartBody(request), hasBody)
  }

  const { text, prefix } = await readBody(request, MAX_PROXY_BODY_BYTES)
  let parsedBody: Record<string, unknown> | null = null
  try {
    parsedBody = JSON.parse(text)
  } catch {
    parsedBody = parseRoutingPrefix(prefix)
  }

  return snapshot({ parsedBody, bodyText: text, multipartFormData: null, isMultipart: false }, hasBody)
}

export function applyProxyBodyTransform(
  body: ProxyBodySnapshot,
  transform: ProxyBodyTransformResult,
): ProxyBodySnapshot {
  if (!transform.body) return body
  if (body.isMultipart) {
    if (body.multipartFormData && typeof transform.body.model === 'string') {
      body.multipartFormData.set('model', transform.body.model)
    }
    return snapshot({ ...body, parsedBody: transform.body }, body.hasBody)
  }
  return snapshot(
    {
      ...body,
      parsedBody: transform.body,
      bodyText: transform.mutated ? JSON.stringify(transform.body) : body.bodyText,
    },
    body.hasBody,
  )
}

export function getProxyForwardBody(
  body: ProxyBodySnapshot,
  request: Request,
): ReadableStream<Uint8Array> | BodyInit | undefined {
  if (!body.hasBody) return undefined
  if (body.isMultipart) return body.multipartFormData ?? request.body ?? undefined
  return body.bodyText || undefined
}

export function getProxyLoggedBody(body: ProxyBodySnapshot): string | null {
  return body.isMultipart ? null : body.bodyText
}

export function applyProxyBodyHeaders(body: ProxyBodySnapshot, headers: Record<string, string>) {
  if (!body.isMultipart && body.bodyText) {
    headers['content-length'] = String(Buffer.byteLength(body.bodyText, 'utf8'))
  }
}

function snapshot(body: PreparedProxyBody, hasBody: boolean): ProxyBodySnapshot {
  return { ...body, hasBody, reqModel: extractModel(body.parsedBody) }
}

function extractModel(parsedBody: Record<string, unknown> | null): string | null {
  return parsedBody && typeof parsedBody.model === 'string' ? parsedBody.model : null
}

async function prepareMultipartBody(request: Request): Promise<PreparedProxyBody> {
  try {
    assertContentLengthWithinLimit(request.headers)
    const multipartFormData = await request.clone().formData()
    const modelField = multipartFormData.get('model')
    const streamField = multipartFormData.get('stream')
    const parsedBody = {
      ...(typeof modelField === 'string' ? { model: modelField } : {}),
      ...(typeof streamField === 'string' ? { stream: streamField === 'true' } : {}),
    }
    return { parsedBody, bodyText: null, multipartFormData, isMultipart: true }
  } catch {
    return { parsedBody: null, bodyText: null, multipartFormData: null, isMultipart: true }
  }
}

async function readBody(request: Request, maxBytes: number): Promise<{ text: string; prefix: string }> {
  assertContentLengthWithinLimit(request.headers)
  const reader = request.body?.getReader()
  if (!reader) return { text: '', prefix: '' }

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
  const text = new TextDecoder().decode(combined)
  return { text, prefix: new TextDecoder().decode(combined.slice(0, PRE_AUTH_PREFIX_BYTES)) }
}

function assertContentLengthWithinLimit(headers: Headers) {
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
