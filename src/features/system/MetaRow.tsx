import type { ReactNode } from 'react'

export function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid items-center gap-4 border-b border-dashed border-border/55 py-1.5 last:border-b-0 [grid-template-columns:auto_minmax(0,1fr)]">
      <dt className="whitespace-nowrap font-mono text-[11px] lowercase tracking-[0.02em] text-fg-muted">{label}</dt>
      <dd className="m-0 min-w-0 justify-self-end break-all text-right font-mono tabular-nums text-xs text-fg">
        {value}
      </dd>
    </div>
  )
}
