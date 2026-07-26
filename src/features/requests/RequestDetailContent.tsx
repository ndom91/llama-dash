import { useHotkey } from '@tanstack/react-hotkeys'
import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Download, LoaderCircle } from 'lucide-react'
import { useMemo } from 'react'
import * as v from 'valibot'
import { CopyButton } from '../../components/CopyButton'
import { PageHeader } from '../../components/PageHeader'
import { Tooltip } from '../../components/Tooltip'
import type { ApiRequestDetail } from '../../lib/api'
import { cn } from '../../lib/cn'
import { isLeaderPending } from '../../lib/nav-leader'
import {
  StoredCredentialInjectionAuditSchema,
  type StoredCredentialInjectionAudit,
} from '../../lib/schemas/credential-injection'
import {
  analyzeResponse,
  analyzeTiming,
  buildCurlCommand,
  byteSize,
  calculateTokPerSec,
  deriveClientLabel,
  deriveRewriteLabel,
  formatDuration,
  formatLocalDateTime,
  formatPhaseMs,
  parseHeaderMap,
  parseRequestPayload,
  parseSseStream,
} from './requestDetailUtils'
import { RequestPayloadPane } from './RequestPayloadPane'
import { RequestTokenTrace } from './RequestTokenTrace'
import { requestKeyLabel } from './requestsListUtils'

type Props = {
  req: ApiRequestDetail
  prevId: string | null
  nextId: string | null
  isPrevPending: boolean
  isNextPending: boolean
}

