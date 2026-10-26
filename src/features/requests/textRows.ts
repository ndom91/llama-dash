export const MAX_TEXT_ROW_CHARS = 1024

export type TextRow = { start: number; end: number; chunked: boolean }

export function splitTextRows(text: string): { rows: TextRow[]; hasChunks: boolean } {
  const rows: TextRow[] = []
  let hasChunks = false
  let lineStart = 0
  while (lineStart <= text.length) {
    const newline = text.indexOf('\n', lineStart)
    const lineEnd = newline === -1 ? text.length : newline
    const chunked = lineEnd - lineStart > MAX_TEXT_ROW_CHARS
    hasChunks ||= chunked
    if (lineStart === lineEnd) rows.push({ start: lineStart, end: lineEnd, chunked: false })
    for (let start = lineStart; start < lineEnd; ) {
      let end = Math.min(start + MAX_TEXT_ROW_CHARS, lineEnd)
      // Keep a UTF-16 surrogate pair in the same rendered chunk.
      if (
        end < lineEnd &&
        text.charCodeAt(end - 1) >= 0xd800 &&
        text.charCodeAt(end - 1) <= 0xdbff &&
        text.charCodeAt(end) >= 0xdc00 &&
        text.charCodeAt(end) <= 0xdfff
      )
        end--
      rows.push({ start, end, chunked })
      start = end
    }
    if (newline === -1) break
    lineStart = newline + 1
  }
  return { rows, hasChunks }
}
