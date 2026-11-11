import { useInfiniteQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { RouteError } from '../../components/RouteError'
import { api } from '../../lib/api'
import { formatDuration } from '../../lib/format'
import { useMediaQuery } from '../../lib/use-media-query'
import { RequestTextView } from './RequestTextView'
import { SessionExchangeSkeleton, SessionPagePending } from './SessionPagePending'
import { requestMessages, responseText, type SessionMessage } from './sessionMessages'

export function SessionPage({ id }: { id: string }) {
  const mobile = useMediaQuery('(max-width: 768px)')
  const order = mobile ? 'desc' : 'asc'
  const query = useInfiniteQuery({
    queryKey: ['request-session', id, order],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => api.getRequestSession(id, pageParam, { signal }, order),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 0,
    gcTime: 60_000,
  })
  const requests = useMemo(() => query.data?.pages.flatMap((page) => page.requests) ?? [], [query.data])
  const parsed = useMemo(() => new WeakMap<object, { messages: SessionMessage[]; response: string }>(), [])
  const exchanges = useMemo(() => {
    const capture = (request: {
      streamed: boolean
      payloads: { requestBody: string | null; responseBody: string | null }
    }) => {
      let result = parsed.get(request)
      if (!result) {
        result = {
          messages: requestMessages(request.payloads.requestBody),
          response: responseText(request.payloads.responseBody, request.streamed),
        }
        parsed.set(request, result)
      }
      return result
    }
    const context = mobile ? query.data?.pages.at(-1)?.olderContext : null
    return requests.map((request, index) => {
      const { messages, response } = capture(request)
      const older = mobile ? (requests[index + 1] ?? context) : requests[index - 1]
      const previous = older ? capture(older) : { messages: [], response: '' }
      let common = 0
      while (
        common < previous.messages.length &&
        common < messages.length &&
        previous.messages[common].role === messages[common].role &&
        previous.messages[common].text === messages[common].text
      )
        common++
      const added = messages.slice(common)
      if (common > 0 && added[0]?.role === 'assistant' && added[0].text === previous.response) added.shift()
      return { request, messages: mobile ? added.reverse() : added, response, hasReadableInput: messages.length > 0 }
    })
  }, [requests, parsed, mobile, query.data])

  if (query.error && !query.data)
    return <RouteError kicker="dsh · sessions" title="Failed to load session" message={query.error.message} />
  if (query.isPending) return <SessionPagePending />
  const sessionId = query.data?.pages[0]?.sessionId
  return (
    <div className="content">
      <div className="page min-h-full min-w-0 max-sm:[&>.page-header]:flex-wrap max-sm:[&_.page-header-action]:w-full">
        <PageHeader
          kicker="dsh · requests · session"
          title="Session history"
          subtitle="A read-only timeline of captured inference requests"
          action={
            <Link
              to="/requests/$id"
              params={{ id }}
              className="inline-flex min-h-11 items-center font-mono text-xs text-info sm:min-h-0"
            >
              ← request detail
            </Link>
          }
        />
        <main className="mx-auto w-full min-w-0 max-w-5xl px-6 pb-12 max-md:px-3">
          {!sessionId ? (
            <p className="py-8 text-sm text-fg-dim">No session ID was captured for this request.</p>
          ) : (
            <>
              <div className="border-b border-border py-4 font-mono text-xs text-fg-dim break-all">
                session <span className="text-fg">{sessionId}</span>
              </div>
              <p className="my-4 text-xs text-fg-dim">
                Only requests and payloads retained by llama-dash appear here. Missing or truncated captures may leave
                gaps; repeated context is collapsed when it matches the preceding request.
                {mobile ? ' Newest requests appear first.' : null}
              </p>
              <div className="space-y-5">
                {exchanges.map(({ request, messages, response, hasReadableInput }, index) => (
                  <section
                    key={request.id}
                    className="min-w-0 rounded border border-border"
                    aria-label={`Request ${index + 1}`}
                  >
                    <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-4 py-3 font-mono text-[11px] text-fg-dim max-sm:px-3 max-sm:text-xs">
                      <Link
                        to="/requests/$id"
                        params={{ id: request.id }}
                        className="inline-flex min-h-11 max-w-full min-w-0 items-center break-all text-info sm:min-h-0"
                      >
                        #{index + 1} · {request.id}
                      </Link>
                      <span>{new Date(request.startedAt).toLocaleString()}</span>
                      <span className="min-w-0 max-w-full break-all">{request.model ?? 'unknown model'}</span>
                      <span className={request.statusCode >= 400 ? 'text-err' : 'text-ok'}>
                        HTTP {request.statusCode}
                      </span>
                      <span>{formatDuration(request.durationMs)}</span>
                      <span>{request.totalTokens?.toLocaleString() ?? '—'} tokens</span>
                      {request.id === id ? <span className="text-fg">selected request</span> : null}
                    </div>
                    <div className="min-w-0 space-y-4 px-4 py-4 max-sm:px-3">
                      {mobile ? (
                        <SessionResponse response={response} hasBody={Boolean(request.payloads.responseBody)} />
                      ) : null}
                      {messages.map((message, messageIndex) => (
                        // Messages are immutable within an exchange.
                        // biome-ignore lint/suspicious/noArrayIndexKey: repeated messages need distinct keys.
                        <Message key={messageIndex} label={message.role} text={message.text} />
                      ))}
                      {!mobile ? (
                        <SessionResponse response={response} hasBody={Boolean(request.payloads.responseBody)} />
                      ) : null}
                      {!request.payloads.requestBody ? (
                        <p className="m-0 font-mono text-xs text-fg-dim">Request body unavailable.</p>
                      ) : null}
                      {request.payloads.requestBody && !hasReadableInput ? (
                        <p className="m-0 font-mono text-xs text-fg-dim">
                          No readable messages in the captured request. Open the request to inspect its body.
                        </p>
                      ) : null}
                      {request.payloads.requestBody?.includes('...[truncated ') ||
                      request.payloads.responseBody?.includes('...[truncated ') ? (
                        <p className="m-0 font-mono text-xs text-warn">
                          A captured body was truncated; open the request for the available raw data.
                        </p>
                      ) : null}
                      {request.payloads.requestBody &&
                      (!hasReadableInput || request.payloads.requestBody.includes('...[truncated ')) ? (
                        <CapturedBody label="request" body={request.payloads.requestBody} />
                      ) : null}
                      {request.payloads.responseBody &&
                      (!response || request.payloads.responseBody.includes('...[truncated ')) ? (
                        <CapturedBody label="response" body={request.payloads.responseBody} />
                      ) : null}
                      {request.error ? <p className="m-0 break-words text-xs text-err">{request.error}</p> : null}
                    </div>
                  </section>
                ))}
              </div>
              {query.isFetchingNextPage ? (
                <div role="status" aria-label="Loading more session requests" className="mt-5">
                  <span className="sr-only">Loading more session requests…</span>
                  <SessionExchangeSkeleton />
                </div>
              ) : null}
              {query.hasNextPage ? (
                <button
                  type="button"
                  className="my-5 min-h-11 rounded border border-border px-4 py-2 font-mono text-xs text-fg hover:border-fg-dim disabled:opacity-50 max-sm:w-full"
                  disabled={query.isFetchingNextPage}
                  onClick={() => void query.fetchNextPage()}
                >
                  {query.isFetchingNextPage ? 'Loading…' : mobile ? 'Load older requests' : 'Load more requests'}
                </button>
              ) : null}
              {query.isFetchNextPageError ? (
                <p className="text-xs text-err">Could not load more requests. Try again.</p>
              ) : null}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

function SessionResponse({ response, hasBody }: { response: string; hasBody: boolean }) {
  if (response) return <Message label="assistant" text={response} />
  return (
    <p className="m-0 font-mono text-xs text-fg-dim">
      {hasBody
        ? 'No readable response text captured. Open the request to inspect the raw response.'
        : 'Response body unavailable.'}
    </p>
  )
}

function Message({ label, text }: { label: string; text: string }) {
  return (
    <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 max-sm:grid-cols-1 max-sm:gap-1">
      <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-dim">{label}</div>
      <div className="min-w-0 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-fg max-sm:text-sm">
        {text}
      </div>
    </div>
  )
}

function CapturedBody({ label, body }: { label: string; body: string }) {
  const [open, setOpen] = useState(false)
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)} className="min-w-0 text-xs text-fg-dim">
      <summary className="min-h-11 cursor-pointer py-3 font-mono text-info">View captured {label} body</summary>
      {open ? <RequestTextView text={body} className="max-h-80 rounded border border-border p-3" /> : null}
    </details>
  )
}
