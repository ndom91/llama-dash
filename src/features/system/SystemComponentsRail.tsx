import type { ReactNode } from 'react'
import { StatusDot } from '../../components/StatusDot'
import type { Tone } from './systemMetrics'

export type SystemComponentRow = { label: string; detail: string; tone: Tone }

export function SystemComponentsRail({
  components,
  children,
}: {
  components: Array<SystemComponentRow>
  children?: ReactNode
}) {
  return (
    <aside className="hidden w-[232px] shrink-0 flex-col border-r border-border bg-surface-0/70 xl:flex">
      <div className="flex h-10 items-center border-b border-border px-4 font-mono text-[10px] uppercase tracking-[0.18em] text-fg-faint">
        <span>components</span>
        <span className="ml-auto">all</span>
      </div>
      <ul className="m-0 list-none p-0 py-2">
        {components.map((item) => (
          <li
            key={item.label}
            className="grid items-center gap-2 px-4 py-2 [grid-template-columns:12px_minmax(0,1fr)_auto]"
          >
            <StatusDot tone={item.tone} />
            <span className="truncate font-mono text-[11px] text-fg-muted">{item.label}</span>
            <span className="font-mono tabular-nums text-[10px] text-fg-faint">{item.detail}</span>
          </li>
        ))}
      </ul>
      {children}
    </aside>
  )
}
