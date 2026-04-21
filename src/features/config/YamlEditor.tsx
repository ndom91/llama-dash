import { useMemo, useRef } from 'react'
import { highlightYaml, highlightedToJsx } from './configUtils'

type Props = {
  value: string
  onChange: (v: string) => void
}

export function YamlEditor({ value, onChange }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)

  const lineCount = useMemo(() => value.split('\n').length, [value])
  const highlighted = useMemo(() => highlightYaml(value), [value])

  const syncScroll = () => {
    const ta = textareaRef.current
    const pre = preRef.current
    if (ta && pre) {
      pre.scrollTop = ta.scrollTop
      pre.scrollLeft = ta.scrollLeft
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.currentTarget
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const before = value.slice(0, start)
      const after = value.slice(end)
      const next = `${before}  ${after}`
      onChange(next)
      requestAnimationFrame(() => {
        ta.selectionStart = start + 2
        ta.selectionEnd = start + 2
      })
    }
  }

  return (
    <div className="flex min-h-0 flex-1 font-mono text-[13px] leading-[1.6]">
      <div
        className="flex min-w-11 flex-col overflow-hidden border-r border-border bg-surface-3 py-3 text-right text-fg-faint select-none"
        aria-hidden="true"
      >
        {Array.from({ length: lineCount }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: line numbers are sequential and never reorder
          <span key={i} className="px-2.5 pl-2 text-[11px] leading-[1.6]">
            {i + 1}
          </span>
        ))}
      </div>
      <div className="relative flex-1 overflow-hidden">
        {/* biome-ignore format: whitespace inside <pre> shifts the highlight overlay */}
        <pre ref={preRef} className="config-highlight" aria-hidden="true">{highlightedToJsx(highlighted)}{'\n'}</pre>
        <textarea
          ref={textareaRef}
          className="config-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
      </div>
    </div>
  )
}
