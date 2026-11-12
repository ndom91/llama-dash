import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from 'react'
import { CopyButton } from '../../components/CopyButton'
import { api } from '../../lib/api'
import { formatDuration } from '../../lib/format'
import { useSlidingIndicator } from '../../lib/use-sliding-indicator'
import type { TranscriptExchange } from './SessionTranscriptView'
import { parseTranscriptInput, parseTranscriptResponse } from './sessionTranscript'

export type { SessionSheetTab } from './sessionSearch'

import type { SessionSheetTab } from './sessionSearch'

export function SessionMobileSheet({
  tab,
  onTab,
  onClose,
  actions,
  children,
  open,
}: {
  tab: SessionSheetTab
  onTab: (tab: SessionSheetTab) => void
  onClose: () => void
  actions: ReactNode
  children: ReactNode
  open: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const node = dialog.current
    if (!node) return
    if (open && !node.open) node.showModal()
    else if (!open && node.open) node.close()
  }, [open])
  const { containerRef, indicatorRef, itemRefs, ready } = useSlidingIndicator<SessionSheetTab, HTMLDivElement>(
    tab,
    'session,requests,show',
    open,
  )
  return (
    <dialog
      ref={dialog}
      aria-labelledby="session-sheet-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      className="session-mobile-sheet fixed inset-x-2 bottom-0 top-auto m-0 max-h-[min(78dvh,720px)] w-[calc(100%-1rem)] max-w-none overflow-hidden rounded-t-xl border border-border bg-surface-0 p-0 text-fg backdrop:bg-surface-0/80"
    >
      <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-border" />
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h2 id="session-sheet-title" className="m-0 text-sm font-semibold">
          Session
        </h2>
        <div className="flex items-center gap-2">
          <details className="relative">
            <summary className="cursor-pointer px-3 py-2 font-mono text-xs" aria-label="Session actions">
              ⋯
            </summary>
            <div className="absolute right-0 z-10 min-w-44 rounded border border-border bg-surface-0 p-2 shadow-lg">
              {actions}
            </div>
          </details>
          <button type="button" className="min-h-9 px-2 font-mono text-xs text-info" onClick={onClose}>
            done
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        role="tablist"
        aria-label="Session information"
        className="session-sheet-tabs mx-4 mt-3 flex rounded border border-border"
      >
        <span
          ref={indicatorRef}
          aria-hidden="true"
          className="t-tabs-pill session-sheet-tab-indicator"
          data-ready={ready}
        />
        {(['session', 'requests', 'show'] as const).map((item) => (
          <button
            key={item}
            ref={(node) => {
              if (node) itemRefs.current.set(item, node)
              else itemRefs.current.delete(item)
            }}
            type="button"
            role="tab"
            id={`session-tab-${item}`}
            aria-controls="session-tabpanel"
            tabIndex={tab === item ? 0 : -1}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
              event.preventDefault()
              const tabs = ['session', 'requests', 'show'] as const
              const next =
                tabs[(tabs.indexOf(item) + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]
              onTab(next)
              document.getElementById(`session-tab-${next}`)?.focus()
            }}
            aria-selected={tab === item}
            onClick={() => onTab(item)}
            className={`relative z-10 min-h-9 flex-1 font-mono text-xs ${tab === item ? 'text-fg' : 'text-fg-dim'}`}
          >
            {item}
          </button>
        ))}
      </div>
      <div
        id="session-tabpanel"
        role="tabpanel"
        aria-labelledby={`session-tab-${tab}`}
        className="max-h-[calc(min(78dvh,720px)-115px)] overflow-y-auto overscroll-contain"
      >
        {children}
      </div>
    </dialog>
  )
}

