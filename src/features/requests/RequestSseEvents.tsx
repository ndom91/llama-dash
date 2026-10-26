import { ChevronDown } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { CopyButton } from '../../components/CopyButton'
import { useStickyToggle } from '../../lib/use-sticky-toggle'
import { assembleSseText, type ParsedSseStream, parseSseStream } from './requestDetailUtils'
import { RequestSseEvent } from './RequestSseEvent'

type Props = {
  body: string
  stream?: ParsedSseStream | null
}

export function RequestSseEvents({ body, stream }: Props) {
  const events = useMemo(() => stream?.events ?? parseSseStream(body).events, [body, stream])
  const assembled = useMemo(
    () => assembleSseText({ events, latestTimingData: stream?.latestTimingData ?? null }),
    [events, stream],
  )
  const [open, toggleOpen] = useStickyToggle('requests-assembled-text-open', false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualized = events.length > 100
  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 160,
    overscan: 5,
    enabled: virtualized,
    initialRect: { width: 0, height: 600 },
  })
  if (events.length === 0) return <>{body}</>
  return (
    <div className="flex min-h-[50%] min-w-0 flex-1 flex-col">
      {assembled ? (
        <div className="t-acc m-2 shrink-0 overflow-hidden rounded-sm border border-border text-xs" data-open={open}>
          <div className="flex w-full items-center bg-surface-0">
            <button
              type="button"
              className="t-acc-head flex flex-1 items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-fg-dim hover:bg-surface-1"
              onClick={toggleOpen}
              aria-expanded={open}
              aria-controls="request-sse-assembled"
            >
              <span className="t-acc-chevron">
                <ChevronDown className="size-3 shrink-0" strokeWidth={2} />
              </span>
              <span>assembled text</span>
              <span className="dim normal-case tracking-normal">{assembled.length.toLocaleString()} chars</span>
            </button>
            <CopyButton text={assembled} variant="icon" icon="clipboard" ariaLabel="Copy assembled text" />
          </div>
          <div id="request-sse-assembled" className="t-acc-panel" aria-hidden={!open}>
            <div className="t-acc-panel-inner">
              <pre className="m-0 max-h-[300px] overflow-y-auto border-t border-border px-3 py-2.5 font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-words text-fg">
                {assembled}
              </pre>
            </div>
          </div>
        </div>
      ) : null}
      <div ref={scrollRef} className="body-pre min-h-0 flex-1 border-t-0">
        <ul
          className="relative m-0 w-full list-none p-0"
          aria-label={`${events.length} SSE events`}
          style={virtualized ? { height: virtualizer.getTotalSize() } : undefined}
        >
          {virtualized
            ? virtualizer.getVirtualItems().map((item) => (
                <li
                  key={item.key}
                  data-index={item.index}
                  ref={virtualizer.measureElement}
                  aria-posinset={item.index + 1}
                  aria-setsize={events.length}
                  className="absolute top-0 left-0 w-full pb-2"
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  <RequestSseEvent event={events[item.index]} />
                </li>
              ))
            : events.map((event, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: captured event order is immutable
                <li key={index}>
                  <RequestSseEvent event={event} />
                </li>
              ))}
        </ul>
      </div>
    </div>
  )
}
