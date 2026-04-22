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

export type SseEvent = {
  event: string | null
  data: string
  parsedData: Record<string, unknown> | null
  isDone: boolean
}

export type ParsedSseStream = {
  events: Array<SseEvent>
  lastParsedData: Record<string, unknown> | null
}

export function parseSseStream(body: string): ParsedSseStream {
  const events: Array<SseEvent> = []
  let lastParsedData: Record<string, unknown> | null = null
  for (const block of body.split('\n\n')) {
    if (!block.trim()) continue
    let event: string | null = null
    const dataLines: Array<string> = []
    for (const rawLine of block.split('\n')) {
      const line = rawLine.replace(/\r$/, '')
      if (line.startsWith('event:')) {
        event = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(line.startsWith('data: ') ? 6 : 5))
      }
    }
    const data = dataLines.join('\n').trim()
    if (event == null && data === '') continue
    const isDone = data === '[DONE]'
    let parsedData: Record<string, unknown> | null = null
    if (!isDone && data !== '') {
      try {
        parsedData = JSON.parse(data) as Record<string, unknown>
        lastParsedData = parsedData
      } catch {}
    }
    events.push({ event, data, parsedData, isDone })
  }
  return { events, lastParsedData }
}

export type ResponseAnalysis = {
  displayBody: string
  isJson: boolean
  isSse: boolean
}

export function analyzeResponse(responseBody: string | null, streamed: boolean): ResponseAnalysis {
  if (!responseBody) return { displayBody: '', isJson: false, isSse: false }
  if (!streamed) {
    const trimmed = responseBody.trimStart()
    return {
      displayBody: responseBody,
      isJson: trimmed.startsWith('{') || trimmed.startsWith('['),
      isSse: false,
    }
  }
  // Streamed bodies render as a sequence of event/data blocks — the
  // RequestSseEvents component handles parsing + per-event JSON highlight.
  return { displayBody: responseBody, isJson: false, isSse: true }
}

export function analyzeTiming(sse: ParsedSseStream | null, streamCloseMs: number | null): RequestTiming {
  const result: RequestTiming = {
    queueMs: null,
    prefillMs: null,
    ttftMs: null,
    decodeMs: null,
    streamCloseMs,
  }
  const lastChunk = sse?.lastParsedData
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

export function buildCurlCommand(
  endpoint: string,
  requestBody: string | null,
  requestHeaders: Record<string, string> | null,
) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://llama-dash.example'
  const auth = requestHeaders?.authorization
    ? maskSensitive('authorization', requestHeaders.authorization)
    : 'Bearer sk-…'
  const contentType = requestHeaders?.['content-type'] ?? 'application/json'
  const body = requestBody ?? '{}'
  return `curl ${origin}${endpoint} \\
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

// Re-indent JSON-like text tokenwise so we can still pretty-print truncated
// payloads (the tail ends with "...[truncated N bytes]" and won't parse).
// Not a validator — whatever trailing garbage the input carries is preserved
// verbatim at the current indent level so the highlighter still styles it.
export function prettyPrintJsonLenient(text: string): string | null {
  const first = text.search(/\S/)
  if (first === -1) return null
  const head = text[first]
  if (head !== '{' && head !== '[') return null

  let out = ''
  let depth = 0
  let inString = false
  let escaped = false
  const indent = () => `\n${'  '.repeat(depth)}`

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      out += ch
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (ch === '"') inString = false
      continue
    }
    switch (ch) {
      case '"':
        inString = true
        out += ch
        break
      case '{':
      case '[': {
        const next = peekNonWs(text, i + 1)
        out += ch
        if (next === '}' || next === ']') break
        depth++
        out += indent()
        break
      }
      case '}':
      case ']': {
        const last = out.charCodeAt(out.length - 1)
        // compact empty container: previous char is the matching opener
        if (last === 0x7b /* { */ || last === 0x5b /* [ */) {
          out += ch
          break
        }
        depth = Math.max(0, depth - 1)
        out += indent() + ch
        break
      }
      case ',':
        out += ch + indent()
        break
      case ':':
        out += `${ch} `
        break
      case ' ':
      case '\t':
      case '\n':
      case '\r':
        break
      default:
        out += ch
    }
  }
  return out
}

function peekNonWs(text: string, from: number): string | null {
  for (let i = from; i < text.length; i++) {
    const ch = text[i]
    if (ch !== ' ' && ch !== '\t' && ch !== '\n' && ch !== '\r') return ch
  }
  return null
}

export function formatCostUsd(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`
  if (usd >= 0.01) return `$${usd.toFixed(4)}`
  if (usd > 0) return `<$0.01`
  return '—'
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
