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
                  className={`inline-flex h-8 w-8 items-center justify-center rounded border border-border-strong text-fg-muted transition-[background-color,color,border-color,transform] duration-100 hover:border-fg-dim hover:bg-surface-3 hover:text-fg active:scale-95 ${nextId ? '' : 'pointer-events-none opacity-30'}`}
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

      <div className="grid min-h-0 flex-1 grid-cols-[250px_minmax(0,1fr)_280px] items-stretch gap-0 max-[1200px]:grid-cols-[168px_minmax(0,1fr)] max-[900px]:grid-cols-1">
        <aside className="border-r border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] bg-surface-1 px-3.5 py-4 max-[900px]:border-r-0 max-[900px]:border-b">
          <div>
            <div className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">Summary</div>
            <dl className="grid gap-2 m-0">
              <div>
                <dt className="font-mono text-[11px] text-fg-dim">method</dt>
                <dd className="m-0 inline-flex items-center gap-1.5 text-xs text-fg">{req.method}</dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] text-fg-dim">endpoint</dt>
                <dd className="m-0 inline-flex items-center gap-1.5 text-xs text-fg mono">{req.endpoint}</dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] text-fg-dim">status</dt>
                <dd className={`m-0 inline-flex items-center gap-1.5 text-xs ${ok ? 'text-ok' : 'text-err'}`}>
                  {req.statusCode} {ok ? 'OK' : ''}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] text-fg-dim">stream</dt>
                <dd className="m-0 inline-flex items-center gap-1.5 text-xs text-fg">
                  {req.streamed ? 'yes • SSE' : 'no'}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] text-fg-dim">key</dt>
                <dd className="m-0 inline-flex items-center gap-1.5 text-xs text-fg">{req.keyName ?? 'system'}</dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] text-fg-dim">client</dt>
                <dd className="m-0 inline-flex items-center gap-1.5 text-xs text-fg">{clientLabel ?? '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-3.5 border-t border-[color:color-mix(in_srgb,var(--border)_72%,transparent)] pt-3.5">
            <div className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">Model</div>
            <dl className="grid gap-2 m-0">
              <div>
                <dt className="font-mono text-[11px] text-fg-dim">requested</dt>
                <dd className="m-0 inline-flex items-center gap-1.5 text-xs text-fg">{requestPayload.model ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] text-fg-dim">served</dt>
                <dd className="m-0 inline-flex items-center gap-1.5 text-xs text-fg">{req.model ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] text-fg-dim">rewrite</dt>
                <dd className="m-0 inline-flex items-center gap-1.5 text-xs text-fg">
                  {deriveRewriteLabel(requestPayload.model, req.model, resHeaders) ?? '—'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-3.5 border-t border-[color:color-mix(in_srgb,var(--border)_72%,transparent)] pt-3.5">
            <div className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">Timing</div>
            <dl className="grid gap-2 m-0">
              <div>
                <dt className="font-mono text-[11px] text-fg-dim">queue</dt>
                <dd className="m-0 inline-flex items-center gap-1.5 text-xs text-fg">
                  {timing.queueMs != null ? formatDuration(timing.queueMs) : '—'}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] text-fg-dim">prefill</dt>
                <dd className="m-0 inline-flex items-center gap-1.5 text-xs text-fg">
                  {timing.prefillMs != null ? formatDuration(timing.prefillMs) : '—'}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] text-fg-dim">ttft</dt>
                <dd className="m-0 inline-flex items-center gap-1.5 text-xs text-fg">
                  {timing.ttftMs != null ? formatDuration(timing.ttftMs) : '—'}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] text-fg-dim">total</dt>
                <dd className="m-0 inline-flex items-center gap-1.5 text-xs text-fg">
                  {formatDuration(req.durationMs)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-3.5 border-t border-[color:color-mix(in_srgb,var(--border)_72%,transparent)] pt-3.5">
            <div className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">Related</div>
            <div className="grid gap-1.5">
              {prevId ? (
                <Link
                  to="/requests/$id"
                  params={{ id: prevId }}
                  className="font-mono text-[11px] text-fg-muted hover:text-fg"
                >
                  ↩ prev
                </Link>
              ) : null}
              <span className="font-mono text-[11px] text-fg-muted">
                ↪ this · {new Date(req.startedAt).toLocaleTimeString([], { hour12: false })} · {req.statusCode}
              </span>
              {nextId ? (
                <Link
                  to="/requests/$id"
                  params={{ id: nextId }}
                  className="font-mono text-[11px] text-fg-muted hover:text-fg"
                >
                  ↪ next
                </Link>
              ) : null}
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-col gap-0">
          <div className="border-r border-border bg-[color:color-mix(in_srgb,var(--bg-1)_84%,var(--bg-2))] px-4 py-4 max-[1200px]:border-r-0 max-[900px]:border-t max-[900px]:border-t-border">
            <div className="flex flex-wrap items-start gap-6">
              <div className="min-w-[280px]">
                <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">endpoint</div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-surface-3 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
                    {req.method}
                  </span>
                  <span className="font-mono text-sm text-fg" translate="no">
                    {req.endpoint}
                  </span>
                </div>
              </div>
              <div className="grid min-w-0 flex-1 grid-cols-3 gap-2 max-[700px]:grid-cols-2">
                <div className="rounded border border-border bg-surface-1 px-3 py-2.5">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-fg-dim">status</span>
                  <span className={`text-sm font-semibold ${ok ? 'text-ok' : 'text-err'}`}>{req.statusCode}</span>
                </div>
                <div className="rounded border border-border bg-surface-1 px-3 py-2.5">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-fg-dim">tok-in</span>
                  <span className="text-sm font-semibold text-fg">{req.promptTokens?.toLocaleString() ?? '—'}</span>
                </div>
                <div className="rounded border border-border bg-surface-1 px-3 py-2.5">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-fg-dim">tok-out</span>
                  <span className="text-sm font-semibold text-fg">{req.completionTokens?.toLocaleString() ?? '—'}</span>
                </div>
                <div className="rounded border border-border bg-surface-1 px-3 py-2.5">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-fg-dim">total</span>
                  <span className="text-sm font-semibold text-fg">{req.totalTokens?.toLocaleString() ?? '—'}</span>
                </div>
                <div className="rounded border border-border bg-surface-1 px-3 py-2.5">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-fg-dim">duration</span>
                  <span className="text-sm font-semibold text-fg">{formatDuration(req.durationMs)}</span>
                </div>
                <div className="rounded border border-border bg-surface-1 px-3 py-2.5">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-fg-dim">tok/s</span>
                  <span className="text-sm font-semibold text-fg">{tokPerSec?.toLocaleString() ?? '—'}</span>
                </div>
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

        <aside className="bg-[color:color-mix(in_srgb,var(--bg-0)_92%,black_8%)] px-3.5 py-3 max-[1200px]:col-span-full max-[1200px]:border-t max-[1200px]:border-t-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
          <section>
            <div className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">Tokens</div>
            <div className="grid gap-2">
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

          <section className="mt-4 border-t border-[color:color-mix(in_srgb,var(--border)_72%,transparent)] pt-4">
            <div className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">Phases</div>
            <dl className="grid gap-2 m-0">
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

          <section className="mt-4 border-t border-[color:color-mix(in_srgb,var(--border)_72%,transparent)] pt-4">
            <div className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">Request ID</div>
            <div className="mono text-xs text-fg">{req.id}</div>
          </section>

          <section className="mt-4 grid gap-2 border-t border-[color:color-mix(in_srgb,var(--border)_72%,transparent)] pt-4">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">Actions</div>
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
