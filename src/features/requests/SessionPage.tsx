import { useInfiniteQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { RouteError } from '../../components/RouteError'
import { api } from '../../lib/api'
import { formatDuration } from '../../lib/format'
import { requestMessages, responseText, type SessionMessage } from './sessionMessages'

export function SessionPage({ id }: { id: string }) {
  const query = useInfiniteQuery({
    queryKey: ['request-session', id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => api.getRequestSession(id, pageParam, { signal }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 0,
    gcTime: 60_000,
  })
  const requests = useMemo(() => query.data?.pages.flatMap((page) => page.requests) ?? [], [query.data])
  const parsed = useMemo(() => new WeakMap<object, { messages: SessionMessage[]; response: string }>(), [])
  const exchanges = useMemo(() => {
    let previous: SessionMessage[] = []
    let previousResponse = ''
    return requests.map((request) => {
      let capture = parsed.get(request)
      if (!capture) {
        capture = {
          messages: requestMessages(request.payloads.requestBody),
          response: responseText(request.payloads.responseBody, request.streamed),
        }
        parsed.set(request, capture)
      }
      const { messages, response } = capture
      let common = 0
      while (
        common < previous.length &&
        common < messages.length &&
        previous[common].role === messages[common].role &&
        previous[common].text === messages[common].text
      )
        common++
      // Only suppress an assistant message when it exactly repeats the last captured response.
      const added = messages.slice(common)
      if (common > 0 && added[0]?.role === 'assistant' && added[0].text === previousResponse) added.shift()
      previous = messages
      previousResponse = response
      return { request, messages: added, response: previousResponse, hasReadableInput: messages.length > 0 }
    })
  }, [requests, parsed])

  if (query.error && !query.data)
    return <RouteError kicker="dsh · sessions" title="Failed to load session" message={query.error.message} />
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
          {query.isPending ? (
            <p className="font-mono text-xs text-fg-dim">Loading session…</p>
          ) : !sessionId ? (
            <p className="py-8 text-sm text-fg-dim">No session ID was captured for this request.</p>
          ) : (
            <>
              <div className="border-b border-border py-4 font-mono text-xs text-fg-dim break-all">
                session <span className="text-fg">{sessionId}</span>
              </div>
              <p className="my-4 text-xs text-fg-dim">
                Only requests and payloads retained by llama-dash appear here. Missing or truncated captures may leave
                gaps; repeated context is collapsed when it matches the preceding request.
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
                      {messages.map((message, messageIndex) => (
                        // Messages are immutable within an exchange.
                        // biome-ignore lint/suspicious/noArrayIndexKey: repeated messages need distinct keys.
                        <Message key={messageIndex} label={message.role} text={message.text} />
                      ))}
                      {response ? (
                        <Message label="assistant" text={response} />
                      ) : (
                        <p className="m-0 font-mono text-xs text-fg-dim">
                          {request.payloads.responseBody
                            ? 'No readable response text captured. Open the request to inspect the raw response.'
                            : 'Response body unavailable.'}
                        </p>
                      )}
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
                      {request.error ? <p className="m-0 break-words text-xs text-err">{request.error}</p> : null}
                    </div>
                  </section>
                ))}
              </div>
              {query.hasNextPage ? (
                <button
                  type="button"
                  className="my-5 min-h-11 rounded border border-border px-4 py-2 font-mono text-xs text-fg hover:border-fg-dim disabled:opacity-50 max-sm:w-full"
                  disabled={query.isFetchingNextPage}
                  onClick={() => void query.fetchNextPage()}
                >
                  {query.isFetchingNextPage ? 'Loading…' : 'Load more requests'}
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