export function SessionScrubber({
  exchanges,
  activeId,
  scrollRef,
  onSelect,
}: {
  exchanges: TranscriptExchange[]
  activeId: string | null
  scrollRef: RefObject<HTMLDivElement | null>
  onSelect: (id: string) => void
}) {
  const [hidden, setHidden] = useState(false)
  const dragging = useRef(false)
  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    let previous = node.scrollTop
    const onScroll = () => {
      const next = node.scrollTop
      if (!dragging.current && Math.abs(next - previous) > 3) setHidden(next > previous && next > 80)
      previous = next
    }
    node.addEventListener('scroll', onScroll, { passive: true })
    return () => node.removeEventListener('scroll', onScroll)
  }, [scrollRef])
  if (!exchanges.length) return null
  const active = Math.max(
    0,
    exchanges.findIndex((exchange) => exchange.request.id === activeId),
  )
  const current = exchanges[active]
  const max = Math.max(1, ...exchanges.map(({ request }) => request.durationMs))
  return (
    <div
      className={`session-scrubber fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 rounded-lg border border-border bg-surface-0 p-2 shadow-lg ${hidden ? 'is-hidden' : ''}`}
      inert={hidden}
    >
      <div className="flex justify-between gap-2 font-mono text-[10px] text-fg-dim">
        <span>
          #{current.number} of {exchanges.length} {exchanges.length > 0 ? 'loaded' : ''}
        </span>
        <span>
          <strong className="text-fg">{formatDuration(current.request.durationMs)}</strong> ·{' '}
          {new Date(current.request.startedAt).toLocaleTimeString()}
        </span>
      </div>
      <div className="relative mt-1 h-7">
        <div aria-hidden="true" className="flex h-full items-end gap-px">
          {exchanges.map(({ request, side }) => (
            <span
              key={request.id}
              className={`min-w-0 flex-1 ${request.statusCode >= 400 ? 'bg-err' : side ? 'bg-accent' : 'bg-info'} ${request.id === current.request.id ? 'opacity-100' : 'opacity-50'}`}
              style={{ height: `${Math.max(8, (request.durationMs / max) * 100)}%` }}
            />
          ))}
        </div>
        <input
          type="range"
          aria-label="Scrub session requests"
          aria-valuetext={`Request ${current.number} of ${exchanges.length}`}
          min={0}
          max={exchanges.length - 1}
          value={active}
          onPointerDown={() => {
            dragging.current = true
            setHidden(false)
          }}
          onPointerUp={() => {
            dragging.current = false
          }}
          onPointerCancel={() => {
            dragging.current = false
          }}
          onChange={(event) => onSelect(exchanges[Number(event.target.value)].request.id)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
    </div>
  )
}

