export type ChatMessage = {
  id: string
  role: 'system' | 'user' | 'assistant'
  content: string
  reasoningContent?: string
  reasoningTimeMs?: number
}

export type StreamChunk = {
  content: string
  reasoningContent?: string
  done: boolean
}

export async function* streamChatCompletion(
  messages: Array<{ role: string; content: string }>,
  model: string,
  temperature: number,
  signal?: AbortSignal,
): AsyncGenerator<StreamChunk> {
  const res = await fetch('/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true, temperature }),
    signal,
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${res.status}: ${body.slice(0, 300)}`)
  }

  if (!res.body) {
    throw new Error('No response body')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const chunk = parseSseLine(line)
        if (chunk) yield chunk
        if (chunk?.done) return
      }
    }

    const tail = decoder.decode()
    if (tail) buffer += tail
    if (buffer.trim()) {
      const chunk = parseSseLine(buffer)
      if (chunk) yield chunk
    }
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
    if (!delta) return null
    return {
      content: delta.content ?? '',
      reasoningContent: delta.reasoning_content,
      done: false,
    }
  } catch {
    return null
  }
}
