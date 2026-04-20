type Token = { cls: string; text: string; offset: number } | string

export function highlightYaml(yaml: string): Array<Token> {
  const YAML_RE =
    /^(#.*)$|(^[ \t]*[\w./-]+)(?=\s*:)|(?<=:\s*)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(:\s)|(true|false|null|~)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b|(^\s*-\s)/gm
  const out: Array<Token> = []
  let i = 0
  YAML_RE.lastIndex = 0
  for (let m = YAML_RE.exec(yaml); m !== null; m = YAML_RE.exec(yaml)) {
    if (m.index > i) out.push(yaml.slice(i, m.index))
    i = m.index + m[0].length
    const [, comment, key, str, colon, bool, num, dash] = m
    if (comment) out.push({ cls: 'yh-comment', text: comment, offset: m.index })
    else if (key) out.push({ cls: 'yh-key', text: key, offset: m.index })
    else if (str) out.push({ cls: 'yh-str', text: str, offset: m.index })
    else if (colon) out.push({ cls: 'yh-punct', text: colon, offset: m.index })
    else if (bool) out.push({ cls: 'yh-bool', text: bool, offset: m.index })
    else if (num) out.push({ cls: 'yh-num', text: num, offset: m.index })
    else if (dash) out.push({ cls: 'yh-punct', text: dash, offset: m.index })
    else out.push(m[0])
  }
  if (i < yaml.length) out.push(yaml.slice(i))
  return out
}

export function highlightedToJsx(tokens: Array<Token>): Array<React.ReactElement | string> {
  return tokens.map((t) =>
    typeof t === 'string' ? (
      t
    ) : (
      <span key={t.offset} className={t.cls}>
        {t.text}
      </span>
    ),
  )
}
