export type ChatMessage = {
  id: string
  role: 'system' | 'user' | 'assistant'
  content: string
  reasoningContent?: string
  reasoningTimeMs?: number
  metrics?: MessageMetrics
}

export type MessageMetrics = {
  ttftMs?: number
  totalMs?: number
  tokIn?: number
  tokOut?: number
  tokPerSec?: number
}

export type SamplingParams = {
  temperature: number
  topP: number
  topK: number
  maxTokens: number
  frequencyPenalty: number
  presencePenalty: number
  stopSequences: Array<string>
  seed: number | null
  n: number
  stream: boolean
  responseFormat: 'text' | 'json'
  logprobs: boolean
}

export type StreamEvent =
  | { kind: 'request-sent'; body: Record<string, unknown>; url: string; at: number }
  | { kind: 'first-byte'; at: number }
  | { kind: 'reasoning-start'; at: number }
  | { kind: 'content-start'; at: number }
  | { kind: 'timings'; promptMs?: number; predictedMs?: number; at: number }
  | { kind: 'chunk'; content: string; reasoningContent?: string; at: number }
  | { kind: 'usage'; promptTokens?: number; completionTokens?: number; at: number }
  | { kind: 'done'; finishReason?: string; at: number }
  | { kind: 'closed'; at: number }
  | { kind: 'error'; message: string; at: number }

export type StreamChunk = {
  content: string
  reasoningContent?: string
  done: boolean
  finishReason?: string
  promptTokens?: number
  completionTokens?: number
  promptMs?: number
  predictedMs?: number
}

export type StreamRequestOptions = {
  messages: Array<{ role: string; content: string }>
  model: string
  sampling: SamplingParams
  signal?: AbortSignal
  apiKey?: string
  onEvent?: (ev: StreamEvent) => void
}

function buildBody(opts: StreamRequestOptions): Record<string, unknown> {
  const s = opts.sampling
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    stream: s.stream,
    temperature: s.temperature,
    top_p: s.topP,
    top_k: s.topK,
    max_tokens: s.maxTokens,
    frequency_penalty: s.frequencyPenalty,
    presence_penalty: s.presencePenalty,
    n: s.n,
  }
  if (s.stopSequences.length > 0) body.stop = s.stopSequences
  if (s.seed != null) body.seed = s.seed
  if (s.responseFormat === 'json') body.response_format = { type: 'json_object' }
  if (s.logprobs) body.logprobs = true
  return body
}

export async function* streamChatCompletion(opts: StreamRequestOptions): AsyncGenerator<StreamChunk> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (opts.apiKey) headers.authorization = `Bearer ${opts.apiKey}`

  const body = buildBody(opts)
  const url = '/v1/chat/completions'
  opts.onEvent?.({ kind: 'request-sent', body, url, at: Date.now() })

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: opts.signal,
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    const msg = `${res.status}: ${errBody.slice(0, 300)}`
    opts.onEvent?.({ kind: 'error', message: msg, at: Date.now() })
    throw new Error(msg)
  }

  if (!res.body) {
    const msg = 'No response body'
    opts.onEvent?.({ kind: 'error', message: msg, at: Date.now() })
    throw new Error(msg)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let sawFirstByte = false
  let sawFirstContent = false
  let sawFirstReasoning = false
  let sawDone = false

  const emitChunkEvents = (chunk: StreamChunk) => {
    if (chunk.reasoningContent && !sawFirstReasoning) {
      sawFirstReasoning = true
      opts.onEvent?.({ kind: 'reasoning-start', at: Date.now() })
    }
    if (chunk.content && !sawFirstContent) {
      sawFirstContent = true
      opts.onEvent?.({ kind: 'content-start', at: Date.now() })
    }
    if (chunk.content || chunk.reasoningContent) {
      opts.onEvent?.({
        kind: 'chunk',
        content: chunk.content,
        reasoningContent: chunk.reasoningContent,
        at: Date.now(),
      })
    }
    if (chunk.promptTokens != null || chunk.completionTokens != null) {
      opts.onEvent?.({
        kind: 'usage',
        promptTokens: chunk.promptTokens,
        completionTokens: chunk.completionTokens,
        at: Date.now(),
      })
    }
    if (chunk.promptMs != null || chunk.predictedMs != null) {
      opts.onEvent?.({
        kind: 'timings',
        promptMs: chunk.promptMs,
        predictedMs: chunk.predictedMs,
        at: Date.now(),
      })
    }
    if (chunk.done && !sawDone) {
      sawDone = true
      opts.onEvent?.({ kind: 'done', finishReason: chunk.finishReason, at: Date.now() })
    }
  }

  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break

      if (!sawFirstByte) {
        sawFirstByte = true
        opts.onEvent?.({ kind: 'first-byte', at: Date.now() })
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const chunk = parseSseLine(line)
        if (!chunk) continue
        emitChunkEvents(chunk)
        yield chunk
      }
    }

    const tail = decoder.decode()
    if (tail) buffer += tail
    if (buffer.trim()) {
      const chunk = parseSseLine(buffer)
      if (chunk) {
        emitChunkEvents(chunk)
        yield chunk
      }
    }
    opts.onEvent?.({ kind: 'closed', at: Date.now() })
  } finally {
    reader.releaseLock()
  }
}

function parseSseLine(line: string): StreamChunk | null {
  const trimmed = line.trim()
  if (!trimmed?.startsWith('data: ')) return null

  const data = trimmed.slice(6)
  if (data === '[DONE]') return { content: '', done: true }

  try {
    const parsed = JSON.parse(data)
    const delta = parsed.choices?.[0]?.delta
    const finishReason = parsed.choices?.[0]?.finish_reason
    const usage = parsed.usage
    if (!delta && !usage && !finishReason) return null
    return {
      content: delta?.content ?? '',
      reasoningContent: delta?.reasoning_content,
      done: false,
      finishReason: finishReason ?? undefined,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      promptMs: parsed.timings?.prompt_ms,
      predictedMs: parsed.timings?.predicted_ms,
    }
  } catch {
    return null
  }
}
