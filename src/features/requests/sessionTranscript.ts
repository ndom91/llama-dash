import type { ApiRequest } from '../../lib/schemas/request'
import { parseSseStream } from './requestDetailUtils'
import { capturedInput } from './sessionMessages'

export type CapturedRequest = ApiRequest & {
  clientUserAgent?: string | null
  payloads: { requestBody: string | null; responseBody: string | null }
}
export type TranscriptPart = {
  kind: 'message' | 'tool' | 'result' | 'thinking'
  role: string
  text: string
  name?: string
  id?: string
  isError?: boolean
}
export type TranscriptInput = {
  raw: unknown[]
  parts: TranscriptPart[][]
  complete: boolean
  system: string | null
  tools: number
  contexts: TranscriptContext[]
}

export type TranscriptContext = {
  kind: 'system' | 'tools' | 'reminder'
  label: string
  text: string
  changed?: boolean
}

function stripReminders(value: string): string {
  return value.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, '').trim()
}
function reminders(raw: unknown[]): TranscriptContext[] {
  const found = new Map<string, TranscriptContext>()
  for (const item of raw) {
    if (!item || typeof item !== 'object' || (item as { role?: string }).role !== 'user') continue
    const content = text((item as { content?: unknown }).content)
    for (const match of content.matchAll(/<system-reminder>([\s\S]*?)<\/system-reminder>/gi)) {
      const value = match[1].trim()
      const label =
        value.match(/(?:[~/.\w-]+\/)?CLAUDE\.md/i)?.[0] ??
        (/attribution/i.test(value) ? 'attribution' : 'system reminder')
      found.set(`${label}:${value}`, { kind: 'reminder', label, text: value })
    }
  }
  return [...found.values()]
}

function text(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join('\n')
  if (!value || typeof value !== 'object') return ''
  const item = value as Record<string, unknown>
  if (typeof item.text === 'string') return item.text
  if (typeof item.content === 'string') return item.content
  if (Array.isArray(item.content)) return text(item.content)
  if (typeof item.output === 'string') return item.output
  return ''
}

function partsForItem(value: unknown): TranscriptPart[] {
  if (!value || typeof value !== 'object') return []
  const item = value as Record<string, unknown>
  const type = typeof item.type === 'string' ? item.type : ''
  const role = typeof item.role === 'string' ? item.role : 'assistant'
  if (role === 'system' || role === 'developer') return []
  if (type === 'function_call' || type === 'tool_use') {
    const input = item.arguments ?? item.input
    return [
      {
        kind: 'tool',
        role: 'assistant',
        name: String(item.name ?? 'tool'),
        id: typeof (item.call_id ?? item.id) === 'string' ? String(item.call_id ?? item.id) : undefined,
        text: typeof input === 'string' ? input : JSON.stringify(input ?? {}, null, 2),
      },
    ]
  }
  if (type === 'function_call_output' || type === 'tool_result' || role === 'tool') {
    return [
      {
        kind: 'result',
        role: 'tool',
        name: typeof item.name === 'string' ? item.name : undefined,
        id:
          typeof (item.tool_use_id ?? item.call_id ?? item.tool_call_id) === 'string'
            ? String(item.tool_use_id ?? item.call_id ?? item.tool_call_id)
            : undefined,
        isError: item.is_error === true,
        text: text(item) || JSON.stringify(item, null, 2),
      },
    ]
  }
  if (type === 'thinking' || type === 'reasoning') {
    const content = text(item.summary ?? item.thinking ?? item.content)
    return content ? [{ kind: 'thinking', role: 'assistant', text: content }] : []
  }
  if (Array.isArray(item.content)) {
    return item.content.flatMap((block) => {
      if (!block || typeof block !== 'object') return []
      const b = block as Record<string, unknown>
      if (b.type === 'tool_use' || b.type === 'tool_result' || b.type === 'thinking') return partsForItem(b)
      const content = role === 'user' ? stripReminders(text(block)) : text(block)
      return content ? [{ kind: 'message' as const, role, text: content }] : []
    })
  }
  const content = role === 'user' ? stripReminders(text(item)) : text(item)
  const out: TranscriptPart[] = content ? [{ kind: 'message', role, text: content }] : []
  if (Array.isArray(item.tool_calls))
    for (const call of item.tool_calls) {
      const fn = (call as { function?: { name?: string; arguments?: string } })?.function
      if (fn)
        out.push({
          kind: 'tool',
          role: 'assistant',
          name: fn.name ?? 'tool',
          text: fn.arguments ?? '',
          id: typeof (call as { id?: unknown }).id === 'string' ? (call as { id: string }).id : undefined,
        })
    }
  return out
}

