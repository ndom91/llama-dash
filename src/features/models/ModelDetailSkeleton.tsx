import { PageHeader } from '../../components/PageHeader'

const HISTORY_ROWS = Array.from({ length: 8 }, (_, index) => `history-${index}`)
const REQUEST_ROWS = Array.from({ length: 5 }, (_, index) => `request-${index}`)

export function ModelDetailSkeleton() {
  return (
    <>
      <PageHeader
        kicker="mdl · loading"
        title="Model detail"
        subtitle={<span className="skel skel-text" style={{ width: 180 }} />}
        variant="integrated"
        action={<span className="skel skel-text" style={{ width: 70, height: 28 }} />}
      />

      <div className="detail-sidecar-shell">
        <aside className="detail-meta-rail">
          <DetailRailSection title="Summary" rows={5} />
          <DetailRailSection title="Aliases" rows={2} />
        </aside>

        <div className="detail-main-stack">
          <div className="stats-row detail-stacked-section detail-stacked-stats-row">
            {Array.from({ length: 4 }, (_, index) => `stat-${index}`).map((key) => (
              <div key={key} className="stat-card">
                <span className="skel skel-text" style={{ width: 92 }} />
                <div className="mt-3 flex items-end gap-2">
                  <span className="skel skel-text" style={{ width: 56, height: 26 }} />
                  <span className="skel skel-text" style={{ width: 40 }} />
                </div>
                <div className="mt-4 h-8 rounded-sm bg-surface-2">
                  <span className="skel skel-block h-full" />
                </div>
              </div>
            ))}
          </div>

          <section className="panel detail-stacked-section">
            <div className="panel-head">
              <span className="panel-title">History</span>
              <span className="panel-sub">· latest 12 load/unload events</span>
            </div>
            <table className="dtable">
              <thead>
                <tr>
                  <th style={{ width: 88 }}>type</th>
                  <th>time</th>
                  <th>event</th>
                </tr>
              </thead>
              <tbody>
                {HISTORY_ROWS.map((row) => (
                  <tr key={row}>
                    <td>
                      <span className="skel skel-text" style={{ width: 42 }} />
                    </td>
                    <td>
                      <span className="skel skel-text" style={{ width: 132 }} />
                    </td>
                    <td>
                      <span className="skel skel-text" style={{ width: 84 }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="panel detail-stacked-section">
            <div className="panel-head">
              <span className="panel-title">Recent requests</span>
              <span className="panel-sub">· last 20</span>
              <span className="skel skel-text ml-auto" style={{ width: 64, height: 24 }} />
            </div>
            <table className="dtable">
              <thead>
                <tr>
                  <th className="mono" style={{ width: 80 }}>
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
                  <th className="num" style={{ width: 180 }}>
                    duration
                  </th>
                </tr>
              </thead>
              <tbody>
                {REQUEST_ROWS.map((row) => (
                  <tr key={row}>
                    <td>
                      <span className="skel skel-text" style={{ width: 56 }} />
                    </td>
                    <td>
                      <span className="skel skel-text" style={{ width: '68%' }} />
                    </td>
                    <td>
                      <span className="skel skel-text" style={{ width: 42 }} />
                    </td>
                    <td className="num">
                      <span className="skel skel-text" style={{ width: 38 }} />
                    </td>
                    <td className="num">
                      <span className="skel skel-text" style={{ width: 38 }} />
                    </td>
                    <td>
                      <div className="h-3 rounded-full bg-surface-2">
                        <span className="skel skel-block h-full rounded-full" style={{ width: '62%' }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <aside className="detail-sidecar bg-surface-2 border-l border-border">
          <section className="detail-sidecar-section">
            <div className="detail-sidecar-title">Command</div>
            <div className="space-y-2 rounded border border-border bg-surface-1 px-3 py-3">
              {Array.from({ length: 8 }, (_, index) => `cmd-${index}`).map((key, index) => (
                <span key={key} className="skel skel-text block" style={{ width: `${72 - index * 5}%` }} />
              ))}
            </div>
          </section>

          <section className="detail-sidecar-section">
            <div className="detail-sidecar-title">Resident</div>
            <div className="space-y-2.5">
              {Array.from({ length: 4 }, (_, index) => `resident-${index}`).map((key) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span className="skel skel-text" style={{ width: 42 }} />
                  <span className="skel skel-text" style={{ width: 54 }} />
                </div>
              ))}
            </div>
          </section>

          <section className="detail-sidecar-section detail-sidecar-danger">
            <div className="detail-sidecar-title">Actions</div>
            <span className="skel skel-text" style={{ width: '100%', height: 30 }} />
            <span className="skel skel-text" style={{ width: '100%', height: 30 }} />
          </section>
        </aside>
      </div>
    </>
  )
}

function DetailRailSection({ title, rows }: { title: string; rows: number }) {
  return (
    <div className="detail-meta-section first:mt-0 first:border-t-0 first:pt-0">
      <div className="detail-meta-kicker">{title}</div>
      <dl className="detail-meta-list">
        {Array.from({ length: rows }, (_, index) => `${title}-${index}`).map((key, index) => (
          <div key={key}>
            <dt>
              <span className="skel skel-text" style={{ width: 44 }} />
            </dt>
            <dd>
              <span className="skel skel-text" style={{ width: `${58 - index * 6}%` }} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
