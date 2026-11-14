import { Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { CopyButton } from '../../components/CopyButton'
import { Tabs } from '../../components/Tabs'
import { Tooltip } from '../../components/Tooltip'
import { cn } from '../../lib/cn'
import type { RealtimeEventEntry } from '../../lib/realtime-audio'
import type { RealtimeSession } from '../../lib/schemas/realtime'
import type { RealtimeTiming } from '../../lib/use-playground-realtime'
import { PlaygroundActiveModelCell } from './PlaygroundActiveModelCell'
import { PlaygroundInspectorSection } from './PlaygroundInspectorSection'
import { PlaygroundKVRow } from './PlaygroundKVRow'
import { formatRealtimeClock, formatRealtimeMs } from './playgroundRealtimeUtils'

type InspectorTab = 'events' | 'timing' | 'session'

const TABS: Array<{ id: InspectorTab; label: string }> = [
  { id: 'events', label: 'events' },
  { id: 'timing', label: 'timing' },
  { id: 'session', label: 'session' },
]

const DIRECTION_LABEL: Record<RealtimeEventEntry['direction'], string> = {
  in: '←',
  out: '→',
  local: '·',
}

type Props = {
  events: Array<RealtimeEventEntry>
  timing: RealtimeTiming
  session: RealtimeSession | null
  connected: boolean
  onClearEvents: () => void
}

export function PlaygroundRealtimeInspector({ events, timing, session, connected, onClearEvents }: Props) {
  const [tab, setTab] = useState<InspectorTab>('events')
  const sessionJson = useMemo(() => (session ? JSON.stringify(session, null, 2) : ''), [session])
  const uptime = useUptime(connected ? timing.sessionStartedAt : null)
  const last = timing.last

  return (
    <aside className="pg-inspector-shell flex min-h-0 flex-col bg-surface-1">
      <Tabs
        items={TABS}
        value={tab}
        onChange={setTab}
        variant="accent"
        density="compact"
        equalWidth
        className="h-10 shrink-0 bg-surface-1 px-0"
        ariaLabel="Realtime inspector panels"
      />

      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-4 pt-2 pb-5">
        {tab === 'events' ? (
          <PlaygroundInspectorSection
            label={`event log · ${events.length}`}
            action={
              events.length > 0 ? (
                <Tooltip label="Clear events">
                  <button
                    type="button"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-transparent text-fg-dim transition-[background-color,color,transform] duration-100 hover:bg-surface-2 hover:text-fg active:scale-[0.96]"
                    onClick={onClearEvents}
                    aria-label="Clear events"
                  >
                    <Trash2 className="size-3 shrink-0" strokeWidth={2} />
                  </button>
                </Tooltip>
              ) : null
            }
          >
            {events.length > 0 ? (
              <ol className="m-0 flex list-none flex-col-reverse p-0">
                {events.map((event) => (
                  <li
                    key={event.id}
                    className="grid grid-cols-[84px_12px_minmax(0,1fr)] gap-x-2 border-b border-dashed border-border py-1.5 font-mono text-[11px] last:border-b-0"
                  >
                    <span className="tabular-nums text-fg-faint">{formatRealtimeClock(event.at)}</span>
                    <span className="text-fg-dim">
                      <span aria-hidden="true">{DIRECTION_LABEL[event.direction]}</span>
                      <span className="sr-only">{event.direction}</span>
                    </span>
                    <span className="min-w-0">
                      <span className={cn('break-all', event.type === 'error' ? 'text-err' : 'text-fg')}>
                        {event.type}
                      </span>
                      {event.count > 1 ? <span className="ml-1.5 text-fg-dim">×{event.count}</span> : null}
                      {event.detail ? (
                        <span
                          className={cn(
                            'block break-words',
                            event.type === 'error' || event.type === 'mic.error' ? 'text-err' : 'text-fg-dim',
                          )}
                        >
                          {event.detail}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyNote>Events appear here once a session starts. Audio payloads are never shown.</EmptyNote>
            )}
          </PlaygroundInspectorSection>
        ) : null}

        {tab === 'timing' ? (
          <>
            <PlaygroundInspectorSection label="last response">
              <div className="grid grid-cols-2 gap-2">
                <PlaygroundActiveModelCell label="first text" value={formatRealtimeMs(last?.firstTextMs ?? null)} />
                <PlaygroundActiveModelCell label="first audio" value={formatRealtimeMs(last?.firstAudioMs ?? null)} />
                <PlaygroundActiveModelCell label="total" value={formatRealtimeMs(last?.totalMs ?? null)} />
                <PlaygroundActiveModelCell
                  label="audio out"
                  value={last?.audioSeconds != null ? last.audioSeconds.toFixed(1) : '—'}
                  unit={last?.audioSeconds != null ? 's' : undefined}
                />
              </div>
              <PlaygroundKVRow k="status" v={last?.status ?? '—'} />
              <PlaygroundKVRow k="output tokens" v={last?.outputTokens ?? '—'} />
              <p className="m-0 text-[11px] leading-4 text-fg-dim">
                Measured from the end of your turn, in the browser.
              </p>
            </PlaygroundInspectorSection>
            <PlaygroundInspectorSection label="session">
              <PlaygroundKVRow k="connect" v={formatRealtimeMs(timing.connectMs)} />
              <PlaygroundKVRow k="uptime" v={uptime ?? '—'} />
              <PlaygroundKVRow k="responses" v={timing.responses} />
              <PlaygroundKVRow k="output tokens" v={timing.outputTokens} />
              <PlaygroundKVRow k="input rate" v={timing.inputRate ? `${timing.inputRate} Hz` : '—'} />
              <PlaygroundKVRow k="output rate" v={timing.outputRate ? `${timing.outputRate} Hz` : '—'} />
            </PlaygroundInspectorSection>
          </>
        ) : null}

        {tab === 'session' ? (
          <PlaygroundInspectorSection
            label="session config"
            action={sessionJson ? <CopyButton text={sessionJson} /> : null}
          >
            {sessionJson ? (
              <pre className="m-0 whitespace-pre-wrap break-words rounded border border-border bg-surface-2 p-3 font-mono text-[11px] leading-[1.55] text-fg-muted">
                {sessionJson}
              </pre>
            ) : (
              <EmptyNote>The session config from session.created shows here.</EmptyNote>
            )}
          </PlaygroundInspectorSection>
        ) : null}
      </div>
    </aside>
  )
}

function useUptime(startedAt: number | null): string | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (startedAt == null) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [startedAt])
  if (startedAt == null) return null
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000))
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 rounded border border-dashed border-border bg-surface-2 px-3 py-2 text-[11px] text-fg-dim">
      {children}
    </p>
  )
}
