import { memo, type ReactNode, useMemo } from 'react'
import { cn } from '../../lib/cn'

// Line-at-a-time markdown highlighting. Callers only render visible rows, so a
// multi-MB prompt costs no more than the rows on screen. Rows are capped at
// MAX_TEXT_ROW_CHARS, which bounds the regex work per row.
const HEADING = /^(\s{0,3}#{1,6})(\s.*)?$/
const QUOTE = /^(\s*>+)(.*)$/
const LIST = /^(\s*)([-*+]|\d+[.)])(\s+)(.*)$/
const RULE = /^\s*([-*_])(?:\s*\1){2,}\s*$/
const INLINE =
  /(`[^`\n]+`)|(\*\*[^*\n]+\*\*|__[^_\n]+__)|(\[[^\]\n]+\]\([^)\s]+\))|(https?:\/\/[^\s)>\]]+)|(<\/?[A-Za-z][\w:.-]*(?:\s[^<>\n]*)?\/?>)/g

export const RequestMarkdownLine = memo(function RequestMarkdownLine({
  line,
  inFence,
}: {
  line: string
  inFence: boolean
}) {
  const fenceMarker = line.trimStart().startsWith('```')
  const codeBlock = inFence || fenceMarker
  const elements = useMemo(() => (codeBlock ? line || '\u00a0' : highlightBlock(line)), [line, codeBlock])
  return (
    <div className={cn('whitespace-pre-wrap break-all', codeBlock && 'mdh-fence', fenceMarker && 'mdh-punct')}>
      {elements}
    </div>
  )
})

function highlightBlock(line: string): ReactNode {
  if (line.length === 0) return '\u00a0'
  if (RULE.test(line)) return <span className="mdh-punct">{line}</span>

  const heading = HEADING.exec(line)
  if (heading)
    return (
      <>
        <span className="mdh-punct">{heading[1]}</span>
        <span className="mdh-heading">{heading[2]}</span>
      </>
    )

  const quote = QUOTE.exec(line)
  if (quote)
    return (
      <>
        <span className="mdh-punct">{quote[1]}</span>
        <span className="mdh-quote">{highlightInline(quote[2])}</span>
      </>
    )

  const list = LIST.exec(line)
  if (list)
    return (
      <>
        {list[1]}
        <span className="mdh-list">{list[2]}</span>
        {list[3]}
        {highlightInline(list[4])}
      </>
    )

  return highlightInline(line)
}

function highlightInline(text: string): ReactNode {
  const out: ReactNode[] = []
  let index = 0
  INLINE.lastIndex = 0
  for (let match = INLINE.exec(text); match !== null; match = INLINE.exec(text)) {
    if (match.index > index) out.push(text.slice(index, match.index))
    const token = match[0]
    out.push(
      <span key={match.index} className={inlineClass(match)}>
        {token}
      </span>,
    )
    index = match.index + token.length
  }
  if (index < text.length) out.push(text.slice(index))
  return out.length === 1 ? out[0] : out
}

function inlineClass([, code, strong, link, url]: RegExpExecArray): string {
  if (code) return 'mdh-code'
  if (strong) return 'mdh-strong'
  if (link || url) return 'mdh-link'
  return 'mdh-tag'
}

/** Marks each row that sits inside a fenced code block (fence lines excluded). */
export function markdownFenceRows(text: string, rows: ReadonlyArray<{ start: number; end: number }>): Uint8Array {
  const inFence = new Uint8Array(rows.length)
  let open = false
  for (let index = 0; index < rows.length; index++) {
    const { start, end } = rows[index]
    // Continuation chunks of a long line never start a fence.
    const lineStart = start === 0 || text.charCodeAt(start - 1) === 10
    let first = start
    while (first < end && (text.charCodeAt(first) === 32 || text.charCodeAt(first) === 9)) first++
    if (lineStart && first + 3 <= end && text.startsWith('```', first)) {
      open = !open
      continue
    }
    if (open) inFence[index] = 1
  }
  return inFence
}