export function parseTranscriptInput(body: string | null): TranscriptInput {
  if (!body) return { raw: [], parts: [], complete: false, system: null, tools: 0, contexts: [] }
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>
    const input = parsed.messages ?? parsed.input
    const raw = typeof input === 'string' ? [{ role: 'user', content: input }] : Array.isArray(input) ? input : []
    const system = text(parsed.system ?? parsed.instructions) || null
    const toolText = Array.isArray(parsed.tools) && parsed.tools.length ? JSON.stringify(parsed.tools, null, 2) : null
    const inputSystems: TranscriptContext[] = raw.flatMap((value) => {
      if (!value || typeof value !== 'object') return []
      const message = value as Record<string, unknown>
      if (message.role !== 'system' && message.role !== 'developer') return []
      const content = text(message.content)
      return content ? [{ kind: 'system' as const, label: `${message.role} prompt`, text: content }] : []
    })
    const contexts: TranscriptContext[] = [
      ...(system ? [{ kind: 'system' as const, label: 'system prompt', text: system }] : []),
      ...inputSystems,
      ...(toolText
        ? [{ kind: 'tools' as const, label: `${(parsed.tools as unknown[]).length} schemas`, text: toolText }]
        : []),
      ...reminders(raw),
    ]
    return {
      raw,
      parts: raw.map(partsForItem),
      complete: Array.isArray(input) || typeof input === 'string',
      system,
      tools: Array.isArray(parsed.tools) ? parsed.tools.length : 0,
      contexts,
    }
  } catch {
    const raw = capturedInput(body)
    return { raw, parts: raw.map(partsForItem), complete: false, system: null, tools: 0, contexts: reminders(raw) }
  }
}

// A reset is only asserted when both snapshots are complete; a truncated prefix
// cannot establish whether missing history was replaced.
function sameValue(a: unknown, b: unknown): boolean {
  const pending: Array<[unknown, unknown]> = [[a, b]]
  while (pending.length) {
    const [left, right] = pending.pop()!
    if (left === right) continue
    if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false
    if (Array.isArray(left) || Array.isArray(right)) {
      if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false
      for (let index = 0; index < left.length; index++) pending.push([left[index], right[index]])
    } else {
      const l = left as Record<string, unknown>,
        r = right as Record<string, unknown>
      const keys = Object.keys(l)
      if (keys.length !== Object.keys(r).length) return false
      for (const key of keys) {
        if (!Object.hasOwn(r, key)) return false
        pending.push([l[key], r[key]])
      }
    }
  }
  return true
}

export function diffTranscript(
  previous: TranscriptInput | null,
  current: TranscriptInput,
  previousResponse: TranscriptPart[] = [],
): { parts: TranscriptPart[]; replaced: number | null } {
  if (!previous) return { parts: current.parts.flat(), replaced: null }
  let common = 0
  while (
    common < previous.raw.length &&
    common < current.raw.length &&
    sameValue(previous.raw[common], current.raw[common])
  )
    common++
  const reset = previous.complete && current.complete && common < previous.raw.length
  const parts = current.parts.slice(reset ? 0 : common).flat()
  if (!reset && common > 0) {
    const unmatched = [...previousResponse]
    while (parts[0]) {
      const candidate = parts[0]
      const index = unmatched.findIndex(
        (part) =>
          part.kind === candidate.kind &&
          part.role === candidate.role &&
          part.text === candidate.text &&
          part.name === candidate.name &&
          (part.id || candidate.id ? part.id != null && part.id === candidate.id : true),
      )
      if (index < 0) break
      unmatched.splice(index, 1)
      parts.shift()
    }
  }
  return { parts, replaced: reset ? previous.raw.length - common : null }
}

