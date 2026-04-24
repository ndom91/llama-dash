import { cn } from '../../lib/cn'
import { POLL_MS } from '../../lib/queries'

type RequestsRefreshButtonProps = {
  cycleKey: string | number
  isRefetching: boolean
  onRefresh: () => void
}

export function RequestsRefreshButton({ cycleKey, isRefetching, onRefresh }: RequestsRefreshButtonProps) {
  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon requests-refresh-button"
      onClick={onRefresh}
      disabled={isRefetching}
      aria-label="Refresh"
    >
      <svg className="h-[18px] w-[18px] -rotate-90" aria-hidden="true" viewBox="0 0 22 22">
        <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeOpacity="0.12" />
        <circle
          key={cycleKey}
          className={cn('requests-refresh-ring text-accent', isRefetching && 'requests-refresh-ring-active')}
          cx="11"
          cy="11"
          r="8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.75"
          strokeLinecap="round"
          style={{ animationDuration: `${POLL_MS}ms` }}
        />
      </svg>
    </button>
  )
}
