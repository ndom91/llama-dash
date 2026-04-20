import { useHotkey } from '@tanstack/react-hotkeys'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Check, ChevronLeft, ChevronRight, Clipboard, RotateCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { cn } from '../lib/cn'
import { PageHeader } from '../components/PageHeader'
import { Tooltip } from '../components/Tooltip'
import { TopBar } from '../components/TopBar'
import type { ApiRequestDetail } from '../lib/api'
import { useRequest } from '../lib/queries'

export const Route = createFileRoute('/requests/$id')({ component: RequestDetail })

function RequestDetail() {
  const { id } = Route.useParams()
  const { data, error } = useRequest(id)

  const req = data?.request
  const prevId = data?.prevId ?? null
  const nextId = data?.nextId ?? null

  return (
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page detail-page detail-page-sidecar request-detail-page">
          {error ? (
            <div className="err-banner">{error.message}</div>
          ) : req == null ? (
            <DetailSkeleton />
          ) : (
            <Detail req={req} prevId={prevId} nextId={nextId} />
          )}
        </div>
      </div>
    </div>
  )
}

const SKEL_LINES: ReadonlyArray<{ key: string; indent: number; widths: ReadonlyArray<number> }> = [
  { key: 'a', indent: 0, widths: [90, 24, 160] },
  { key: 'b', indent: 1, widths: [40] },
  { key: 'c', indent: 2, widths: [60, 200] },
  { key: 'd', indent: 3, widths: [80, 120, 60] },
  { key: 'e', indent: 4, widths: [160] },
  { key: 'f', indent: 0, widths: [40, 80] },
  { key: 'g', indent: 1, widths: [120, 60, 100] },
  { key: 'h', indent: 2, widths: [200] },
  { key: 'i', indent: 3, widths: [60, 140] },
  { key: 'j', indent: 4, widths: [80, 40, 180] },
  { key: 'k', indent: 0, widths: [140, 60] },
  { key: 'l', indent: 1, widths: [40, 120] },
  { key: 'm', indent: 2, widths: [100, 80, 60] },
  { key: 'n', indent: 3, widths: [180] },
  { key: 'o', indent: 4, widths: [60, 40, 120] },
  { key: 'p', indent: 0, widths: [80, 160] },
  { key: 'q', indent: 1, widths: [120, 60] },
  { key: 'r', indent: 2, widths: [40, 200] },
  { key: 's', indent: 3, widths: [160, 80] },
  { key: 't', indent: 4, widths: [60, 100, 40] },
  { key: 'u', indent: 0, widths: [140] },
  { key: 'v', indent: 1, widths: [80, 60, 120] },
  { key: 'w', indent: 2, widths: [200, 40] },
  { key: 'x', indent: 3, widths: [60, 140, 80] },
]

