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

// Read only complete top-level input elements from a known truncated JSON prefix.
// A string-aware scan prevents matches inside instructions or nested tool schemas.
function capturedInput(body: string): unknown[] {
  const marker = body.match(/\r?\n\.\.\.\[truncated \d+ bytes\]$/)
  if (!marker) return []
  const text = body.slice(0, marker.index)
  let depth = 0
  let arrayStart = -1
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') {
      const start = i++
      while (i < text.length) {
        if (text[i] === '\\') i += 2
        else if (text[i] === '"') break
        else i++
      }
      if (i >= text.length) break
      if (depth === 1) {
        let key: unknown
        try {
          key = JSON.parse(text.slice(start, i + 1))
        } catch {
          continue
        }
        const tail = /^\s*:\s*\[/.exec(text.slice(i + 1))
        if ((key === 'input' || key === 'messages') && tail) {
          arrayStart = i + tail[0].length + 1
          break
        }
      }
    } else if (char === '{' || char === '[') depth++
    else if (char === '}' || char === ']') depth--
  }
  if (arrayStart < 0) return []
  const items: unknown[] = []
  let start = arrayStart
  let nested = 0
  let inString = false
  let escaped = false
  for (let i = arrayStart; i < text.length; i++) {
    const char = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
    } else if (char === '"') inString = true
    else if (char === '{' || char === '[') nested++
    else if (char === '}' || (char === ']' && nested > 0)) nested--
    else if ((char === ',' || char === ']') && nested === 0) {
      const value = text.slice(start, i).trim()
      if (value) {
        try {
          items.push(JSON.parse(value))
        } catch {
          break
        }
      }
      if (char === ']') break
      start = i + 1
    }
  }
  // A capture can end immediately after a complete item, before its comma.
  if (!inString && nested === 0 && start < text.length) {
    const last = text.slice(start).trim()
    if (last && !last.endsWith(']')) {
      try {
        items.push(JSON.parse(last))
      } catch {}
    }
  }
  return items
}

function messagesFromInput(input: unknown): SessionMessage[] {
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
}

export function requestMessages(body: string | null): SessionMessage[] {
  if (!body) return []
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>
    return messagesFromInput(parsed.messages ?? parsed.input)
  } catch {
    return messagesFromInput(capturedInput(body))
  }
}

export function responseText(body: string | null, streamed: boolean): string {
  if (!body) return ''
  if (streamed || /^(?:event|data):/m.test(body.slice(0, 128))) {
    const stream = parseSseStream(body)
    const text = assembleSseText(stream)
    const items = stream.events.flatMap(({ parsedData }) => {
      if (parsedData?.type !== 'response.output_item.done') return []
      const item = parsedData.item
      if (!item || typeof item !== 'object') return []
      const record = item as Record<string, unknown>
      if (record.type === 'function_call') return [JSON.stringify(record, null, 2)]
      if (record.type === 'reasoning') {
        const summary = contentText(record.summary)
        return summary ? [`Reasoning: ${summary}`] : []
      }
      return []
    })
    return [...(text ? [text] : []), ...items].join('\n\n')
  }
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
