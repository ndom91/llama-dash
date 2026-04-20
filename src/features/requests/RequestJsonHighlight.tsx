import { useMemo } from 'react'

const JSON_TOKEN =
  /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b|(true|false|null)\b|([[\]{}.,:])|\n( *)/g

type Props = {
  json: string
}

export function RequestJsonHighlight({ json }: Props) {
  const elements = useMemo(() => {
    const out: Array<React.ReactElement | string> = []
    let index = 0
    JSON_TOKEN.lastIndex = 0
    for (let match = JSON_TOKEN.exec(json); match !== null; match = JSON_TOKEN.exec(json)) {
      if (match.index > index) out.push(json.slice(index, match.index))
      index = match.index + match[0].length

      const [, str, colon, num, bool, punct, indent] = match
      if (str) {
        const cls = colon ? 'jh-key' : 'jh-str'
        out.push(
          <span key={index} className={cls}>
            {str}
          </span>,
        )
        if (colon) out.push(colon)
      } else if (num) {
        out.push(
          <span key={index} className="jh-num">
            {num}
          </span>,
        )
      } else if (bool) {
        out.push(
          <span key={index} className="jh-bool">
            {bool}
          </span>,
        )
      } else if (punct) {
        out.push(
          <span key={index} className="jh-punct">
            {punct}
          </span>,
        )
      } else if (indent !== undefined) {
        out.push(`\n${indent}`)
      }
    }
    if (index < json.length) out.push(json.slice(index))
    return out
  }, [json])

  return <>{elements}</>
}
