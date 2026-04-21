const ROWS = Array.from({ length: 10 }, (_, index) => `request-row-${index}`)

export function RequestsPageSkeleton() {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)] items-stretch gap-0 max-[900px]:grid-cols-1">
      <aside className="h-full border-border bg-surface-1 px-4 py-4 font-mono text-[11px] text-fg max-[900px]:border-r-0 max-[900px]:border-b">
        {['Search', 'Status', 'Model', 'Key'].map((label) => (
          <div key={label} className="mb-4 flex flex-col gap-1.5">
            <div className="text-[10px] uppercase tracking-[0.12em] text-fg-dim">{label}</div>
            <span className="skel skel-text" style={{ width: '100%', height: 32 }} />
          </div>
        ))}
        <span className="skel skel-text" style={{ width: 84, height: 24 }} />
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-0 border-l border-border bg-surface-0 max-[900px]:border-l-0">
        <section className="panel rounded-none! border-t-0! border-x-0! bg-surface-1!">
          <div className="histogram-header panel-head bg-transparent px-4">
            <div>
              <span className="panel-title">req/s</span>
              <span className="panel-sub" style={{ marginLeft: 8 }}>
                last 60m · bucket 1m
              </span>
            </div>
          </div>
          <div className="px-4 pb-4">
            <div className="h-28 rounded-sm bg-surface-2">
              <span className="skel skel-block h-full" />
            </div>
          </div>
        </section>

        <section className="panel !rounded-none !border-x-0 !border-t-0 !bg-surface-1 flex min-h-0 flex-1 flex-col">
          <div className="panel-head bg-transparent px-4">
            <span className="panel-title">Log</span>
            <span className="panel-sub">loading rows…</span>
            <span className="ml-auto font-mono text-[11px] text-fg-dim">↑↓ navigate · ⏎ open · / search</span>
          </div>

          <table className="dtable dtable-virtual">
            <thead>
              <tr>
                <th className="mono">t</th>
                <th className="mono">endpoint</th>
                <th>model</th>
                <th>status</th>
                <th className="num">tok-in</th>
                <th className="num">tok-out</th>
                <th className="num">cache</th>
                <th className="num">cost</th>
                <th className="num">duration</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row}>
                  <td className="mono dim">
                    <span className="skel skel-text" style={{ width: 56 }} />
                  </td>
                  <td className="mono">
                    <span className="skel skel-text" style={{ width: '74%' }} />
                  </td>
                  <td>
                    <span className="skel skel-text" style={{ width: '62%' }} />
                  </td>
                  <td>
                    <span className="skel skel-text" style={{ width: 46 }} />
                  </td>
                  <td className="num">
                    <span className="skel skel-text" style={{ width: 34 }} />
                  </td>
                  <td className="num">
                    <span className="skel skel-text" style={{ width: 34 }} />
                  </td>
                  <td className="num">
                    <span className="skel skel-text" style={{ width: 28 }} />
                  </td>
                  <td className="num">
                    <span className="skel skel-text" style={{ width: 42 }} />
                  </td>
                  <td>
                    <div className="h-3 rounded-full bg-surface-2">
                      <span className="skel skel-block h-full rounded-full" style={{ width: '58%' }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}
