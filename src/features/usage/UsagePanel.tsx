import type { ReactNode } from 'react'

type Props = {
  title: string
  sub?: ReactNode
  aside?: ReactNode
  children: ReactNode
  className?: string
}

/** Flush section used by every usage panel, matching the dashboard's integrated panels. */
export function UsagePanel({ title, sub, aside, children, className }: Props) {
  return (
    <section
      className={`panel !rounded-none !border-x-0 !border-t-0 border-b !bg-surface-1 min-w-0 ${className ?? ''}`}
    >
      <div className="panel-head bg-transparent px-4">
        <span className="panel-title">{title}</span>
        {sub ? <span className="panel-sub truncate">{sub}</span> : null}
        {aside ? <div className="ml-auto flex shrink-0 items-center gap-3">{aside}</div> : null}
      </div>
      {children}
    </section>
  )
}
