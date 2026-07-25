import { ChevronRight, MessageSquare, Paperclip, Terminal } from 'lucide-react'
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
  /** Persisted tool calls as JSON array string. */
  assembledToolCalls?: string | null
  /** Persisted citations as JSON array string. */
  assembledCitations?: string | null
}

export function RequestSseEvents({
  body,
  stream = null,
  assembledReasoning = null,
  assembledResponse = null,
  assembledToolCalls = null,
  assembledCitations = null,
}: Props) {
  const events = useMemo(() => stream?.events ?? parseSseStream(body).events, [body, stream])
  const derived = useMemo(
    () => assembleSseParts({ events, latestTimingData: stream?.latestTimingData ?? null }),
    [events, stream],
  )
  const reasoning = assembledReasoning ?? derived.reasoning
  const response = assembledResponse ?? derived.response

  const toolCalls = useMemo(() => parseToolCalls(assembledToolCalls), [assembledToolCalls])
  const citations = useMemo(() => parseCitations(assembledCitations), [assembledCitations])

  if (events.length === 0 && !reasoning && !response && !toolCalls && !citations) return <>{body}</>

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
      {toolCalls.length > 0 ? <ToolCallsBlock calls={toolCalls} /> : null}
      {citations.length > 0 ? <CitationsBlock citations={citations} /> : null}
      {events.length > 0 ? <SseRawEvents events={events} /> : null}
    </div>
  )
}

// ----------------------------------------------------------------
// Assembled text block (reasoning / response)
// ----------------------------------------------------------------

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
  const prettyJson = useMemo(() => {
    try {
      return JSON.parse(text) ? JSON.stringify(JSON.parse(text), null, 2) : null
    } catch {
      return null
    }
  }, [text])
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
          <span className="ml-auto dim normal-case tracking-normal">
            ({tokens.toLocaleString()} {tokens === 1 ? 'token' : 'tokens'})
          </span>
        </button>
        <CopyButton text={text} variant="icon" icon="clipboard" ariaLabel={`Copy ${label}`} />
      </div>
      {open ? (
        prettyJson ? (
          <div className="m-0 w-full overflow-visible border-t border-border px-3 py-2.5">
            <RequestJsonHighlight json={prettyJson} />
          </div>
        ) : (
          <pre className="m-0 w-full overflow-visible border-t border-border px-3 py-2.5 font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-words text-fg">
            {text}
          </pre>
        )
      ) : null}
    </div>
  )
}

// ----------------------------------------------------------------
// Tool calls block
// ----------------------------------------------------------------

type ParsedToolCall = { id: string; type: string; name: string; input: string }

function parseToolCalls(raw: string | null): ParsedToolCall[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
  } catch {
    // ignore
  }
  return []
}

function ToolCallsBlock({ calls }: { calls: ParsedToolCall[] }) {
  const [open, toggleOpen] = useStickyToggle('requests-assembled-tool-calls-open', false)
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
          <MessageSquare size={12} strokeWidth={2} aria-hidden="true" />
          <span>assembled tool calls</span>
          <span className="ml-auto dim normal-case tracking-normal">({calls.length} calls)</span>
        </button>
      </div>
      {open ? (
        <div className="w-full overflow-visible border-t border-border">
          {calls.map((call, i) => (
            <div key={i} className="border-b border-border last:border-b-0">
              <div className="flex items-center gap-1.5 bg-surface-0 px-3 py-1.5">
                <span className="font-mono text-[11px] font-medium text-fg">{call.name}</span>
                <span className="font-mono text-[10px] text-fg-faint">{call.id}</span>
              </div>
              <div className="m-0 overflow-x-auto px-3 py-2">{renderToolCallInput(call.input)}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function renderToolCallInput(input: string): React.ReactElement {
  try {
    const parsed = JSON.parse(input)
    if (parsed) {
      const pretty = JSON.stringify(parsed, null, 2)
      return <RequestJsonHighlight json={pretty} />
    }
  } catch {
    // not valid JSON
  }
  return <pre className="m-0 font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-words text-fg">{input}</pre>
}

// ----------------------------------------------------------------
// Citations block
// ----------------------------------------------------------------

type ParsedCitation = { type: string; cited_content: string; title: string | null; url: string | null }

function parseCitations(raw: string | null): ParsedCitation[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
  } catch {
    // ignore
  }
  return []
}

function CitationsBlock({ citations }: { citations: ParsedCitation[] }) {
  const [open, toggleOpen] = useStickyToggle('requests-assembled-citations-open', false)
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
          <Paperclip size={12} strokeWidth={2} aria-hidden="true" />
          <span>citations</span>
          <span className="ml-auto dim normal-case tracking-normal">({citations.length})</span>
        </button>
      </div>
      {open ? (
        <div className="w-full overflow-visible border-t border-border">
          {citations.map((c, i) => (
            <div key={i} className="border-b border-border px-3 py-2 last:border-b-0">
              {c.title ? <div className="mb-0.5 font-mono text-[11px] font-medium text-fg">{c.title}</div> : null}
              {c.url ? <div className="mb-0.5 truncate font-mono text-[10px] text-info">{c.url}</div> : null}
              <div className="font-mono text-[11px] leading-[1.5] text-fg-muted whitespace-pre-wrap break-words">
                {c.cited_content}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

// ----------------------------------------------------------------
// Raw SSE events (collapsible, default closed)
// ----------------------------------------------------------------

function SseRawEvents({ events }: { events: NonNullable<ParsedSseStream['events']> }) {
  const [open, toggleOpen] = useStickyToggle('requests-sse-raw-events-open', false)
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
          <Terminal size={12} strokeWidth={2} aria-hidden="true" />
          <span>raw SSE stream</span>
          <span className="ml-auto dim normal-case tracking-normal">({events.length} events)</span>
        </button>
      </div>
      {open ? (
        <div className="w-full overflow-visible border-t border-border px-3 py-2">
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
      ) : null}
    </div>
  )
}
