type Props = {
  text: string
  pattern: RegExp | null
}

export function HighlightedText({ text, pattern }: Props) {
  if (!pattern) return <>{text}</>

  const parts: Array<{ text: string; match: boolean; offset: number }> = []
  let lastIndex = 0
  pattern.lastIndex = 0
  for (let m = pattern.exec(text); m !== null; m = pattern.exec(text)) {
    if (m.index > lastIndex) parts.push({ text: text.slice(lastIndex, m.index), match: false, offset: lastIndex })
    parts.push({ text: m[0], match: true, offset: m.index })
    lastIndex = pattern.lastIndex
    if (m[0].length === 0) {
      pattern.lastIndex++
      if (pattern.lastIndex > text.length) break
    }
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), match: false, offset: lastIndex })
  if (parts.length === 0) return <>{text}</>

  return (
    <>
      {parts.map((p) =>
        p.match ? (
          <mark key={p.offset} className="log-match">
            {p.text}
          </mark>
        ) : (
          p.text
        ),
      )}
    </>
  )
}
