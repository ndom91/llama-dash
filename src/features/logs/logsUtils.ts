export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'TRACE'

export const SOURCE_LABEL = {
  upstream: 'llama.cpp',
  proxy: 'llama-swap',
} as const

/**
 * Only WARN and ERROR get colour. INFO used to be `text-info` (blue), which
 * painted the most common level — the one that means "nothing to see here" —
 * more brightly than DEBUG, and turned the level gutter into a solid blue column
 * on any info-heavy stream. Colour here means "look at this".
 */
export const LEVEL_CLASS: Record<LogLevel, string> = {
  INFO: 'text-fg-dim',
  WARN: 'text-warn',
  ERROR: 'text-err',
  DEBUG: 'text-fg-faint',
  TRACE: 'text-fg-faint',
}

/** llama-swap's own format: a bracketed level at the start of the line. */
const LEVEL_RE = /^\s*\[(INFO|WARN|WARNING|ERROR|ERR|DEBUG|DBG|TRACE|TRC|FATAL)\]\s*/i

/**
 * llama.cpp / llama-server writes severity as a single letter between its own
 * uptime timestamp and the component name, e.g.
 *   `4801.04.670.511 W srv   alloc: - making room for prompt cache entry`
 * Without this branch those lines parse as level-less, which previously meant
 * they were all labelled a fabricated `DEBUG` — so genuine warnings were
 * indistinguishable from trace spam. The marker is left in `rest` because the
 * timestamp+letter is one unit in the raw line and clipping only the letter
 * reads worse than leaving it.
 */
const UPSTREAM_LEVEL_RE = /^\s*[\d.]+\s+([IWED])\s/

const CHAR_LEVEL: Record<string, LogLevel> = {
  I: 'INFO',
  W: 'WARN',
  E: 'ERROR',
  D: 'DEBUG',
}

/**
 * Extracts severity from a raw log line. Returns `level: null` when the line
 * carries no severity marker — callers must render that as blank rather than
 * substituting a default, because a guessed level is indistinguishable from a
 * parsed one.
 */
export function parseLogLevel(text: string): { level: LogLevel | null; rest: string } {
  const m = text.match(LEVEL_RE)
  if (!m) {
    const upstream = text.match(UPSTREAM_LEVEL_RE)
    if (upstream) return { level: CHAR_LEVEL[upstream[1]], rest: text }
    return { level: null, rest: text }
  }
  const raw = m[1].toUpperCase()
  let level: LogLevel = 'INFO'
  if (raw === 'WARN' || raw === 'WARNING') level = 'WARN'
  else if (raw === 'ERROR' || raw === 'ERR' || raw === 'FATAL') level = 'ERROR'
  else if (raw === 'DEBUG' || raw === 'DBG') level = 'DEBUG'
  else if (raw === 'TRACE' || raw === 'TRC') level = 'TRACE'
  return { level, rest: text.slice(m[0].length) }
}

export function formatLogTime(ts: number) {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}
