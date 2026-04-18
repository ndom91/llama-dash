import { useHotkey } from '@tanstack/react-hotkeys'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Check, ChevronLeft, ChevronRight, Clipboard } from 'lucide-react'
import { useMemo, useState } from 'react'
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
        <div className="page">
          {error ? (
            <div className="err-banner">{error.message}</div>
          ) : req == null ? (
            <div className="empty-state">loading…</div>
          ) : (
            <Detail req={req} prevId={prevId} nextId={nextId} />
          )}
        </div>
      </div>
    </div>
  )
}

function Detail({ req, prevId, nextId }: { req: ApiRequestDetail; prevId: string | null; nextId: string | null }) {
  const ok = req.statusCode >= 200 && req.statusCode < 300
  const when = new Date(req.startedAt)
  const navigate = useNavigate()

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

  const tokPerSec =
    req.completionTokens != null && req.durationMs > 0
      ? Math.round((req.completionTokens / req.durationMs) * 1000)
      : null

  return (
    <>
      <div className="detail-breadcrumb">
        <Link to="/requests">Requests</Link>
        <span>/</span>
        <span style={{ color: 'var(--fg-muted)' }}>{req.id}</span>
        <div style={{ marginLeft: 'auto' }}>
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
        </div>
      </div>

      <div className="detail-hero">
        <div className="detail-endpoint">
          <div className="detail-endpoint-kicker">endpoint</div>
          <div className="detail-endpoint-row">
            <span className="detail-endpoint-method">{req.method}</span>
            <span className="detail-endpoint-path">{req.endpoint}</span>
          </div>
          <div className="detail-endpoint-meta">
            ↳{' '}
            {req.model ? (
              <>
                <span translate="no">{req.model}</span>
                <span> · </span>
              </>
            ) : null}
            {when.toISOString()}
          </div>
        </div>
        <div className="detail-stats-strip">
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
        <section className="panel">
          <div className="panel-head">
            <span className="panel-title" style={{ color: 'var(--err)' }}>
              Error
            </span>
          </div>
          <pre className="detail-error">{req.error}</pre>
        </section>
      ) : null}

      <div className="req-res-columns">
        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          {req.requestBody ? (
            <BodySection title="Request" subtitle="body" size={byteSize(req.requestBody)} body={req.requestBody} />
          ) : null}
          {reqHeaders ? <HeadersSection title="Headers" subtitle="in" headers={reqHeaders} /> : null}
        </div>
        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          {req.responseBody ? (
            <BodySection
              title="Response"
              subtitle={req.streamed ? 'stream' : 'body'}
              size={byteSize(req.responseBody)}
              body={req.responseBody}
            />
          ) : null}
          {resHeaders ? <HeadersSection title="Headers" subtitle="out" headers={resHeaders} /> : null}
        </div>
      </div>
    </>
  )
}

function HeadersSection({
  title,
  subtitle,
  headers,
}: {
  title: string
  subtitle: string
  headers: Record<string, string>
}) {
  const entries = Object.entries(headers)
  if (entries.length === 0) return null

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-title">{title}</span>
        <span className="panel-sub">· {subtitle}</span>
      </div>
      <table className="dtable headers-table">
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k}>
              <td className="mono header-key">{k}</td>
              <td className="mono">{maskSensitive(k, v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function BodySection({ title, subtitle, size, body }: { title: string; subtitle: string; size: string; body: string }) {
  const [copied, setCopied] = useState(false)

  const pretty = tryPrettyJson(body)
  const display = pretty ?? body

  const onCopy = () => {
    navigator.clipboard.writeText(body)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section className="panel detail-body-panel">
      <div className="panel-head">
        <span className="panel-title">{title}</span>
        <span className="panel-sub">· {subtitle}</span>
        <span className="body-size">{size}</span>
        <button type="button" className="btn btn-ghost btn-xs" style={{ marginLeft: 'auto' }} onClick={onCopy}>
          {copied ? (
            <Check className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Clipboard className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
          )}
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <pre className="body-pre">{pretty ? <JsonHighlight json={display} /> : display}</pre>
    </section>
  )
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
    <section className="panel">
      <div className="panel-head">
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
          <span className="token-trace-label" style={{ color: 'var(--warn)' }}>
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
