import { cn } from '../../lib/cn'
import { MODEL_ROW_GRID } from './modelResidency'

export function DashboardModelsPanelSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }, (_, index) => `model-skel-${index}`).map((key) => (
        <div key={key} className={cn(MODEL_ROW_GRID, 'min-h-12 border-b border-border py-2')}>
          <span className="skel skel-text mx-auto" style={{ width: 8, height: 8, borderRadius: 999 }} />
          <span className="skel skel-text" style={{ width: '70%' }} />
          <span className="skel skel-text max-[900px]:hidden" style={{ width: 42 }} />
          <span className="skel skel-text" style={{ width: '100%', height: 8 }} />
          <span className="skel skel-text ml-auto max-[900px]:hidden" style={{ width: 28 }} />
          <span className="skel skel-text ml-auto" style={{ width: 20 }} />
        </div>
      ))}
    </>
  )
}
