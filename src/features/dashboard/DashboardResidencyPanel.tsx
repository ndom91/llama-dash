import { useMemo } from 'react'
import type { ApiModel, ApiModelEvent } from '../../lib/api'
import { DASHBOARD_WINDOW_MS, buildResidencySpans, formatDurationMinutes } from './dashboardUtils'

type Props = {
  events: Array<ApiModelEvent>
  active: Array<ApiModel>
}

export function DashboardResidencyPanel({ events, active }: Props) {
  const now = Date.now()
  const windowStart = now - DASHBOARD_WINDOW_MS
  const spans = useMemo(() => buildResidencySpans(events, now), [events, now])
  const peerIds = useMemo(() => new Set(active.filter((m) => m.kind === 'peer').map((m) => m.id)), [active])
  const barColors = ['var(--ok)', 'var(--accent)', 'var(--info)']

  const rows = useMemo(() => {
    const byModel = new Map<string, Array<(typeof spans)[number]>>()
    for (const span of spans) {
      const arr = byModel.get(span.modelId) ?? []
      arr.push(span)
      byModel.set(span.modelId, arr)
    }

    return active.map((model) => ({
      id: model.id,
      label: model.name || model.id,
      kind: model.kind,
      spans: byModel.get(model.id) ?? [],
    }))
  }, [active, spans])

  return (
    <section className="panel dashboard-panel dashboard-residency-panel">
      <div className="panel-head dashboard-panel-head">
        <span className="panel-title">Model residency</span>
        <span className="panel-sub">· 60 min</span>
        <span className="panel-sub" style={{ marginLeft: 'auto' }}>
          {active.filter((m) => m.running && m.kind !== 'peer').length} resident · {peerIds.size} peer
        </span>
      </div>
      <div className="dashboard-residency-body">
        {rows.length === 0 ? (
          <div className="dashboard-empty-state">no active model residency in the last hour</div>
        ) : (
          rows.map((row) => {
            const totalMs = row.spans.reduce((sum, span) => sum + (span.end - span.start), 0)
            return (
              <div key={row.id} className="dashboard-residency-row">
                <div className="dashboard-residency-label mono" translate="no">
                  {row.id}
                  <span className="dim">{row.kind === 'peer' ? ' · peer' : ''}</span>
                </div>
                <div className="dashboard-residency-track">
                  {row.spans.map((span) => {
                    const left = ((span.start - windowStart) / DASHBOARD_WINDOW_MS) * 100
                    const width = ((span.end - span.start) / DASHBOARD_WINDOW_MS) * 100
                    return (
                      <span
                        key={`${row.id}-${span.start}`}
                        className={`dashboard-residency-fill${row.kind === 'peer' ? ' is-peer' : ''}`}
                        style={{
                          left: `${left}%`,
                          width: `${Math.max(width, 0.8)}%`,
                          background:
                            row.kind === 'peer'
                              ? 'var(--info)'
                              : barColors[active.findIndex((m) => m.id === row.id) % barColors.length],
                        }}
                      />
                    )
                  })}
                </div>
                <div className="dashboard-residency-duration mono dim">{formatDurationMinutes(totalMs)}</div>
              </div>
            )
          })
        )}
        <div className="dashboard-residency-axis mono dim">
          <span>-60m</span>
          <span>-45m</span>
          <span>-30m</span>
          <span>-15m</span>
          <span>now</span>
        </div>
      </div>
    </section>
  )
}