export function parseTranscriptResponse(body: string | null, streamed: boolean): TranscriptPart[] {
  if (!body) return []
  if (!streamed && !/^(?:event|data):/m.test(body.slice(0, 128))) {
    try {
      const data = JSON.parse(body) as Record<string, unknown>
      if (Array.isArray(data.choices))
        return data.choices.flatMap((choice: { message?: unknown }) => partsForItem(choice.message))
      if (Array.isArray(data.output)) return data.output.flatMap(partsForItem)
      return partsForItem({ role: 'assistant', content: data.content ?? data.output_text })
    } catch {
      return []
    }
  }
  const stream = parseSseStream(body)
  const parts: TranscriptPart[] = []
  let completedOutput: TranscriptPart[] | null = null
  const slots = new Map<string, TranscriptPart>()
  const slot = (key: string, initial: TranscriptPart) => {
    const existing = slots.get(key)
    if (existing) return existing
    slots.set(key, initial)
    parts.push(initial)
    return initial
  }
  const addCompleted = (candidate: TranscriptPart) => {
    const existing = parts.find(
      (part) =>
        part.kind === candidate.kind &&
        (candidate.id ? part.id === candidate.id : part.text === candidate.text && part.name === candidate.name),
    )
    if (!existing) parts.push(candidate)
  }
  for (const event of stream.events) {
    const data = event.parsedData
    if (!data) continue
    const type = data.type
    const outputIndex = Number(data.output_index ?? 0)
    const contentIndex = Number(data.content_index ?? 0)
    if (type === 'response.output_text.delta' && typeof data.delta === 'string') {
      slot(`text:${outputIndex}:${contentIndex}`, { kind: 'message', role: 'assistant', text: '' }).text += data.delta
    }
    if (type === 'response.output_text.done' && typeof data.text === 'string') {
      const part = slot(`text:${outputIndex}:${contentIndex}`, { kind: 'message', role: 'assistant', text: '' })
      if (!part.text) part.text = data.text
    }
    if (type === 'response.reasoning_summary_text.delta' && typeof data.delta === 'string') {
      slot(`reasoning:${outputIndex}:${Number(data.summary_index ?? 0)}`, {
        kind: 'thinking',
        role: 'assistant',
        text: '',
      }).text += data.delta
    }
    if (type === 'response.output_item.added' || type === 'response.output_item.done') {
      const item = data.item as Record<string, unknown> | undefined
      if (item?.type === 'function_call') {
        const normalized = partsForItem(item)[0]
        const part = slot(`tool:${outputIndex}`, normalized)
        if (type === 'response.output_item.done') Object.assign(part, normalized)
      } else if (type === 'response.output_item.done' && item?.type === 'message') {
        for (const [index, candidate] of partsForItem(item).entries()) {
          const part = slot(`text:${outputIndex}:${index}`, candidate)
          if (!part.text) part.text = candidate.text
        }
      } else if (
        type === 'response.output_item.done' &&
        item?.type === 'reasoning' &&
        ![...slots.keys()].some((key) => key.startsWith(`reasoning:${outputIndex}:`))
      ) {
        for (const candidate of partsForItem(item)) addCompleted(candidate)
      }
    }
    if (type === 'response.function_call_arguments.delta' && typeof data.delta === 'string') {
      slot(`tool:${outputIndex}`, { kind: 'tool', role: 'assistant', name: 'tool', text: '' }).text += data.delta
    }
    if (Array.isArray(data.choices))
      for (const choice of data.choices as Array<{
        index?: number
        delta?: {
          content?: string
          tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>
        }
      }>) {
        const choiceIndex = choice.index ?? 0
        if (choice.delta?.content)
          slot(`chat-text:${choiceIndex}`, { kind: 'message', role: 'assistant', text: '' }).text +=
            choice.delta.content
        for (const tool of choice.delta?.tool_calls ?? []) {
          const part = slot(`chat-tool:${choiceIndex}:${tool.index ?? 0}`, {
            kind: 'tool',
            role: 'assistant',
            name: '',
            text: '',
          })
          if (tool.id) part.id = tool.id
          part.name = (part.name ?? '') + (tool.function?.name ?? '')
          part.text += tool.function?.arguments ?? ''
        }
      }
    if (type === 'content_block_start') {
      const block = data.content_block as
        | { type?: string; name?: string; id?: string; text?: string; thinking?: string; input?: unknown }
        | undefined
      if (block?.type === 'text' || block?.type === 'thinking' || block?.type === 'tool_use') {
        const initialInput =
          block.input && Object.keys(block.input as object).length ? JSON.stringify(block.input, null, 2) : ''
        slot(`block:${Number(data.index ?? 0)}`, {
          kind: block.type === 'text' ? 'message' : block.type === 'thinking' ? 'thinking' : 'tool',
          role: 'assistant',
          name: block.name,
          id: block.id,
          text: block.text ?? block.thinking ?? initialInput,
        })
      }
    }
    if (type === 'content_block_delta') {
      const delta = data.delta as { type?: string; text?: string; thinking?: string; partial_json?: string } | undefined
      if (
        delta &&
        (delta.type === 'text_delta' || delta.type === 'thinking_delta' || delta.type === 'input_json_delta')
      ) {
        const kind = delta.type === 'text_delta' ? 'message' : delta.type === 'thinking_delta' ? 'thinking' : 'tool'
        const part = slot(`block:${Number(data.index ?? 0)}`, { kind, role: 'assistant', text: '' })
        part.text += delta.text ?? delta.thinking ?? delta.partial_json ?? ''
      }
    }
    if (type === 'response.completed') {
      const response = data.response as { output?: unknown[] } | undefined
      if (Array.isArray(response?.output)) completedOutput = response.output.flatMap(partsForItem)
    }
  }
  if (completedOutput?.length) {
    const extras = parts.filter(
      (part) =>
        !completedOutput!.some(
          (candidate) =>
            candidate.kind === part.kind &&
            (candidate.id ? candidate.id === part.id : candidate.text === part.text && candidate.name === part.name),
        ),
    )
    const hasFinalText = completedOutput.some((part) => part.kind === 'message')
    return [
      ...extras.filter((part) => part.kind === 'thinking' || (part.kind === 'message' && !hasFinalText)),
      ...completedOutput,
      ...extras.filter((part) => part.kind !== 'thinking' && part.kind !== 'message'),
    ]
  }
  return parts.filter((part) => part.text || part.kind === 'tool')
}

