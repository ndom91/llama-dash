const PRE_AUTH_PREFIX_BYTES = 16 * 1024

export type PreparedProxyBody = {
  parsedBody: Record<string, unknown> | null
  bodyText: string | null
  multipartFormData: FormData | null
  isMultipart: boolean
}

export async function prepareProxyBody(request: Request, method: string): Promise<PreparedProxyBody> {
  const hasBody = method !== 'GET' && method !== 'HEAD'
  const contentType = request.headers.get('content-type') ?? ''
  const isMultipart = hasBody && contentType.includes('multipart/form-data')

  if (!hasBody) {
    return { parsedBody: null, bodyText: null, multipartFormData: null, isMultipart: false }
  }

  if (isMultipart) {
    return prepareMultipartBody(request)
  }

  const { text, prefix } = await readBody(request)
  let parsedBody: Record<string, unknown> | null = null
  try {
    parsedBody = JSON.parse(text)
  } catch {
    parsedBody = parseRoutingPrefix(prefix)
  }

  return { parsedBody, bodyText: text, multipartFormData: null, isMultipart: false }
}

async function prepareMultipartBody(request: Request): Promise<PreparedProxyBody> {
  try {
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

async function readBody(request: Request): Promise<{ text: string; prefix: string }> {
  const reader = request.body?.getReader()
  if (!reader) return { text: '', prefix: '' }

  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    total += value.byteLength
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

function parseRoutingPrefix(prefix: string): Record<string, unknown> | null {
  const model = prefix.match(/"model"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/)
  const stream = prefix.match(/"stream"\s*:\s*(true|false)/)
  if (!model && !stream) return null
  return {
    ...(model ? { model: JSON.parse(`"${model[1]}"`) } : {}),
    ...(stream ? { stream: stream[1] === 'true' } : {}),
  }
}
