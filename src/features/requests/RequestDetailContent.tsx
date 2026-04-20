import { useHotkey } from '@tanstack/react-hotkeys'
import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, RotateCw } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { Tooltip } from '../../components/Tooltip'
import type { ApiRequestDetail } from '../../lib/api'
import {
  analyzeResponse,
  analyzeTiming,
  buildCurlCommand,
  byteSize,
  deriveClientLabel,
  deriveRewriteLabel,
  formatDuration,
  parseRequestPayload,
} from './requestDetailUtils'
import { RequestPayloadPane } from './RequestPayloadPane'
import { RequestTokenTrace } from './RequestTokenTrace'

type Props = {
  req: ApiRequestDetail
  prevId: string | null
  nextId: string | null
}

export function RequestDetailContent({ req, prevId, nextId }: Props) {
  const ok = req.statusCode >= 200 && req.statusCode < 300
  const navigate = useNavigate()
  const [copiedCurl, setCopiedCurl] = useState(false)

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

  const reqHeaders: Record<string, string> | null = req.requestHeaders ? JSON.parse(req.requestHeaders) : null
  const resHeaders: Record<string, string> | null = req.responseHeaders ? JSON.parse(req.responseHeaders) : null
  const requestPayload = parseRequestPayload(req.requestBody)
  const responseAnalysis = analyzeResponse(req)
  const timing = analyzeTiming(req)
  const clientLabel = deriveClientLabel(reqHeaders)
  const curlCommand = buildCurlCommand(req, reqHeaders)
  const tokPerSec =
    req.completionTokens != null && req.durationMs > 0
      ? Math.round((req.completionTokens / req.durationMs) * 1000)
      : null

  return (
    <>
      <PageHeader
        kicker={`req · ${req.id.slice(4, 10)}… · a · split`}
        title={`${req.method} ${req.endpoint}`}
        subtitle={<span translate="no">{req.model ? `${req.model}` : 'request detail'}</span>}
        variant="integrated"
        action={
          <div className="detail-header-actions">
            <div className="detail-nav-arrows">
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
                  className={`nav-arrow${prevId ? '' : ' disabled'}`}
                  disabled={!prevId}
                  aria-disabled={!prevId}
                  onClick={(e) => !prevId && e.preventDefault()}
                >
                  <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
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
                  className={`nav-arrow${nextId ? '' : ' disabled'}`}
                  disabled={!nextId}
                  aria-disabled={!nextId}
                  onClick={(e) => !nextId && e.preventDefault()}
                >
                  <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
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

      <div className="detail-sidecar-shell request-detail-shell">
        <aside className="detail-meta-rail request-detail-meta-rail">
          <div className="detail-meta-section">
            <div className="detail-meta-kicker">Summary</div>
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
                <dd className={ok ? 'text-ok' : 'text-err'}>
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

          <div className="detail-meta-section">
            <div className="detail-meta-kicker">Model</div>
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

          <div className="detail-meta-section">
            <div className="detail-meta-kicker">Timing</div>
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
            </dl>
          </div>

          <div className="detail-meta-section">
            <div className="detail-meta-kicker">Related</div>
            <div className="detail-meta-links">
              {prevId ? (
                <Link to="/requests/$id" params={{ id: prevId }} className="detail-meta-link">
                  ↩ prev
                </Link>
              ) : null}
              <span className="detail-meta-link detail-meta-link-active">
                ↪ this · {new Date(req.startedAt).toLocaleTimeString([], { hour12: false })} · {req.statusCode}
              </span>
              {nextId ? (
                <Link to="/requests/$id" params={{ id: nextId }} className="detail-meta-link">
                  ↪ next
                </Link>
              ) : null}
            </div>
          </div>
        </aside>

        <div className="detail-main-stack request-detail-main">
          <div className="detail-hero request-detail-hero detail-stacked-section">
            <div className="detail-endpoint">
              <div className="detail-endpoint-kicker">endpoint</div>
              <div className="detail-endpoint-row">
                <span className="detail-endpoint-method">{req.method}</span>
                <span className="detail-endpoint-path">{req.endpoint}</span>
              </div>
            </div>
            <div className="detail-stats-strip request-detail-hero-stats">
              <div className="detail-stat">
                <span className="detail-stat-label">status</span>
                <span className={`detail-stat-value ${ok ? 'is-ok' : 'is-err'}`}>{req.statusCode}</span>
              </div>
              <div className="detail-stat">
                <span className="detail-stat-label">tok-in</span>
                <span className="detail-stat-value">{req.promptTokens?.toLocaleString() ?? '—'}</span>
              </div>
              <div className="detail-stat">
                <span className="detail-stat-label">tok-out</span>
                <span className="detail-stat-value">{req.completionTokens?.toLocaleString() ?? '—'}</span>
              </div>
              <div className="detail-stat">
                <span className="detail-stat-label">total</span>
                <span className="detail-stat-value">{req.totalTokens?.toLocaleString() ?? '—'}</span>
              </div>
              <div className="detail-stat">
                <span className="detail-stat-label">duration</span>
                <span className="detail-stat-value">{formatDuration(req.durationMs)}</span>
              </div>
              <div className="detail-stat">
                <span className="detail-stat-label">tok/s</span>
                <span className="detail-stat-value">{tokPerSec?.toLocaleString() ?? '—'}</span>
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
            <section className="panel request-detail-panel detail-stacked-section">
              <div className="panel-head request-detail-panel-head">
                <span className="panel-title" style={{ color: 'var(--err)' }}>
                  Error
                </span>
              </div>
              <pre className="detail-error">{req.error}</pre>
            </section>
          ) : null}

          <section className="panel request-detail-workspace detail-stacked-section detail-fill-panel">
            <div className="panel-head request-detail-panel-head request-workspace-head">
              <span className="panel-title">Payloads</span>
              <span className="panel-sub">request • response</span>
              <span className="panel-sub" style={{ marginLeft: 'auto' }}>
                {byteSize(req.requestBody ?? '')} on the wire
              </span>
            </div>
            <div className="request-workspace-grid">
              <RequestPayloadPane
                title="Request"
                subtitle={`${byteSize(req.requestBody ?? '')} • ${requestPayload.messagesCount} messages • ${req.promptTokens?.toLocaleString() ?? '—'} tok`}
                body={req.requestBody ?? ''}
                headers={reqHeaders}
                mode="pretty"
              />
              <RequestPayloadPane
                title="Response"
                subtitle={`${req.streamed ? 'SSE' : 'body'} • ${byteSize(req.responseBody ?? '')} • ${req.completionTokens?.toLocaleString() ?? '—'} tok`}
                body={responseAnalysis.displayBody}
                headers={resHeaders}
                mode={responseAnalysis.isJson ? 'pretty' : 'raw'}
              />
            </div>
          </section>
        </div>

        <aside className="detail-sidecar detail-sidecar-dark request-detail-sidecar">
          <section className="detail-sidecar-section">
            <div className="detail-sidecar-title">Tokens</div>
            <div className="request-token-pair">
              <div>
                <span className="label">in</span>
                <strong>{req.promptTokens?.toLocaleString() ?? '—'}</strong>
              </div>
              <div>
                <span className="label">out</span>
                <strong>{req.completionTokens?.toLocaleString() ?? '—'}</strong>
              </div>
            </div>
          </section>

          <section className="detail-sidecar-section">
            <div className="detail-sidecar-title">Phases</div>
            <dl className="detail-sidecar-metrics">
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
                <dt>decode</dt>
                <dd>{timing.decodeMs != null ? formatDuration(timing.decodeMs) : '—'}</dd>
              </div>
              <div>
                <dt>total</dt>
                <dd>{formatDuration(req.durationMs)}</dd>
              </div>
            </dl>
          </section>

          <section className="detail-sidecar-section">
            <div className="detail-sidecar-title">Request ID</div>
            <div className="detail-sidecar-id mono">{req.id}</div>
          </section>

          <section className="detail-sidecar-section detail-sidecar-danger">
            <div className="detail-sidecar-title">Actions</div>
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
