import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function SystemPanel({
  title,
  aside,
  children,
  className,
}: {
  title: string
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('panel border-t border-border !rounded-none border-x-0 !bg-surface-1', className)}>
      <div className="panel-head bg-transparent px-6 max-md:px-4">
        <h2 className="panel-title">{title}</h2>
        {aside ? <span className="panel-sub ml-auto">{aside}</span> : null}
      </div>
      <dl className="m-0 px-6 py-4 max-md:px-4">{children}</dl>
    </section>
  )
}
