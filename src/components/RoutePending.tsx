type RoutePendingVariant = 'requests' | 'playground' | 'logs' | 'config'

type RoutePendingProps = {
  variant: RoutePendingVariant
}

const TABLE_ROWS = Array.from({ length: 11 }, (_, index) => `pending-row-${index}`)
const LOG_ROWS = Array.from({ length: 18 }, (_, index) => `pending-log-${index}`)
const EDITOR_ROWS = Array.from({ length: 20 }, (_, index) => `pending-editor-${index}`)
const CHAT_ROWS = Array.from({ length: 6 }, (_, index) => `pending-chat-${index}`)

export function RoutePending({ variant }: RoutePendingProps) {
  if (variant === 'requests') return <RequestsPending />
  if (variant === 'logs') return <LogsPending />
  if (variant === 'config') return <ConfigPending />
  return <PlaygroundPending />
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="content">
      <div className="page min-h-0 flex-1 bg-surface-1">{children}</div>
    </div>
  )
}

function HeaderSkeleton({ kickerWidth = 120, titleWidth = 180 }: { kickerWidth?: number; titleWidth?: number }) {
  return (
    <div className="border-b border-border bg-surface-0 px-6 py-4 max-md:px-3">
      <span className="skel skel-text" style={{ width: kickerWidth, height: 10 }} />
      <div className="mt-3">
        <span className="skel skel-text" style={{ width: titleWidth, height: 24 }} />
      </div>
      <div className="mt-3 flex gap-2">
        <span className="skel skel-text" style={{ width: 220 }} />
        <span className="skel skel-text max-sm:hidden" style={{ width: 120 }} />
      </div>
    </div>
  )
}

