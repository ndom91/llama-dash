import { Link } from '@tanstack/react-router'
import { Eye } from 'lucide-react'
import { memo, useRef, useState } from 'react'
import { CopyButton } from '../../components/CopyButton'
import { formatCompactNumber, formatDuration } from '../../lib/format'
import { SessionAssistantMessage } from './SessionAssistantMessage'
import { SessionEntry } from './SessionEntry'
import { SessionToolCard } from './SessionToolCard'
import { SessionMessageClamp } from './SessionMessageClamp'
import { SessionCollapsedRun } from './SessionCollapsedRun'
import {
  type CapturedRequest,
  parseTranscriptInput,
  parseTranscriptResponse,
  sessionInputTokens,
  sessionTitle,
  type TranscriptContext,
  type TranscriptPart,
} from './sessionTranscript'

export type TranscriptFilters = {
  messages: boolean
  tools: boolean
  results: boolean
  thinking: boolean
  side: boolean
  context: boolean
}
export type TranscriptExchange = {
  request: CapturedRequest
  number: number
  parts: TranscriptPart[]
  inputParts: TranscriptPart[]
  responseParts: TranscriptPart[]
  stopReason?: string | null
  replaced: number | null
  side: 'title' | 'probe' | 'helper' | 'count' | null
  contexts: TranscriptContext[]
  inputDelta: number | null
}

export function SessionTranscriptView({
  exchanges,
  filters,
  mobile = false,
  onOpenDetail,
}: {
  exchanges: TranscriptExchange[]
  filters: TranscriptFilters
  mobile?: boolean
  onOpenDetail?: (detail: string) => void
}) {
  const results = new Map<string, TranscriptPart>()
  const toolIds = new Set<string>()
  for (const exchange of exchanges)
    for (const part of exchange.parts) {
      if (part.kind === 'result' && part.id) results.set(part.id, part)
      if (part.kind === 'tool' && part.id) toolIds.add(part.id)
    }
  const groups: Array<TranscriptExchange[]> = []
  let run: TranscriptExchange[] = []
  const flush = () => {
    if (run.length) groups.push(run)
    run = []
  }
  for (const exchange of exchanges) {
    const toolOnly =
      !exchange.side &&
      exchange.replaced == null &&
      exchange.contexts.length === 0 &&
      exchange.parts.some((part) => part.kind === 'tool') &&
      !exchange.parts.some((part) => part.kind === 'message')
    if (toolOnly) run.push(exchange)
    else {
      flush()
      groups.push([exchange])
    }
  }
  flush()
  const renderExchange = (exchange: TranscriptExchange) => (
    <Exchange
      key={exchange.request.id}
      exchange={exchange}
      filters={filters}
      results={results}
      toolIds={toolIds}
      mobile={mobile}
      onOpenDetail={onOpenDetail}
    />
  )
  return (
    <div className="mx-auto w-full max-w-[820px] space-y-5 px-6 py-6 max-md:px-3">
      {groups.map((group) =>
        group.length > 8 ? (
          <SessionCollapsedRun
            key={group[0].request.id}
            className="group"
            anchors={group.map((exchange) => `session-${exchange.request.id}`)}
            summary={
              <span className="block cursor-pointer rounded-full border border-border px-3 py-1 text-center font-mono text-[10px] text-info">
                #{group[0].number} – #{group[group.length - 1].number} · {group.length} more · show
              </span>
            }
          >
            {() => <div className="space-y-5">{group.map(renderExchange)}</div>}
          </SessionCollapsedRun>
        ) : (
          group.map(renderExchange)
        ),
      )}
    </div>
  )
}

