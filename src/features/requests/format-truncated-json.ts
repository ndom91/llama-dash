// Format a captured JSON prefix without completing or repairing missing data.
export function formatTruncatedJson(text: string): string {
  const parts: string[] = []
  let depth = 0
  let inString = false
  let escaped = false
  let start = 0
  const indent = () => '  '.repeat(Math.min(depth, 32))
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') {
      inString = true
      continue
    }
    if (char === '{' || char === '[') {
      parts.push(text.slice(start, i + 1))
      depth++
      parts.push('\n', indent())
      start = i + 1
    } else if (char === '}' || char === ']') {
      parts.push(text.slice(start, i).trimStart())
      depth = Math.max(0, depth - 1)
      parts.push('\n', indent(), char)
      start = i + 1
    } else if (char === ',') {
      parts.push(text.slice(start, i + 1).trimStart(), '\n', indent())
      start = i + 1
    } else if (char === ':') {
      parts.push(text.slice(start, i + 1).trimStart(), ' ')
      start = i + 1
    }
  }
  parts.push(text.slice(start).trimStart())
  return parts.join('')
}
