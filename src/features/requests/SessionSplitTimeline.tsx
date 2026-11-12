// Captured parts and lines have stable positions and may contain duplicate text.
// biome-ignore-all lint/suspicious/noArrayIndexKey: Positions distinguish repeated captured blocks.
// biome-ignore-all lint/a11y/noStaticElementInteractions: Hover only highlights linked blocks; their buttons provide keyboard access.
import { Link } from '@tanstack/react-router'
import { Fragment, memo, useMemo, useState } from 'react'
import { formatCompactNumber, formatDuration } from '../../lib/format'
import { ContextPills, type TranscriptExchange, type TranscriptFilters, TranscriptItem } from './SessionTranscriptView'
import { parseStopReason, sessionInputTokens, sessionTitle, type TranscriptPart } from './sessionTranscript'

type Location = { requestId: string; number: number; index: number; part: TranscriptPart }
type Pair = { call?: Location; result?: Location }

function isCompacted(exchange: TranscriptExchange): boolean {
  return (
    exchange.inputDelta != null &&
    exchange.inputDelta <= -10_000 &&
    exchange.request.cacheReadTokens === 0 &&
    Boolean(sessionInputTokens(exchange.request))
  )
}

function partId(location: Location, kind: 'call' | 'result') {
  return `session-${location.requestId}-${kind}-${location.index}`
}

function jumpToPart(location: Location, kind: 'call' | 'result') {
  const target = document.getElementById(partId(location, kind))
  if (!target) return
  let parent = target.parentElement
  while (parent) {
    if (parent instanceof HTMLDetailsElement) parent.open = true
    parent = parent.parentElement
  }
  target.scrollIntoView({ block: 'center' })
}

