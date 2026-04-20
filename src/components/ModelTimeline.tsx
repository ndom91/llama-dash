import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import type { ApiModelEvent } from '../lib/api'
import { cn } from '../lib/cn'

const WINDOW_MS = 30 * 60_000
const MODEL_COLORS = ['var(--accent)', 'var(--info)', 'var(--ok)', 'var(--warn)', 'var(--err)']
const SWAP_COLOR = 'var(--warn)'

type Span = {
  modelId: string
  start: number
  end: number
  isSwap: boolean
}

function buildSpans(events: Array<ApiModelEvent>, now: number): Array<Span> {
  const windowStart = now - WINDOW_MS
  const spans: Array<Span> = []
  const active = new Map<string, number>()

  for (const ev of events) {
    const ts = new Date(ev.timestamp).getTime()
    if (ev.event === 'load') {
      active.set(ev.modelId, ts)
    } else if (ev.event === 'unload') {
      const loadTs = active.get(ev.modelId)
      if (loadTs != null) {
        spans.push({
          modelId: ev.modelId,
          start: Math.max(loadTs, windowStart),
          end: ts,
          isSwap: false,
        })
        active.delete(ev.modelId)
      }
    }
  }

  for (const [modelId, loadTs] of active) {
    spans.push({
      modelId,
      start: Math.max(loadTs, windowStart),
      end: now,
      isSwap: false,
    })
  }

  const sorted = spans.sort((a, b) => a.start - b.start)
  const result: Array<Span> = []
  for (let i = 0; i < sorted.length; i++) {
    result.push(sorted[i])
    if (i < sorted.length - 1) {
      const gap = sorted[i + 1].start - sorted[i].end
      if (gap > 1000) {
        result.push({
          modelId: '__swap__',
          start: sorted[i].end,
          end: sorted[i + 1].start,
          isSwap: true,
        })
      }
    }
  }

  return result
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  return `${Math.round(ms / 60_000)} min`
}

const TICK_COUNT = 7

export function ModelTimeline({ events, className }: { events: Array<ApiModelEvent>; className?: string }) {
  const now = Date.now()
  const windowStart = now - WINDOW_MS

  const spans = useMemo(() => buildSpans(events, now), [events, now])

  const modelIds = useMemo(() => {
    const ids = new Set<string>()
    for (const s of spans) if (!s.isSwap) ids.add(s.modelId)
    return [...ids]
  }, [spans])

  const colorMap = useMemo(() => {
    const m = new Map<string, string>()
    for (let i = 0; i < modelIds.length; i++) {
      m.set(modelIds[i], MODEL_COLORS[i % MODEL_COLORS.length])
    }
    return m
  }, [modelIds])

  const ticks = useMemo(() => {
    const arr: Array<{ pct: number; label: string }> = []
    for (let i = 0; i < TICK_COUNT; i++) {
      const pct = (i / (TICK_COUNT - 1)) * 100
      const t = windowStart + (i / (TICK_COUNT - 1)) * WINDOW_MS
      const minAgo = Math.round((now - t) / 60_000)
      arr.push({ pct, label: minAgo === 0 ? 'now' : `-${minAgo}m` })
    }
    return arr
  }, [windowStart, now])

  const legend = useMemo(() => {
    const durations = new Map<string, number>()
    for (const s of spans) {
      if (s.isSwap) continue
      durations.set(s.modelId, (durations.get(s.modelId) ?? 0) + (s.end - s.start))
    }
    const swapTime = spans.filter((s) => s.isSwap).reduce((sum, s) => sum + (s.end - s.start), 0)
    return { models: durations, swapTime }
  }, [spans])

  if (spans.length === 0) {
    return (
      <section className={cn('panel', className)}>
        <div className={cn('panel-head', className && 'dashboard-panel-head')}>
          <span className="panel-title">Model swap timeline</span>
          <span className="panel-sub">30 min · resident in VRAM</span>
        </div>
        <div className={cn('empty-state', className && 'dashboard-empty-state')}>no model activity in last 30 min</div>
      </section>
    )
  }

  return (
    <section className={cn('panel', className)}>
      <div className={cn('panel-head', className && 'dashboard-panel-head')}>
        <span className="panel-title">Model swap timeline</span>
        <span className="panel-sub">30 min · resident in VRAM</span>
        <span className="panel-sub" style={{ marginLeft: 'auto' }}>
          now →
        </span>
      </div>
      <div className="timeline-body">
        <div className="timeline-track">
          {spans.map((s) => {
            const left = ((s.start - windowStart) / WINDOW_MS) * 100
            const width = ((s.end - s.start) / WINDOW_MS) * 100
            return (
              <div
                key={`${s.modelId}-${s.start}`}
                className={`timeline-span${s.isSwap ? ' timeline-swap' : ''}`}
                style={{
                  left: `${left}%`,
                  width: `${Math.max(width, 0.3)}%`,
                  background: s.isSwap ? SWAP_COLOR : colorMap.get(s.modelId),
                }}
              />
            )
          })}
        </div>
        <div className="timeline-axis">
          {ticks.map((t) => (
            <span key={t.label} className="timeline-tick" style={{ left: `${t.pct}%` }}>
              {t.label}
            </span>
          ))}
        </div>
        <div className="timeline-legend">
          {[...legend.models.entries()].map(([id, ms]) => (
            <span key={id} className="timeline-legend-item">
              <span className="timeline-legend-swatch" style={{ background: colorMap.get(id) }} />
              <span className="mono" translate="no">
                <Link to="/models/$id" params={{ id }} className="link-subtle">
                  {id}
                </Link>{' '}
                <span className="dim">· {formatDuration(ms)}</span>
              </span>
            </span>
          ))}
          {legend.swapTime > 0 ? (
            <span className="timeline-legend-item">
              <span className="timeline-legend-swatch" style={{ background: SWAP_COLOR }} />
              <span className="mono">
                swap window <span className="dim">· {formatDuration(legend.swapTime)}</span>
              </span>
            </span>
          ) : null}
        </div>
      </div>
    </section>
  )
}