function Exchange({
  exchange,
  filters,
  results,
  toolIds,
  mobile,
  onOpenDetail,
}: {
  exchange: TranscriptExchange
  filters: TranscriptFilters
  results: Map<string, TranscriptPart>
  toolIds: Set<string>
  mobile: boolean
  onOpenDetail?: (detail: string) => void
}) {
  const { request, parts, side, number } = exchange
  const [expandedChip, setExpandedChip] = useState(false)
  const openPart = (part: TranscriptPart) => {
    const input = parseTranscriptInput(request.payloads.requestBody)
    const all = [...input.parts.flat(), ...parseTranscriptResponse(request.payloads.responseBody, request.streamed)]
    const index = all.findIndex(
      (item) =>
        item.kind === part.kind && (part.id ? item.id === part.id : item.name === part.name && item.text === part.text),
    )
    if (index >= 0) onOpenDetail?.(`${request.id}~tool~${index}`)
  }
  const openContext = (context: TranscriptContext) => {
    const index = parseTranscriptInput(request.payloads.requestBody).contexts.findIndex(
      (item) => item.kind === context.kind && item.label === context.label && item.text === context.text,
    )
    if (index >= 0) onOpenDetail?.(`${request.id}~context~${index}`)
  }
  const inputTokens = sessionInputTokens(request)
  const cache =
    inputTokens && request.cacheReadTokens != null ? Math.round((request.cacheReadTokens / inputTokens) * 100) : null
  const warnings = (['response', 'request'] as const).flatMap((kind) => {
    const body = kind === 'request' ? request.payloads.requestBody : request.payloads.responseBody
    const match = body?.match(/\n\.\.\.\[truncated (\d+) bytes\]$/)
    if (!match || !body) return []
    const captured = new TextEncoder().encode(body.slice(0, match.index)).length
    const formatBytes = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`)
    return [
      {
        kind,
        text: `▲ ${kind} ${kind === 'response' ? 'cut off at ' : ''}${formatBytes(captured)} of ${formatBytes(captured + Number(match[1]))}`,
      },
    ]
  })
  const responseHasMessage =
    warnings.some((item) => item.kind === 'response') &&
    parseTranscriptResponse(request.payloads.responseBody, request.streamed).some(
      (part) => part.kind === 'message' && part.role === 'assistant',
    )
  const lastAssistant = parts.reduce(
    (last, part, index) => (part.kind === 'message' && part.role === 'assistant' ? index : last),
    -1,
  )
  const content = (
    <>
      {exchange.replaced != null ? (
        <div className="my-4 border-y border-dashed border-border py-2 text-center font-mono text-[10px] text-warn">
          context reset · {exchange.replaced} messages replaced
        </div>
      ) : null}
      {filters.context && exchange.contexts.length > 0 ? (
        <ContextPills contexts={exchange.contexts} mobile={mobile} onOpen={openContext} />
      ) : null}
      <div className="space-y-4">
        {parts.map((part, index) => {
          if ((part.kind === 'message' && !filters.messages) || (part.kind === 'tool' && !filters.tools)) return null
          if (part.kind === 'result' && part.id && filters.tools && toolIds.has(part.id)) return null
          return (
            <TranscriptItem
              // biome-ignore lint/suspicious/noArrayIndexKey: captured parts have stable positions and may repeat.
              key={index}
              part={part}
              result={part.kind === 'tool' && part.id ? results.get(part.id) : undefined}
              expanded={part.kind === 'thinking' ? filters.thinking : filters.results}
              time={request.startedAt}
              truncated={
                responseHasMessage && index === lastAssistant && warnings.some((item) => item.kind === 'response')
              }
              onOpen={mobile && (part.kind === 'tool' || part.kind === 'result') ? () => openPart(part) : undefined}
            />
          )
        })}
      </div>
      {warnings.length > 0 ? (
        <div className="ml-0.5 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 pl-5 font-mono text-[10px] text-warn">
          {warnings.map((warning) => (
            <span key={warning.kind}>{warning.text}</span>
          ))}
          {mobile ? (
            <button
              type="button"
              className="ml-auto min-h-9 text-info"
              onClick={() => onOpenDetail?.(`${request.id}~${warnings[0].kind}~0`)}
            >
              open raw ›
            </button>
          ) : (
            <Link to="/requests/$id" params={{ id: request.id }} className="ml-auto text-info">
              open raw ›
            </Link>
          )}
        </div>
      ) : null}
      {parts.length === 0 ? (
        <div className="font-mono text-xs text-fg-dim">
          no readable content ·{' '}
          {mobile ? (
            <button
              type="button"
              className="min-h-9 text-info"
              onClick={() => onOpenDetail?.(`${request.id}~response~0`)}
            >
              open raw ›
            </button>
          ) : (
            <Link to="/requests/$id" params={{ id: request.id }} className="text-info">
              open raw ›
            </Link>
          )}
        </div>
      ) : null}
    </>
  )
  if (side && !filters.side)
    return (
      <details
        id={`session-${request.id}`}
        data-session-request={request.id}
        className="rounded border border-dashed border-border px-3 py-2 font-mono text-[11px] text-fg-dim"
      >
        <summary className="cursor-pointer break-words">
          #{number} ·{' '}
          {side === 'title'
            ? '◌ title generation'
            : side === 'count'
              ? '◌ count tokens'
              : side === 'helper'
                ? '◌ helper'
                : '● quota probe'}{' '}
          {side === 'title' && parts.find((part) => part.kind === 'message' && part.role === 'assistant')?.text
            ? ` → “${sessionTitle(parts.find((part) => part.kind === 'message' && part.role === 'assistant')!.text).slice(0, 100)}”`
            : ''}{' '}
          · {request.model ?? 'unknown model'} ·{' '}
          <span className={request.statusCode >= 400 ? 'text-err' : 'text-ok'}>HTTP {request.statusCode}</span> ·{' '}
          {formatDuration(request.durationMs)} <span className="float-right text-info">show</span>
        </summary>
        <div className="mt-4">{content}</div>
      </details>
    )
  return (
    <section id={`session-${request.id}`} data-session-request={request.id} aria-label={`Request ${number}`}>
      <div className="my-3 flex min-w-0 items-center gap-2">
        <span className="h-px flex-1 bg-border" />
        {mobile && !expandedChip ? (
          <button
            type="button"
            className="min-h-9 max-w-full font-mono text-[10px] text-fg-dim"
            onClick={() => setExpandedChip(true)}
            aria-label={`Expand request ${number} details`}
          >
            <span className="text-info">#{number}</span> ·{' '}
            <span className={request.statusCode >= 400 ? 'text-err' : 'text-ok'}>{request.statusCode}</span> ·{' '}
            {formatDuration(request.durationMs)} ·{' '}
            {exchange.inputDelta == null
              ? '—'
              : `${exchange.inputDelta >= 0 ? '+' : ''}${formatCompactNumber(exchange.inputDelta)}`}{' '}
            in
          </button>
        ) : (
          <Link
            to="/requests/$id"
            params={{ id: request.id }}
            className="max-w-full rounded-full border border-border px-3 py-1 text-center font-mono text-[10px] text-fg-dim no-underline hover:border-fg-dim hover:text-fg"
          >
            <span className="text-info">#{number}</span> ·{' '}
            {request.id.length > 20 ? `${request.id.slice(0, 13)}…${request.id.slice(-4)}` : request.id} ·{' '}
            {request.model ?? '—'} ·{' '}
            <span className={request.statusCode >= 400 ? 'text-err' : 'text-ok'}>{request.statusCode}</span> ·{' '}
            {formatDuration(request.durationMs)} ·{' '}
            {exchange.inputDelta == null
              ? '—'
              : `${exchange.inputDelta >= 0 ? '+' : ''}${formatCompactNumber(exchange.inputDelta)}`}{' '}
            in / {formatCompactNumber(request.completionTokens)} out{cache == null ? '' : ` · cache ${cache}%`}
          </Link>
        )}
        <span className="h-px flex-1 bg-border" />
      </div>
      {content}
    </section>
  )
}

export function ContextPills({
  contexts,
  mobile,
  onOpen,
}: {
  contexts: TranscriptContext[]
  mobile: boolean
  onOpen: (item: TranscriptContext) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const pressedOutside = useRef(false)
  const [selected, setSelected] = useState<TranscriptContext | null>(null)
  const outside = (event: React.PointerEvent<HTMLDialogElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return (
      event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom
    )
  }
  return (
    <div className="mb-4 space-y-2">
      <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">Context</div>
      <div
        className={
          mobile
            ? 'flex min-w-0 gap-2 overflow-x-auto pb-2 [mask-image:linear-gradient(to_right,black_90%,transparent)]'
            : 'flex flex-wrap gap-2'
        }
      >
        {contexts.map((item) => (
          <button
            type="button"
            key={`${item.kind}-${item.label}-${item.text}`}
            title={`View ${item.label}`}
            onClick={() => {
              if (mobile) onOpen(item)
              else {
                setSelected(item)
                dialog.current?.showModal()
              }
            }}
            className={`inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded border bg-surface-2 px-2 py-1 font-mono text-[11px] text-fg-muted hover:border-info hover:text-fg focus-visible:outline-none focus-visible:shadow-focus ${mobile ? 'shrink-0 whitespace-nowrap' : ''} ${item.changed ? 'border-info text-info' : 'border-border-strong'}`}
          >
            <Eye className="size-3 shrink-0" aria-hidden="true" />
            {item.kind} · {item.label} · ~{formatCompactNumber(Math.ceil(item.text.length / 4))} tok
          </button>
        ))}
      </div>
      <dialog
        ref={dialog}
        closedby="any"
        onPointerDown={(event) => {
          if (!('closedBy' in HTMLDialogElement.prototype)) pressedOutside.current = outside(event)
        }}
        onPointerUp={(event) => {
          if (!('closedBy' in HTMLDialogElement.prototype) && pressedOutside.current && outside(event)) {
            event.currentTarget.close()
          }
          pressedOutside.current = false
        }}
        aria-label={selected?.label ?? 'Context'}
        className="session-context-dialog fixed inset-0 m-auto max-h-[80dvh] w-[min(90vw,700px)] max-w-[calc(100%-2rem)] overflow-hidden rounded border border-border bg-surface-0 p-0 text-fg backdrop:bg-surface-0/80"
      >
        <div className="flex items-center justify-between gap-4 border-b border-border p-4">
          <h2 className="m-0 text-sm font-semibold">{selected?.label}</h2>
          <div className="flex shrink-0 items-center gap-2">
            <CopyButton
              text={selected?.text ?? ''}
              variant="icon"
              ariaLabel="Copy context"
              className="btn btn-sm h-7 w-7 justify-center"
            />
            <button type="button" className="btn btn-sm" onClick={() => dialog.current?.close()}>
              Close
            </button>
          </div>
        </div>
        <pre className="m-0 max-h-[65vh] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs">
          {selected?.text}
        </pre>
      </dialog>
    </div>
  )
}

export function primaryArgument(value: string): string {
  try {
    const parsed = JSON.parse(value) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const args = parsed as Record<string, unknown>
      for (const key of ['command', 'cmd', 'file_path', 'path', 'query', 'title', 'url']) {
        if (typeof args[key] === 'string') return args[key] as string
      }
    }
  } catch {}
  return value.replace(/\s+/g, ' ')
}

export const TranscriptItem = memo(function TranscriptItem({
  part,
  result,
  expanded,
  time,
  onOpen,
  truncated,
  hideRaw = false,
  glyph = false,
}: {
  part: TranscriptPart
  result?: TranscriptPart
  expanded: boolean
  time: string
  onOpen?: () => void
  truncated: boolean
  hideRaw?: boolean
  glyph?: boolean
}) {
  if (part.kind === 'thinking') {
    if (glyph)
      return (
        <SessionEntry
          kind="thinking"
          initiallyOpen={expanded}
          summary={
            <>
              ~{formatCompactNumber(Math.ceil(part.text.length / 4))} tok · <i>{part.text.split('\n')[0]}</i>
            </>
          }
        >
          <div className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-[13px] italic leading-relaxed text-fg-dim">
            {part.text}
          </div>
        </SessionEntry>
      )
    return (
      <details open={expanded || undefined} className="min-w-0">
        <summary className="cursor-pointer py-1 font-mono text-[10px] text-fg-faint marker:text-fg-faint">
          <span className="uppercase tracking-wider">thinking</span> · ~
          {formatCompactNumber(Math.ceil(part.text.length / 4))} tok
        </summary>
        <div className="ml-0.5 max-w-[92ch] border-l border-dashed border-border-strong pl-5">
          <div className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-[13px] italic leading-relaxed text-fg-dim">
            {part.text}
          </div>
        </div>
      </details>
    )
  }
  if (part.kind === 'tool' || part.kind === 'result') {
    if (glyph && part.kind === 'tool')
      return <SessionToolCard part={part} result={result} expanded={expanded} incomplete={false} />
    const name = part.name?.startsWith('mcp__') ? `mcp · ${part.name.slice(5).replace('__', ' · ')}` : part.name
    if (onOpen)
      return (
        <button
          type="button"
          onClick={onOpen}
          className="flex min-h-9 w-full min-w-0 items-center gap-2 rounded border border-border bg-surface-0 px-3 text-left font-mono text-xs text-fg-dim"
        >
          <span className="shrink-0 text-info">{name ?? (part.kind === 'result' ? 'tool result' : 'tool')}</span>
          <span className="min-w-0 flex-1 truncate">{primaryArgument(part.text)}</span>
          <span aria-hidden="true">›</span>
        </button>
      )
    return (
      <details
        open={expanded && (part.kind === 'result' || (part.kind === 'tool' && Boolean(result))) ? true : undefined}
        className="min-w-0 rounded border border-border bg-surface-0 font-mono text-xs"
      >
        <summary className="cursor-pointer break-words px-3 py-2 text-fg-dim">
          <span className="text-info">{part.kind === 'tool' ? (name ?? 'tool') : 'tool result'}</span>
          {part.kind === 'tool' && part.text ? ` · ${primaryArgument(part.text).slice(0, 140)}` : ''}
          {result ? (
            <span className={result.isError ? 'float-right text-err' : 'float-right text-ok'}>
              {result.isError ? 'error' : 'ok'}
            </span>
          ) : null}
        </summary>
        {part.text ? (
          part.kind === 'result' ? (
            <ResultLines text={part.text} />
          ) : (
            <pre className="m-0 max-h-80 overflow-auto whitespace-pre-wrap break-words border-t border-border px-3 py-2 text-fg">
              {part.text}
            </pre>
          )
        ) : null}
        {result ? <ResultLines text={result.text} /> : null}
      </details>
    )
  }
  if (part.role !== 'user')
    return (
      <SessionAssistantMessage text={part.text} time={time} truncated={truncated} hideRaw={hideRaw} glyph={glyph} />
    )
  if (glyph)
    return (
      <SessionEntry
        kind="user"
        initiallyOpen
        meta={<time title="Request start time">{new Date(time).toLocaleTimeString()}</time>}
        actions={<CopyButton text={part.text} variant="icon" ariaLabel="Copy user message" />}
      >
        <SessionMessageClamp text={part.text}>
          <div className="session-user-message whitespace-pre-wrap break-words text-sm text-fg">{part.text}</div>
        </SessionMessageClamp>
      </SessionEntry>
    )
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
        <span className={part.role === 'user' ? 'size-1.5 rounded-full bg-info' : 'size-1.5 rounded-full bg-ok'} />
        {part.role}
        <time title="Request start time">{new Date(time).toLocaleTimeString()}</time>
        <span className="ml-auto">
          <CopyButton text={part.text} variant="icon" ariaLabel="Copy user message" />
        </span>
      </div>
      <div className="ml-0.5 min-w-0 border-l border-border-strong pl-5">
        <SessionMessageClamp text={part.text}>
          <div className="session-user-message rounded border border-border bg-surface-1 px-3 py-3 text-sm whitespace-pre-wrap break-words text-fg">
            {part.text}
          </div>
        </SessionMessageClamp>
      </div>
    </div>
  )
})

function ResultLines({ text }: { text: string }) {
  return (
    <div className="max-h-80 overflow-auto whitespace-pre-wrap break-words border-t border-border px-3 py-2">
      {text.split('\n').map((line, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: captured lines have stable positions and may repeat.
        <div key={index} className={line.startsWith('+') ? 'text-ok' : line.startsWith('-') ? 'text-err' : ''}>
          {line || '\u00a0'}
        </div>
      ))}
    </div>
  )
}