function BodySkeleton({ title }: { title: string }) {
  return (
    <section className="panel detail-body-panel">
      <div className="panel-head">
        <span className="panel-title">{title}</span>
        <span className="panel-sub">· body</span>
      </div>
      <div className="skel-body-lines">
        {SKEL_LINES.map((line) => (
          <div key={line.key} className="skel-body-line" style={{ paddingLeft: line.indent * 12 + 16 }}>
            {line.widths.map((w) => (
              <span key={`${line.key}-${w}`} className="skel skel-text" style={{ width: w }} />
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

function DetailSkeleton() {
  return (
    <>
      <PageHeader kicker="dsh · requests · detail" title="Request detail" subtitle="loading…" variant="integrated" />

      <div className="detail-hero">
        <div className="detail-endpoint">
          <div className="detail-endpoint-kicker">endpoint</div>
          <div className="detail-endpoint-row">
            <span className="skel skel-text" style={{ width: 60, height: 24 }} />
            <span className="skel skel-text" style={{ width: 200, height: 24 }} />
          </div>
          <div className="detail-endpoint-meta">
            <span className="skel skel-text" style={{ width: 320 }} />
          </div>
        </div>
        <div className="detail-stats-strip">
          {['status', 'tok-in', 'tok-out', 'total', 'duration', 'tok/s'].map((label) => (
            <div key={label} className="detail-stat">
              <span className="detail-stat-label">{label}</span>
              <span className="skel skel-text" style={{ width: 48, height: 18 }} />
            </div>
          ))}
        </div>
      </div>

      <div className="req-res-columns">
        <div className="request-detail-column">
          <BodySkeleton title="Request" />
        </div>
        <div className="request-detail-column">
          <BodySkeleton title="Response" />
        </div>
      </div>
    </>
  )
}

function Detail({ req, prevId, nextId }: { req: ApiRequestDetail; prevId: string | null; nextId: string | null }) {
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
              <div className="detail-endpoint-meta">
                variant A — three-pane request detail
                {req.model ? (
                  <>
                    <span> · </span>
                    <span translate="no">{req.model}</span>
                  </>
                ) : null}
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
            <TokenTrace durationMs={req.durationMs} completionTokens={req.completionTokens} tokPerSec={tokPerSec} />
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
              <PayloadPane
                title="Request"
                subtitle={`${byteSize(req.requestBody ?? '')} • ${requestPayload.messagesCount} messages • ${req.promptTokens?.toLocaleString() ?? '—'} tok`}
                body={req.requestBody ?? ''}
                headers={reqHeaders}
                mode="pretty"
              />
              <PayloadPane
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
            <Link to="/playground" className="btn btn-ghost btn-sm">
              Open in Playground
            </Link>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => navigator.clipboard.writeText(curlCommand)}
            >
              Copy as curl
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled>
              Download .jsonl
            </button>
          </section>
        </aside>
      </div>
    </>
  )
}

function PayloadPane({
  title,
  subtitle,
  body,
  headers,
  mode,
}: {
  title: string
  subtitle: string
  body: string
  headers: Record<string, string> | null
  mode: 'pretty' | 'raw'
}) {
  const [copied, setCopied] = useState(false)
  const pretty = mode === 'pretty' ? tryPrettyJson(body) : null
  const display = pretty ?? body
  const headerEntries = headers ? Object.entries(headers) : []

  const onCopy = () => {
    navigator.clipboard.writeText(body)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section className="request-payload-pane">
      <div className="request-payload-head">
        <span className="panel-title">{title}</span>
        <span className="panel-sub">{subtitle}</span>
        <div className="request-payload-modes">
          <span className={cn('request-payload-mode', mode === 'pretty' && 'is-active')}>pretty</span>
          <span className={cn('request-payload-mode', mode === 'raw' && 'is-active')}>raw</span>
        </div>
        <button type="button" className="btn btn-ghost btn-xs" style={{ marginLeft: 'auto' }} onClick={onCopy}>
          <span className={cn('copy-icon-swap', copied && 'copy-icon-swap-done')}>
            <Clipboard className="copy-icon-swap-from icon-btn-12" strokeWidth={2} aria-hidden="true" />
            <Check className="copy-icon-swap-to icon-btn-12" strokeWidth={2} aria-hidden="true" />
          </span>
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <pre className="body-pre request-payload-pre">{pretty ? <JsonHighlight json={display} /> : display}</pre>
      {headerEntries.length > 0 ? (
        <div className="request-payload-headers">
          <div className="request-payload-headers-title">Headers</div>
          <table className="dtable headers-table">
            <tbody>
              {headerEntries.map(([k, v]) => (
                <tr key={k}>
                  <td className="mono header-key">{k}</td>
                  <td className="mono">{maskSensitive(k, v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}

function parseRequestPayload(body: string | null) {
  if (!body) return { model: null as string | null, messagesCount: 0 }
  try {
    const parsed = JSON.parse(body) as { model?: string; messages?: Array<unknown> }
    return {
      model: typeof parsed.model === 'string' ? parsed.model : null,
      messagesCount: Array.isArray(parsed.messages) ? parsed.messages.length : 0,
    }
  } catch {
    return { model: null, messagesCount: 0 }
  }
}

function parseSseChunks(body: string) {
  const chunks: Array<Record<string, unknown>> = []
  for (const raw of body.split('\n\n')) {
    const line = raw.trim()
    if (!line.startsWith('data: ')) continue
    const payload = line.slice(6)
    if (payload === '[DONE]') continue
    try {
      chunks.push(JSON.parse(payload) as Record<string, unknown>)
    } catch {}
  }
  return chunks
}

function analyzeResponse(req: ApiRequestDetail) {
  if (!req.responseBody) return { displayBody: '', isJson: false }
  if (!req.streamed) {
    return { displayBody: req.responseBody, isJson: tryPrettyJson(req.responseBody) != null }
  }

  const chunks = parseSseChunks(req.responseBody)
  if (chunks.length === 0) return { displayBody: req.responseBody, isJson: false }

  let content = ''
  let finishReason: string | null = null
  let model: string | null = null
  for (const chunk of chunks) {
    model = typeof chunk.model === 'string' ? chunk.model : model
    const choices = Array.isArray(chunk.choices) ? chunk.choices : []
    for (const choice of choices) {
      if (!choice || typeof choice !== 'object') continue
      const finish = 'finish_reason' in choice ? choice.finish_reason : null
      if (typeof finish === 'string') finishReason = finish
      if ('delta' in choice && choice.delta && typeof choice.delta === 'object') {
        const deltaContent = 'content' in choice.delta ? choice.delta.content : null
        if (typeof deltaContent === 'string') content += deltaContent
      }
    }
  }

  return {
    displayBody: JSON.stringify(
      {
        object: 'chat.completion',
        model: model ?? req.model,
        finish_reason: finishReason,
        usage: {
          prompt: req.promptTokens,
          completion: req.completionTokens,
          total: req.totalTokens,
        },
        choices: [{ message: { role: 'assistant', content } }],
      },
      null,
      2,
    ),
    isJson: true,
  }
}

function analyzeTiming(req: ApiRequestDetail) {
  const result = {
    queueMs: null as number | null,
    prefillMs: null as number | null,
    ttftMs: null as number | null,
    decodeMs: null as number | null,
  }
  if (!req.responseBody) return result
  const chunks = parseSseChunks(req.responseBody)
  const lastChunk = chunks[chunks.length - 1]
  if (
    !lastChunk ||
    typeof lastChunk !== 'object' ||
    !('timings' in lastChunk) ||
    !lastChunk.timings ||
    typeof lastChunk.timings !== 'object'
  ) {
    return result
  }
  const timings = lastChunk.timings as Record<string, unknown>
  result.prefillMs = typeof timings.prompt_ms === 'number' ? timings.prompt_ms : null
  result.ttftMs = result.prefillMs
  result.decodeMs = typeof timings.predicted_ms === 'number' ? timings.predicted_ms : null
  return result
}

function deriveClientLabel(headers: Record<string, string> | null) {
  if (!headers) return null
  const origin = headers.origin
  if (origin) {
    try {
      return new URL(origin).hostname
    } catch {
      return origin
    }
  }
  return headers['x-forwarded-for'] ?? null
}

function deriveRewriteLabel(
  requestedModel: string | null,
  servedModel: string | null,
  responseHeaders: Record<string, string> | null,
) {
  const alias = responseHeaders?.['x-alias-from']
  if (alias) return 'alias'
  if (requestedModel && servedModel && requestedModel !== servedModel) return 'rewrite'
  return null
}

function buildCurlCommand(req: ApiRequestDetail, requestHeaders: Record<string, string> | null) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://llama-dash.example'
  const auth = requestHeaders?.authorization
    ? maskSensitive('authorization', requestHeaders.authorization)
    : 'Bearer sk-…'
  const contentType = requestHeaders?.['content-type'] ?? 'application/json'
  const body = req.requestBody ?? '{}'
  return `curl ${origin}${req.endpoint} \\
  -H "Authorization: ${auth}" \\
  -H "Content-Type: ${contentType}" \\
  -d '${body.replace(/'/g, "'\\''")}'`
}

function tryPrettyJson(text: string): string | null {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return null
  }
}

const JSON_TOKEN =
  /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b|(true|false|null)\b|([[\]{},:])|\n( *)/g

function JsonHighlight({ json }: { json: string }) {
  const elements = useMemo(() => {
    const out: Array<React.ReactElement | string> = []
    let i = 0
    JSON_TOKEN.lastIndex = 0
    for (let match = JSON_TOKEN.exec(json); match !== null; match = JSON_TOKEN.exec(json)) {
      if (match.index > i) out.push(json.slice(i, match.index))
      i = match.index + match[0].length

      const [, str, colon, num, bool, punct, indent] = match
      if (str) {
        const cls = colon ? 'jh-key' : 'jh-str'
        out.push(
          <span key={i} className={cls}>
            {str}
          </span>,
        )
        if (colon) out.push(colon)
      } else if (num) {
        out.push(
          <span key={i} className="jh-num">
            {num}
          </span>,
        )
      } else if (bool) {
        out.push(
          <span key={i} className="jh-bool">
            {bool}
          </span>,
        )
      } else if (punct) {
        out.push(
          <span key={i} className="jh-punct">
            {punct}
          </span>,
        )
      } else if (indent !== undefined) {
        out.push(`\n${indent}`)
      }
    }
    if (i < json.length) out.push(json.slice(i))
    return out
  }, [json])

  return <>{elements}</>
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(s < 10 ? 2 : 1)}s`
  const m = Math.floor(s / 60)
  const rem = Math.floor(s % 60)
  return `${m}m ${rem}s`
}

function byteSize(str: string): string {
  const bytes = new Blob([str]).size
  if (bytes < 1024) return `${bytes}B`
  return `${(bytes / 1024).toFixed(1)}KB`
}

function maskSensitive(key: string, value: string): string {
  const k = key.toLowerCase()
  if (k === 'authorization' && value.startsWith('Bearer ') && value.length > 14) {
    const token = value.slice(7)
    return `Bearer ${token.slice(0, 8)}…`
  }
  return value
}

function TokenTrace({
  durationMs,
  completionTokens,
  tokPerSec,
}: {
  durationMs: number
  completionTokens: number
  tokPerSec: number | null
}) {
  return (
    <section className="panel request-detail-panel">
      <div className="panel-head request-detail-panel-head">
        <span className="panel-title">Stream</span>
        <span className="panel-sub">· token trace</span>
        <span className="panel-sub" style={{ marginLeft: 'auto' }}>
          {completionTokens} tokens · {tokPerSec ?? '—'} tok/s
        </span>
      </div>
      <div className="token-trace">
        <div className="token-trace-track">
          <div className="token-trace-fill" />
        </div>
        <div className="token-trace-labels">
          <span className="token-trace-label" style={{ color: 'var(--accent-shifted)' }}>
            start
          </span>
          <span className="token-trace-label">
            {completionTokens} tokens · {tokPerSec ?? '—'} tok/s
          </span>
          <span className="token-trace-label">eos {formatDuration(durationMs)}</span>
        </div>
      </div>
    </section>
  )
}