type DetailKind = 'tool' | 'context' | 'request' | 'response'
export function SessionMobileDetail({
  detail,
  sessionAnchor,
  onClose,
}: {
  detail: string
  sessionAnchor: string
  onClose: () => void
}) {
  const [requestId, rawKind, rawIndex, number] = detail.split('~')
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  const kind = rawKind as DetailKind
  const index = Number(rawIndex)
  const [wrap, setWrap] = useState(false)
  const captured = useQuery({
    queryKey: ['session-mobile-detail', requestId],
    queryFn: async ({ signal }) => {
      const [metadata, payloads] = await Promise.all([
        api.getRequestMetadata(requestId, { signal }),
        api.getRequestPayloads(requestId, { signal }),
      ])
      return { request: metadata.request, payloads }
    },
    staleTime: 60_000,
    gcTime: 60_000,
  })
  const input = useMemo(() => parseTranscriptInput(captured.data?.payloads.requestBody ?? null), [captured.data])
  const response = useMemo(
    () =>
      parseTranscriptResponse(captured.data?.payloads.responseBody ?? null, captured.data?.request.streamed ?? false),
    [captured.data],
  )
  const allParts = [...input.parts.flat(), ...response]
  const part = kind === 'tool' ? allParts[index] : undefined
  const context = kind === 'context' ? input.contexts[index] : undefined
  const result = useQuery({
    queryKey: ['session-tool-result', sessionAnchor, part?.id],
    enabled: kind === 'tool' && part?.kind === 'tool' && Boolean(part.id),
    queryFn: async ({ signal }) => {
      let cursor: string | undefined
      do {
        const page = await api.getRequestSession(sessionAnchor, cursor, { signal, priority: 'low' }, 'asc')
        for (const request of page.requests) {
          const match = parseTranscriptInput(request.payloads.requestBody)
            .parts.flat()
            .find((item) => item.kind === 'result' && item.id === part?.id)
          if (match) return match
        }
        cursor = page.nextCursor ?? undefined
      } while (cursor)
      return null
    },
    staleTime: 60_000,
    gcTime: 60_000,
  })
  const body =
    kind === 'request'
      ? captured.data?.payloads.requestBody
      : kind === 'response'
        ? captured.data?.payloads.responseBody
        : kind === 'context'
          ? context?.text
          : part?.text
  const title =
    kind === 'tool'
      ? (part?.name ?? (part?.kind === 'result' ? 'Tool result' : 'Tool call'))
      : kind === 'context'
        ? (context?.label ?? 'Context')
        : `Captured ${kind}`
  const resultBody = result.data?.text
  const copyText = [body, resultBody].filter(Boolean).join('\n\n')
  return (
    <dialog
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      className="fixed inset-0 z-[110] m-0 h-[100dvh] max-h-none w-full max-w-none min-w-0 flex-col border-0 bg-surface-1 p-0 text-fg open:flex"
      aria-label="Session detail"
    >
      <header className="flex min-h-12 items-center gap-3 border-b border-border px-3">
        <button type="button" className="min-h-11 font-mono text-xs text-info" onClick={onClose}>
          ‹ back
        </button>
        <h2 className="m-0 min-w-0 flex-1 truncate text-center font-mono text-xs font-semibold">
          {number ? `#${number} · ` : ''}
          {title}
        </h2>
        <CopyButton
          text={copyText}
          variant="icon"
          ariaLabel="Copy detail"
          className="flex size-11 items-center justify-center text-info"
        />
      </header>
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain px-3.5 py-4">
        {captured.isPending ? (
          <p role="status" className="font-mono text-xs text-fg-dim">
            Loading detail…
          </p>
        ) : captured.error ? (
          <p role="alert" className="text-xs text-err">
            Could not load detail: {captured.error.message}
          </p>
        ) : body == null ? (
          <p className="text-xs text-fg-dim">Captured content is unavailable.</p>
        ) : (
          <>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
              {kind === 'tool' && part?.kind === 'tool' ? 'Tool call' : title}
            </div>
            <CodeLines text={body} wrap={wrap} />
            {kind === 'tool' && part?.kind === 'tool' ? (
              <>
                <div className="mt-3 flex gap-2 font-mono text-[10px] text-fg-dim">
                  {part?.id ? <span className="break-all">{part.id}</span> : null}
                  {result.data ? (
                    <span className={result.data.isError ? 'text-err' : 'text-ok'}>
                      {result.data.isError ? 'error' : 'ok'}
                    </span>
                  ) : null}
                </div>
                <div className="mb-2 mt-5 font-mono text-[10px] uppercase tracking-wider text-fg-dim">Result</div>
                {result.isFetching ? (
                  <p className="text-xs text-fg-dim">Looking for captured result…</p>
                ) : result.error ? (
                  <p className="text-xs text-err">Could not load the result.</p>
                ) : resultBody ? (
                  <CodeLines text={resultBody} wrap={wrap} />
                ) : (
                  <p className="text-xs text-fg-dim">No captured result available.</p>
                )}
              </>
            ) : null}
          </>
        )}
        <div className="mt-5 border-t border-border pt-3 font-mono text-[10px] text-fg-dim">request · {requestId}</div>
      </div>
      <footer className="flex gap-2 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          className="btn min-h-11 flex-1 justify-center"
          aria-pressed={wrap}
          onClick={() => setWrap(!wrap)}
        >
          wrap {wrap ? 'on' : 'off'}
        </button>
        <CopyButton text={copyText} variant="button" label="copy" className="btn min-h-11 flex-1 justify-center" />
        <Link to="/requests/$id" params={{ id: requestId }} className="btn min-h-11 flex-1 justify-center">
          raw request ›
        </Link>
      </footer>
    </dialog>
  )
}

function CodeLines({ text, wrap }: { text: string; wrap: boolean }) {
  return (
    <div className="max-w-full overflow-auto rounded border border-border bg-surface-0 p-3 font-mono text-xs leading-relaxed">
      <div className={wrap ? 'w-full min-w-0' : 'w-max min-w-full'}>
        {text.split('\n').map((line, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: captured lines have stable positions and may repeat.
            key={index}
            className={`flex gap-3 ${line.startsWith('+') ? 'text-ok' : line.startsWith('-') ? 'text-err' : 'text-fg'}`}
          >
            <span aria-hidden="true" className="w-6 shrink-0 text-right text-fg-faint">
              {index + 1}
            </span>
            <span className={wrap ? 'min-w-0 flex-1 whitespace-pre-wrap break-all' : 'whitespace-pre'}>
              {line || '\u00a0'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
