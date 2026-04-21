import { useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { useGpu, useModels } from '../../lib/queries'
import type { InspectorState } from '../../lib/use-playground-chat'
import { PlaygroundActiveModelCell } from './PlaygroundActiveModelCell'
import { PlaygroundCopyButton } from './PlaygroundCopyButton'
import { PlaygroundInspectorSection } from './PlaygroundInspectorSection'
import { PlaygroundObservation } from './PlaygroundObservation'
import { PlaygroundTimingBars } from './PlaygroundTimingBars'
import { formatContextLength } from '../models/modelUtils'

type InspectorTab = 'request' | 'response' | 'timing' | 'events' | 'curl'

const TABS: Array<{ id: InspectorTab; label: string }> = [
  { id: 'request', label: 'request' },
  { id: 'response', label: 'response' },
  { id: 'timing', label: 'timing' },
  { id: 'events', label: 'events' },
  { id: 'curl', label: 'curl' },
]

type Props = {
  model: string
  inspector: InspectorState
  apiKey: string | null
}

export function PlaygroundInspector({ model, inspector, apiKey }: Props) {
  const [tab, setTab] = useState<InspectorTab>('request')
  const { data: models } = useModels()
  const { data: gpu } = useGpu()

  const active = models?.find((m) => m.id === model)
  const residentMiB = gpu?.gpus.reduce((sum, g) => sum + (g.memoryUsedMiB ?? 0), 0) ?? null
  const contextLabel = formatContextLength(active?.contextLength)

  const requestJson = useMemo(() => {
    if (!inspector.lastRequestBody) return ''
    return JSON.stringify(inspector.lastRequestBody, null, 2)
  }, [inspector.lastRequestBody])

  const curlCommand = useMemo(() => {
    if (!inspector.lastRequestBody || !inspector.lastRequestUrl) return ''
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const auth = apiKey
      ? ` \\
  -H 'authorization: Bearer ${apiKey}'`
      : ''
    const body = JSON.stringify(inspector.lastRequestBody, null, 2).replace(/'/g, "'\\''")
    return `curl -N ${origin}${inspector.lastRequestUrl} \\
  -H 'content-type: application/json'${auth} \\
  -d '${body}'`
  }, [inspector.lastRequestBody, inspector.lastRequestUrl, apiKey])

  return (
    <aside className="pg-inspector-shell flex min-h-0 flex-col gap-0.5 overflow-y-auto bg-surface-1 px-4 pt-3.5 pb-5">
      <div className="h-10 -mx-4 -mt-3.5 mb-2 flex gap-0 border-b border-border bg-surface-1 px-0">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              'mb-[-1px] inline-flex flex-1 items-center justify-center border-b-2 border-transparent px-3 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-dim transition-colors hover:bg-surface-2 hover:text-fg',
              tab === item.id && 'border-accent bg-surface-2 text-accent',
            )}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <PlaygroundInspectorSection label="active model">
        <div className="grid grid-cols-2 gap-2">
          <PlaygroundActiveModelCell
            label="model"
            value={active?.id ?? model ?? '—'}
            sub={active ? (active.kind === 'local' ? 'local' : 'peer') : undefined}
            mono
          />
          <PlaygroundActiveModelCell
            label="context"
            value={contextLabel ?? '—'}
            sub={contextLabel ? 'cfg' : undefined}
          />
          <PlaygroundActiveModelCell
            label="resident"
            value={residentMiB != null ? (residentMiB / 1024).toFixed(1) : '—'}
            unit="GB"
            sub={residentMiB != null ? `${Math.round(residentMiB)} MiB total` : undefined}
          />
          <PlaygroundActiveModelCell
            label="ttft"
            value={inspector.lastMetrics.ttftMs != null ? String(Math.round(inspector.lastMetrics.ttftMs)) : '—'}
            unit="ms"
            sub={inspector.lastMetrics.ttftMs != null ? 'last run' : undefined}
          />
        </div>
      </PlaygroundInspectorSection>

      {tab === 'request' ? (
        <PlaygroundInspectorSection
          label={`POST ${inspector.lastRequestUrl ?? '/v1/chat/completions'}`}
          action={requestJson ? <PlaygroundCopyButton text={requestJson} /> : null}
        >
          {inspector.lastRequestUrl ? (
            <div className="flex items-center gap-2 rounded border border-border bg-surface-2 px-2.5 py-2">
              <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
                POST
              </span>
              <span className="font-mono text-[11px] text-fg-muted">
                {typeof window !== 'undefined' ? window.location.host : ''}
                {inspector.lastRequestUrl}
              </span>
            </div>
          ) : null}
          {requestJson ? (
            <pre className="m-0 overflow-x-auto rounded border border-border bg-surface-2 p-3 font-mono text-[11px] leading-[1.55] text-fg-muted">
              {requestJson}
            </pre>
          ) : (
            <EmptyNote>No request sent yet.</EmptyNote>
          )}
        </PlaygroundInspectorSection>
      ) : null}

      {tab === 'response' ? (
        <PlaygroundInspectorSection
          label="response"
          action={inspector.lastResponseText ? <PlaygroundCopyButton text={inspector.lastResponseText} /> : null}
        >
          {inspector.lastResponseText ? (
            <pre className="m-0 overflow-x-auto rounded border border-border bg-surface-2 p-3 font-mono text-[11px] leading-[1.55] text-fg-muted">
              {inspector.lastResponseText}
            </pre>
          ) : (
            <EmptyNote>Run a request to capture its response.</EmptyNote>
          )}
        </PlaygroundInspectorSection>
      ) : null}

      {tab === 'timing' ? (
        <PlaygroundInspectorSection label="request → swap → decode">
          <PlaygroundTimingBars inspector={inspector} />
          <div className="flex flex-wrap gap-2 font-mono text-[11px] text-fg-dim">
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
        </PlaygroundInspectorSection>
      ) : null}

      {tab === 'events' ? (
        <PlaygroundInspectorSection label="event tape">
          {inspector.events.length ? (
            <div className="flex flex-col gap-1.5">
              {inspector.events.map((event) => (
                <div
                  key={event.id}
                  className="grid grid-cols-[48px_52px_minmax(0,1fr)] items-start gap-2 rounded border border-border bg-surface-2 px-2.5 py-2 text-[11px]"
                >
                  <span className="font-mono text-fg-dim">{formatClock(event.at)}</span>
                  <span className={cn('pg-event-tag', `pg-event-tag-${event.tag.toLowerCase()}`)}>{event.tag}</span>
                  <span className="min-w-0 text-fg-muted">{event.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyNote>Event tape fills while streaming.</EmptyNote>
          )}
        </PlaygroundInspectorSection>
      ) : null}

      {tab === 'curl' ? (
        <PlaygroundInspectorSection
          label="curl"
          action={curlCommand ? <PlaygroundCopyButton text={curlCommand} /> : null}
        >
          {curlCommand ? (
            <pre className="m-0 overflow-x-auto rounded border border-border bg-surface-2 p-3 font-mono text-[11px] leading-[1.55] text-fg-muted">
              {curlCommand}
            </pre>
          ) : (
            <EmptyNote>Send a request to generate a curl command.</EmptyNote>
          )}
        </PlaygroundInspectorSection>
      ) : null}

      <PlaygroundObservation inspector={inspector} />
    </aside>
  )
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 rounded border border-dashed border-border bg-surface-2 px-3 py-2 text-[11px] text-fg-dim">
      {children}
    </p>
  )
}

function formatClock(at: number): string {
  const date = new Date(at)
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  const ms = String(date.getMilliseconds()).padStart(3, '0').slice(0, 1)
  return `${mm}:${ss}.${ms}`
}
