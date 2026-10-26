import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useMemo, useRef } from 'react'
import { cn } from '../../lib/cn'
import { RequestJsonLine } from './RequestJsonLine'
import { splitTextRows } from './textRows'

const VIRTUALIZE_ROW_THRESHOLD = 300
const VIRTUALIZE_CHAR_THRESHOLD = 32 * 1024
const LINE_HEIGHT = 18

type Props = {
  text: string
  highlightJson?: boolean
  embedded?: boolean
  className?: string
}

export function RequestTextView({ text, highlightJson = false, embedded = false, className }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { rows, hasChunks } = useMemo(() => splitTextRows(text), [text])
  const virtualized = hasChunks || rows.length > VIRTUALIZE_ROW_THRESHOLD || text.length > VIRTUALIZE_CHAR_THRESHOLD
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const width = scrollRef.current?.clientWidth || 600
      const columns = Math.max(1, Math.floor((width - 28) / 7.2))
      return Math.max(1, Math.ceil((rows[index].end - rows[index].start) / columns)) * LINE_HEIGHT
    },
    overscan: 8,
    enabled: virtualized,
    initialRect: { width: 600, height: 400 },
  })

  useEffect(() => {
    if (!virtualized || rows.length === 0) return
    // New text can change row heights even when the number of rows is unchanged.
    virtualizer.measure()
    const element = scrollRef.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => virtualizer.measure())
    observer.observe(element)
    return () => observer.disconnect()
  }, [rows, virtualized, virtualizer])

  const renderRow = (index: number) => {
    const row = rows[index]
    const value = text.slice(row.start, row.end)
    if (highlightJson && !row.chunked) return <RequestJsonLine line={value} />
    return value || '\u00a0'
  }

  return (
    <div
      ref={scrollRef}
      data-text-view
      data-virtualized={virtualized}
      {...(virtualized ? { role: 'region', 'aria-label': 'Scrollable payload text', tabIndex: 0 } : {})}
      className={cn('body-pre min-h-0 border-t-0', !embedded && 'h-full', embedded && virtualized && 'h-80', className)}
    >
      {virtualized ? (
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => (
            <div
              key={item.key}
              data-index={item.index}
              data-text-row
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full whitespace-pre-wrap break-all"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              {renderRow(item.index)}
            </div>
          ))}
        </div>
      ) : (
        rows.map((row, index) => (
          <div key={row.start} data-text-row className="whitespace-pre-wrap break-all">
            {renderRow(index)}
          </div>
        ))
      )}
    </div>
  )
}
