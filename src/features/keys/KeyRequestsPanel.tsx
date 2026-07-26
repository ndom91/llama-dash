import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { DurationBar } from '../../components/DurationBar'
import { StatusCell } from '../../components/StatusCell'
import type { ApiRequest } from '../../lib/api'
import { clickableRowFocusClass, clickableRowProps } from '../../lib/clickable-row-props'
import { cn } from '../../lib/cn'
import { formatWhen } from '../requests/requestsListUtils'

type Props = {
  rows: Array<ApiRequest>
}

export function KeyRequestsPanel({ rows }: Props) {
  const navigate = useNavigate()

  return (
    <section className="panel detail-stacked-section flex min-h-0 flex-1 flex-col">
      <div className="panel-head">
        <span className="panel-title text-fg-muted">Recent requests</span>
        <span className="panel-sub">· last 20</span>
        <Link to="/requests" className="btn btn-ghost btn-xs" style={{ marginLeft: 'auto' }}>
          view all
          <ChevronRight className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="empty-state">no requests for this key yet.</div>
      ) : (
        <table className="dtable">
          <thead>
            <tr>
              <th className="mono" style={{ width: 132 }}>
                t
              </th>
              <th className="mono">endpoint</th>
              <th className="mono">model</th>
              <th style={{ width: 80 }}>status</th>
              <th className="num" style={{ width: 72 }}>
                tok-in
              </th>
              <th className="num" style={{ width: 72 }}>
                tok-out
              </th>
              <th style={{ width: 120 }}>duration</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={cn('clickable-row', clickableRowFocusClass)}
                {...clickableRowProps(() => navigate({ to: '/requests/$id', params: { id: r.id } }))}
              >
                <td className="mono dim" style={{ whiteSpace: 'nowrap' }}>
                  {formatWhen(r.startedAt)}
                </td>
                <td className="mono" translate="no">
                  {r.endpoint}
                </td>
                <td className="mono dim">{r.model ?? '—'}</td>
                <td>
                  <StatusCell code={r.statusCode} streamed={r.streamed} />
                </td>
                <td className="num dim">{r.promptTokens ?? '—'}</td>
                <td className="num">{r.completionTokens ?? '—'}</td>
                <td>
                  <DurationBar
                    ms={r.durationMs}
                    isErr={r.statusCode >= 400}
                    timing={{
                      queueMs: r.queueMs,
                      modelLoadingMs: r.modelLoadingMs,
                      prefillMs: r.prefillMs,
                      reasoningMs: r.reasoningMs,
                      responseMs: r.responseMs,
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