function RequestsPending() {
  return (
    <PageFrame>
      <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)] items-stretch max-[900px]:grid-cols-1">
        <aside className="h-full border-border bg-surface-1 px-4 py-4 font-mono text-[11px] text-fg max-[900px]:border-b">
          {['Search', 'Status', 'Model', 'Key', 'Routing'].map((label) => (
            <div key={label} className="mb-4 flex flex-col gap-1.5">
              <div className="text-[10px] uppercase tracking-[0.12em] text-fg-dim">{label}</div>
              <span className="skel skel-text" style={{ width: '100%', height: 32 }} />
            </div>
          ))}
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-border bg-surface-0 max-[900px]:border-l-0">
          <section className="panel !rounded-none !border-x-0 !border-t-0 !bg-surface-1">
            <div className="panel-head bg-transparent px-4">
              <span className="panel-title">req/s</span>
              <span className="panel-sub">last 60m</span>
            </div>
            <div className="px-4 pb-4">
              <span className="skel skel-block h-28 rounded-sm" />
            </div>
          </section>

          <section className="panel !rounded-none !border-x-0 !border-t-0 !bg-surface-1 flex min-h-0 flex-1 flex-col">
            <div className="panel-head bg-transparent px-4">
              <span className="panel-title">Log</span>
              <span className="panel-sub">loading rows</span>
              <span className="ml-auto hidden font-mono text-[11px] text-fg-dim md:inline">↑↓ navigate · / search</span>
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
                  <th className="num">duration</th>
                </tr>
              </thead>
              <tbody>
                {TABLE_ROWS.map((row, index) => (
                  <tr key={row}>
                    <td className="mono dim">
                      <span className="skel skel-text" style={{ width: 54 }} />
                    </td>
                    <td className="mono">
                      <span className="skel skel-text" style={{ width: `${58 + (index % 4) * 8}%` }} />
                    </td>
                    <td>
                      <span className="skel skel-text" style={{ width: `${42 + (index % 3) * 12}%` }} />
                    </td>
                    <td>
                      <span className="skel skel-text" style={{ width: 44 }} />
                    </td>
                    <td className="num">
                      <span className="skel skel-text" style={{ width: 32 }} />
                    </td>
                    <td className="num">
                      <span className="skel skel-text" style={{ width: 32 }} />
                    </td>
                    <td>
                      <div className="h-3 rounded-full bg-surface-2">
                        <span
                          className="skel skel-block h-full rounded-full"
                          style={{ width: `${44 + (index % 4) * 11}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </PageFrame>
  )
}

function PlaygroundPending() {
  return (
    <PageFrame>
      <HeaderSkeleton kickerWidth={156} titleWidth={170} />
      <div className="flex gap-2 border-b border-border bg-surface-0 px-6 py-3 max-md:px-3">
        {['Chat', 'Image', 'Speech', 'Transcribe'].map((tab, index) => (
          <div key={tab} className="rounded border border-border bg-surface-1 px-3 py-2">
            <span className="skel skel-text" style={{ width: index === 3 ? 80 : 46 }} />
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px] bg-surface-1 max-xl:grid-cols-1">
        <div className="flex min-h-0 flex-col border-r border-border max-xl:border-r-0">
          <div className="flex-1 space-y-4 overflow-hidden p-6 max-md:p-3">
            {CHAT_ROWS.map((row, index) => (
              <div key={row} className={index % 2 === 0 ? 'mr-16' : 'ml-16'}>
                <div className="panel p-4">
                  <span className="skel skel-text" style={{ width: index % 2 === 0 ? '68%' : '44%' }} />
                  <div className="mt-3 space-y-2">
                    <span className="skel skel-text block" style={{ width: '92%' }} />
                    <span className="skel skel-text block" style={{ width: `${54 + (index % 3) * 12}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-border bg-surface-0 p-4 max-md:p-3">
            <span className="skel skel-block h-24 rounded" />
          </div>
        </div>
        <aside className="hidden min-h-0 flex-col bg-surface-0 p-4 xl:flex">
          <span className="skel skel-text" style={{ width: 110 }} />
          <span className="skel skel-block mt-4 h-48 rounded" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <span className="skel skel-text" style={{ height: 36 }} />
            <span className="skel skel-text" style={{ height: 36 }} />
            <span className="skel skel-text" style={{ height: 36 }} />
            <span className="skel skel-text" style={{ height: 36 }} />
          </div>
        </aside>
      </div>
    </PageFrame>
  )
}

function LogsPending() {
  return (
    <PageFrame>
      <HeaderSkeleton kickerWidth={104} titleWidth={90} />
      <div className="flex items-center gap-2 border-b border-border bg-surface-1 px-4 py-3 font-mono max-md:px-3">
        <span className="skel skel-text" style={{ width: 180, height: 32 }} />
        <span className="skel skel-text" style={{ width: 74, height: 32 }} />
        <span className="skel skel-text" style={{ width: 74, height: 32 }} />
        <span className="ml-auto skel skel-text max-sm:hidden" style={{ width: 120 }} />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden bg-[#050607] p-4 font-mono text-xs max-md:p-3">
        {LOG_ROWS.map((row, index) => (
          <div key={row} className="mb-2 grid grid-cols-[90px_72px_minmax(0,1fr)] gap-3">
            <span className="skel skel-text" style={{ width: 72 }} />
            <span className="skel skel-text" style={{ width: index % 5 === 0 ? 54 : 36 }} />
            <span className="skel skel-text" style={{ width: `${44 + (index % 6) * 8}%` }} />
          </div>
        ))}
      </div>
    </PageFrame>
  )
}

function ConfigPending() {
  return (
    <PageFrame>
      <HeaderSkeleton kickerWidth={112} titleWidth={190} />
      <div className="panel flex min-h-0 flex-1 flex-col overflow-hidden !rounded-none !border-x-0 !bg-surface-1 border-border-strong">
        <div className="flex items-center gap-2 border-b border-border bg-surface-3 px-3.5 py-2 font-mono text-[11px] text-fg-dim">
          <span className="skel skel-text" style={{ width: 96 }} />
          <span className="ml-auto skel skel-text" style={{ width: 120 }} />
        </div>
        <div className="min-h-0 flex-1 overflow-hidden bg-surface-0 p-4 font-mono text-xs max-md:p-3">
          {EDITOR_ROWS.map((row, index) => (
            <div key={row} className="mb-3 grid grid-cols-[36px_minmax(0,1fr)] gap-4">
              <span className="skel skel-text" style={{ width: 22 }} />
              <span className="skel skel-text" style={{ width: `${34 + (index % 7) * 8}%` }} />
            </div>
          ))}
        </div>
        <div className="border-t border-border bg-surface-3 px-3.5 py-2">
          <span className="skel skel-text" style={{ width: 360, maxWidth: '80%' }} />
        </div>
      </div>
    </PageFrame>
  )
}
