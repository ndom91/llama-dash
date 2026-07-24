import { Link } from '@tanstack/react-router'
import { Fragment, type ReactNode } from 'react'

export type PageHeaderParent = {
  label: string
  to:
    | '/'
    | '/models'
    | '/requests'
    | '/logs'
    | '/system'
    | '/playground'
    | '/config'
    | '/settings'
    | '/keys'
    | '/attribution'
    | '/endpoints'
    | '/policies'
}

type Props = {
  /** Current page label — matches the sidebar item for top-level pages. */
  title: string
  /** Parent crumb for detail/sub pages, e.g. Requests › req_…. */
  parent?: PageHeaderParent
  /** Replaces the current title segment (e.g. inline rename). */
  titleNode?: ReactNode
  /** Inline meta after the title, e.g. `type · llama.cpp Router`. */
  meta?: ReactNode
  action?: ReactNode
  variant?: 'default' | 'integrated'
}

export function PageHeader({ title, parent, titleNode, meta, action, variant = 'default' }: Props) {
  return (
    <div className={`page-header page-header-${variant} flex shrink-0 items-start justify-between gap-4`}>
      <div className="page-header-copy flex min-w-0 flex-1 flex-col gap-0.5">
        <h1 className="page-header-title m-0 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-balance text-xl font-semibold -tracking-[0.015em] text-fg">
          {parent ? (
            <Fragment>
              <Link
                to={parent.to}
                className="min-w-0 truncate font-medium text-fg-dim no-underline transition-colors hover:text-fg"
              >
                {parent.label}
              </Link>
              <span className="shrink-0 font-normal text-fg-faint opacity-60" aria-hidden="true">
                ›
              </span>
            </Fragment>
          ) : null}
          {titleNode ?? <span className="min-w-0 truncate">{title}</span>}
          {meta ? (
            <span className="min-w-0 truncate font-mono text-[12px] font-normal tracking-normal text-fg-dim">
              {meta}
            </span>
          ) : null}
        </h1>
      </div>
      {action ? <div className="page-header-action flex shrink-0 items-center gap-1.5">{action}</div> : null}
    </div>
  )
}
