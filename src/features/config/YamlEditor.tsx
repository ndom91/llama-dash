import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { highlightYaml, highlightedToJsx } from './configUtils'

type Props = {
  value: string
  onChange: (v: string) => void
}

export function YamlEditor({ value, onChange }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)

  const deferredValue = useDeferredValue(value)
  const lineCount = useMemo(() => countLines(value), [value])
  const highlighted = useMemo(() => highlightYaml(deferredValue), [deferredValue])

  const syncScroll = useCallback(() => {
    const ta = textareaRef.current
    const pre = preRef.current
    if (!ta || !pre) return
    // The textarea reserves space for its scrollbars; the overlay hides its own.
    // Without mirroring that gutter the overlay's client box is taller, so it
    // bottoms out a scrollbar-height early and the highlighted text drifts out
    // of alignment near the end of the file.
    pre.style.borderBottomWidth = `${ta.offsetHeight - ta.clientHeight}px`
    pre.style.borderRightWidth = `${ta.offsetWidth - ta.clientWidth}px`
    pre.scrollTop = ta.scrollTop
    pre.scrollLeft = ta.scrollLeft
  }, [])

  // No dep list: content changes are what make the scrollbars appear or
  // disappear, so the gutters have to be re-measured after every render.
  useLayoutEffect(() => {
    syncScroll()
  })

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    const observer = new ResizeObserver(syncScroll)
    observer.observe(ta)
    return () => observer.disconnect()
  }, [syncScroll])

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
        className="flex min-w-11 flex-col overflow-hidden border-r border-border bg-surface-3 py-3 text-right tabular-nums text-fg-faint select-none"
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

function countLines(value: string) {
  let lines = 1
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) === 10) lines++
  }
  return lines
}
