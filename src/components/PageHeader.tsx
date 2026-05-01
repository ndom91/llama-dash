import { Fragment, type ReactNode } from 'react'

export function PageHeader({
  kicker,
  title,
  titleNode,
  subtitle,
  action,
  variant = 'default',
}: {
  kicker?: string
  title: string
  titleNode?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  variant?: 'default' | 'integrated'
}) {
  const kickerSegments = kicker ? kicker.split(/\s*·\s*/).filter(Boolean) : []

  return (
    <div className={`page-header page-header-${variant} flex items-start justify-between gap-4`}>
      <div className="page-header-copy flex flex-1 flex-col gap-0.5">
        {kickerSegments.length > 0 ? (
          <div className="page-header-kicker font-mono text-[10px] uppercase tracking-[0.14em] text-fg-faint font-medium flex items-center gap-1.5">
            {kickerSegments.map((seg, i) => {
              const isLast = i === kickerSegments.length - 1
              const key = kickerSegments.slice(0, i + 1).join('>')
              return (
                <Fragment key={key}>
                  <span className={isLast ? 'text-fg font-semibold' : undefined}>{seg}</span>
                  {isLast ? null : <span className="text-fg-faint opacity-60">›</span>}
                </Fragment>
              )
            })}
          </div>
        ) : null}
        {titleNode ?? (
          <h1 className="page-header-title text-xl font-semibold -tracking-[0.015em] text-fg m-0">{title}</h1>
        )}
        {subtitle ? <p className="page-header-subtitle font-mono text-xs text-fg-dim m-0">{subtitle}</p> : null}
      </div>
      {action ? <div className="page-header-action shrink-0 flex items-center gap-1.5">{action}</div> : null}
    </div>
  )
}
