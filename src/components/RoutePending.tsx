type RoutePendingProps = {
  title: string
  subtitle?: string
}

export function RoutePending({ title, subtitle = 'loading client workspace...' }: RoutePendingProps) {
  return (
    <div className="content">
      <div className="page min-h-full flex-1 bg-surface-1">
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <div className="panel w-full max-w-sm p-5">
            <div className="mb-3 h-1.5 overflow-hidden rounded-pill bg-surface-3">
              <div className="h-full w-1/3 animate-pulse rounded-pill bg-accent" />
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-faint">client route</div>
            <div className="mt-1 text-sm font-medium text-fg">{title}</div>
            <div className="mt-1 font-mono text-xs text-fg-dim">{subtitle}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
