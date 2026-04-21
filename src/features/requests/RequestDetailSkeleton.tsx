import { PageHeader } from '../../components/PageHeader'
import { RequestBodySkeleton } from './RequestBodySkeleton'

export function RequestDetailSkeleton() {
  return (
    <>
      <PageHeader kicker="dsh · requests · detail" title="Request detail" subtitle="loading…" variant="integrated" />

      <div className="border-r border-border bg-[color:color-mix(in_srgb,var(--bg-1)_84%,var(--bg-2))] max-[1200px]:border-r-0">
        <div className="grid min-h-[86px] grid-cols-[minmax(0,1fr)_108px_108px_108px_108px_108px_92px] max-[1300px]:grid-cols-[minmax(0,1fr)_100px_100px_100px_100px_100px_84px] max-[1100px]:grid-cols-3 max-[900px]:grid-cols-2">
          <div className="border-r border-border px-4 py-4 max-[1100px]:col-span-3 max-[1100px]:border-r-0 max-[1100px]:border-b max-[900px]:col-span-2">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">endpoint</div>
            <div className="flex items-center gap-2">
              <span className="skel skel-text" style={{ width: 60, height: 30 }} />
              <span className="skel skel-text" style={{ width: 260, height: 30 }} />
            </div>
          </div>
          {['status', 'tok-in', 'tok-out', 'total', 'duration', 'tok/s'].map((label, index) => (
            <div
              key={label}
              className={`px-4 py-4 ${index < 5 ? 'border-r border-border' : ''} max-[1100px]:border-r-0 max-[1100px]:border-b max-[900px]:border-b ${index % 2 === 1 ? 'max-[900px]:border-r-0' : 'max-[900px]:border-r border-border'}`}
            >
              <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-fg-dim">{label}</span>
              <span className="mt-2 block skel skel-text" style={{ width: 48, height: 22 }} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 grid-cols-2 max-[900px]:grid-cols-1">
        <div>
          <RequestBodySkeleton title="Request" />
        </div>
        <div>
          <RequestBodySkeleton title="Response" />
        </div>
      </div>
    </>
  )
}
