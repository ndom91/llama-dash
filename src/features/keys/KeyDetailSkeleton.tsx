import { PageHeader } from '../../components/PageHeader'

const REQUEST_ROWS = Array.from({ length: 5 }, (_, index) => `request-${index}`)
const ACCESS_ROWS = Array.from({ length: 8 }, (_, index) => `access-${index}`)

export function KeyDetailSkeleton() {
  return (
    <>
      <PageHeader
        kicker="key · loading"
        title="API Key"
        subtitle={<span className="skel skel-text" style={{ width: 220 }} />}
        variant="integrated"
        action={
          <div className="flex items-center gap-2">
            <span className="skel skel-text" style={{ width: 60, height: 28 }} />
            <span className="skel skel-text" style={{ width: 64, height: 28 }} />
          </div>
        }
      />

      <div className="detail-sidecar-shell">
        <aside className="detail-meta-rail">
          <DetailRailSection title="Key" rows={4} />
          <DetailRailSection title="Limits" rows={3} />
        </aside>

        <div className="detail-main-stack">
          <div className="stats-row stats-row-flat detail-stacked-section detail-stacked-stats-row">
            {Array.from({ length: 5 }, (_, index) => `stat-${index}`).map((key, index) => (
              <div key={key} className="stat-card stat-card-flat">
                <span className="skel skel-text" style={{ width: 96 }} />
                <div className="mt-3 flex items-end gap-2">
                  <span className="skel skel-text" style={{ width: 54, height: 26 }} />
                  <span className="skel skel-text" style={{ width: 30 }} />
                </div>
                {index < 3 ? (
                  <div className="mt-4 h-8 rounded-sm bg-surface-2">
                    <span className="skel skel-block h-full" />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <DetailPanelSkeleton title="Default model" rows={2} actionWidth={46} />
          <DetailPanelSkeleton title="System prompt" rows={3} actionWidth={46} />

          <section className="panel detail-stacked-section">
            <div className="panel-head">
              <span className="panel-title">Model access</span>
              <span className="panel-sub">· loading</span>
              <span className="skel skel-text ml-auto" style={{ width: 72, height: 24 }} />
            </div>
            <table className="dtable">
              <thead>
                <tr>
                  <th style={{ width: 72 }}>enabled</th>
                  <th>model</th>
                  <th style={{ width: 84 }}>requests</th>
                  <th style={{ width: 84 }}>tokens</th>
                  <th style={{ width: 84 }}>errors</th>
                </tr>
              </thead>
              <tbody>
                {ACCESS_ROWS.map((row) => (
                  <tr key={row}>
                    <td>
                      <span className="skel skel-text" style={{ width: 16, height: 16, borderRadius: 4 }} />
                    </td>
                    <td>
                      <span className="skel skel-text" style={{ width: '54%' }} />
                    </td>
                    <td>
                      <span className="skel skel-text" style={{ width: 34 }} />
                    </td>
                    <td>
                      <span className="skel skel-text" style={{ width: 42 }} />
                    </td>
                    <td>
                      <span className="skel skel-text" style={{ width: 24 }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="panel detail-stacked-section flex min-h-0 flex-1 flex-col">
            <div className="panel-head">
              <span className="panel-title text-fg-muted">Recent requests</span>
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
                  <th className="mono">model</th>
                  <th style={{ width: 80 }}>status</th>
                  <th className="num" style={{ width: 72 }}>
                    tok-in
                  </th>
                  <th className="num" style={{ width: 72 }}>
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
                      <span className="skel skel-text" style={{ width: '48%' }} />
                    </td>
                    <td>
                      <span className="skel skel-text" style={{ width: '58%' }} />
                    </td>
                    <td>
                      <span className="skel skel-text" style={{ width: 42 }} />
                    </td>
                    <td className="num">
                      <span className="skel skel-text" style={{ width: 36 }} />
                    </td>
                    <td className="num">
                      <span className="skel skel-text" style={{ width: 36 }} />
                    </td>
                    <td>
                      <div className="h-3 rounded-full bg-surface-2">
                        <span className="skel skel-block h-full rounded-full" style={{ width: '56%' }} />
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
            <div className="detail-sidecar-title">Use this key</div>
            <div className="space-y-2 rounded border border-border bg-surface-1 px-3 py-3">
              {Array.from({ length: 6 }, (_, index) => `snippet-${index}`).map((key, index) => (
                <span key={key} className="skel skel-text block" style={{ width: `${78 - index * 8}%` }} />
              ))}
            </div>
          </section>

          <section className="detail-sidecar-section">
            <div className="detail-sidecar-title">Activity · 30m</div>
            <div className="space-y-2.5">
              {Array.from({ length: 4 }, (_, index) => `activity-${index}`).map((key) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span className="skel skel-text" style={{ width: 56 }} />
                  <span className="skel skel-text" style={{ width: 30 }} />
                </div>
              ))}
            </div>
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
              <span className="skel skel-text" style={{ width: 42 }} />
            </dt>
            <dd>
              <span className="skel skel-text" style={{ width: `${56 - index * 7}%` }} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function DetailPanelSkeleton({ title, rows, actionWidth }: { title: string; rows: number; actionWidth: number }) {
  return (
    <section className="panel detail-stacked-section">
      <div className="panel-head">
        <span className="panel-title">{title}</span>
        <span className="panel-sub">· loading</span>
        <span className="skel skel-text ml-auto" style={{ width: actionWidth, height: 24 }} />
      </div>
      <div className="space-y-2.5 px-4 py-4">
        {Array.from({ length: rows }, (_, index) => `${title}-${index}`).map((key, index) => (
          <span key={key} className="skel skel-text block" style={{ width: `${84 - index * 10}%` }} />
        ))}
      </div>
    </section>
  )
}
