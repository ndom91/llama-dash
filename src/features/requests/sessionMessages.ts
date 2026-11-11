import { assembleSseText, parseSseStream } from './requestDetailUtils'

export type SessionMessage = { role: string; text: string }

function contentText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(contentText).filter(Boolean).join('\n')
  if (!value || typeof value !== 'object') return ''
  const item = value as Record<string, unknown>
  if (typeof item.text === 'string') return item.text
  if (typeof item.output_text === 'string') return item.output_text
  if (Array.isArray(item.tool_calls)) {
    const content = contentText(item.content)
    return [content, JSON.stringify(item.tool_calls, null, 2)].filter(Boolean).join('\n')
  }
  if (item.content != null) return contentText(item.content)
  if (
    item.type === 'function_call' ||
    item.type === 'function_call_output' ||
    item.type === 'tool_use' ||
    item.type === 'tool_result'
  ) {
    return JSON.stringify(item, null, 2)
  }
  return ''
}

export function requestMessages(body: string | null): SessionMessage[] {
  if (!body) return []
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>
    const input = parsed.messages ?? parsed.input
    if (typeof input === 'string') return [{ role: 'user', text: input }]
    if (!Array.isArray(input)) return []
    return input.flatMap((item: unknown) => {
      if (!item || typeof item !== 'object') return []
      const message = item as Record<string, unknown>
      const role =
        typeof message.role === 'string' ? message.role : typeof message.type === 'string' ? message.type : 'input'
      const text = contentText(message)
      return text ? [{ role, text }] : []
    })
  } catch {
    return []
  }
}

export function responseText(body: string | null, streamed: boolean): string {
  if (!body) return ''
  if (streamed) return assembleSseText(parseSseStream(body))
  try {
    const data = JSON.parse(body) as Record<string, unknown>
    const choices = data.choices
    if (Array.isArray(choices))
      return choices
        .map((choice) => contentText(choice?.message?.content))
        .filter(Boolean)
        .join('\n')
    return contentText(data.content ?? data.output ?? data.output_text)
  } catch {
    return ''
  }
}
