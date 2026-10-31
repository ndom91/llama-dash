import type { ReactNode } from 'react'

type Props = {
  title: string
  sub?: ReactNode
  aside?: ReactNode
  children: ReactNode
  className?: string
}

/** Card section used by every usage panel, matching the dashboard cards. */
export function UsagePanel({ title, sub, aside, children, className }: Props) {
  return (
    <section className={`card min-w-0 ${className ?? ''}`}>
      <div className="panel-head">
        <span className="panel-title">{title}</span>
        {sub ? <span className="panel-sub truncate">{sub}</span> : null}
        {aside ? <div className="ml-auto flex shrink-0 items-center gap-3">{aside}</div> : null}
      </div>
      {children}
    </section>
  )
}
