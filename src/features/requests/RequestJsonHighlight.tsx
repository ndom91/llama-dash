import { useVirtualizer } from '@tanstack/react-virtual'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'

const JSON_TOKEN = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b|(true|false|null)\b|([[\]{}.,:])/g

const VIRTUALIZE_LINE_THRESHOLD = 300
const LINE_HEIGHT_ESTIMATE = 18

type Props = {
  json: string
  className?: string
}

export function RequestJsonHighlight({ json, className = '' }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const lines = useMemo(() => json.split('\n'), [json])
  const shouldVirtualize = lines.length > VIRTUALIZE_LINE_THRESHOLD
  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => LINE_HEIGHT_ESTIMATE,
    overscan: 30,
  })

  useEffect(() => {
    if (shouldVirtualize) virtualizer.measure()
  }, [shouldVirtualize, virtualizer])

  const measureLine = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el || !shouldVirtualize) return
      virtualizer.measureElement(el)
    },
    [shouldVirtualize, virtualizer],
  )

  if (!shouldVirtualize) {
    return (
      <div ref={scrollRef} className={`body-pre border-t-0 h-full max-h-none min-h-0 ${className}`}>
        {lines.map((line, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: pretty-printed lines are static for a given payload
          <JsonLine key={index} line={line} />
        ))}
      </div>
    )
  }

  return (
    <div ref={scrollRef} className={`body-pre border-t-0 h-full max-h-none min-h-0 ${className}`}>
      <div className="relative min-w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => (
          <div
            key={item.index}
            data-index={item.index}
            ref={measureLine}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${item.start}px)`,
            }}
          >
            <JsonLine line={lines[item.index] ?? ''} />
          </div>
        ))}
      </div>
    </div>
  )
}

const JsonLine = memo(function JsonLine({ line }: { line: string }) {
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
