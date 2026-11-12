import { Link } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { formatCompactNumber, formatDuration } from '../../lib/format'
import {
  type CapturedRequest,
  sessionInputTokens,
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
  replaced: number | null
  side: 'title' | 'probe' | 'helper' | 'count' | null
  contexts: TranscriptContext[]
  inputDelta: number | null
}

export function SessionTranscriptView({
  exchanges,
  filters,
}: {
  exchanges: TranscriptExchange[]
  filters: TranscriptFilters
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
    <Exchange key={exchange.request.id} exchange={exchange} filters={filters} results={results} toolIds={toolIds} />
  )
  return (
    <div className="mx-auto w-full max-w-[820px] space-y-5 px-6 py-6 max-md:px-3">
      {groups.map((group) =>
        group.length > 8 ? (
          <details key={group[0].request.id} className="group">
            <summary className="cursor-pointer rounded-full border border-border px-3 py-1 text-center font-mono text-[10px] text-info">
              #{group[0].number} – #{group[group.length - 1].number} · {group.length} more · show
            </summary>
            <div className="space-y-5">{group.map(renderExchange)}</div>
          </details>
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
}: {
  exchange: TranscriptExchange
  filters: TranscriptFilters
  results: Map<string, TranscriptPart>
  toolIds: Set<string>
}) {
  const { request, parts, side, number } = exchange
  const inputTokens = sessionInputTokens(request)
  const cache =
    inputTokens && request.cacheReadTokens != null ? Math.round((request.cacheReadTokens / inputTokens) * 100) : null
  const content = (
    <>
      {exchange.replaced != null ? (
        <div className="my-4 border-y border-dashed border-border py-2 text-center font-mono text-[10px] text-warn">
          context reset · {exchange.replaced} messages replaced
        </div>
      ) : null}
      {filters.context && exchange.contexts.length > 0 ? <ContextPills contexts={exchange.contexts} /> : null}
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
            />
          )
        })}
      </div>
      {(['request', 'response'] as const).map((kind) => {
        const body = kind === 'request' ? request.payloads.requestBody : request.payloads.responseBody
        const match = body?.match(/\n\.\.\.\[truncated (\d+) bytes\]$/)
        if (!match || !body) return null
        const captured = new TextEncoder().encode(body.slice(0, match.index)).length
        const formatBytes = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`)
        return (
          <div key={kind} className="mt-2 font-mono text-[10px] text-warn">
            ▲ {kind} captured {formatBytes(captured)} of {formatBytes(captured + Number(match[1]))} ·{' '}
            <Link to="/requests/$id" params={{ id: request.id }} className="text-info">
              open raw ›
            </Link>
          </div>
        )
      })}
      {parts.length === 0 ? (
        <div className="font-mono text-xs text-fg-dim">
          no readable content ·{' '}
          <Link to="/requests/$id" params={{ id: request.id }} className="text-info">
            open raw ›
          </Link>
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
            ? ` → “${parts.find((part) => part.kind === 'message' && part.role === 'assistant')!.text.slice(0, 100)}”`
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
        <span className="h-px flex-1 bg-border" />
      </div>
      {content}
    </section>
  )
}

function ContextPills({ contexts }: { contexts: TranscriptContext[] }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [selected, setSelected] = useState<TranscriptContext | null>(null)
  return (
    <div className="mb-4 space-y-2">
      <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">Context</div>
      <div className="flex flex-wrap gap-2">
        {contexts.map((item) => (
          <button
            type="button"
            key={`${item.kind}-${item.label}-${item.text}`}
            onClick={() => {
              setSelected(item)
              dialog.current?.showModal()
            }}
            className={`max-w-full rounded border px-2 py-1 font-mono text-[11px] text-fg-dim ${item.changed ? 'border-info text-info' : 'border-dashed border-border'}`}
          >
            {item.kind} · {item.label} · ~{formatCompactNumber(Math.ceil(item.text.length / 4))} tok
          </button>
        ))}
      </div>
      <dialog
        ref={dialog}
        onClose={() => setSelected(null)}
        aria-label={selected?.label ?? 'Context'}
        className="max-h-[80vh] w-[min(90vw,700px)] rounded border border-border bg-surface-0 p-0 text-fg backdrop:bg-surface-0/80"
      >
        <div className="flex items-center justify-between gap-4 border-b border-border p-4">
          <h2 className="m-0 text-sm font-semibold">{selected?.label}</h2>
          <button type="button" className="btn btn-sm" onClick={() => dialog.current?.close()}>
            Close
          </button>
        </div>
        <pre className="m-0 max-h-[65vh] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs">
          {selected?.text}
        </pre>
      </dialog>
    </div>
  )
}

function primaryArgument(value: string): string {
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

function TranscriptItem({
  part,
  result,
  expanded,
  time,
}: {
  part: TranscriptPart
  result?: TranscriptPart
  expanded: boolean
  time: string
}) {
  if (part.kind === 'tool' || part.kind === 'result' || part.kind === 'thinking') {
    const name = part.name?.startsWith('mcp__') ? `mcp · ${part.name.slice(5).replace('__', ' · ')}` : part.name
    return (
      <details
        open={
          expanded && (part.kind === 'thinking' || part.kind === 'result' || (part.kind === 'tool' && Boolean(result)))
            ? true
            : undefined
        }
        className="min-w-0 rounded border border-border bg-surface-0 font-mono text-xs"
      >
        <summary className="cursor-pointer break-words px-3 py-2 text-fg-dim">
          <span className="text-info">
            {part.kind === 'tool'
              ? (name ?? 'tool')
              : part.kind === 'result'
                ? 'tool result'
                : `thinking · ~${formatCompactNumber(Math.ceil(part.text.length / 4))} tok`}
          </span>
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
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
        <span className={part.role === 'user' ? 'size-1.5 rounded-full bg-info' : 'size-1.5 rounded-full bg-ok'} />
        {part.role}
        <time className="ml-auto" title="Request start time">
          {new Date(time).toLocaleTimeString()}
        </time>
      </div>
      <div
        className={
          part.role === 'user'
            ? 'rounded border border-border bg-surface-1 px-3 py-3 text-sm whitespace-pre-wrap break-words text-fg'
            : 'prose prose-sm max-w-none break-words text-fg'
        }
      >
        {part.role === 'user' ? part.text : <Markdown remarkPlugins={[remarkGfm]}>{part.text}</Markdown>}
      </div>
    </div>
  )
}

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
