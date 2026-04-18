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
    <div className="page-header">
      <div className="page-intro">
        {kicker ? <div className="kicker">{kicker}</div> : null}
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-sub">{subtitle}</p> : null}
      </div>
      {action ? <div className="page-header-action">{action}</div> : null}
    </div>
  )
}
