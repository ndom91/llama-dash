import { ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CopyButton } from '../../components/CopyButton'
import { cn } from '../../lib/cn'
import { assembleSseText, type ParsedSseStream, parseSseStream } from './requestDetailUtils'
import { RequestJsonHighlight } from './RequestJsonHighlight'

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
  const [open, setOpen] = useState(false)
  if (events.length === 0) return <>{body}</>
  return (
    <div className="sse-events">
      {assembled ? (
        <div className="mb-2 overflow-hidden rounded-sm border border-border text-xs">
          <div className="flex w-full items-center bg-surface-0">
            <button
              type="button"
              className="flex flex-1 items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-fg-dim hover:bg-surface-1"
              onClick={() => setOpen(!open)}
            >
              <ChevronRight
                className={cn('size-3 shrink-0 transition-transform duration-150', open && 'rotate-90')}
                strokeWidth={2}
              />
              <span>output</span>
              <span className="dim normal-case tracking-normal">{assembled.length.toLocaleString()} chars</span>
            </button>
            <CopyButton text={assembled} variant="icon" icon="clipboard" ariaLabel="Copy assembled output" />
          </div>
          {open ? (
            <pre className="m-0 max-h-[300px] overflow-y-auto border-t border-border px-3 py-2.5 font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-words text-fg">
              {assembled}
            </pre>
          ) : null}
        </div>
      ) : null}
      {events.map((e, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: stream is append-only, index is stable
        <div className="sse-event" key={i}>
          {e.event != null ? (
            <div className="sse-event-head">
              <span className="sse-field">event:</span>
              <span className="sse-event-name">{e.event}</span>
            </div>
          ) : null}
          <div className="sse-event-data">
            <span className="sse-field">data:</span>{' '}
            {e.parsedData ? (
              <RequestJsonHighlight json={JSON.stringify(e.parsedData, null, 2)} />
            ) : e.isDone ? (
              <span className="sse-done">[DONE]</span>
            ) : (
              <span>{e.data}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
