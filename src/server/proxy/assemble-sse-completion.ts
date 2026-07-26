/**
 * Assemble an OpenAI/Anthropic-compatible non-stream JSON body from an upstream
 * SSE completion stream (chat.completion.chunk / Messages stream events).
 *
 * OpenAI chat.completion:
 *   chunk.choices[].delta → message; finish_reason + usage from final chunks
 * Anthropic messages:
 *   message_start shell + content_block_* + message_delta → Message
 * OpenAI legacy completions:
 *   chunk.choices[].text / delta.text → choices[].text
 */

type RawJson = Record<string, unknown>

const asRecord = (v: unknown): RawJson | null => (v && typeof v === 'object' ? (v as RawJson) : null)

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export type AssembledNonStreamCompletion = {
  /** Protocol detected from the stream (or inferred from endpoint). */
  protocol: 'openai-chat' | 'openai-completions' | 'anthropic-messages'
  body: Record<string, unknown>
}

type OpenAiToolCallAcc = {
  id: string
  type: string
  name: string
  arguments: string
}

/**
 * Incremental SSE → final JSON completion assembler.
 * Feed raw SSE bytes/text (including `data:` lines and keep-alive comments).
 */
export class SseToJsonCompletionAssembler {
  private buf = ''
  private protocol: AssembledNonStreamCompletion['protocol'] | null = null

  // OpenAI chat / completions metadata
  private id: string | null = null
  private created: number | null = null
  private model: string | null = null
  private systemFingerprint: string | null = null
  private role = 'assistant'
  private content = ''
  private reasoningContent = ''
  private finishReason: string | null = null
  private openaiToolCalls = new Map<number, OpenAiToolCallAcc>()
  private completionText = '' // legacy /v1/completions
  private usage: Record<string, unknown> | null = null
  private timings: Record<string, unknown> | null = null

  // Anthropic
  private anthropicMessage: RawJson | null = null
  private anthropicBlocks = new Map<
    number,
    {
      type: string
      text?: string
      thinking?: string
      id?: string
      name?: string
      inputJson?: string
      signature?: string
    }
  >()
  private anthropicStopReason: string | null = null
  private anthropicStopSequence: string | null = null
  private anthropicUsage: Record<string, unknown> | null = null

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

  /**
   * Finalize. `endpoint` disambiguates openai-chat vs completions when the stream
   * never set an obvious object field.
   */
  result(endpoint: string): AssembledNonStreamCompletion | null {
    if (this.buf.trim()) {
      this.processEvent(this.buf)
      this.buf = ''
    }

    const protocol = this.protocol ?? protocolFromEndpoint(endpoint)
    if (protocol === 'anthropic-messages') {
      const body = this.buildAnthropic()
      if (!body) return null
      return { protocol, body }
    }
    if (protocol === 'openai-completions') {
      return { protocol, body: this.buildOpenAiCompletions() }
    }
    return { protocol: 'openai-chat', body: this.buildOpenAiChat() }
  }

