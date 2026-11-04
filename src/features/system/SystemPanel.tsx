import type { ReactNode } from 'react'

export function SystemPanel({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col border-t border-border">
      <div className="flex h-10 items-center gap-3 border-b border-border px-5 max-md:px-4">
        <h2 className="panel-title">{title}</h2>
        {aside ? <span className="ml-auto font-mono text-[10px] text-fg-faint">{aside}</span> : null}
      </div>
      <div className="flex-1 px-5 pt-2 pb-4 max-md:px-4">{children}</div>
    </section>
  )
}
