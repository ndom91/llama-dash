import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Props = {
  step: number
  children: ReactNode
  className?: string
}

export function StepLabel({ step, children, className }: Props) {
  return (
    <div className={cn('font-mono text-[9.5px] uppercase tracking-[0.14em] text-fg-dim', className)}>
      {step} · {children}
    </div>
  )
}