function warnings(exchange: TranscriptExchange) {
  return (['request', 'response'] as const).flatMap((kind) => {
    const body = kind === 'request' ? exchange.request.payloads.requestBody : exchange.request.payloads.responseBody
    const match = body?.match(/\n\.\.\.\[truncated (\d+) bytes\]$/)
    if (!body || !match) return []
    const size = new TextEncoder().encode(body.slice(0, match.index)).length
    const format = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`)
    const total = size + Number(match[1])
    return [
      {
        kind,
        size,
        total,
        label: `${format(size)}/${format(total)}`,
        title: `${kind} captured ${format(size)} of ${format(total)}`,
      },
    ]
  })
}

export function SessionSplitTimeline({
  exchanges,
  filters,
  activeId,
  incomplete = false,
}: {
  exchanges: TranscriptExchange[]
  filters: TranscriptFilters
  activeId: string | null
  incomplete?: boolean
}) {
  const [hovered, setHovered] = useState<string | null>(null)
  const metadata = useMemo(
    () =>
      new Map(
        exchanges.map((exchange) => [
          exchange.request.id,
          {
            reason: parseStopReason(exchange.request.payloads.responseBody),
            warnings: warnings(exchange),
          },
        ]),
      ),
    [exchanges],
  )
  const pairs = useMemo(() => {
    const result = new Map<string, Pair>()
    for (const exchange of exchanges) {
      if (exchange.side) continue
      for (const [index, part] of exchange.responseParts.entries()) {
        if (part.kind !== 'tool' || !part.id) continue
        const pair = result.get(part.id) ?? {}
        pair.call ??= { requestId: exchange.request.id, number: exchange.number, index, part }
        result.set(part.id, pair)
      }
      for (const [index, part] of exchange.inputParts.entries()) {
        if (part.kind !== 'result' || !part.id) continue
        const pair = result.get(part.id) ?? {}
        pair.result ??= { requestId: exchange.request.id, number: exchange.number, index, part }
        result.set(part.id, pair)
      }
    }
    return result
  }, [exchanges])
  const maxLatency = Math.max(1, ...exchanges.map(({ request }) => request.durationMs))
  const groups: TranscriptExchange[][] = []
  for (const exchange of exchanges) {
    const previous = groups[groups.length - 1]
    const toolOnly = (item: TranscriptExchange) =>
      !item.side &&
      item.replaced == null &&
      !item.contexts.length &&
      !isCompacted(item) &&
      item.responseParts.some((part) => part.kind === 'tool') &&
      !item.parts.some((part) => part.kind === 'message')
    if (previous && ((exchange.side && previous[0].side) || (toolOnly(exchange) && toolOnly(previous[0]))))
      previous.push(exchange)
    else groups.push([exchange])
  }
  const renderRow = (exchange: TranscriptExchange) => {
    const { request, number } = exchange
    const { reason, warnings: warningLines } = metadata.get(request.id)!
    const inputTokens = sessionInputTokens(request)
    const cache =
      inputTokens && request.cacheReadTokens != null ? Math.round((request.cacheReadTokens / inputTokens) * 100) : null
    const lastResponseMessage = exchange.responseParts.reduce(
      (last, part, index) => (part.kind === 'message' ? index : last),
      -1,
    )
    const compacted = isCompacted(exchange)
    const missingInput =
      !exchange.inputParts.length &&
      (!request.payloads.requestBody || /\n\.\.\.\[truncated \d+ bytes\]$/.test(request.payloads.requestBody))
    return (
      <Fragment key={request.id}>
        {compacted ? (
          <div className="session-compaction">
            ⇣ context compacted before #{number} · {exchange.inputDelta!.toLocaleString()} tokens · cache reset
          </div>
        ) : null}
        <section
          id={`session-${request.id}`}
          data-session-request={request.id}
          aria-label={`Request ${number}`}
          className={`session-split-row ${activeId === request.id ? 'is-active' : ''} ${reason === 'end_turn' || reason === 'stop' ? 'is-final' : ''}`}
        >
          <div
            className={`session-split-meta ${reason === 'tool_use' ? 'is-tool' : reason === 'end_turn' || reason === 'stop' ? 'is-end' : ''}`}
          >
            <Link to="/requests/$id" params={{ id: request.id }} className="text-sm font-semibold text-info">
              #{number}
            </Link>
            {reason ? (
              <div>
                <span
                  className={`session-stop-badge ${reason === 'end_turn' || reason === 'stop' ? 'is-end' : 'is-tool'}`}
                >
                  ● {reason}
                </span>
              </div>
            ) : null}
            <div>{new Date(request.startedAt).toLocaleTimeString()}</div>
            <div>
              <span className={request.statusCode >= 400 ? 'text-err' : 'text-ok'}>{request.statusCode}</span> ·{' '}
              {formatDuration(request.durationMs)}
            </div>
            <div className="my-1 h-1 bg-surface-3">
              <div
                className={
                  compacted ? 'h-full bg-warn' : request.statusCode >= 400 ? 'h-full bg-err' : 'h-full bg-info'
                }
                style={{ width: `${Math.max(2, (request.durationMs / maxLatency) * 100)}%` }}
              />
            </div>
            <div>
              {exchange.inputDelta == null
                ? '—'
                : `${exchange.inputDelta >= 0 ? '+' : ''}${formatCompactNumber(exchange.inputDelta)}`}{' '}
              / {formatCompactNumber(request.completionTokens)}
            </div>
            <div>cache {cache == null ? '—' : `${cache}%`}</div>
          </div>
          <div className="session-conversation space-y-3">
            {exchange.replaced != null ? (
              <div className="font-mono text-[10px] text-warn">
                context reset · {exchange.replaced} messages replaced
              </div>
            ) : null}
            {filters.context && exchange.contexts.length ? (
              <ContextPills contexts={exchange.contexts} mobile={false} onOpen={() => {}} />
            ) : null}
            {exchange.inputParts.map((part, index) => {
              if (part.kind === 'message' && !filters.messages) return null
              if (part.kind === 'result') {
                const pair = part.id ? pairs.get(part.id) : undefined
                const location = { requestId: request.id, number, index, part }
                return (
                  <div className="session-sent-strip" key={`${part.kind}-${index}-${filters.results}`}>
                    <span>SENT</span>
                    <ResultBlock
                      key={`${part.kind}-${index}-${filters.results}`}
                      location={location}
                      call={filters.tools ? pair?.call : undefined}
                      expanded={filters.results}
                      highlighted={Boolean(part.id && hovered === part.id)}
                      onHover={setHovered}
                    />
                  </div>
                )
              }
              if (part.kind === 'tool' && !filters.tools) return null
              return (
                <div className="session-sent-strip" key={`${part.kind}-${index}`}>
                  <span>{part.kind === 'message' && part.role === 'user' ? 'USER' : 'SENT'}</span>
                  <TranscriptItem
                    part={part}
                    expanded={filters.thinking}
                    time={request.startedAt}
                    hideRaw
                    truncated={false}
                  />
                </div>
              )
            })}
            {missingInput ? (
              <div className="session-sent-strip">
                <span>SENT</span>
                <div className="session-input-missing">
                  ▲ input not captured ·{' '}
                  {request.payloads.requestBody
                    ? 'new messages are past the capture limit'
                    : 'request body unavailable'}
                </div>
              </div>
            ) : null}
            {exchange.responseParts.map((part, index) => {
              if ((part.kind === 'message' && !filters.messages) || (part.kind === 'tool' && !filters.tools))
                return null
              const location = { requestId: request.id, number, index, part }
              const result = part.id ? pairs.get(part.id)?.result : undefined
              return part.kind === 'tool' ? (
                <div
                  key={`${part.kind}-${index}`}
                  id={partId(location, 'call')}
                  className={`session-linked-tool ${part.id && hovered === part.id ? 'is-linked' : ''}`}
                  onMouseEnter={() => setHovered(part.id ?? null)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <TranscriptItem part={part} expanded={false} time={request.startedAt} truncated={false} />
                  {result ? (
                    <button type="button" className="session-link-chip" onClick={() => jumpToPart(result, 'result')}>
                      → #{result.number}
                    </button>
                  ) : (
                    <span className="session-link-missing">
                      {incomplete ? 'result may be in unloaded requests' : 'no result captured'}
                    </span>
                  )}
                </div>
              ) : (
                <TranscriptItem
                  key={`${part.kind}-${index}`}
                  part={part}
                  expanded={filters.thinking}
                  time={request.startedAt}
                  hideRaw
                  truncated={index === lastResponseMessage && warningLines.some((line) => line.kind === 'response')}
                />
              )
            })}
            {!exchange.responseParts.length ? (
              <div className="font-mono text-xs text-fg-dim">no readable content</div>
            ) : null}
            <div className="session-capture-controls">
              {warningLines.map((line) => (
                <span className="session-capture-segment" key={line.kind} title={line.title}>
                  {line.kind === 'request' ? 'req' : 'resp'} {line.label}
                  <span className="session-capture-bar">
                    <i style={{ width: `${line.total ? (line.size / line.total) * 100 : 0}%` }} />
                  </span>
                </span>
              ))}
              <Link to="/requests/$id" params={{ id: request.id }} className="session-capture-raw">
                raw ↗
              </Link>
            </div>
          </div>
        </section>
      </Fragment>
    )
  }
  return (
    <div className="session-split-timeline">
      <div className="session-split-heading">
        <span>Request</span>
        <span>
          Conversation{' '}
          <span className="session-legend">
            <i /> sent to model <b /> model response
          </span>
        </span>
      </div>
      {groups.map((group) =>
        group[0].side ? (
          <div key={group[0].request.id} className="session-split-row session-side-group">
            <div className="session-split-meta">
              #{group[0].number}
              {group.length > 1 ? `–${group[group.length - 1].number}` : ''} · side
            </div>
            <div className="session-side-content space-y-2">
              {group.map((exchange) => (
                <details
                  key={exchange.request.id}
                  id={`session-${exchange.request.id}`}
                  data-session-request={exchange.request.id}
                  className={`rounded border border-dashed border-border p-2 font-mono text-[10px] text-fg-dim ${activeId === exchange.request.id ? 'bg-surface-2' : ''}`}
                  open={filters.side || undefined}
                >
                  <summary className="cursor-pointer truncate">
                    #{exchange.number} ·{' '}
                    {exchange.side === 'title'
                      ? 'title generation'
                      : exchange.side === 'probe'
                        ? 'quota probe'
                        : exchange.side === 'count'
                          ? 'count tokens'
                          : 'helper'}
                    {exchange.side === 'title' && exchange.responseParts.find((part) => part.kind === 'message')
                      ? ` → “${sessionTitle(exchange.responseParts.find((part) => part.kind === 'message')!.text)}”`
                      : ''}{' '}
                    · {exchange.request.model} · {exchange.request.statusCode} ·{' '}
                    {formatDuration(exchange.request.durationMs)} · show
                  </summary>
                  <div className="mt-3 space-y-3">
                    {exchange.parts.map((part, index) =>
                      (part.kind === 'message' && !filters.messages) ||
                      (part.kind === 'tool' && !filters.tools) ? null : (
                        <TranscriptItem
                          key={`${part.kind}-${index}`}
                          part={part}
                          expanded={part.kind === 'thinking' ? filters.thinking : filters.results}
                          time={exchange.request.startedAt}
                          truncated={false}
                        />
                      ),
                    )}
                  </div>
                </details>
              ))}
            </div>
          </div>
        ) : group.length > 8 ? (
          <details key={group[0].request.id} className="session-collapsed-run">
            <summary>
              #{group[0].number} – #{group[group.length - 1].number} · show {group.length} requests
            </summary>
            {group.map(renderRow)}
          </details>
        ) : (
          group.map(renderRow)
        ),
      )}
    </div>
  )
}

const ResultBlock = memo(
  function ResultBlock({
    location,
    call,
    expanded,
    highlighted,
    onHover,
  }: {
    location: Location
    call?: Location
    expanded: boolean
    highlighted: boolean
    onHover: (id: string | null) => void
  }) {
    const [open, setOpen] = useState<boolean | null>(null)
    const isOpen = open ?? expanded
    const lines = useMemo(() => location.part.text.split('\n'), [location.part.text])
    return (
      <div
        id={partId(location, 'result')}
        className={`session-result ${highlighted ? 'is-linked' : ''}`}
        onMouseEnter={() => onHover(location.part.id ?? null)}
        onMouseLeave={() => onHover(null)}
      >
        <div className="flex min-w-0 items-center gap-2 px-2 py-1 font-mono text-[10px] text-fg-dim">
          <span className="min-w-0 flex-1 truncate">
            ↳ {call?.part.name ?? location.part.name ?? 'tool'} · {lines[0] || '(empty result)'} · {lines.length}{' '}
            {lines.length === 1 ? 'line' : 'lines'}
          </span>
          {call ? (
            <button type="button" className="session-link-chip-static" onClick={() => jumpToPart(call, 'call')}>
              ← #{call.number}
            </button>
          ) : null}
          <button type="button" className="ml-auto text-info" aria-expanded={isOpen} onClick={() => setOpen(!isOpen)}>
            {isOpen ? 'collapse' : 'expand'}
          </button>
        </div>
        {isOpen ? (
          <pre className="m-0 overflow-auto whitespace-pre-wrap break-words border-t border-border p-2 font-mono text-[10px] text-fg-dim">
            {lines.map((line, index) => (
              <span
                key={`${index}-${line}`}
                className={`block ${line.startsWith('+') ? 'text-ok' : line.startsWith('-') ? 'text-err' : ''}`}
              >
                {line || ' '}
              </span>
            ))}
          </pre>
        ) : null}
      </div>
    )
  },
  (previous, next) =>
    previous.location.part === next.location.part &&
    previous.location.requestId === next.location.requestId &&
    previous.location.number === next.location.number &&
    previous.location.index === next.location.index &&
    previous.call === next.call &&
    previous.expanded === next.expanded &&
    previous.highlighted === next.highlighted &&
    previous.onHover === next.onHover,
)
