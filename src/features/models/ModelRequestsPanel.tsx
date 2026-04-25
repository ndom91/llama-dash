import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { DurationBar } from '../../components/DurationBar'
import { StatusCell } from '../../components/StatusCell'
import type { ApiRequest } from '../../lib/api'
import { formatWhen } from '../requests/requestsListUtils'

type Props = {
  rows: Array<ApiRequest>
  modelId: string
}

export function ModelRequestsPanel({ rows, modelId }: Props) {
  const navigate = useNavigate()
  const maxDuration = useMemo(() => Math.max(0, ...rows.map((r) => r.durationMs)), [rows])

  return (
    <section className="panel detail-stacked-section">
      <div className="panel-head">
        <span className="panel-title">Recent requests</span>
        <span className="panel-sub">· last 20</span>
        <Link
          to="/requests"
          search={{ model: modelId }}
          className="btn btn-ghost btn-xs"
          style={{ marginLeft: 'auto' }}
        >
          view all
          <ChevronRight className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="empty-state">no requests for this model yet.</div>
      ) : (
        <table className="dtable">
          <thead>
            <tr>
              <th className="mono" style={{ width: 132 }}>
                t
              </th>
              <th className="mono">endpoint</th>
              <th style={{ width: 80 }}>status</th>
              <th className="num whitespace-nowrap" style={{ width: 84 }}>
                tok-in
              </th>
              <th className="num whitespace-nowrap" style={{ width: 84 }}>
                tok-out
              </th>
              <th style={{ width: 120 }}>duration</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="clickable-row"
                onClick={() => navigate({ to: '/requests/$id', params: { id: r.id } })}
              >
                <td className="mono dim" style={{ whiteSpace: 'nowrap' }}>
                  {formatWhen(r.startedAt)}
                </td>
                <td className="mono" translate="no">
                  {r.endpoint}
                </td>
                <td>
                  <StatusCell code={r.statusCode} streamed={r.streamed} />
                </td>
                <td className="num dim">{r.promptTokens ?? '—'}</td>
                <td className="num">{r.completionTokens ?? '—'}</td>
                <td>
                  <DurationBar ms={r.durationMs} maxMs={maxDuration} isErr={r.statusCode >= 400} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
