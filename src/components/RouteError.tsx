import { AlertTriangle, RefreshCw } from 'lucide-react'

type RouteErrorProps = {
  title: string
  message: string
  kicker?: string
  onRetry?: () => void
  retryLabel?: string
}

export function RouteError({
  title,
  message,
  kicker = 'client route',
  onRetry,
  retryLabel = 'retry',
}: RouteErrorProps) {
  return (
    <div className="content">
      <div className="page min-h-full flex-1 bg-surface-1">
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <div className="panel w-full max-w-md p-5">
            <div className="mb-3 flex h-1.5 items-stretch overflow-hidden rounded-pill bg-surface-3">
              <div className="h-full w-full rounded-pill bg-err" />
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-err">
              <AlertTriangle size={11} strokeWidth={2} aria-hidden="true" />
              {kicker}
            </div>
            <div className="mt-1 text-sm font-medium text-fg">{title}</div>
            <div className="mt-1 break-words font-mono text-xs text-fg-dim">{message}</div>
            {onRetry ? (
              <div className="mt-4">
                <button type="button" className="btn btn-ghost btn-xs" onClick={onRetry}>
                  <RefreshCw size={12} strokeWidth={2} aria-hidden="true" />
                  {retryLabel}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