type CredentialInjectionSummary = {
  countLabel: string
  credentialsLabel: string
  locationsLabel: string
  modesLabel: string
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
  const railSectionTitle = 'mb-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-faint'
  const railSectionDivider = 'mt-3.5 border-t border-border pt-3.5'
  const endpointMetricLabel = 'font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim'
  const endpointMetricValue = 'mt-1 font-mono text-[17px] font-semibold tracking-[-0.03em] text-fg'
  const statMetricCell = 'border-r border-b border-border px-4 py-3.5 min-[1500px]:border-b-0'
  const navButtonClass =
    'inline-flex h-8 w-8 items-center justify-center rounded border outline-none focus-visible:border-fg-dim focus-visible:shadow-none active:scale-95'

  useHotkey('H', (e) => {
    if (!prevId) return
    e.preventDefault()
    navigate({ to: '/requests/$id', params: { id: prevId } })
  })

  useHotkey('L', (e) => {
    // `g l` navigates to Logs. Both the sequence manager and this handler listen
    // on document, so without this guard pressing `g` then `l` here would fire
    // both — navigating to Logs *and* stepping to the next request.
    if (isLeaderPending()) return
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
  const timing = useMemo(
    () =>
      analyzeTiming({
        queueMs: req.queueMs,
        modelLoadingMs: req.modelLoadingMs,
        prefillMs: req.prefillMs,
        reasoningMs: req.reasoningMs,
        responseMs: req.responseMs,
        decodeMs: req.decodeMs,
        streamCloseMs: req.streamCloseMs,
        gpuPrefillMs: req.gpuPrefillMs,
        gpuDecodeMs: req.gpuDecodeMs,
        sse: parsedSse,
      }),
    [
      parsedSse,
      req.decodeMs,
      req.gpuDecodeMs,
      req.gpuPrefillMs,
      req.modelLoadingMs,
      req.prefillMs,
      req.queueMs,
      req.reasoningMs,
      req.responseMs,
      req.streamCloseMs,
    ],
  )
  const credentialInjection = useMemo(
    () => parseCredentialInjectionSummary(req.credentialInjectionJson),
    [req.credentialInjectionJson],
  )
  const clientLabel = deriveClientLabel(reqHeaders)
  const curlCommand = useMemo(
    () => buildCurlCommand(req.endpoint, req.requestBody, reqHeaders),
    [req.endpoint, req.requestBody, reqHeaders],
  )
  const tokPerSec = calculateTokPerSec(req.completionTokens, req.durationMs)
  const hasAttribution = Boolean(req.clientName || req.endUserId || req.sessionId)
  // Model names deliberately excluded: requested/served/rewrite live in the
  // Model section, and duplicating them here produced a `routed` row that
  // contradicted `served` (one fell back to req.model, the other to an em-dash).
  const isRouted = Boolean(
    req.routingRuleName ||
      req.routingActionType ||
      req.routingAuthMode ||
      req.routingTargetType ||
      req.routingTargetBaseUrl ||
      req.routingRejectReason ||
      credentialInjection,
  )
  const keyLabel = requestKeyLabel(req)
  const startedAtLabel = formatLocalDateTime(req.startedAt)

  return (
    <>
      <PageHeader
        parent={{ label: 'Requests', to: '/requests' }}
        title={req.id}
        variant="integrated"
        action={
          <div className="flex items-center gap-2">
            <CopyButton text={curlCommand} label="copy curl" variant="button" />
            <div className="flex shrink-0 items-center gap-1.5">
              <Tooltip
                label={
                  <>
                    Newer <kbd className="tooltip-kbd">H</kbd>
                  </>
                }
                side="bottom"
              >
                {prevId ? (
                  <Link
                    to="/requests/$id"
                    params={{ id: prevId }}
                    className={cn(
                      navButtonClass,
                      'border-border-strong text-fg-muted transition-[background-color,color,border-color,transform] duration-100 hover:border-fg-dim hover:bg-surface-3 hover:text-fg',
                    )}
                    aria-disabled={isPrevPending}
                  >
                    {isPrevPending ? (
                      <LoaderCircle size={16} strokeWidth={2} aria-hidden="true" className="animate-spin" />
                    ) : (
                      <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
                    )}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={cn(navButtonClass, 'border-border text-fg-faint opacity-30 transition-none')}
                    disabled
                    aria-label="No newer request"
                  >
                    <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
                  </button>
                )}
              </Tooltip>
              <Tooltip
                label={
                  <>
                    Older <kbd className="tooltip-kbd">L</kbd>
                  </>
                }
                side="bottom"
              >
                {nextId ? (
                  <Link
                    to="/requests/$id"
                    params={{ id: nextId }}
                    className={cn(
                      navButtonClass,
                      'border-border-strong text-fg-muted transition-[background-color,color,border-color,transform] duration-100 hover:border-fg-dim hover:bg-surface-3 hover:text-fg',
                    )}
                    aria-disabled={isNextPending}
                  >
                    {isNextPending ? (
                      <LoaderCircle size={16} strokeWidth={2} aria-hidden="true" className="animate-spin" />
                    ) : (
                      <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
                    )}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={cn(navButtonClass, 'border-border text-fg-faint opacity-30 transition-none')}
                    disabled
                    aria-label="No older request"
                  >
                    <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
                  </button>
                )}
              </Tooltip>
            </div>
          </div>
        }
      />

      <div className="request-detail-grid grid min-h-0 flex-1 items-stretch gap-0">
        <aside className="flex min-h-0 min-w-0 flex-col border-r border-border bg-surface-1 max-[1024px]:border-r-0 max-[1024px]:border-b">
          <div className="border-b border-border px-3.5 py-4 max-[1200px]:px-3">
            <div className={railSectionTitle}>Summary</div>
            <dl className="detail-meta-list">
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
                <dd>{keyLabel}</dd>
              </div>
              <div>
                {/* Labeled `host`, not `client`: this is the origin hostname
                    derived from request headers. The Attribution section below
                    has its own `client` (req.clientName), and two rows in the
                    same rail sharing one label meant different things. */}
                <dt>host</dt>
                <dd>{clientLabel ?? '—'}</dd>
              </div>
              <div>
                <dt>date</dt>
                <dd className="mono justify-start whitespace-nowrap text-left">{startedAtLabel}</dd>
              </div>
            </dl>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-4 max-[1200px]:px-3 [&>div:first-child]:mt-0 [&>div:first-child]:border-t-0 [&>div:first-child]:pt-0">
            {hasAttribution ? (
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
            ) : null}

            <div className={railSectionDivider}>
              <div className={railSectionTitle}>Model</div>
              <dl className="detail-meta-list">
                <div>
                  <dt>requested</dt>
                  <dd>{req.routingRequestedModel ?? requestPayload.model ?? '—'}</dd>
                </div>
                <div>
                  <dt>served</dt>
                  <dd>{req.routingRoutedModel ?? req.model ?? '—'}</dd>
                </div>
                <div>
                  <dt>rewrite</dt>
                  <dd>
                    {deriveRewriteLabel(
                      req.routingRequestedModel ?? requestPayload.model,
                      req.routingRoutedModel ?? req.model,
                      resHeaders,
                    ) ?? '—'}
                  </dd>
                </div>
              </dl>
            </div>

            <div className={railSectionDivider}>
              <div className={railSectionTitle}>Routing</div>
              {isRouted ? (
                <dl className="detail-meta-list">
                  {req.routingRuleName ? (
                    <div>
                      <dt>rule</dt>
                      <dd>{req.routingRuleName}</dd>
                    </div>
                  ) : null}
                  {req.routingActionType ? (
                    <div>
                      <dt>action</dt>
                      <dd>{req.routingActionType}</dd>
                    </div>
                  ) : null}
                  {req.routingAuthMode ? (
                    <div>
                      <dt>auth</dt>
                      <dd>
                        {req.routingAuthMode}
                        {req.routingAuthMode === 'passthrough' && req.routingPreserveAuthorization
                          ? ' · authorization preserved'
                          : ''}
                      </dd>
                    </div>
                  ) : null}
                  {req.routingTargetType ? (
                    <div>
                      <dt>target</dt>
                      <dd>{req.routingTargetType}</dd>
                    </div>
                  ) : null}
                  {req.routingTargetBaseUrl ? (
                    <div>
                      <dt>upstream</dt>
                      <dd>{req.routingTargetBaseUrl}</dd>
                    </div>
                  ) : null}
                  {req.routingRejectReason ? (
                    <div>
                      <dt>reject</dt>
                      <dd>{req.routingRejectReason}</dd>
                    </div>
                  ) : null}
                  {credentialInjection ? (
                    <>
                      <div>
                        <dt>credential</dt>
                        <dd>{credentialInjection.countLabel}</dd>
                      </div>
                      <div>
                        <dt>credentials</dt>
                        <dd>{credentialInjection.credentialsLabel}</dd>
                      </div>
                      <div>
                        <dt>injected</dt>
                        <dd>{credentialInjection.locationsLabel}</dd>
                      </div>
                      <div>
                        <dt>mode</dt>
                        <dd>{credentialInjection.modesLabel}</dd>
                      </div>
                    </>
                  ) : null}
                </dl>
              ) : (
                /* Previously this section always rendered nine rows, which for an
                   unrouted request meant six or seven em-dashes plus two
                   fabricated values: `authorization: default` (asserted even when
                   the `auth` row above showed `—`) and `target: llama_swap`
                   (asserted for requests with no target at all). */
                <div className="mono text-[11px] text-fg-dim">no routing rule matched</div>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-border px-3.5 py-4 max-[1200px]:px-3">
            <div className={railSectionTitle}>Timing</div>
            <dl className="detail-meta-list">
              <div>
                <dt>queue</dt>
                <dd>{formatPhaseMs(timing.queueMs)}</dd>
              </div>
              <div>
                <dt>model loading</dt>
                <dd>{formatPhaseMs(timing.modelLoadingMs)}</dd>
              </div>
              <div>
                <dt>prefill</dt>
                <dd>{formatPhaseMs(timing.prefillMs)}</dd>
              </div>
              <div>
                <dt>reasoning</dt>
                <dd>{formatPhaseMs(timing.reasoningMs)}</dd>
              </div>
              <div>
                <dt>response</dt>
                <dd>{formatPhaseMs(timing.responseMs)}</dd>
              </div>
              <div>
                <dt>total</dt>
                <dd>{formatDuration(req.durationMs)}</dd>
              </div>
            </dl>

            <div className={`${railSectionDivider} grid gap-2`}>
              <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-faint">Actions</div>
              <CopyButton
                text={getRequestDetailUrl()}
                label="Copy link"
                variant="button"
                icon="link"
                className="btn btn-ghost btn-sm w-full justify-start"
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm w-full justify-start"
                onClick={() => downloadRequestJsonl(req)}
              >
                <Download className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
                Download .jsonl
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-col gap-0">
          <div className="border-b border-border bg-surface-1 max-[1024px]:border-t max-[1024px]:border-t-border">
            {/* The endpoint cell that used to lead this strip is gone: it
                repeated the page h1 at 22px, so the duplicate was louder than
                the original. What remains is a uniform six-metric band. */}
            <div className="grid min-h-[72px] grid-cols-6 max-[1500px]:grid-cols-3 max-[1024px]:grid-cols-2">
              <div className={statMetricCell}>
                <div className={endpointMetricLabel}>status</div>
                <div className={cn(endpointMetricValue, statusColor)}>{req.statusCode}</div>
              </div>
              <div className={statMetricCell}>
                <div className={endpointMetricLabel}>tok-in</div>
                <div className={endpointMetricValue}>{req.promptTokens?.toLocaleString() ?? '—'}</div>
              </div>
              <div className={statMetricCell}>
                <div className={endpointMetricLabel}>tok-out</div>
                <div className={endpointMetricValue}>{req.completionTokens?.toLocaleString() ?? '—'}</div>
              </div>
              <div className={statMetricCell}>
                <div className={endpointMetricLabel}>total</div>
                <div className={endpointMetricValue}>
                  {req.promptTokens != null || req.completionTokens != null
                    ? ((req.promptTokens ?? 0) + (req.completionTokens ?? 0)).toLocaleString()
                    : '—'}
                </div>
              </div>
              <div className={statMetricCell}>
                <div className={endpointMetricLabel}>duration</div>
                <div className={endpointMetricValue}>{formatDuration(req.durationMs)}</div>
              </div>
              <div className={cn(statMetricCell, 'border-r-0')}>
                <div className={endpointMetricLabel}>tok/s</div>
                <div className={endpointMetricValue}>{tokPerSec?.toLocaleString() ?? '—'}</div>
              </div>
            </div>
          </div>

          <RequestTokenTrace durationMs={req.durationMs} timing={timing} />

          {req.error ? (
            <section className="panel !rounded-none !border-l-0 !border-r-0 !border-b-0 !bg-surface-1">
              <div className="panel-head bg-surface-1 px-4">
                <span className="panel-title" style={{ color: 'var(--err)' }}>
                  Error
                </span>
              </div>
              <pre className="m-0 whitespace-pre-wrap break-all px-3.5 py-3.5 font-mono text-xs leading-[1.5] text-err border-b-1 border-border">
                {req.error}
              </pre>
            </section>
          ) : null}

          <section className="panel !rounded-none !border-l-0 !border-r-0 !border-b-0 !bg-surface-1 flex min-h-0 flex-1 flex-col">
            <div className="grid min-h-0 flex-1 grid-cols-2 items-stretch max-[1024px]:grid-cols-1">
              <RequestPayloadPane
                key={`${req.id}-request`}
                title="Request"
                subtitle={`${byteSize(req.requestBody ?? '')} • ${requestPayload.messagesCount} messages${requestPayload.toolsCount > 0 ? ` • ${requestPayload.toolsCount} tools` : ''} • ${req.promptTokens?.toLocaleString() ?? '—'} tok`}
                body={req.requestBody ?? ''}
                headers={reqHeaders}
                mode="pretty"
                direction="request"
              />
              <RequestPayloadPane
                key={`${req.id}-response`}
                title="Response"
                subtitle={`${req.streamed ? 'SSE' : 'body'} • ${byteSize(req.responseBody ?? '')} • ${req.completionTokens?.toLocaleString() ?? '—'} tok`}
                body={responseAnalysis.displayBody}
                headers={resHeaders}
                mode={responseAnalysis.isSse ? 'sse' : responseAnalysis.isJson ? 'pretty' : 'raw'}
                direction="response"
                sseStream={parsedSse}
                assembledReasoning={req.assembledReasoning}
                assembledResponse={req.assembledResponse}
                assembledToolCalls={req.assembledToolCalls}
                assembledCitations={req.assembledCitations}
              />
            </div>
          </section>
        </div>
      </div>
    </>
  )
}

function parseCredentialInjectionSummary(raw: string | null): CredentialInjectionSummary | null {
  const audit = parseCredentialInjectionAudit(raw)
  if (!audit) return null
  try {
    if (!audit.count || audit.count <= 0) return null
    const locations = audit.locations ?? []
    const locationNames = uniqueLabels(locations.map((location) => location.name).filter(isNonEmptyString))
    const modes = uniqueLabels(
      locations.map((location) => formatCredentialInjectionMode(location.mode)).filter(isNonEmptyString),
    )
    const credentialLabels = uniqueLabels((audit.credentials ?? []).map(formatCredentialLabel).filter(isNonEmptyString))
    return {
      countLabel: audit.count === 1 ? '1 injected' : `${audit.count} injected`,
      credentialsLabel: credentialLabels.length > 0 ? credentialLabels.join(', ') : '—',
      locationsLabel: locationNames.length > 0 ? locationNames.join(', ') : '—',
      modesLabel: modes.length > 0 ? modes.join(', ') : '—',
    }
  } catch {
    return null
  }
}

function parseCredentialInjectionAudit(raw: string | null): StoredCredentialInjectionAudit | null {
  if (!raw) return null
  try {
    const result = v.safeParse(StoredCredentialInjectionAuditSchema, JSON.parse(raw))
    return result.success ? result.output : null
  } catch {
    return null
  }
}

function formatCredentialInjectionMode(mode: string | undefined): string {
  if (mode === 'set_header') return 'set header'
  if (mode === 'replace_placeholder') return 'replace placeholder'
  return mode ?? ''
}

function formatCredentialLabel(credential: NonNullable<StoredCredentialInjectionAudit['credentials']>[number]): string {
  if (typeof credential === 'string') return credential
  if (credential.name && credential.slug) return `${credential.name} (${credential.slug})`
  return credential.name ?? credential.slug ?? credential.id ?? ''
}

function uniqueLabels(values: string[]): string[] {
  return [...new Set(values)]
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function downloadRequestJsonl(req: ApiRequestDetail) {
  const row = {
    id: req.id,
    startedAt: req.startedAt,
    durationMs: req.durationMs,
    method: req.method,
    endpoint: req.endpoint,
    statusCode: req.statusCode,
    model: req.model,
    streamed: req.streamed,
    promptTokens: req.promptTokens,
    completionTokens: req.completionTokens,
    requestHeaders: req.requestHeaders,
    responseHeaders: req.responseHeaders,
    requestBody: req.requestBody,
    responseBody: req.responseBody,
    error: req.error,
    routing: {
      ruleName: req.routingRuleName,
      actionType: req.routingActionType,
      authMode: req.routingAuthMode,
      targetType: req.routingTargetType,
      targetBaseUrl: req.routingTargetBaseUrl,
      requestedModel: req.routingRequestedModel,
      routedModel: req.routingRoutedModel,
      rejectReason: req.routingRejectReason,
      credentialInjection: parseCredentialInjectionAudit(req.credentialInjectionJson),
    },
    attribution: {
      clientName: req.clientName,
      endUserId: req.endUserId,
      sessionId: req.sessionId,
    },
  }
  const blob = new Blob([`${JSON.stringify(row)}\n`], { type: 'application/x-ndjson' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `llama-dash-${req.id}.jsonl`
  link.click()
  URL.revokeObjectURL(url)
}

function getRequestDetailUrl() {
  return typeof window === 'undefined' ? '' : window.location.href
}
