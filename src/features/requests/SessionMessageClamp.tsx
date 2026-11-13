import { type ReactNode, useEffect, useId, useRef, useState } from 'react'

const COLLAPSED_HEIGHT = 280

export function SessionMessageClamp({ text, children }: { text: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false)
  const [height, setHeight] = useState(0)
  const bodyRef = useRef<HTMLDivElement>(null)
  const id = useId()
  // Remeasure when captured text changes, including without ResizeObserver.
  // biome-ignore lint/correctness/useExhaustiveDependencies: Text changes can alter the rendered height.
  useEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const measure = () => setHeight(body.scrollHeight)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(body)
    return () => observer.disconnect()
  }, [text])
  const long = height > COLLAPSED_HEIGHT
  const animated = long && text.length <= 20_000
  return (
    <>
      <div
        id={id}
        className={`session-message-clamp ${long && !expanded ? 'is-clamped' : ''} ${animated ? 'is-animated' : ''}`}
        style={animated ? { maxHeight: expanded ? height : COLLAPSED_HEIGHT } : undefined}
        onFocusCapture={() => {
          if (long) setExpanded(true)
        }}
      >
        <div ref={bodyRef}>{children}</div>
      </div>
      {long ? (
        <button
          type="button"
          className="btn btn-sm mt-2 text-info"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'show less' : 'show more'}
        </button>
      ) : null}
    </>
  )
}
