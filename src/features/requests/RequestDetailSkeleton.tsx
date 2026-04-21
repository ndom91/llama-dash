import { PageHeader } from '../../components/PageHeader'
import { RequestBodySkeleton } from './RequestBodySkeleton'

export function RequestDetailSkeleton() {
  return (
    <>
      <PageHeader
        kicker="req · loading · a · split"
        title="POST /v1/chat/completions"
        subtitle={<span className="skel skel-text" style={{ width: 180 }} />}
        variant="integrated"
        action={
          <div className="flex items-center gap-2">
            <span className="skel skel-text" style={{ width: 68, height: 28 }} />
            <span className="skel skel-text" style={{ width: 70, height: 28 }} />
          </div>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-[250px_minmax(0,1fr)_280px] items-stretch gap-0 max-[1200px]:grid-cols-[168px_minmax(0,1fr)] max-[900px]:grid-cols-1">
        <aside className="border-r border-border bg-surface-1 px-3.5 py-4 max-[900px]:border-r-0 max-[900px]:border-b">
          <DetailRailSection title="Summary" rows={6} />
          <DetailRailSection title="Model" rows={3} divider />
          <DetailRailSection title="Timing" rows={5} divider />
        </aside>

        <div className="flex min-h-0 min-w-0 flex-col gap-0">
          <div className="border-r border-b border-border bg-surface-1 max-[1200px]:border-r-0 max-[900px]:border-t max-[900px]:border-t-border">
            <div className="grid min-h-[86px] grid-cols-[minmax(0,1fr)_90px_90px_90px_90px_90px_90px] max-[1900px]:grid-cols-[minmax(0,1fr)_100px_100px_100px_100px_100px_84px] max-[1500px]:grid-cols-3 max-[900px]:grid-cols-2">
              <div className="border-r border-border px-4 py-4 max-[1500px]:col-span-3 max-[1500px]:border-r-0 max-[1500px]:border-b max-[900px]:col-span-2">
                <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">endpoint</div>
                <div className="mt-2 flex items-center gap-3">
                  <span className="skel skel-text" style={{ width: 58, height: 28 }} />
                  <span className="skel skel-text" style={{ width: '52%', height: 28 }} />
                </div>
              </div>
              {['status', 'tok-in', 'tok-out', 'total', 'duration', 'tok/s'].map((label, index) => (
                <div
                  key={label}
                  className={`px-4 py-4 ${index < 5 ? 'border-r border-border' : ''} max-[1500px]:border-r-0 max-[1500px]:border-b max-[900px]:border-b ${index % 2 === 1 ? 'max-[900px]:border-r-0' : 'max-[900px]:border-r border-border'}`}
                >
                  <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-fg-dim">{label}</span>
                  <span className="mt-2 block skel skel-text" style={{ width: 48, height: 22 }} />
                </div>
              ))}
            </div>
          </div>

          <section className="panel !rounded-none !border-l-0 !border-r border-r-border !border-b-0 !bg-surface-1">
            <div className="panel-head bg-surface-1 px-4">
              <span className="panel-title">Stream</span>
              <span className="panel-sub">· token trace</span>
            </div>
            <div className="px-4 pb-4">
              <div className="h-16 rounded-sm bg-surface-2">
                <span className="skel skel-block h-full" />
              </div>
            </div>
          </section>

          <section className="panel !rounded-none !border-l-0 !border-r border-r-border !border-b-0 !bg-surface-1 flex min-h-0 flex-1 flex-col">
            <div className="panel-head bg-surface-1 px-4">
              <span className="panel-title">Payloads</span>
              <span className="panel-sub">request • response</span>
              <span className="panel-sub ml-auto">
                <span className="skel skel-text" style={{ width: 88 }} />
              </span>
            </div>

            <div className="grid min-h-0 grid-cols-2 max-[900px]:grid-cols-1">
              <div>
                <RequestBodySkeleton title="Request" />
              </div>
              <div>
                <RequestBodySkeleton title="Response" />
              </div>
            </div>
          </section>
        </div>

        <aside className="detail-sidecar bg-surface-2 border-l border-border">
          <section className="detail-sidecar-section">
            <div className="detail-sidecar-title">Response</div>
            <div className="space-y-2 rounded border border-border bg-surface-1 px-3 py-3">
              {Array.from({ length: 5 }, (_, index) => `res-${index}`).map((key, index) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span className="skel skel-text" style={{ width: 62 }} />
                  <span className="skel skel-text" style={{ width: `${44 - index * 4}%` }} />
                </div>
              ))}
            </div>
          </section>

          <section className="detail-sidecar-section">
            <div className="detail-sidecar-title">Headers</div>
            <div className="space-y-2.5">
              {Array.from({ length: 6 }, (_, index) => `hdr-${index}`).map((key, index) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span className="skel skel-text" style={{ width: 74 }} />
                  <span className="skel skel-text" style={{ width: `${46 - index * 3}%` }} />
                </div>
              ))}
            </div>
          </section>
        </aside>
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
