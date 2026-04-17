import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, ChevronDown, ChevronRight, Clipboard, Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { StatusCell } from '../components/StatusCell'
import { TopBar } from '../components/TopBar'
import { api, type ApiRequestDetail } from '../lib/api'

export const Route = createFileRoute('/requests/$id')({ component: RequestDetail })

function RequestDetail() {
  const { id } = Route.useParams()
  const [req, setReq] = useState<ApiRequestDetail | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    api
      .getRequest(Number(id))
      .then((r) => setReq(r.request))
      .catch((e: Error) => setErr(e.message))
  }, [id])

  return (
    <div className="main-col">
      <TopBar
        actions={
          <Link to="/requests" className="btn btn-ghost btn-xs">
            <ArrowLeft className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
            back to requests
          </Link>
        }
      />
      <div className="content">
        <div className="page">
          {err ? (
            <div className="err-banner">{err}</div>
          ) : req == null ? (
            <div className="empty-state">loading…</div>
          ) : (
            <Detail req={req} />
          )}
        </div>
      </div>
    </div>
  )
}

function Detail({ req }: { req: ApiRequestDetail }) {
  const ok = req.statusCode >= 200 && req.statusCode < 300
  const when = new Date(req.startedAt)

  const reqHeaders: Record<string, string> | null = req.requestHeaders ? JSON.parse(req.requestHeaders) : null
  const resHeaders: Record<string, string> | null = req.responseHeaders ? JSON.parse(req.responseHeaders) : null

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <p className="page-sub" style={{ marginBottom: 4 }}>
          request #{req.id}
        </p>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="mono" style={{ color: 'var(--fg-muted)', fontWeight: 500, fontSize: 18 }}>
            {req.method}
          </span>
          <span className="mono" translate="no">
            {req.endpoint}
          </span>
        </h1>
      </div>

      <div className="detail-grid">
        <section className="panel">
          <div className="panel-head">
            <span className="panel-title">Overview</span>
          </div>
          <dl className="dl-grid">
            <dt>Status</dt>
            <dd>
              <StatusCell code={req.statusCode} streamed={req.streamed} />
            </dd>
            <dt>Time</dt>
            <dd className="mono">{when.toLocaleString([], { hour12: false })}</dd>
            <dt>Duration</dt>
            <dd className="mono">{formatDuration(req.durationMs)}</dd>
            <dt>Model</dt>
            <dd className="mono" translate="no">
              {req.model ?? <span className="dim">—</span>}
            </dd>
            <dt>Streamed</dt>
            <dd>{req.streamed ? 'Yes (SSE)' : 'No'}</dd>
          </dl>
        </section>

        <section className="panel">
          <div className="panel-head">
            <span className="panel-title">Tokens</span>
          </div>
          <dl className="dl-grid">
            <dt>Prompt</dt>
            <dd className="mono">{req.promptTokens?.toLocaleString() ?? <span className="dim">—</span>}</dd>
            <dt>Completion</dt>
            <dd className="mono">{req.completionTokens?.toLocaleString() ?? <span className="dim">—</span>}</dd>
            <dt>Total</dt>
            <dd className="mono" style={{ fontWeight: 600 }}>
              {req.totalTokens?.toLocaleString() ?? <span className="dim">—</span>}
            </dd>
          </dl>
        </section>

        {req.error ? (
          <section className="panel" style={{ gridColumn: '1 / -1' }}>
            <div className="panel-head">
              <span className="panel-title" style={{ color: 'var(--err)' }}>
                Error
              </span>
            </div>
            <pre className="detail-error">{req.error}</pre>
          </section>
        ) : ok ? null : (
          <section className="panel" style={{ gridColumn: '1 / -1' }}>
            <div className="panel-head">
              <span className="panel-title" style={{ color: 'var(--warn)' }}>
                Non-success status
              </span>
              <span className="panel-sub">HTTP {req.statusCode}</span>
            </div>
          </section>
        )}
      </div>

      <div className="req-res-columns">
        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          {reqHeaders ? <HeadersSection title="Request Headers" headers={reqHeaders} /> : null}
          {req.requestBody ? <BodySection title="Request Body" body={req.requestBody} /> : null}
        </div>
        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          {resHeaders ? <HeadersSection title="Response Headers" headers={resHeaders} /> : null}
          {req.responseBody ? <BodySection title="Response Body" body={req.responseBody} /> : null}
        </div>
      </div>
    </>
  )
}

function HeadersSection({ title, headers }: { title: string; headers: Record<string, string> }) {
  const [open, setOpen] = useState(true)
  const entries = Object.entries(headers)
  if (entries.length === 0) return null

  return (
    <section className="panel">
      <button type="button" className="panel-head panel-toggle" onClick={() => setOpen(!open)}>
        {open ? (
          <ChevronDown className="icon-12" strokeWidth={2} aria-hidden="true" />
        ) : (
          <ChevronRight className="icon-12" strokeWidth={2} aria-hidden="true" />
        )}
        <span className="panel-title">{title}</span>
      </button>
      {open ? (
        <table className="dtable">
          <tbody>
            {entries.map(([k, v]) => (
              <tr key={k}>
                <td className="mono" style={{ color: 'var(--accent)', width: 200, fontWeight: 500 }}>
                  {k}
                </td>
                <td className="mono">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  )
}

function BodySection({ title, body }: { title: string; body: string }) {
  const [open, setOpen] = useState(true)
  const [mode, setMode] = useState<'pretty' | 'raw'>('pretty')
  const [copied, setCopied] = useState(false)

  const pretty = tryPrettyJson(body)
  const hasPretty = pretty !== null
  const display = mode === 'pretty' && hasPretty ? pretty : body

  const onCopy = () => {
    navigator.clipboard.writeText(body)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section className="panel">
      <button type="button" className="panel-head panel-toggle" onClick={() => setOpen(!open)}>
        {open ? (
          <ChevronDown className="icon-12" strokeWidth={2} aria-hidden="true" />
        ) : (
          <ChevronRight className="icon-12" strokeWidth={2} aria-hidden="true" />
        )}
        <span className="panel-title">{title}</span>
      </button>
      {open ? (
        <div>
          <div className="body-toolbar">
            <div className="body-tabs">
              {hasPretty ? (
                <>
                  <button
                    type="button"
                    className={`body-tab${mode === 'pretty' ? ' active' : ''}`}
                    onClick={() => setMode('pretty')}
                  >
                    Pretty
                  </button>
                  <button
                    type="button"
                    className={`body-tab${mode === 'raw' ? ' active' : ''}`}
                    onClick={() => setMode('raw')}
                  >
                    Raw
                  </button>
                </>
              ) : null}
            </div>
            <button type="button" className="btn btn-ghost btn-xs" onClick={onCopy}>
              {copied ? (
                <Check className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
              ) : (
                <Clipboard className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
              )}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="body-pre">{display}</pre>
        </div>
      ) : null}
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

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(s < 10 ? 2 : 1)} s`
  const m = Math.floor(s / 60)
  const rem = Math.floor(s % 60)
  return `${m}m ${rem}s`
}
