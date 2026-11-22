// llama-swap's rfc3339/rfc3339nano formats carry a date and UTC offset, so
// replayed history can be parsed without guessing the day or server timezone.
const TIMESTAMP_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2}))\s+/

export function parseLogTimestamp(text: string): { ts: number | null; rest: string } {
  const match = text.match(TIMESTAMP_RE)
  if (match) {
    const ts = Date.parse(match[1])
    if (Number.isFinite(ts)) return { ts, rest: text.slice(match[0].length) }
  }
  // In particular, llama.cpp's process uptime is not a wall-clock timestamp.
  return { ts: null, rest: text }
}
