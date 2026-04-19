import type { ReactNode } from 'react'

export function PageHeader({
  kicker,
  title,
  subtitle,
  action,
}: {
  kicker?: string
  title: string
  subtitle?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        {kicker ? (
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim font-medium">{kicker}</div>
        ) : null}
        <h1 className="text-xl font-semibold -tracking-[0.015em] text-fg m-0">{title}</h1>
        {subtitle ? <p className="font-mono text-xs text-fg-dim m-0">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0 flex items-center gap-1.5">{action}</div> : null}
    </div>
  )
}
