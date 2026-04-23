import { useHotkey } from '@tanstack/react-hotkeys'
import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, LoaderCircle, RotateCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { Tooltip } from '../../components/Tooltip'
import type { ApiRequestDetail } from '../../lib/api'
import {
  analyzeResponse,
  analyzeTiming,
  buildCurlCommand,
  byteSize,
  calculateTokPerSec,
  deriveClientLabel,
  deriveRewriteLabel,
  formatCostUsd,
  formatDuration,
  parseHeaderMap,
  parseRequestPayload,
  parseSseStream,
} from './requestDetailUtils'
import { RequestPayloadPane } from './RequestPayloadPane'
import { RequestTokenTrace } from './RequestTokenTrace'

type Props = {
  req: ApiRequestDetail
  prevId: string | null
  nextId: string | null
  isPrevPending: boolean
  isNextPending: boolean
}

export function RequestDetailContent({ req, prevId, nextId, isPrevPending, isNextPending }: Props) {
  const ok = req.statusCode >= 200 && req.statusCode < 300
  const statusColor =
    req.statusCode >= 400
      ? '!text-err'
      : req.statusCode >= 300
        ? '!text-warn'
        : req.statusCode >= 200
          ? '!text-ok'
          : '!text-fg-muted'
  const navigate = useNavigate()
  const [copiedCurl, setCopiedCurl] = useState(false)
  const railSectionTitle = 'mb-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-faint'
  const railSectionDivider = 'mt-3.5 border-t border-border pt-3.5'
  const endpointMetricLabel = 'font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim'
  const endpointMetricValue = 'mt-1 font-mono text-[17px] font-semibold tracking-[-0.03em] text-fg'

  useHotkey('H', (e) => {
    if (!prevId) return
    e.preventDefault()
    navigate({ to: '/requests/$id', params: { id: prevId } })
  })

  useHotkey('L', (e) => {
    if (!nextId) return
    e.preventDefault()
    navigate({ to: '/requests/$id', params: { id: nextId } })
  })

  const reqHeaders = useMemo(() => parseHeaderMap(req.requestHeaders), [req.requestHeaders])
  const resHeaders = useMemo(() => parseHeaderMap(req.responseHeaders), [req.responseHeaders])
  const requestPayload = useMemo(() => parseRequestPayload(req.requestBody), [req.requestBody])
  const responseAnalysis = useMemo(
    () => analyzeResponse(req.responseBody, req.streamed),
    [req.responseBody, req.streamed],
  )
  const parsedSse = useMemo(
    () => (req.streamed && req.responseBody ? parseSseStream(req.responseBody) : null),
    [req.responseBody, req.streamed],
  )
  const timing = useMemo(() => analyzeTiming(parsedSse, req.streamCloseMs), [parsedSse, req.streamCloseMs])
  const clientLabel = deriveClientLabel(reqHeaders)
  const curlCommand = useMemo(
    () => buildCurlCommand(req.endpoint, req.requestBody, reqHeaders),
    [req.endpoint, req.requestBody, reqHeaders],
  )
  const tokPerSec = calculateTokPerSec(req.completionTokens, req.durationMs)

  return (
    <>
      <PageHeader
        kicker={`req · ${req.id.slice(4, 10)}… · a · split`}
        title={`${req.method} ${req.endpoint}`}
        subtitle={
          <span translate="no">
            <span>{req.model ? `${req.model}` : 'request detail'}</span>
            <span className="text-fg-muted"> · {req.keyName ?? 'system'}</span>
          </span>
        }
        variant="integrated"
        action={
          <div className="flex items-center gap-2">
            <div className="flex shrink-0 items-center gap-1.5">
              <Tooltip
                label={
                  <>
                    Newer <kbd className="tooltip-kbd">H</kbd>
                  </>
                }
                side="bottom"
              >
                <Link
                  to="/requests/$id"
                  params={{ id: prevId ?? '' }}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded border border-border-strong text-fg-muted transition-[background-color,color,border-color,transform] duration-100 hover:border-fg-dim hover:bg-surface-3 hover:text-fg active:scale-95 ${prevId ? '' : 'pointer-events-none opacity-30'}`}
                  disabled={!prevId || isPrevPending}
                  aria-disabled={!prevId || isPrevPending}
                  onClick={(e) => !prevId && e.preventDefault()}
                >
                  {isPrevPending ? (
                    <LoaderCircle size={16} strokeWidth={2} aria-hidden="true" className="animate-spin" />
                  ) : (
                    <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
                  )}
                </Link>
              </Tooltip>
              <Tooltip
                label={
                  <>
                    Older <kbd className="tooltip-kbd">L</kbd>
                  </>
                }
                side="bottom"
              >
                <Link
                  to="/requests/$id"
                  params={{ id: nextId ?? '' }}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded border border-border-strong text-fg-muted transition-[background-color,color,border-color,transform] duration-100 hover:border-fg-dim hover:bg-surface-3 hover:text-fg active:scale-95 ${nextId ? '' : 'pointer-events-none opacity-30'}`}
                  disabled={!nextId || isNextPending}
                  aria-disabled={!nextId || isNextPending}
                  onClick={(e) => !nextId && e.preventDefault()}
                >
                  {isNextPending ? (
                    <LoaderCircle size={16} strokeWidth={2} aria-hidden="true" className="animate-spin" />
                  ) : (
                    <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
                  )}
                </Link>
              </Tooltip>
            </div>
            <button type="button" className="btn btn-ghost btn-xs" disabled>
              <RotateCw className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
              replay
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => {
                navigator.clipboard.writeText(curlCommand)
                setCopiedCurl(true)
                setTimeout(() => setCopiedCurl(false), 1500)
              }}
            >
              {copiedCurl ? 'copied' : 'copy curl'}
            </button>
          </div>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-[250px_minmax(0,1fr)_280px] items-stretch gap-0 max-[1200px]:grid-cols-[168px_minmax(0,1fr)] max-[900px]:grid-cols-1">
        <aside className="border-r border-border bg-surface-1 px-3.5 py-4 max-[900px]:border-r-0 max-[900px]:border-b">
          <div>
            <div className={railSectionTitle}>Summary</div>
            <dl className="detail-meta-list">
              <div>
                <dt>method</dt>
                <dd>{req.method}</dd>
              </div>
              <div>
                <dt>endpoint</dt>
                <dd className="mono">{req.endpoint}</dd>
              </div>
              <div>
                <dt>status</dt>
                <dd className={statusColor}>
                  {req.statusCode} {ok ? 'OK' : ''}
                </dd>
              </div>
              <div>
                <dt>stream</dt>
                <dd>{req.streamed ? 'yes • SSE' : 'no'}</dd>
              </div>
              <div>
                <dt>key</dt>
                <dd>{req.keyName ?? 'system'}</dd>
              </div>
              <div>
                <dt>client</dt>
                <dd>{clientLabel ?? '—'}</dd>
              </div>
            </dl>
          </div>

          <div className={railSectionDivider}>
            <div className={railSectionTitle}>Attribution</div>
            <dl className="detail-meta-list">
              <div>
                <dt>client</dt>
                <dd>{req.clientName ?? '—'}</dd>
              </div>
              <div>
                <dt>end user</dt>
                <dd>{req.endUserId ?? '—'}</dd>
              </div>
              <div>
                <dt>session</dt>
                <dd>
                  {req.sessionId ? (
                    <Link
                      to="/requests"
                      search={{ session: req.sessionId }}
                      className="font-mono text-info no-underline hover:text-fg"
                    >
                      {req.sessionId}
                    </Link>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div>
                <dt>related</dt>
                <dd>
                  {req.sessionId ? (
                    <Link
                      to="/requests"
                      search={{ session: req.sessionId }}
                      className="font-mono text-info no-underline hover:text-fg"
                    >
                      other requests in this session
                    </Link>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div className={railSectionDivider}>
            <div className={railSectionTitle}>Model</div>
            <dl className="detail-meta-list">
              <div>
                <dt>requested</dt>
                <dd>{requestPayload.model ?? '—'}</dd>
              </div>
              <div>
                <dt>served</dt>
                <dd>{req.model ?? '—'}</dd>
              </div>
              <div>
                <dt>rewrite</dt>
                <dd>{deriveRewriteLabel(requestPayload.model, req.model, resHeaders) ?? '—'}</dd>
              </div>
            </dl>
          </div>

          <div className={railSectionDivider}>
            <div className={railSectionTitle}>Routing</div>
            <dl className="detail-meta-list">
              <div>
                <dt>rule</dt>
                <dd>{req.routingRuleName ?? '—'}</dd>
              </div>
              <div>
                <dt>action</dt>
                <dd>{req.routingActionType ?? '—'}</dd>
              </div>
              <div>
                <dt>requested</dt>
                <dd>{req.routingRequestedModel ?? requestPayload.model ?? '—'}</dd>
              </div>
              <div>
                <dt>routed</dt>
                <dd>{req.routingRoutedModel ?? '—'}</dd>
              </div>
              <div>
                <dt>reject</dt>
                <dd>{req.routingRejectReason ?? '—'}</dd>
              </div>
            </dl>
          </div>

          <div className={railSectionDivider}>
            <div className={railSectionTitle}>Timing</div>
            <dl className="detail-meta-list">
              <div>
                <dt>queue</dt>
                <dd>{timing.queueMs != null ? formatDuration(timing.queueMs) : '—'}</dd>
              </div>
              <div>
                <dt>prefill</dt>
                <dd>{timing.prefillMs != null ? formatDuration(timing.prefillMs) : '—'}</dd>
              </div>
              <div>
                <dt>ttft</dt>
                <dd>{timing.ttftMs != null ? formatDuration(timing.ttftMs) : '—'}</dd>
              </div>
              <div>
                <dt>total</dt>
                <dd>{formatDuration(req.durationMs)}</dd>
              </div>
              <div>
                <dt>stream close</dt>
                <dd>{timing.streamCloseMs != null ? formatDuration(timing.streamCloseMs) : '—'}</dd>
              </div>
            </dl>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-col gap-0">
          <div className="border-r border-b border-border bg-surface-1 max-[1200px]:border-r-0 max-[900px]:border-t max-[900px]:border-t-border">
            <div className="grid min-h-[86px] grid-cols-[minmax(0,1fr)_90px_90px_90px_90px_90px_90px] max-[1900px]:grid-cols-[minmax(0,1fr)_100px_100px_100px_100px_100px_84px] max-[1500px]:grid-cols-3 max-[900px]:grid-cols-2">
              <div className="border-r border-border px-4 py-4 max-[1500px]:col-span-3 max-[1500px]:border-r-0 max-[1500px]:border-b max-[900px]:col-span-2">
                <div className={endpointMetricLabel}>Endpoint</div>
                <div className="mt-2 flex flex-wrap wrap-anywhere items-baseline gap-x-3 gap-y-1 font-mono">
                  <span className="text-[22px] font-semibold tracking-[-0.04em] text-fg">{req.method}</span>
                  <span className="text-[22px] font-semibold tracking-[-0.04em] text-info" translate="no">
                    {req.endpoint}
                  </span>
                </div>
              </div>
              <div className="border-r border-border px-4 py-4 max-[1500px]:border-r-0 max-[1500px]:border-b max-[900px]:border-b">
                <div className={endpointMetricLabel}>status</div>
                <div className={`${endpointMetricValue} ${statusColor}`}>{req.statusCode}</div>
              </div>
              <div className="border-r border-border px-4 py-4 max-[1500px]:border-r-0 max-[1500px]:border-b max-[900px]:border-r-0 max-[900px]:border-b">
                <div className={endpointMetricLabel}>tok-in</div>
                <div className={endpointMetricValue}>{req.promptTokens?.toLocaleString() ?? '—'}</div>
              </div>
              <div className="border-r border-border px-4 py-4 max-[1500px]:border-r-0 max-[1500px]:border-b max-[900px]:border-b">
                <div className={endpointMetricLabel}>tok-out</div>
                <div className={endpointMetricValue}>{req.completionTokens?.toLocaleString() ?? '—'}</div>
              </div>
              <div className="border-r border-border px-4 py-4 max-[1500px]:border-r-0 max-[900px]:border-r-0 max-[900px]:border-b">
                <div className={endpointMetricLabel}>total</div>
                <div className={endpointMetricValue}>{req.totalTokens?.toLocaleString() ?? '—'}</div>
              </div>
              <div className="border-r border-border px-4 py-4 max-[1500px]:border-r-0 max-[900px]:border-b">
                <div className={endpointMetricLabel}>duration</div>
                <div className={endpointMetricValue}>{formatDuration(req.durationMs)}</div>
              </div>
              <div className="px-4 py-4">
                <div className={endpointMetricLabel}>tok/s</div>
                <div className={endpointMetricValue}>{tokPerSec?.toLocaleString() ?? '—'}</div>
              </div>
            </div>
          </div>

          {req.streamed && req.completionTokens ? (
            <RequestTokenTrace
              durationMs={req.durationMs}
              completionTokens={req.completionTokens}
              tokPerSec={tokPerSec}
            />
          ) : null}

          {req.error ? (
            <section className="panel !rounded-none !border-l-0 !border-r border-r-border !border-b-0 !bg-surface-1">
              <div className="panel-head bg-surface-1 px-4">
                <span className="panel-title" style={{ color: 'var(--err)' }}>
                  Error
                </span>
              </div>
              <pre className="m-0 whitespace-pre-wrap break-all px-3.5 py-3.5 font-mono text-xs leading-[1.5] text-err">
                {req.error}
              </pre>
            </section>
          ) : null}

          <section className="panel !rounded-none !border-l-0 !border-r border-r-border !border-b-0 !bg-surface-1 flex min-h-0 flex-1 flex-col">
            <div className="panel-head bg-surface-1 px-4">
              <span className="panel-title">Payloads</span>
              <span className="panel-sub">request • response</span>
              <span className="panel-sub ml-auto">{byteSize(req.requestBody ?? '')} on the wire</span>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-2 items-stretch max-[900px]:grid-cols-1">
              <RequestPayloadPane
                key={`${req.id}-request`}
                title="Request"
                subtitle={`${byteSize(req.requestBody ?? '')} • ${requestPayload.messagesCount} messages${requestPayload.toolsCount > 0 ? ` • ${requestPayload.toolsCount} tools` : ''} • ${req.promptTokens?.toLocaleString() ?? '—'} tok`}
                body={req.requestBody ?? ''}
                headers={reqHeaders}
                mode="pretty"
              />
              <RequestPayloadPane
                key={`${req.id}-response`}
                title="Response"
                subtitle={`${req.streamed ? 'SSE' : 'body'} • ${byteSize(req.responseBody ?? '')} • ${req.completionTokens?.toLocaleString() ?? '—'} tok`}
                body={responseAnalysis.displayBody}
                headers={resHeaders}
                mode={responseAnalysis.isSse ? 'sse' : responseAnalysis.isJson ? 'pretty' : 'raw'}
                sseStream={parsedSse}
              />
            </div>
          </section>
        </div>

        <aside className="bg-surface-2 px-3.5 py-3 max-[1200px]:col-span-full max-[1200px]:border-t max-[1200px]:border-t-border">
          <section>
            <div className={railSectionTitle}>Tokens</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="border border-border bg-surface-1 px-3 py-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">in</div>
                <div className="mt-2 font-mono text-[28px] font-semibold tracking-[-0.03em] text-fg">
                  {req.promptTokens?.toLocaleString() ?? '—'}
                </div>
              </div>
              <div className="border border-border bg-surface-1 px-3 py-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">out</div>
                <div className="mt-2 font-mono text-[28px] font-semibold tracking-[-0.03em] text-fg">
                  {req.completionTokens?.toLocaleString() ?? '—'}
                </div>
              </div>
            </div>
            {req.cacheCreationTokens != null || req.cacheReadTokens != null || req.costUsd != null ? (
              <dl className="m-0 mt-2 grid gap-1.5 font-mono text-xs">
                {req.cacheCreationTokens != null || req.cacheReadTokens != null ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-fg-dim">cache write</dt>
                      <dd className="m-0 text-fg">{req.cacheCreationTokens?.toLocaleString() ?? '—'}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-fg-dim">cache read</dt>
                      <dd className="m-0 text-fg">{req.cacheReadTokens?.toLocaleString() ?? '—'}</dd>
                    </div>
                  </>
                ) : null}
                {req.costUsd != null ? (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-fg-dim">cost</dt>
                    <dd className="m-0 text-fg">{formatCostUsd(req.costUsd)}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </section>

          <section className={railSectionDivider}>
            <div className={railSectionTitle}>Phases</div>
            <dl className="m-0 grid gap-2.5 font-mono text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-fg-dim">queue</dt>
                <dd className="m-0 text-fg">{timing.queueMs != null ? formatDuration(timing.queueMs) : '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-fg-dim">prefill</dt>
                <dd className="m-0 text-fg">{timing.prefillMs != null ? formatDuration(timing.prefillMs) : '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-fg-dim">ttft</dt>
                <dd className="m-0 text-fg">{timing.ttftMs != null ? formatDuration(timing.ttftMs) : '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-fg-dim">decode</dt>
                <dd className="m-0 text-fg">{timing.decodeMs != null ? formatDuration(timing.decodeMs) : '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-fg-dim">total</dt>
                <dd className="m-0 text-fg">{formatDuration(req.durationMs)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-fg-dim">stream close</dt>
                <dd className="m-0 text-fg">
                  {timing.streamCloseMs != null ? formatDuration(timing.streamCloseMs) : '—'}
                </dd>
              </div>
            </dl>
          </section>

          <section className={railSectionDivider}>
            <div className={railSectionTitle}>Request ID</div>
            <div className="mono text-xs text-fg">{req.id}</div>
          </section>

          <section className={`${railSectionDivider} grid gap-2`}>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-faint">Actions</div>
            <Link to="/playground" className="btn btn-sm">
              Open in Playground
            </Link>
            <button type="button" className="btn btn-sm" onClick={() => navigator.clipboard.writeText(curlCommand)}>
              Copy as curl
            </button>
            <button type="button" className="btn btn-sm" disabled>
              Download .jsonl
            </button>
          </section>
        </aside>
      </div>
    </>
  )
}
