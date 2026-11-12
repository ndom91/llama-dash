import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { CopyButton } from '../../components/CopyButton'
import { PageHeader } from '../../components/PageHeader'
import { RouteError } from '../../components/RouteError'
import { api } from '../../lib/api'
import { formatCompactNumber, formatDuration } from '../../lib/format'
import { useMediaQuery } from '../../lib/use-media-query'
import { SessionExchangeSkeleton, SessionPagePending } from './SessionPagePending'
import { SessionTranscriptView, type TranscriptExchange, type TranscriptFilters } from './SessionTranscriptView'
import {
  type CapturedRequest,
  diffTranscript,
  parseTranscriptInput,
  parseTranscriptResponse,
  sessionInputTokens,
  sideRequest,
} from './sessionTranscript'

const initialFilters: TranscriptFilters = {
  messages: true,
  tools: true,
  results: false,
  thinking: false,
  side: false,
  context: true,
}

export function SessionPage({ id }: { id: string }) {
  const mobile = useMediaQuery('(max-width: 768px)')
  const order = mobile ? 'desc' : 'asc'
  const navigate = useNavigate()
  const search = useSearch({ strict: false })
  const filters = useMemo(() => {
    if (typeof search.show !== 'string') return initialFilters
    const selected = new Set(search.show.split(','))
    return Object.fromEntries(Object.keys(initialFilters).map((key) => [key, selected.has(key)])) as TranscriptFilters
  }, [search.show])
  const setFilters: React.Dispatch<React.SetStateAction<TranscriptFilters>> = (next) => {
    const value = typeof next === 'function' ? next(filters) : next
    void navigate({
      to: '/sessions/$id',
      params: { id },
      search: {
        show: Object.entries(value)
          .filter(([, enabled]) => enabled)
          .map(([key]) => key)
          .join(','),
      },
      replace: true,
    })
  }
  const [activeId, setActiveId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const query = useInfiniteQuery({
    queryKey: ['request-session', id, order],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => api.getRequestSession(id, pageParam, { signal }, order),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 0,
    gcTime: 60_000,
  })
  const requests = useMemo(() => query.data?.pages.flatMap((page) => page.requests) ?? [], [query.data])
  const boundary = mobile ? query.data?.pages.at(-1)?.olderContext : null
  const boundaryIsSide = Boolean(boundary && sideRequest(boundary, parseTranscriptInput(boundary.payloads.requestBody)))
  const boundaryCursor = boundaryIsSide ? query.data?.pages.at(-1)?.nextCursor : null
  const olderMain = useQuery({
    queryKey: ['session-older-main', id, boundaryCursor],
    enabled: mobile && Boolean(boundaryCursor),
    queryFn: async ({ signal }) => {
      let cursor = boundaryCursor ?? undefined
      while (cursor) {
        const page = await api.getRequestSession(id, cursor, { signal, priority: 'low' }, 'desc')
        const main = page.requests.find(
          (request) => !sideRequest(request, parseTranscriptInput(request.payloads.requestBody)),
        )
        if (main) return main
        cursor = page.nextCursor ?? undefined
      }
      return null
    },
    staleTime: 60_000,
    gcTime: 60_000,
  })
  const parsed = useMemo(() => new WeakMap<object, ReturnType<typeof parseTranscriptInput>>(), [])
  const responses = useMemo(() => new WeakMap<object, ReturnType<typeof parseTranscriptResponse>>(), [])
  const diffs = useMemo(
    () => new WeakMap<object, { previous: object | null; value: ReturnType<typeof diffTranscript> }>(),
    [],
  )
  const exchanges = useMemo(() => {
    const inputFor = (request: { payloads: { requestBody: string | null } }) => {
      let input = parsed.get(request)
      if (!input) {
        input = parseTranscriptInput(request.payloads.requestBody)
        parsed.set(request, input)
      }
      return input
    }
    const responseFor = (request: { streamed: boolean; payloads: { responseBody: string | null } }) => {
      let result = responses.get(request)
      if (!result) {
        result = parseTranscriptResponse(request.payloads.responseBody, request.streamed)
        responses.set(request, result)
      }
      return result
    }
    const context = boundaryIsSide ? olderMain.data : boundary
    const previousByIndex: Array<(typeof requests)[number] | typeof context> = []
    let last: (typeof requests)[number] | typeof context = context
    for (
      let index = mobile ? requests.length - 1 : 0;
      mobile ? index >= 0 : index < requests.length;
      index += mobile ? -1 : 1
    ) {
      previousByIndex[index] = last
      if (!sideRequest(requests[index], inputFor(requests[index]))) last = requests[index]
    }
    return requests.map((request, index): TranscriptExchange => {
      const input = inputFor(request)
      const side = sideRequest(request, input)
      const older = side ? null : previousByIndex[index]
      const previous = older ? inputFor(older) : null
      const priorOutput = older ? responseFor(older) : []
      let cachedDiff = diffs.get(request)
      if (!cachedDiff || cachedDiff.previous !== (older ?? null)) {
        cachedDiff = { previous: older ?? null, value: diffTranscript(previous, input, priorOutput) }
        diffs.set(request, cachedDiff)
      }
      const diff = cachedDiff.value
      const response = responseFor(request)
      const parts = mobile ? [...response].reverse().concat([...diff.parts].reverse()) : [...diff.parts, ...response]
      const previousRequest = mobile ? (requests[index + 1] ?? context) : requests[index - 1]
      const previousTokens =
        previousRequest && 'promptTokens' in previousRequest && previousRequest.promptTokens != null
          ? sessionInputTokens({
              endpoint: previousRequest.endpoint ?? '',
              promptTokens: previousRequest.promptTokens,
              cacheReadTokens: previousRequest.cacheReadTokens ?? null,
              cacheCreationTokens: previousRequest.cacheCreationTokens ?? null,
            })
          : null
      const currentTokens = sessionInputTokens(request)
      return {
        request,
        number: index + 1,
        parts,
        replaced: diff.replaced,
        side,
        contexts: input.contexts.flatMap((item) => {
          const old = previous?.contexts.filter((entry) => entry.kind === item.kind && entry.label === item.label) ?? []
          if (old.some((entry) => entry.text === item.text)) return []
          return [{ ...item, changed: old.length > 0 }]
        }),
        inputDelta:
          currentTokens == null
            ? null
            : previousTokens == null
              ? previousRequest
                ? null
                : currentTokens
              : currentTokens - previousTokens,
      }
    })
  }, [requests, parsed, responses, diffs, mobile, boundary, boundaryIsSide, olderMain.data])

  // Mobile opens at the newest page; fetch the oldest page in the background
  // so an early title-generation request can still name the session.
  const titleQuery = useQuery({
    queryKey: ['request-session-title', id],
    queryFn: ({ signal }) => api.getRequestSession(id, undefined, { signal, priority: 'low' }, 'asc'),
    enabled:
      mobile && Boolean(query.data) && Boolean(query.hasNextPage) && !exchanges.some((item) => item.side === 'title'),
    staleTime: 60_000,
    gcTime: 60_000,
  })

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const visibility = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.sessionRequest
          if (!id) continue
          if (entry.isIntersecting) visibility.set(id, entry.boundingClientRect.top)
          else visibility.delete(id)
        }
        const first = [...visibility].sort((a, b) => Math.abs(a[1]) - Math.abs(b[1]))[0]
        if (first) setActiveId(first[0])
      },
      { rootMargin: '-10% 0px -60% 0px', threshold: 0 },
    )
    for (const exchange of exchanges) {
      const node = document.getElementById(`session-${exchange.request.id}`)
      if (node) observer.observe(node)
    }
    return () => observer.disconnect()
  }, [exchanges])

  if (query.error && !query.data)
    return <RouteError kicker="dsh · sessions" title="Failed to load session" message={query.error.message} />
  if (query.isPending) return <SessionPagePending />
  const sessionId = query.data?.pages[0]?.sessionId
  const chronological = mobile ? [...exchanges].reverse() : exchanges
  const loadedTitle = chronological
    .find((item) => item.side === 'title')
    ?.parts.find((part) => part.kind === 'message' && part.role === 'assistant')?.text
  const oldestTitle = titleQuery.data?.requests.find(
    (request) => sideRequest(request, parseTranscriptInput(request.payloads.requestBody)) === 'title',
  )
  const titleText =
    loadedTitle ??
    (oldestTitle
      ? parseTranscriptResponse(oldestTitle.payloads.responseBody, oldestTitle.streamed).find(
          (part) => part.kind === 'message',
        )?.text
      : undefined)
  const title =
    titleText
      ?.trim()
      .replace(/^['"]|['"]$/g, '')
      .slice(0, 160) || 'Session history'
  const start = requests.length ? Math.min(...requests.map((r) => Date.parse(r.startedAt))) : null
  const end = requests.length ? Math.max(...requests.map((r) => Date.parse(r.startedAt) + r.durationMs)) : null
  const client =
    requests.find((r) => r.clientName)?.clientName ??
    (requests.some((r) => /codex/i.test(r.clientUserAgent ?? '')) ? 'codex' : null)
  const incomplete = Boolean(query.hasNextPage)
  async function exportSession(format: 'jsonl' | 'md') {
    setExporting(true)
    setExportError(null)
    try {
      const all: CapturedRequest[] = []
      let cursor: string | undefined
      do {
        const page = await api.getRequestSession(id, cursor, {}, 'asc')
        all.push(...page.requests)
        cursor = page.nextCursor ?? undefined
      } while (cursor)
      let previous: ReturnType<typeof parseTranscriptInput> | null = null
      let previousResponse: ReturnType<typeof parseTranscriptResponse> = []
      const output =
        format === 'jsonl'
          ? `${all.map((request) => JSON.stringify(request)).join('\n')}\n`
          : all
              .map((request, index) => {
                const input = parseTranscriptInput(request.payloads.requestBody)
                const side = sideRequest(request, input)
                const delta = side ? diffTranscript(null, input) : diffTranscript(previous, input, previousResponse)
                const response = parseTranscriptResponse(request.payloads.responseBody, request.streamed)
                if (!side) {
                  previous = input
                  previousResponse = response
                }
                const parts = [...delta.parts, ...response]
                return `## Request ${index + 1} · ${request.id}\n\n${delta.replaced == null ? '' : `> Context reset · ${delta.replaced} messages replaced\n\n`}${parts.map((part) => `### ${part.name ?? part.role}\n\n${part.text}`).join('\n\n')}`
              })
              .join('\n\n')
      const url = URL.createObjectURL(
        new Blob([output], { type: format === 'jsonl' ? 'application/x-ndjson' : 'text/markdown' }),
      )
      const link = document.createElement('a')
      link.href = url
      link.download = `llama-dash-session-${id}.${format}`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }
  return (
    <div className="content">
      <div className="page min-h-full min-w-0 max-md:[&>.page-header]:flex-wrap max-md:[&_.page-header-action]:w-full">
        <PageHeader
          kicker="dsh · requests · session"
          title={title}
          titleNode={
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="page-header-title m-0 min-w-0 break-words text-xl font-semibold text-fg">{title}</h1>
              {client ? (
                <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-fg-dim">
                  {client}
                </span>
              ) : null}
            </div>
          }
          subtitle={
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="break-all">{sessionId ?? '—'}</span>
              {sessionId ? (
                <CopyButton
                  text={sessionId}
                  variant="icon"
                  ariaLabel="Copy session ID"
                  className="flex h-6 w-6 items-center justify-center rounded-sm text-fg-dim hover:text-fg focus-visible:outline-none focus-visible:shadow-focus max-md:h-11 max-md:w-11"
                />
              ) : null}
              {start != null && end != null ? (
                <span>
                  {' '}
                  · {new Date(start).toLocaleTimeString()} → {new Date(end).toLocaleTimeString()} ·{' '}
                  {formatDuration(end - start)}
                  {incomplete ? ' · loaded' : ''}
                </span>
              ) : null}
            </div>
          }
          action={
            <div className="flex flex-wrap gap-2">
              <Link to="/requests/$id" params={{ id }} className="btn btn-sm max-md:min-h-11">
                ← request detail
              </Link>
              <button
                type="button"
                className="btn btn-sm max-md:min-h-11"
                disabled={exporting || !sessionId}
                onClick={() => void exportSession('jsonl')}
              >
                {exporting ? 'exporting…' : 'raw JSONL'}
              </button>
              <button
                type="button"
                className="btn btn-sm max-md:min-h-11"
                disabled={exporting || !sessionId}
                onClick={() => void exportSession('md')}
              >
                export .md
              </button>
              {sessionId ? (
                <Link to="/requests" search={{ session: sessionId }} className="btn btn-sm max-md:min-h-11">
                  open in requests ›
                </Link>
              ) : null}
            </div>
          }
        />
        {exportError ? (
          <p role="alert" className="px-6 text-xs text-err">
            Export failed: {exportError}
          </p>
        ) : null}
        {!sessionId ? (
          <p className="p-6 text-sm text-fg-dim">No session ID was captured for this request.</p>
        ) : (
          <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_300px] max-lg:grid-cols-1">
            <main className="min-w-0">
              <p className="sr-only">
                Only retained captures are shown.{' '}
                {mobile ? 'Newest requests appear first.' : 'Oldest requests appear first.'}
              </p>
              <SessionTranscriptView exchanges={exchanges} filters={filters} />
              {query.isFetchingNextPage ? (
                <div role="status" aria-label="Loading more session requests" className="mx-auto max-w-[820px] px-6">
                  <SessionExchangeSkeleton />
                </div>
              ) : null}
              {query.hasNextPage ? (
                <div className="mx-auto max-w-[820px] px-6 pb-8 max-md:px-3">
                  <button
                    type="button"
                    className="btn min-h-11 max-md:w-full"
                    disabled={query.isFetchingNextPage}
                    onClick={() => void query.fetchNextPage()}
                  >
                    {query.isFetchingNextPage ? 'Loading…' : mobile ? 'Load older requests' : 'Load more requests'}
                  </button>
                </div>
              ) : null}
              {query.isFetchNextPageError ? (
                <p className="px-6 text-xs text-err">Could not load more requests. Try again.</p>
              ) : null}
            </main>
            <SessionRail
              exchanges={exchanges}
              filters={filters}
              setFilters={setFilters}
              incomplete={incomplete}
              client={client}
              activeId={activeId}
              onSelect={setActiveId}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function SessionRail({
  exchanges,
  filters,
  setFilters,
  incomplete,
  client,
  activeId,
  onSelect,
}: {
  exchanges: TranscriptExchange[]
  filters: TranscriptFilters
  setFilters: React.Dispatch<React.SetStateAction<TranscriptFilters>>
  incomplete: boolean
  client: string | null
  activeId: string | null
  onSelect: (id: string) => void
}) {
  const requests = exchanges.map((item) => item.request)
  const total = (key: 'promptTokens' | 'completionTokens' | 'cacheReadTokens' | 'costUsd') =>
    requests.reduce((sum, request) => sum + (request[key] ?? 0), 0)
  const inputs = requests.reduce((sum, request) => sum + (sessionInputTokens(request) ?? 0), 0)
  const outputs = total('completionTokens')
  const cacheRequests = requests.filter(
    (request) => request.cacheReadTokens != null && sessionInputTokens(request) != null,
  )
  const cacheInputs = cacheRequests.reduce((sum, request) => sum + (sessionInputTokens(request) ?? 0), 0)
  const knownCached = cacheRequests.reduce((sum, request) => sum + (request.cacheReadTokens ?? 0), 0)
  const max = Math.max(1, ...requests.map((request) => request.durationMs))
  const controls: Array<[keyof TranscriptFilters, string]> = [
    ['messages', 'messages'],
    ['tools', 'tool calls'],
    ['results', 'tool results expanded'],
    ['thinking', 'thinking'],
    ['side', 'side requests'],
    ['context', 'context pills'],
  ]
  const body = (
    <div className="font-mono text-[11px] text-fg-dim">
      <section className="border-b border-border p-4">
        <div className="mb-3 text-[10px] uppercase tracking-wider text-fg-faint">
          Session {incomplete ? '· loaded requests' : ''}
        </div>
        {[
          ['client', requests.find((r) => r.clientUserAgent)?.clientUserAgent ?? client ?? '—'],
          ['model', [...new Set(requests.map((r) => r.model).filter(Boolean))].join(', ') || '—'],
          ['requests', `${requests.length} · ${exchanges.filter((item) => item.side).length} side`],
          [
            'tokens in · out',
            `${requests.some((r) => r.promptTokens != null) ? formatCompactNumber(inputs) : '—'} · ${requests.some((r) => r.completionTokens != null) ? formatCompactNumber(outputs) : '—'}`,
          ],
          [
            'cache read',
            cacheInputs
              ? `${Math.round((knownCached / cacheInputs) * 100)}%${cacheRequests.length < requests.length ? ' · partial' : ''}`
              : '—',
          ],
          [
            'tool calls',
            `${exchanges.reduce((n, item) => n + item.parts.filter((part) => part.kind === 'tool').length, 0)} · ${exchanges.reduce((n, item) => n + item.parts.filter((part) => part.kind === 'result' && part.isError).length, 0)} errors`,
          ],
          [
            'cost',
            requests.some((r) => r.costUsd != null)
              ? `$${total('costUsd').toFixed(4)}${requests.some((r) => r.costUsd == null) ? ' · partial' : ''}`
              : '—',
          ],
          ['api key', requests.find((r) => r.keyName)?.keyName ?? '—'],
        ].map(([label, value]) => (
          <div
            key={label}
            className="flex justify-between gap-3 border-b border-dashed border-border py-1.5 last:border-0"
          >
            <span>{label}</span>
            <span className="break-all text-right text-fg">{value}</span>
          </div>
        ))}
      </section>
      <section className="border-b border-border p-4">
        <div className="mb-3 flex justify-between text-[10px] uppercase tracking-wider text-fg-faint">
          <span>Requests</span>
          <span>latency</span>
        </div>
        <div className="space-y-1">
          {exchanges.map(({ request, number, side }) => (
            <a
              key={request.id}
              href={`#session-${request.id}`}
              onClick={(event) => {
                const target = document.getElementById(`session-${request.id}`)
                if (!target) return
                const parent = target.parentElement?.closest('details')
                if (parent) parent.open = true
                event.preventDefault()
                target.scrollIntoView({ block: 'start' })
                onSelect(request.id)
              }}
              className={`flex items-center gap-2 no-underline hover:text-fg ${activeId === request.id ? 'font-semibold text-fg' : ''}`}
            >
              <span className="w-6">#{number}</span>
              <span className="h-1.5 min-w-0 flex-1 bg-surface-2">
                <span
                  className={
                    request.statusCode >= 400
                      ? 'block h-full bg-err'
                      : side
                        ? 'block h-full bg-accent'
                        : 'block h-full bg-info'
                  }
                  style={{ width: `${Math.max(2, (request.durationMs / max) * 100)}%` }}
                />
              </span>
              <span className="w-12 text-right">{formatDuration(request.durationMs)}</span>
            </a>
          ))}
        </div>
      </section>
      <section className="p-4">
        <div className="mb-3 text-[10px] uppercase tracking-wider text-fg-faint">Show</div>
        <div className="space-y-2">
          {controls.map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={filters[key]}
                onChange={(event) => setFilters((previous) => ({ ...previous, [key]: event.target.checked }))}
              />
              {label}
            </label>
          ))}
        </div>
      </section>
    </div>
  )
  return (
    <aside className="min-w-0 border-l border-border bg-surface-0 max-lg:order-first max-lg:border-b max-lg:border-l-0">
      <div className="max-lg:hidden">{body}</div>
      <details className="hidden max-lg:block">
        <summary className="cursor-pointer px-4 py-3 font-mono text-xs text-fg">Session details & filters</summary>
        {body}
      </details>
    </aside>
  )
}
