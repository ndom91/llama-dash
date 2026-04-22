import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { StatusDot, stateTone } from '../../components/StatusDot'
import type { ApiModel } from '../../lib/api'

type Props = {
  active: Array<ApiModel>
  total: number | null
}

export function DashboardRunningModelsPanel({ active, total }: Props) {
  const navigate = useNavigate()
  const runningCount = active.filter((m) => m.running && m.kind !== 'peer').length
  const peerCount = active.filter((m) => m.kind === 'peer').length
  const subtitle =
    total == null
      ? '—'
      : `${runningCount} of ${total} loaded${peerCount > 0 ? ` · ${peerCount} peer${peerCount > 1 ? 's' : ''}` : ''}`

  return (
    <section className="panel border-t !rounded-none !border-x-0 !bg-surface-1">
      <div className="panel-head bg-transparent px-4">
        <span className="panel-title">Running</span>
        <span className="panel-sub">{subtitle}</span>
        <Link to="/models" className="panel-link ml-auto inline-flex items-center gap-1 font-mono text-[11px]">
          manage
          <ChevronRight className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
      {total == null ? (
        <table className="dtable">
          <thead>
            <tr>
              <th style={{ width: 18 }} aria-label="state" />
              <th className="mono">id</th>
              <th>name</th>
              <th style={{ width: 80 }}>state</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 4 }, (_, index) => `run-skel-${index}`).map((row) => (
              <tr key={row}>
                <td>
                  <span className="skel skel-text" style={{ width: 8, height: 8, borderRadius: 999 }} />
                </td>
                <td className="mono">
                  <span className="skel skel-text" style={{ width: 118 }} />
                </td>
                <td>
                  <span className="skel skel-text" style={{ width: '56%' }} />
                </td>
                <td>
                  <span className="skel skel-text" style={{ width: 42 }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : active.length === 0 ? (
        <div className="empty-state">
          idle — no models loaded. Hit <code translate="no">/v1/chat/completions</code> to swap one in.
        </div>
      ) : (
        <table className="dtable">
          <thead>
            <tr>
              <th style={{ width: 18 }} aria-label="state" />
              <th className="mono">id</th>
              <th>name</th>
              <th style={{ width: 80 }}>state</th>
            </tr>
          </thead>
          <tbody>
            {active.map((m) => {
              const tone = m.kind === 'peer' ? ('warn' as const) : stateTone(m.state, m.running)
              const label = m.kind === 'peer' ? 'peer' : m.state
              return (
                <tr
                  key={m.id}
                  className="clickable-row last:border-b last:border-border"
                  onClick={() => navigate({ to: '/models/$id', params: { id: m.id } })}
                >
                  <td>
                    <StatusDot tone={tone} live />
                  </td>
                  <td className="mono" translate="no">
                    {m.id}
                  </td>
                  <td>{m.name}</td>
                  <td>
                    <span className={`state-label state-label-${tone}`}>{label}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}
