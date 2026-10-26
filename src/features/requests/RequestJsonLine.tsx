import { memo, useMemo } from 'react'

const JSON_TOKEN = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b|(true|false|null)\b|([[\]{}.,:])/g

export const RequestJsonLine = memo(function RequestJsonLine({ line }: { line: string }) {
  const elements = useMemo(() => highlightJsonLine(line), [line])
  return <div className="whitespace-pre-wrap break-all">{elements}</div>
})

function highlightJsonLine(line: string): Array<React.ReactElement | string> | string {
  if (line.length === 0) return '\u00a0'

  const out: Array<React.ReactElement | string> = []
  let index = 0
  JSON_TOKEN.lastIndex = 0

  for (let match = JSON_TOKEN.exec(line); match !== null; match = JSON_TOKEN.exec(line)) {
    if (match.index > index) out.push(line.slice(index, match.index))
    index = match.index + match[0].length

    const [, str, colon, num, bool, punct] = match
    if (str) {
      const cls = colon ? 'jh-key' : 'jh-str'
      out.push(
        <span key={index} className={cls}>
          {str}
        </span>,
      )
      if (colon) out.push(colon)
      continue
    }

    if (num) {
      out.push(
        <span key={index} className="jh-num">
          {num}
        </span>,
      )
      continue
    }

    if (bool) {
      out.push(
        <span key={index} className="jh-bool">
          {bool}
        </span>,
      )
      continue
    }

    if (punct) {
      out.push(
        <span key={index} className="jh-punct">
          {punct}
        </span>,
      )
    }
  }

  if (index < line.length) out.push(line.slice(index))
  return out
}
