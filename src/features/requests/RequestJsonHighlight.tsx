import { useVirtualizer } from '@tanstack/react-virtual'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { LongStringModal } from './LongStringModal'

const JSON_TOKEN = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b|(true|false|null)\b|([[\]{}.,:])/g

const VIRTUALIZE_LINE_THRESHOLD = 300
const LINE_HEIGHT_ESTIMATE = 18
const LONG_STRING_THRESHOLD = 64

type Props = {
  json: string
  className?: string
  /** Outer scrollport for virtualization (shared headers+body pane). */
  getScrollElement?: () => HTMLElement | null
}

export function RequestJsonHighlight({ json, className = '', getScrollElement }: Props) {
  const localScrollRef = useRef<HTMLDivElement>(null)
  const [modalText, setModalText] = useState<string | null>(null)
  const lines = useMemo(() => json.split('\n'), [json])
  const shouldVirtualize = lines.length > VIRTUALIZE_LINE_THRESHOLD
  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => getScrollElement?.() ?? localScrollRef.current,
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

  const scrollOwned = getScrollElement == null
  const rootClass = cn(
    'body-pre border-t-0 max-h-none min-h-0',
    scrollOwned ? 'h-full overflow-auto' : 'h-auto overflow-visible',
    className,
  )

  if (!shouldVirtualize) {
    return (
      <>
        <div ref={localScrollRef} className={rootClass}>
          {lines.map((line, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: pretty-printed lines are static for a given payload
            <JsonLine key={index} line={line} onLongString={setModalText} />
          ))}
        </div>
        {modalText != null ? <LongStringModal text={modalText} onClose={() => setModalText(null)} /> : null}
      </>
    )
  }

  return (
    <>
      <div ref={localScrollRef} className={rootClass}>
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
              <JsonLine line={lines[item.index] ?? ''} onLongString={setModalText} />
            </div>
          ))}
        </div>
      </div>
      {modalText != null ? <LongStringModal text={modalText} onClose={() => setModalText(null)} /> : null}
    </>
  )
}

const JsonLine = memo(function JsonLine({
  line,
  onLongString,
}: {
  line: string
  onLongString: (text: string) => void
}) {
  const elements = useMemo(() => highlightJsonLine(line, onLongString), [line, onLongString])
  return <div className="whitespace-pre-wrap break-all">{elements}</div>
})

function highlightJsonLine(
  line: string,
  onLongString: (text: string) => void,
): Array<React.ReactElement | string> | string {
  if (line.length === 0) return '\u00a0'

  const out: Array<React.ReactElement | string> = []
  let index = 0
  JSON_TOKEN.lastIndex = 0

  for (let match = JSON_TOKEN.exec(line); match !== null; match = JSON_TOKEN.exec(line)) {
    if (match.index > index) out.push(line.slice(index, match.index))
    index = match.index + match[0].length

    const [, str, colon, num, bool, punct] = match
    if (str) {
      const isKey = !!colon
      if (!isKey && str.length > LONG_STRING_THRESHOLD + 2) {
        const decoded = decodeJsonString(str)
        if (decoded.length > LONG_STRING_THRESHOLD) {
          const rawInner = str.slice(1, -1)
          const preview = rawInner.slice(0, 55)
          const charCount = decoded.length
          const keyId = `ls_${index}`
          out.push(
            <span
              key={keyId}
              role="button"
              tabIndex={0}
              className="inline-flex items-center whitespace-nowrap jh-str cursor-pointer rounded border border-border bg-surface-0 px-1 py-0.5 text-[11px] transition-[background-color,border-color] hover:border-border-strong hover:bg-surface-2 active:scale-[0.98]"
              onClick={() => onLongString(decoded)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onLongString(decoded)
                }
              }}
              title="Click to view full string"
            >
              {'"'}
              {preview}...{'"'} ({charCount} chars)
            </span>,
          )
          continue
        }
      }
      const cls = isKey ? 'jh-key' : 'jh-str'
      out.push(
        <span key={index} className={cls}>
          {str}
        </span>,
      )
      if (isKey) out.push(colon)
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

function decodeJsonString(raw: string): string {
  if (raw.length < 2 || raw[0] !== '"' || raw[raw.length - 1] !== '"') return raw
  const inner = raw.slice(1, -1)
  try {
    return JSON.parse(raw) as string
  } catch {
    return inner
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
  }
}
