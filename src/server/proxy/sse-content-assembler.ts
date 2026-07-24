type RawJson = Record<string, unknown>

const asRecord = (v: unknown): RawJson | null => (v && typeof v === 'object' ? (v as RawJson) : null)

/**
 * Accumulates human-readable reasoning + response text from an SSE stream.
 * Unbounded — kept separate from BoundedTextCapture so assembled text survives
 * max-stored-body truncation of the raw SSE payload.
 */
export class SseContentAssembler {
  private buf = ''
  private reasoning = ''
  private response = ''

  feed(chunk: string) {
    if (!chunk) return
    this.buf += chunk
    for (;;) {
      const idx = this.buf.indexOf('\n\n')
      if (idx === -1) break
      this.processEvent(this.buf.slice(0, idx))
      this.buf = this.buf.slice(idx + 2)
    }
  }

  result(): { reasoning: string | null; response: string | null } {
    if (this.buf.length > 0) {
      this.processEvent(this.buf)
      this.buf = ''
    }
    return {
      reasoning: this.reasoning.length > 0 ? this.reasoning : null,
      response: this.response.length > 0 ? this.response : null,
    }
  }

  private processEvent(event: string) {
    for (const line of event.split('\n')) {
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        const body = JSON.parse(payload) as RawJson
        appendDelta(body, (kind, text) => {
          if (kind === 'reasoning') this.reasoning += text
          else this.response += text
        })
      } catch {
        // ignore malformed chunks
      }
    }
  }
}

function appendDelta(body: RawJson, push: (kind: 'reasoning' | 'content', text: string) => void) {
  const choices = body.choices
  if (Array.isArray(choices)) {
    for (const choice of choices) {
      const delta = asRecord(asRecord(choice)?.delta)
      if (!delta) continue
      if (typeof delta.reasoning_content === 'string' && delta.reasoning_content.length > 0) {
        push('reasoning', delta.reasoning_content)
      }
      if (typeof delta.reasoning === 'string' && delta.reasoning.length > 0) {
        push('reasoning', delta.reasoning)
      }
      if (typeof delta.content === 'string' && delta.content.length > 0) {
        push('content', delta.content)
      }
    }
    return
  }

  if (body.type === 'content_block_delta') {
    const delta = asRecord(body.delta)
    if (!delta) return
    if (delta.type === 'thinking_delta' && typeof delta.thinking === 'string' && delta.thinking.length > 0) {
      push('reasoning', delta.thinking)
    }
    if (delta.type === 'text_delta' && typeof delta.text === 'string' && delta.text.length > 0) {
      push('content', delta.text)
    }
  }
}