// Anthropic reports cached input separately; OpenAI includes it in input tokens.
export function sessionInputTokens(
  request: Pick<ApiRequest, 'endpoint' | 'promptTokens' | 'cacheReadTokens' | 'cacheCreationTokens'>,
): number | null {
  if (request.promptTokens == null) return null
  return request.endpoint?.startsWith('/v1/messages')
    ? request.promptTokens + (request.cacheReadTokens ?? 0) + (request.cacheCreationTokens ?? 0)
    : request.promptTokens
}

export function sideRequest(
  request: Pick<CapturedRequest, 'endpoint' | 'statusCode' | 'model'>,
  input: TranscriptInput,
): 'title' | 'probe' | 'helper' | 'count' | null {
  if (request.endpoint?.endsWith('/count_tokens')) return 'count'
  const prompt = input.parts
    .flat()
    .map((part) => part.text)
    .join(' ')
  if (
    /\b(?:generate|create|write|provide)\b.{0,80}\b(?:title|conversation name)\b|\btitle\b.{0,80}\b(?:conversation|chat)\b/i.test(
      prompt,
    ) &&
    prompt.length < 4000
  )
    return 'title'
  if (
    request.statusCode === 429 &&
    ((input.complete && input.raw.length === 0) || /\b(?:quota|rate.?limit|probe)\b/i.test(prompt)) &&
    prompt.length < 2000
  )
    return 'probe'
  if (
    /\b(?:subagent|summarize|summarise|classify)\b/i.test(prompt) &&
    /haiku/i.test(request.model ?? '') &&
    input.raw.length <= 2 &&
    prompt.length < 4000
  )
    return 'helper'
  return null
}
