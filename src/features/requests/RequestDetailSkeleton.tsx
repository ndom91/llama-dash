import { PageHeader } from '../../components/PageHeader'
import { RequestBodySkeleton } from './RequestBodySkeleton'

export function RequestDetailSkeleton() {
  return (
    <>
      <PageHeader kicker="dsh · requests · detail" title="Request detail" subtitle="loading…" variant="integrated" />

      <div className="border-r border-border bg-[color:color-mix(in_srgb,var(--bg-1)_84%,var(--bg-2))] px-4 py-4 max-[1200px]:border-r-0">
        <div className="flex flex-wrap items-start gap-6">
          <div className="min-w-[280px] flex-1">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">endpoint</div>
            <div className="flex items-center gap-2">
              <span className="skel skel-text" style={{ width: 60, height: 24 }} />
              <span className="skel skel-text" style={{ width: 200, height: 24 }} />
            </div>
            <div className="mt-1">
              <span className="skel skel-text" style={{ width: 320 }} />
            </div>
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-3 gap-2 max-[700px]:grid-cols-2">
            {['status', 'tok-in', 'tok-out', 'total', 'duration', 'tok/s'].map((label) => (
              <div key={label} className="rounded border border-border bg-surface-1 px-3 py-2.5">
                <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-fg-dim">{label}</span>
                <span className="skel skel-text" style={{ width: 48, height: 18 }} />
              </div>
            ))}
          </div>
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
