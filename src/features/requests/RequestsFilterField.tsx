import type { ReactNode } from 'react'

type Props = {
  label: string
  hint?: string
  children: ReactNode
}

export function RequestsFilterField({ label, hint, children }: Props) {
  return (
    <div className="mb-4 flex flex-col gap-1.5">
      <div className="text-[10px] uppercase tracking-[0.12em] text-fg-dim">
        {label}
        {hint ? <span className="ml-1.5 normal-case tracking-normal text-fg-faint">{hint}</span> : null}
      </div>
      {children}
    </div>
  )
}
