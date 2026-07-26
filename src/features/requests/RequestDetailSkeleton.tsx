import { PageHeader } from '../../components/PageHeader'
import { RequestBodySkeleton } from './RequestBodySkeleton'

export function RequestDetailSkeleton() {
  return (
    <>
      <PageHeader
        parent={{ label: 'Requests', to: '/requests' }}
        title="loading…"
        variant="integrated"
        action={
          <div className="flex items-center gap-2">
            <span className="skel skel-text" style={{ width: 68, height: 28 }} />
            <span className="skel skel-text" style={{ width: 70, height: 28 }} />
          </div>
        }
      />

      <div className="request-detail-grid grid min-h-0 flex-1 items-stretch gap-0">
        <aside className="flex min-h-0 min-w-0 flex-col border-r border-border bg-surface-1 max-[1024px]:border-r-0 max-[1024px]:border-b">
          <div className="border-b border-border px-3.5 py-4 max-[1200px]:px-3">
            <DetailRailSection title="Summary" rows={5} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-4 max-[1200px]:px-3">
            <DetailRailSection title="Model" rows={3} />
          </div>
          <div className="shrink-0 border-t border-border px-3.5 py-4 max-[1200px]:px-3">
            <DetailRailSection title="Timing" rows={6} />
            <div className="mt-3.5 border-t border-border pt-3.5">
              <div className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-faint">Actions</div>
              <div className="grid gap-2">
                <span className="skel skel-text" style={{ width: '100%', height: 28 }} />
                <span className="skel skel-text" style={{ width: '100%', height: 28 }} />
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-col gap-0">
          <div className="border-b border-border bg-surface-1 max-[1024px]:border-t max-[1024px]:border-t-border">
            <div className="grid min-h-[86px] grid-cols-[minmax(0,1fr)_148px_148px_148px_148px_148px] max-[1900px]:grid-cols-[minmax(0,1fr)_136px_136px_136px_136px_136px] max-[1500px]:grid-cols-3 max-[1024px]:grid-cols-2">
              <div className="border-r border-border px-4 py-4 max-[1500px]:col-span-3 max-[1500px]:border-r-0 max-[1500px]:border-b max-[1024px]:col-span-2">
                <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">endpoint</div>
                <div className="mt-2 flex items-center gap-3">
                  <span className="skel skel-text" style={{ width: 58, height: 28 }} />
                  <span className="skel skel-text" style={{ width: '52%', height: 28 }} />
                </div>
              </div>
              {['status', 'tok-in', 'tok-out', 'duration', 'tok/s'].map((label, index) => (
                <div
                  key={label}
                  className={`border-border px-4 py-4 ${index % 3 !== 2 ? 'border-r' : ''} ${index < 4 ? 'max-[1500px]:border-b' : ''} ${index % 2 === 1 ? 'max-[1024px]:border-r-0' : 'max-[1024px]:border-r'} max-[1024px]:border-b`}
                >
                  <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-fg-dim">{label}</span>
                  <span className="mt-2 block skel skel-text" style={{ width: 48, height: 22 }} />
                </div>
              ))}
            </div>
          </div>

          <section className="panel !rounded-none !border-l-0 !border-r-0 !border-b-0 !bg-surface-1">
            <div className="px-4 py-3">
              <div className="h-16 rounded-sm bg-surface-2">
                <span className="skel skel-block h-full" />
              </div>
            </div>
          </section>

          <section className="panel !rounded-none !border-l-0 !border-r-0 !border-b-0 !bg-surface-1 flex min-h-0 flex-1 flex-col">
            <div className="grid min-h-0 grid-cols-2 max-[1024px]:grid-cols-1">
              <div>
                <RequestBodySkeleton title="Request" />
              </div>
              <div>
                <RequestBodySkeleton title="Response" />
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}

function DetailRailSection({ title, rows, divider = false }: { title: string; rows: number; divider?: boolean }) {
  return (
    <div className={divider ? 'mt-3.5 border-t border-border pt-3.5' : ''}>
      <div className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-faint">{title}</div>
      <dl className="detail-meta-list">
        {Array.from({ length: rows }, (_, index) => `${title}-${index}`).map((key, index) => (
          <div key={key}>
            <dt>
              <span className="skel skel-text" style={{ width: 42 }} />
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