  private processEvent(event: string) {
    for (const line of event.split('\n')) {
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        this.ingestJson(JSON.parse(payload) as RawJson)
      } catch {
        // ignore malformed chunks
      }
    }
  }

  private ingestJson(body: RawJson) {
    if (typeof body.type === 'string' && body.type.startsWith('message_')) {
      this.protocol = 'anthropic-messages'
      this.ingestAnthropic(body)
      return
    }
    if (typeof body.type === 'string' && body.type.startsWith('content_block_')) {
      this.protocol = 'anthropic-messages'
      this.ingestAnthropic(body)
      return
    }

    if (body.object === 'text_completion' || body.object === 'text_completion.chunk') {
      this.protocol = 'openai-completions'
    } else if (body.object === 'chat.completion' || body.object === 'chat.completion.chunk') {
      this.protocol = 'openai-chat'
    }

    if (typeof body.id === 'string' && !this.id) this.id = body.id
    if (typeof body.created === 'number') this.created = body.created
    if (typeof body.model === 'string') this.model = body.model
    if (typeof body.system_fingerprint === 'string') this.systemFingerprint = body.system_fingerprint

    const usage = asRecord(body.usage)
    if (usage) this.usage = { ...this.usage, ...usage }
    const timings = asRecord(body.timings)
    if (timings) this.timings = { ...this.timings, ...timings }

    const choices = body.choices
    if (!Array.isArray(choices)) return

    for (const choice of choices) {
      const ch = asRecord(choice)
      if (!ch) continue
      if (typeof ch.finish_reason === 'string') this.finishReason = ch.finish_reason

      // Legacy completions: text on choice or delta
      if (typeof ch.text === 'string') {
        this.protocol ??= 'openai-completions'
        this.completionText += ch.text
      }

      const delta = asRecord(ch.delta)
      if (delta) {
        this.protocol ??= 'openai-chat'
        if (typeof delta.role === 'string') this.role = delta.role
        if (typeof delta.content === 'string') this.content += delta.content
        if (typeof delta.reasoning_content === 'string') this.reasoningContent += delta.reasoning_content
        if (typeof delta.reasoning === 'string') this.reasoningContent += delta.reasoning
        if (typeof delta.text === 'string') {
          this.protocol = 'openai-completions'
          this.completionText += delta.text
        }
        this.accumulateOpenAiToolCalls(delta)
      }

      // Non-stream-shaped choice inside a stream (rare) — take message as-is.
      const message = asRecord(ch.message)
      if (message) {
        this.protocol ??= 'openai-chat'
        if (typeof message.role === 'string') this.role = message.role
        if (typeof message.content === 'string') this.content = message.content
        if (typeof message.reasoning_content === 'string') this.reasoningContent = message.reasoning_content
      }
    }
  }

  private accumulateOpenAiToolCalls(delta: RawJson) {
    const toolCalls = delta.tool_calls
    if (!Array.isArray(toolCalls)) return
    for (const tc of toolCalls) {
      const tcRec = asRecord(tc)
      if (!tcRec || typeof tcRec.index !== 'number') continue
      let entry = this.openaiToolCalls.get(tcRec.index)
      if (!entry) {
        entry = { id: '', type: 'function', name: '', arguments: '' }
        this.openaiToolCalls.set(tcRec.index, entry)
      }
      if (typeof tcRec.id === 'string' && !entry.id) entry.id = tcRec.id
      if (typeof tcRec.type === 'string') entry.type = tcRec.type
      const fn = asRecord(tcRec.function)
      if (fn) {
        if (typeof fn.name === 'string' && !entry.name) entry.name = fn.name
        if (typeof fn.arguments === 'string') entry.arguments += fn.arguments
      }
    }
  }

  private ingestAnthropic(body: RawJson) {
    if (body.type === 'message_start') {
      const message = asRecord(body.message)
      if (message) {
        this.anthropicMessage = { ...message, content: [] }
        if (typeof message.model === 'string') this.model = message.model
        if (typeof message.id === 'string') this.id = message.id
        const usage = asRecord(message.usage)
        if (usage) this.anthropicUsage = { ...usage }
      }
      return
    }

    if (body.type === 'content_block_start') {
      const index = typeof body.index === 'number' ? body.index : num(body.content_block_index)
      const block = asRecord(body.content_block) ?? asRecord(body.delta)
      if (index == null || !block || typeof block.type !== 'string') return
      if (block.type === 'text') {
        this.anthropicBlocks.set(index, { type: 'text', text: typeof block.text === 'string' ? block.text : '' })
      } else if (block.type === 'thinking') {
        this.anthropicBlocks.set(index, {
          type: 'thinking',
          thinking: typeof block.thinking === 'string' ? block.thinking : '',
          signature: typeof block.signature === 'string' ? block.signature : undefined,
        })
      } else if (block.type === 'tool_use') {
        this.anthropicBlocks.set(index, {
          type: 'tool_use',
          id: typeof block.id === 'string' ? block.id : '',
          name: typeof block.name === 'string' ? block.name : '',
          inputJson: '',
        })
      }
      return
    }

    if (body.type === 'content_block_delta') {
      const index = typeof body.index === 'number' ? body.index : num(body.content_block_index)
      const delta = asRecord(body.delta)
      if (index == null || !delta) return
      const entry = this.anthropicBlocks.get(index)
      if (!entry) return
      if (delta.type === 'text_delta' && typeof delta.text === 'string') {
        entry.text = (entry.text ?? '') + delta.text
      } else if (delta.type === 'thinking_delta' && typeof delta.thinking === 'string') {
        entry.thinking = (entry.thinking ?? '') + delta.thinking
      } else if (delta.type === 'signature_delta' && typeof delta.signature === 'string') {
        entry.signature = delta.signature
      } else if (delta.type === 'input_json_delta' && typeof delta.partial_json === 'string') {
        entry.inputJson = (entry.inputJson ?? '') + delta.partial_json
      }
      return
    }

    if (body.type === 'message_delta') {
      const delta = asRecord(body.delta)
      if (delta) {
        if (typeof delta.stop_reason === 'string') this.anthropicStopReason = delta.stop_reason
        if (typeof delta.stop_sequence === 'string') this.anthropicStopSequence = delta.stop_sequence
      }
      const usage = asRecord(body.usage)
      if (usage) this.anthropicUsage = { ...this.anthropicUsage, ...usage }
    }
  }

  private buildOpenAiChat(): Record<string, unknown> {
    const message: Record<string, unknown> = {
      role: this.role,
      content: this.content.length > 0 ? this.content : null,
    }
    if (this.reasoningContent.length > 0) message.reasoning_content = this.reasoningContent

    if (this.openaiToolCalls.size > 0) {
      const keys = [...this.openaiToolCalls.keys()].sort((a, b) => a - b)
      message.tool_calls = keys.map((i) => {
        const tc = this.openaiToolCalls.get(i)!
        return {
          id: tc.id || `call_${i}`,
          type: tc.type || 'function',
          function: { name: tc.name, arguments: tc.arguments },
        }
      })
    }

    const body: Record<string, unknown> = {
      id: this.id ?? `chatcmpl_assembled`,
      object: 'chat.completion',
      created: this.created ?? Math.floor(Date.now() / 1000),
      model: this.model ?? 'unknown',
      choices: [
        {
          index: 0,
          message,
          finish_reason: this.finishReason ?? 'stop',
        },
      ],
    }
    if (this.systemFingerprint) body.system_fingerprint = this.systemFingerprint
    if (this.usage) {
      body.usage = normalizeOpenAiUsage(this.usage)
    }
    if (this.timings) body.timings = this.timings
    return body
  }

  private buildOpenAiCompletions(): Record<string, unknown> {
    const body: Record<string, unknown> = {
      id: this.id ?? `cmpl_assembled`,
      object: 'text_completion',
      created: this.created ?? Math.floor(Date.now() / 1000),
      model: this.model ?? 'unknown',
      choices: [
        {
          text: this.completionText || this.content,
          index: 0,
          finish_reason: this.finishReason ?? 'stop',
        },
      ],
    }
    if (this.usage) body.usage = normalizeOpenAiUsage(this.usage)
    if (this.timings) body.timings = this.timings
    return body
  }

  private buildAnthropic(): Record<string, unknown> | null {
    const base = this.anthropicMessage ? { ...this.anthropicMessage } : null
    if (!base && this.anthropicBlocks.size === 0) return null

    const content: Array<Record<string, unknown>> = []
    const keys = [...this.anthropicBlocks.keys()].sort((a, b) => a - b)
    for (const i of keys) {
      const block = this.anthropicBlocks.get(i)!
      if (block.type === 'text') {
        content.push({ type: 'text', text: block.text ?? '' })
      } else if (block.type === 'thinking') {
        const thinking: Record<string, unknown> = { type: 'thinking', thinking: block.thinking ?? '' }
        if (block.signature) thinking.signature = block.signature
        content.push(thinking)
      } else if (block.type === 'tool_use') {
        let input: unknown = {}
        if (block.inputJson) {
          try {
            input = JSON.parse(block.inputJson)
          } catch {
            input = block.inputJson
          }
        }
        content.push({
          type: 'tool_use',
          id: block.id ?? `toolu_${i}`,
          name: block.name ?? '',
          input,
        })
      }
    }

    return {
      id: (typeof base?.id === 'string' ? base.id : null) ?? this.id ?? 'msg_assembled',
      type: 'message',
      role: 'assistant',
      model: (typeof base?.model === 'string' ? base.model : null) ?? this.model ?? 'unknown',
      content,
      stop_reason: this.anthropicStopReason ?? 'end_turn',
      stop_sequence: this.anthropicStopSequence,
      usage: this.anthropicUsage ?? asRecord(base?.usage) ?? { input_tokens: 0, output_tokens: 0 },
    }
  }
}

function protocolFromEndpoint(endpoint: string): AssembledNonStreamCompletion['protocol'] {
  if (endpoint === '/v1/messages' || endpoint.startsWith('/v1/messages')) return 'anthropic-messages'
  if (endpoint === '/v1/completions') return 'openai-completions'
  return 'openai-chat'
}

function normalizeOpenAiUsage(usage: Record<string, unknown>): Record<string, unknown> {
  const prompt = num(usage.prompt_tokens) ?? num(usage.input_tokens)
  const completion = num(usage.completion_tokens) ?? num(usage.output_tokens)
  const out: Record<string, unknown> = { ...usage }
  if (prompt != null) out.prompt_tokens = prompt
  if (completion != null) out.completion_tokens = completion
  if (prompt != null && completion != null) out.total_tokens = prompt + completion
  return out
}

/** Force `stream: true` on a JSON request body for upstream forwarding. */
export function forceUpstreamStream(body: Record<string, unknown>): {
  body: Record<string, unknown>
  mutated: boolean
} {
  if (body.stream === true) return { body, mutated: false }
  return { body: { ...body, stream: true }, mutated: true }
}
