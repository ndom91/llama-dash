import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { CopyButton } from '../../components/CopyButton'
import { cn } from '../../lib/cn'
import { useStickyToggle } from '../../lib/use-sticky-toggle'
import { assembleSseParts, estimateTextTokens, type ParsedSseStream, parseSseStream } from './requestDetailUtils'
import { RequestJsonHighlight } from './RequestJsonHighlight'

type Props = {
  body: string
  stream?: ParsedSseStream | null
  /** Persisted full reasoning (preferred over stream-derived when set). */
  assembledReasoning?: string | null
  /** Persisted full response (preferred over stream-derived when set). */
  assembledResponse?: string | null
}

export function RequestSseEvents({ body, stream = null, assembledReasoning = null, assembledResponse = null }: Props) {
  const events = useMemo(() => stream?.events ?? parseSseStream(body).events, [body, stream])
  const derived = useMemo(
    () => assembleSseParts({ events, latestTimingData: stream?.latestTimingData ?? null }),
    [events, stream],
  )
  const reasoning = assembledReasoning ?? derived.reasoning
  const response = assembledResponse ?? derived.response

  if (events.length === 0 && !reasoning && !response) return <>{body}</>

  return (
    <div className="sse-events">
      {reasoning ? (
        <AssembledBlock label="assembled reasoning" text={reasoning} storageKey="requests-assembled-reasoning-open" />
      ) : null}
      {response ? (
        <AssembledBlock
          label="assembled response"
          text={response}
          storageKey="requests-assembled-response-open"
          defaultOpen
        />
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

function AssembledBlock({
  label,
  text,
  storageKey,
  defaultOpen = false,
}: {
  label: string
  text: string
  storageKey: string
  defaultOpen?: boolean
}) {
  const [open, toggleOpen] = useStickyToggle(storageKey, defaultOpen)
  const tokens = estimateTextTokens(text)
  return (
    <div className="mb-2 overflow-hidden rounded-sm border border-border text-xs">
      <div className="flex w-full items-center bg-surface-0">
        <button
          type="button"
          className="flex flex-1 items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-fg-dim hover:bg-surface-1"
          onClick={toggleOpen}
        >
          <ChevronRight
            className={cn('size-3 shrink-0 transition-transform duration-150', open && 'rotate-90')}
            strokeWidth={2}
          />
          <span>{label}</span>
          <span className="dim normal-case tracking-normal">
            {tokens.toLocaleString()} {tokens === 1 ? 'token' : 'tokens'}
          </span>
        </button>
        <CopyButton text={text} variant="icon" icon="clipboard" ariaLabel={`Copy ${label}`} />
      </div>
      {open ? (
        <pre className="m-0 max-h-[300px] overflow-y-auto border-t border-border px-3 py-2.5 font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-words text-fg">
          {text}
        </pre>
      ) : null}
    </div>
  )
}
