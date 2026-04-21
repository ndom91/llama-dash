import type { ApiRequestDetail } from '../../lib/api'

export type RequestTiming = {
  queueMs: number | null
  prefillMs: number | null
  ttftMs: number | null
  decodeMs: number | null
  streamCloseMs: number | null
}

export function parseRequestPayload(body: string | null) {
  if (!body) return { model: null as string | null, messagesCount: 0, toolsCount: 0 }
  try {
    const parsed = JSON.parse(body) as { model?: string; messages?: Array<unknown>; tools?: Array<unknown> }
    return {
      model: typeof parsed.model === 'string' ? parsed.model : null,
      messagesCount: Array.isArray(parsed.messages) ? parsed.messages.length : 0,
      toolsCount: Array.isArray(parsed.tools) ? parsed.tools.length : 0,
    }
  } catch {
    return { model: null, messagesCount: 0, toolsCount: 0 }
  }
}

export function parseSseChunks(body: string) {
  const chunks: Array<Record<string, unknown>> = []
  for (const raw of body.split('\n\n')) {
    const line = raw.trim()
    if (!line.startsWith('data: ')) continue
    const payload = line.slice(6)
    if (payload === '[DONE]') continue
    try {
      chunks.push(JSON.parse(payload) as Record<string, unknown>)
    } catch {}
  }
  return chunks
}

export function analyzeResponse(req: ApiRequestDetail) {
  if (!req.responseBody) return { displayBody: '', isJson: false }
  if (!req.streamed) {
    return { displayBody: req.responseBody, isJson: tryPrettyJson(req.responseBody) != null }
  }

  const chunks = parseSseChunks(req.responseBody)
  if (chunks.length === 0) return { displayBody: req.responseBody, isJson: false }

  let content = ''
  let finishReason: string | null = null
  let model: string | null = null
  for (const chunk of chunks) {
    model = typeof chunk.model === 'string' ? chunk.model : model
    const choices = Array.isArray(chunk.choices) ? chunk.choices : []
    for (const choice of choices) {
      if (!choice || typeof choice !== 'object') continue
      const finish = 'finish_reason' in choice ? choice.finish_reason : null
      if (typeof finish === 'string') finishReason = finish
      if ('delta' in choice && choice.delta && typeof choice.delta === 'object') {
        const deltaContent = 'content' in choice.delta ? choice.delta.content : null
        if (typeof deltaContent === 'string') content += deltaContent
      }
    }
  }

  return {
    displayBody: JSON.stringify(
      {
        object: 'chat.completion',
        model: model ?? req.model,
        finish_reason: finishReason,
        usage: {
          prompt: req.promptTokens,
          completion: req.completionTokens,
          total: req.totalTokens,
        },
        choices: [{ message: { role: 'assistant', content } }],
      },
      null,
      2,
    ),
    isJson: true,
  }
}

export function analyzeTiming(req: ApiRequestDetail): RequestTiming {
  const result: RequestTiming = {
    queueMs: null,
    prefillMs: null,
    ttftMs: null,
    decodeMs: null,
    streamCloseMs: req.streamCloseMs,
  }
  if (!req.responseBody) return result
  const chunks = parseSseChunks(req.responseBody)
  const lastChunk = chunks[chunks.length - 1]
  if (
    !lastChunk ||
    typeof lastChunk !== 'object' ||
    !('timings' in lastChunk) ||
    !lastChunk.timings ||
    typeof lastChunk.timings !== 'object'
  ) {
    return result
  }
  const timings = lastChunk.timings as Record<string, unknown>
  result.prefillMs = typeof timings.prompt_ms === 'number' ? timings.prompt_ms : null
  result.ttftMs = result.prefillMs
  result.decodeMs = typeof timings.predicted_ms === 'number' ? timings.predicted_ms : null
  return result
}

export function deriveClientLabel(headers: Record<string, string> | null) {
  if (!headers) return null
  const origin = headers.origin
  if (origin) {
    try {
      return new URL(origin).hostname
    } catch {
      return origin
    }
  }
  return headers['x-forwarded-for'] ?? null
}

export function deriveRewriteLabel(
  requestedModel: string | null,
  servedModel: string | null,
  responseHeaders: Record<string, string> | null,
) {
  const alias = responseHeaders?.['x-alias-from']
  if (alias) return 'alias'
  if (requestedModel && servedModel && requestedModel !== servedModel) return 'rewrite'
  return null
}

export function buildCurlCommand(req: ApiRequestDetail, requestHeaders: Record<string, string> | null) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://llama-dash.example'
  const auth = requestHeaders?.authorization
    ? maskSensitive('authorization', requestHeaders.authorization)
    : 'Bearer sk-…'
  const contentType = requestHeaders?.['content-type'] ?? 'application/json'
  const body = req.requestBody ?? '{}'
  return `curl ${origin}${req.endpoint} \\
  -H "Authorization: ${auth}" \\
  -H "Content-Type: ${contentType}" \\
  -d '${body.replace(/'/g, "'\\''")}'`
}

export function tryPrettyJson(text: string): string | null {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return null
  }
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(s < 10 ? 2 : 1)}s`
  const m = Math.floor(s / 60)
  const rem = Math.floor(s % 60)
  return `${m}m ${rem}s`
}

export function byteSize(str: string): string {
  const bytes = new Blob([str]).size
  if (bytes < 1024) return `${bytes}B`
  return `${(bytes / 1024).toFixed(1)}KB`
}

export function maskSensitive(key: string, value: string): string {
  const k = key.toLowerCase()
  if (k === 'authorization' && value.startsWith('Bearer ') && value.length > 14) {
    const token = value.slice(7)
    return `Bearer ${token.slice(0, 8)}…`
  }
  return value
}
