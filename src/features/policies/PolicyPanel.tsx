import type { ReactNode } from 'react'

export function PolicyPanel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="panel flex min-h-0 flex-1 flex-col !rounded-none !border-x-0 border-t-0 !bg-surface-1">
      <div className="panel-head shrink-0 bg-transparent px-6 max-md:px-3">
        <span className="panel-title">{title}</span>
        <span className="panel-sub">· {subtitle}</span>
      </div>
      <div className="min-h-0 flex-1">
        <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto px-6 py-4 max-md:px-3">{children}</div>
      </div>
    </section>
  )
}
