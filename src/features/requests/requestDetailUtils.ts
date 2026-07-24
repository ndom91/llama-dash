import { deriveDisplayPhases } from '../../lib/timing-phases.ts'

export type RequestTiming = {
  queueMs: number | null
  modelLoadingMs: number | null
  prefillMs: number | null
  reasoningMs: number | null
  responseMs: number | null
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
  latestTimingData: Record<string, unknown> | null
}

export function parseSseStream(body: string): ParsedSseStream {
  const events: Array<SseEvent> = []
  let latestTimingData: Record<string, unknown> | null = null
  for (const block of body.split(/\r?\n\r?\n/)) {
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
        if ('timings' in parsedData && parsedData.timings && typeof parsedData.timings === 'object') {
          latestTimingData = parsedData
        }
      } catch {}
    }
    events.push({ event, data, parsedData, isDone })
  }
  return { events, latestTimingData }
}

// Concatenate the assistant's generated text across an SSE stream so the
// Response pane can show the assembled completion without the user reading
// every delta chunk. Handles both OpenAI chat-completions
// (choices[0].delta.content / reasoning_content) and Anthropic messages
// (content_block_delta → delta.text / thinking) shapes. Tool-arg deltas
// (input_json_delta) are intentionally skipped.
export function assembleSseParts(stream: ParsedSseStream | null): { reasoning: string; response: string } {
  if (!stream) return { reasoning: '', response: '' }
  let reasoning = ''
  let response = ''
  for (const e of stream.events) {
    const data = e.parsedData
    if (!data) continue
    const choices = (data as { choices?: unknown }).choices
    if (Array.isArray(choices)) {
      for (const choice of choices) {
        const delta = (choice as { delta?: Record<string, unknown> })?.delta
        if (!delta) continue
        if (typeof delta.reasoning_content === 'string') reasoning += delta.reasoning_content
        if (typeof delta.reasoning === 'string') reasoning += delta.reasoning
        if (typeof delta.content === 'string') response += delta.content
      }
      continue
    }
    if ((data as { type?: unknown }).type === 'content_block_delta') {
      const delta = (data as { delta?: { type?: unknown; text?: unknown; thinking?: unknown } }).delta
      if (delta?.type === 'thinking_delta' && typeof delta.thinking === 'string') reasoning += delta.thinking
      if (delta?.type === 'text_delta' && typeof delta.text === 'string') response += delta.text
    }
  }
  return { reasoning, response }
}

/** @deprecated prefer assembleSseParts — kept for call sites that only need response text. */
export function assembleSseText(stream: ParsedSseStream | null): string {
  return assembleSseParts(stream).response
}

/** Rough token estimate for assembled text display (~4 chars/token). */
export function estimateTextTokens(text: string): number {
  if (!text) return 0
  return Math.max(1, Math.round(text.length / 4))
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

export function analyzeTiming(input: {
  queueMs?: number | null
  modelLoadingMs?: number | null
  prefillMs?: number | null
  reasoningMs?: number | null
  responseMs?: number | null
  /** Legacy wall decode — ignored for display when GPU/new fields exist. */
  decodeMs?: number | null
  streamCloseMs?: number | null
  gpuPrefillMs?: number | null
  gpuDecodeMs?: number | null
  /** Fallback for older rows: scrape llama.cpp timings from the SSE body. */
  sse?: ParsedSseStream | null
}): RequestTiming {
  let gpuPrefillMs = input.gpuPrefillMs ?? null
  let gpuDecodeMs = input.gpuDecodeMs ?? null

  if (gpuPrefillMs == null && gpuDecodeMs == null) {
    const lastChunk = input.sse?.latestTimingData
    if (
      lastChunk &&
      typeof lastChunk === 'object' &&
      'timings' in lastChunk &&
      lastChunk.timings &&
      typeof lastChunk.timings === 'object'
    ) {
      const timings = lastChunk.timings as Record<string, unknown>
      gpuPrefillMs = typeof timings.prompt_ms === 'number' ? timings.prompt_ms : null
      gpuDecodeMs = typeof timings.predicted_ms === 'number' ? timings.predicted_ms : null
    }
  }

  const hasPersistedDisplay =
    input.modelLoadingMs != null ||
    input.reasoningMs != null ||
    input.responseMs != null ||
    (input.prefillMs != null && gpuPrefillMs != null && input.prefillMs === gpuPrefillMs)

  if (hasPersistedDisplay) {
    return {
      queueMs: input.queueMs ?? null,
      modelLoadingMs: input.modelLoadingMs ?? null,
      prefillMs: input.prefillMs ?? gpuPrefillMs,
      reasoningMs: input.reasoningMs ?? null,
      responseMs:
        input.responseMs ?? (gpuDecodeMs != null ? Math.max(0, gpuDecodeMs - (input.reasoningMs ?? 0)) : null),
    }
  }

  // Legacy / incomplete rows: derive display phases from GPU only.
  const derived = deriveDisplayPhases({
    relayToFirstTokenMs: null,
    gpuPrefillMs,
    gpuDecodeMs,
    reasoningMs: null,
  })
  return {
    queueMs: input.queueMs ?? null,
    modelLoadingMs: derived.modelLoadingMs,
    prefillMs: derived.prefillMs,
    reasoningMs: derived.reasoningMs,
    responseMs: derived.responseMs,
  }
}

/** Format a phase for display: null or ≤0 → "—". */
export function formatPhaseMs(ms: number | null | undefined): string {
  if (ms == null || ms <= 0) return '—'
  return formatDuration(ms)
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

export function parseHeaderMap(headers: string | null): Record<string, string> | null {
  if (!headers) return null
  try {
    return JSON.parse(headers) as Record<string, string>
  } catch {
    return null
  }
}

export function calculateTokPerSec(completionTokens: number | null, durationMs: number): number | null {
  if (completionTokens == null || durationMs <= 0) return null
  return Math.round((completionTokens / durationMs) * 1000)
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
  if (ms < 1000) return `${ms.toFixed(1)} ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)} s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}m ${rem.toFixed(1)} s`
}

/** Local wall time as `YYYY-MM-DD HH:MM:SS`. */
export function formatLocalDateTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
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
