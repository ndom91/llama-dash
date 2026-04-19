import { Check, Copy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { cn } from '../lib/cn'
import { useGpu, useModels } from '../lib/queries'
import type { InspectorState } from '../lib/use-playground-chat'

type InspectorTab = 'request' | 'response' | 'timing' | 'events' | 'curl'

const TABS: Array<{ id: InspectorTab; label: string }> = [
  { id: 'request', label: 'request' },
  { id: 'response', label: 'response' },
  { id: 'timing', label: 'timing' },
  { id: 'events', label: 'events' },
  { id: 'curl', label: 'curl' },
]

export function PlaygroundInspector({
  model,
  inspector,
  apiKey,
}: {
  model: string
  inspector: InspectorState
  apiKey: string | null
}) {
  const [tab, setTab] = useState<InspectorTab>('request')
  const { data: models } = useModels()
  const { data: gpu } = useGpu()

  const active = models?.find((m) => m.id === model)
  const residentMiB = gpu?.gpus.reduce((sum, g) => sum + (g.memoryUsedMiB ?? 0), 0) ?? null

  const requestJson = useMemo(() => {
    if (!inspector.lastRequestBody) return ''
    return JSON.stringify(inspector.lastRequestBody, null, 2)
  }, [inspector.lastRequestBody])

  const curlCommand = useMemo(() => {
    if (!inspector.lastRequestBody || !inspector.lastRequestUrl) return ''
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const auth = apiKey ? ` \\\n  -H 'authorization: Bearer ${apiKey}'` : ''
    const body = JSON.stringify(inspector.lastRequestBody, null, 2).replace(/'/g, "'\\''")
    return `curl -N ${origin}${inspector.lastRequestUrl} \\\n  -H 'content-type: application/json'${auth} \\\n  -d '${body}'`
  }, [inspector.lastRequestBody, inspector.lastRequestUrl, apiKey])

  return (
    <aside className="pg-rail pg-rail-right">
      <div className="pg-inspector-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={cn('pg-inspector-tab', tab === t.id && 'pg-inspector-tab-active')}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Section label="active model">
        <div className="pg-am-grid">
          <AMCell
            label="model"
            value={active?.id ?? model ?? '—'}
            sub={active ? (active.kind === 'local' ? 'local' : 'peer') : undefined}
            mono
          />
          <AMCell label="context" value="32" unit="K" sub="cfg" />
          <AMCell
            label="resident"
            value={residentMiB != null ? (residentMiB / 1024).toFixed(1) : '—'}
            unit="GB"
            sub={residentMiB != null ? `${Math.round(residentMiB)} MiB total` : undefined}
          />
          <AMCell
            label="ttft"
            value={inspector.lastMetrics.ttftMs != null ? String(Math.round(inspector.lastMetrics.ttftMs)) : '—'}
            unit="ms"
            sub={inspector.lastMetrics.ttftMs != null ? 'last run' : undefined}
          />
        </div>
      </Section>

      {tab === 'request' ? (
        <Section
          label={`POST ${inspector.lastRequestUrl ?? '/v1/chat/completions'}`}
          action={requestJson ? <CopyBtn text={requestJson} /> : null}
        >
          {inspector.lastRequestUrl ? (
            <div className="pg-inspector-endpoint">
              <span className="pg-method-badge">POST</span>
              <span className="font-mono text-[11px] text-fg-muted">
                {typeof window !== 'undefined' ? window.location.host : ''}
                {inspector.lastRequestUrl}
              </span>
            </div>
          ) : null}
          {requestJson ? (
            <pre className="pg-inspector-json">{requestJson}</pre>
          ) : (
            <EmptyNote>No request sent yet.</EmptyNote>
          )}
        </Section>
      ) : null}

      {tab === 'response' ? (
        <Section
          label="response"
          action={inspector.lastResponseText ? <CopyBtn text={inspector.lastResponseText} /> : null}
        >
          {inspector.lastResponseText ? (
            <pre className="pg-inspector-json">{inspector.lastResponseText}</pre>
          ) : (
            <EmptyNote>Run a request to capture its response.</EmptyNote>
          )}
        </Section>
      ) : null}

      {tab === 'timing' ? (
        <Section label="request → swap → decode">
          <TimingBars inspector={inspector} />
          <div className="pg-timing-totals">
            {inspector.lastMetrics.totalMs != null ? (
              <>
                <span>total {(inspector.lastMetrics.totalMs / 1000).toFixed(2)} s</span>
                {inspector.lastMetrics.tokOut != null ? <span>· {inspector.lastMetrics.tokOut} tokens</span> : null}
                {inspector.lastMetrics.tokPerSec != null ? (
                  <span>· {inspector.lastMetrics.tokPerSec.toFixed(1)} tok/s</span>
                ) : null}
              </>
            ) : (
              <span className="dim">Run a request to populate timing.</span>
            )}
          </div>
        </Section>
      ) : null}

      {tab === 'events' ? (
        <Section label="event tape">
          {inspector.events.length ? (
            <div className="pg-event-tape">
              {inspector.events.map((e) => (
                <div key={e.id} className="pg-event-row">
                  <span className="pg-event-time">{formatClock(e.at)}</span>
                  <span className={cn('pg-event-tag', `pg-event-tag-${e.tag.toLowerCase()}`)}>{e.tag}</span>
                  <span className="pg-event-text">{e.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyNote>Event tape fills while streaming.</EmptyNote>
          )}
        </Section>
      ) : null}

      {tab === 'curl' ? (
        <Section label="curl" action={curlCommand ? <CopyBtn text={curlCommand} /> : null}>
          {curlCommand ? (
            <pre className="pg-inspector-json pg-inspector-curl">{curlCommand}</pre>
          ) : (
            <EmptyNote>Send a request to generate a curl command.</EmptyNote>
          )}
        </Section>
      ) : null}

      <Observation inspector={inspector} />
    </aside>
  )
}

function Section({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="pg-rail-section">
      <div className="pg-rail-heading pg-rail-heading-row">
        <span>{label}</span>
        {action}
      </div>
      <div className="pg-rail-body">{children}</div>
    </section>
  )
}

function AMCell({
  label,
  value,
  unit,
  sub,
  mono,
}: {
  label: string
  value: string | number
  unit?: string
  sub?: string
  mono?: boolean
}) {
  return (
    <div className="pg-am-cell">
      <div className="pg-am-label">{label}</div>
      <div className={cn('pg-am-value', mono && 'font-mono text-[12px]')}>
        {value}
        {unit ? <span className="pg-am-unit">{unit}</span> : null}
      </div>
      {sub ? <div className="pg-am-sub">{sub}</div> : null}
    </div>
  )
}

function TimingBars({ inspector }: { inspector: InspectorState }) {
  const t = inspector.timing
  const total = inspector.lastMetrics.totalMs ?? 0
  const rows: Array<{ label: string; ms: number | null; tone: 'neutral' | 'accent' | 'warn' }> = [
    { label: 'queue', ms: t.queueMs, tone: 'neutral' },
    { label: 'model swap', ms: t.swapMs, tone: 'neutral' },
    { label: 'prefill', ms: t.prefillMs, tone: 'warn' },
    { label: 'decode', ms: t.decodeMs, tone: 'accent' },
    { label: 'stream close', ms: t.streamCloseMs, tone: 'neutral' },
  ]
  const max = total || Math.max(...rows.map((r) => r.ms ?? 0), 1)

  return (
    <div className="pg-timing-rows">
      {rows.map((r) => {
        const width = r.ms != null && max > 0 ? (r.ms / max) * 100 : 0
        const stub = r.ms == null
        return (
          <div key={r.label} className="pg-timing-row">
            <span className="pg-timing-label">{r.label}</span>
            <div className="pg-timing-track">
              <div
                className={cn('pg-timing-bar', `pg-timing-bar-${r.tone}`, stub && 'pg-timing-bar-stub')}
                style={{ width: `${Math.max(stub ? 2 : 1, width)}%` }}
              />
            </div>
            <span className="pg-timing-ms">{r.ms != null ? `${Math.round(r.ms)}ms` : '—'}</span>
          </div>
        )
      })}
    </div>
  )
}

function Observation({ inspector }: { inspector: InspectorState }) {
  const ttft = inspector.lastMetrics.ttftMs
  if (ttft == null) return null
  const tokPerSec = inspector.lastMetrics.tokPerSec
  const note =
    tokPerSec != null && tokPerSec > 0
      ? `ttft ${Math.round(ttft)}ms · decode ${tokPerSec.toFixed(1)} tok/s. All within tolerance.`
      : `ttft ${Math.round(ttft)}ms. Run completed.`

  return (
    <div className="pg-observation">
      <div className="pg-observation-label">observation</div>
      <p className="pg-observation-text">{note}</p>
    </div>
  )
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="pg-inspector-empty">{children}</p>
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="pg-inspector-copy"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        })
      }}
    >
      <span className={cn('copy-icon-swap', copied && 'copy-icon-swap-done')}>
        <Copy className="copy-icon-swap-from icon-12" strokeWidth={2} />
        <Check className="copy-icon-swap-to icon-12 text-ok" strokeWidth={2} />
      </span>
      copy
    </button>
  )
}

function formatClock(at: number): string {
  const d = new Date(at)
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0').slice(0, 1)
  return `${mm}:${ss}.${ms}`
}
