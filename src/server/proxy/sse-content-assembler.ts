type RawJson = Record<string, unknown>

const asRecord = (v: unknown): RawJson | null => (v && typeof v === 'object' ? (v as RawJson) : null)

/** Single assembled tool call (normalized across protocols). */
export type AssembledToolCall = {
  id: string
  type: string
  name: string
  /** JSON arguments / input string. */
  input: string
}

/** Single assembled citation (Anthropic file citation). */
export type AssembledCitation = {
  type: string
  cited_content: string
  title: string | null
  url: string | null
}

/**
 * Accumulates human-readable reasoning + response text, tool calls, and
 * citations from an SSE stream.  Unbounded — kept separate from
 * BoundedTextCapture so assembled text survives max-stored-body truncation.
 */
export class SseContentAssembler {
  private buf = ''
  private reasoning = ''
  private response = ''

  // OpenAI tool-call accumulator: keyed by index
  private openaiToolCalls: Map<number, AssembledToolCall> = new Map()
  // Anthropic tool-call accumulator: keyed by content_block_index
  private anthropicToolCalls: Map<number, AssembledToolCall> = new Map()
  // Anthropic citation accumulator: keyed by content_block_index
  private anthropicCitations: Map<number, AssembledCitation> = new Map()

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

  result(): {
    reasoning: string | null
    response: string | null
    toolCalls: AssembledToolCall[] | null
    citations: AssembledCitation[] | null
  } {
    if (this.buf.length > 0) {
      this.processEvent(this.buf)
      this.buf = ''
    }
    const toolCalls = mergeToolCalls(this.openaiToolCalls, this.anthropicToolCalls)
    const citations = mapValues(this.anthropicCitations)
    return {
      reasoning: this.reasoning.length > 0 ? this.reasoning : null,
      response: this.response.length > 0 ? this.response : null,
      toolCalls,
      citations: citations.length > 0 ? citations : null,
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
        accumulateToolCalls(body, this.openaiToolCalls, this.anthropicToolCalls, this.anthropicCitations)
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

// ----------------------------------------------------------------
// Tool-call accumulation
// ----------------------------------------------------------------

function accumulateToolCalls(
  body: RawJson,
  openai: Map<number, AssembledToolCall>,
  anthropic: Map<number, AssembledToolCall>,
  citations: Map<number, AssembledCitation>,
) {
  // OpenAI: delta.tool_calls[]
  const choices = body.choices
  if (Array.isArray(choices)) {
    for (const choice of choices) {
      const delta = asRecord(asRecord(choice)?.delta)
      if (!delta) continue
      const toolCalls = delta.tool_calls
      if (!Array.isArray(toolCalls)) continue
      for (const tc of toolCalls) {
        const tcRec = asRecord(tc)
        if (!tcRec) continue
        const index = tcRec.index
        if (typeof index !== 'number') continue

        let entry = openai.get(index)
        if (!entry) {
          entry = {
            id: typeof tcRec.id === 'string' ? tcRec.id : '',
            type: typeof tcRec.type === 'string' ? tcRec.type : 'function',
            name: '',
            input: '',
          }
          openai.set(index, entry)
        }

        // Update id/type if provided (usually in first delta)
        if (typeof tcRec.id === 'string' && entry.id === '') entry.id = tcRec.id
        if (typeof tcRec.type === 'string' && entry.type === 'function') entry.type = tcRec.type

        const fn = asRecord(tcRec.function)
        if (fn) {
          if (typeof fn.name === 'string' && entry.name === '') entry.name = fn.name
          if (typeof fn.arguments === 'string') entry.input += fn.arguments
        }
      }
    }
    return
  }

  // Anthropic: content_block_start for tool_use
  if (body.type === 'content_block_start') {
    const block = asRecord(body.delta)
    if (!block) return
    const idx = body.content_block_index
    if (typeof idx !== 'number') return

    if (block.type === 'tool_use') {
      const entry: AssembledToolCall = {
        id: typeof block.id === 'string' ? block.id : '',
        type: 'function',
        name: typeof block.name === 'string' ? block.name : '',
        input: '',
      }
      anthropic.set(idx, entry)
    }

    // Anthropic: file citation
    if (block.type === 'file_citation') {
      const citedContents = block.cited_content
      if (Array.isArray(citedContents) && citedContents.length > 0) {
        const first = asRecord(citedContents[0])
        if (first) {
          citations.set(idx, {
            type: typeof block.type === 'string' ? block.type : 'file_citation',
            cited_content: typeof first.cited_content === 'string' ? first.cited_content : '',
            title: typeof first.title === 'string' ? first.title : null,
            url: typeof first.url === 'string' ? first.url : null,
          })
        }
      }
    }
    return
  }

  // Anthropic: content_block_delta for input_json_delta
  if (body.type === 'content_block_delta') {
    const delta = asRecord(body.delta)
    if (!delta) return
    const idx = body.content_block_index
    if (typeof idx !== 'number') return

    if (delta.type === 'input_json_delta' && typeof delta.partial_json === 'string') {
      const entry = anthropic.get(idx)
      if (entry) {
        entry.input += delta.partial_json
      }
    }
    return
  }
}

// ----------------------------------------------------------------
// Merge helpers
// ----------------------------------------------------------------

function mergeToolCalls(
  openai: Map<number, AssembledToolCall>,
  anthropic: Map<number, AssembledToolCall>,
): AssembledToolCall[] | null {
  const all = [...mapValues(openai), ...mapValues(anthropic)]
  return all.length > 0 ? all : null
}

function mapValues<T>(map: Map<number, T>): T[] {
  const keys = [...map.keys()].sort((a, b) => a - b)
  return keys.map((k) => map.get(k)!).filter(Boolean)
}
