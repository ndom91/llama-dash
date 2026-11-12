// Read only complete top-level input elements from a known truncated JSON prefix.
// A string-aware scan prevents matches inside instructions or nested tool schemas.
export function capturedInput(body: string): unknown[] {
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
