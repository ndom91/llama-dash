import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { CopyableCode } from '../../components/CopyableCode'
import { DurationBar } from '../../components/DurationBar'
import { StatusCell } from '../../components/StatusCell'
import type { ApiRequest } from '../../lib/api'

type Props = {
  requests: Array<ApiRequest> | null
}

export function DashboardRecentRequestsPanel({ requests }: Props) {
  const navigate = useNavigate()
  const errCount = useMemo(() => requests?.filter((r) => r.statusCode >= 400).length ?? 0, [requests])
  const maxDuration = useMemo(() => Math.max(0, ...(requests?.map((r) => r.durationMs) ?? [])), [requests])

  return (
    <section className="panel !rounded-none !border-x-0 !bg-surface-1 flex min-h-0 flex-1 flex-col">
      <div className="panel-head bg-transparent px-4">
        <span className="panel-title">Recent requests</span>
        <span className="panel-sub">
          newest first · {requests?.length ?? 0} shown{errCount > 0 ? ` · ${errCount} errors` : ''}
        </span>
        <Link to="/requests" className="panel-link ml-auto inline-flex items-center gap-1 font-mono text-[11px]">
          view all
          <ChevronRight className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
      {requests == null ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="dtable">
            <thead>
              <tr>
                <th className="mono" style={{ width: 80 }}>
                  t
                </th>
                <th className="mono">endpoint</th>
                <th>model</th>
                <th style={{ width: 80 }}>status</th>
                <th className="num" style={{ width: 80 }}>
                  tok-in
                </th>
                <th className="num" style={{ width: 80, whiteSpace: 'nowrap' }}>
                  tok-out
                </th>
                <th className="num" style={{ width: 90 }}>
                  duration
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }, (_, index) => `req-skel-${index}`).map((row) => (
                <tr key={row}>
                  <td className="mono dim">
                    <span className="skel skel-text" style={{ width: 54 }} />
                  </td>
                  <td className="mono">
                    <span className="skel skel-text" style={{ width: '72%' }} />
                  </td>
                  <td className="dim">
                    <span className="skel skel-text" style={{ width: '58%' }} />
                  </td>
                  <td>
                    <span className="skel skel-text" style={{ width: 44 }} />
                  </td>
                  <td className="num dim">
                    <span className="skel skel-text" style={{ width: 32 }} />
                  </td>
                  <td className="num">
                    <span className="skel skel-text" style={{ width: 32 }} />
                  </td>
                  <td>
                    <div className="h-3 rounded-full bg-surface-2">
                      <span className="skel skel-block h-full rounded-full" style={{ width: '52%' }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : requests.length === 0 ? (
        <div className="empty-state">
          no requests yet. point clients at{' '}
          <CopyableCode text={`${typeof window !== 'undefined' ? window.location.origin : ''}/v1/`} /> to see them here.
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="dtable">
            <thead>
              <tr>
                <th className="mono" style={{ width: 80 }}>
                  t
                </th>
                <th className="mono">endpoint</th>
                <th>model</th>
                <th style={{ width: 80 }}>status</th>
                <th className="num" style={{ width: 80 }}>
                  tok-in
                </th>
                <th className="num" style={{ width: 80, whiteSpace: 'nowrap' }}>
                  tok-out
                </th>
                <th className="num" style={{ width: 90 }}>
                  duration
                </th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr
                  key={r.id}
                  className="clickable-row"
                  onClick={() => navigate({ to: '/requests/$id', params: { id: r.id } })}
                >
                  <td className="mono dim">{new Date(r.startedAt).toLocaleTimeString([], { hour12: false })}</td>
                  <td className="mono" translate="no">
                    <span className="block overflow-hidden text-ellipsis whitespace-nowrap" title={r.endpoint}>
                      {r.endpoint}
                    </span>
                  </td>
                  <td className="dim" translate="no">
                    <span className="block overflow-hidden text-ellipsis whitespace-nowrap" title={r.model ?? '—'}>
                      {r.model ?? '—'}
                    </span>
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
        </div>
      )}
    </section>
  )
}
