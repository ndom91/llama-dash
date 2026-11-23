import type { ReactNode } from 'react'
import { Select } from '../../components/Select'
import { SkeletonLine } from '../../components/skeleton/SkeletonFrame'
import { cn } from '../../lib/cn'
import { useSkeletonReveal } from '../../lib/use-skeleton-reveal'

type Props = {
  modelIds: ReadonlyArray<string>
  loading: boolean
  value: string
  onChange: (model: string) => void
  className?: string
}

export function EndpointModelPicker({ modelIds, loading, value, onChange, className }: Props) {
  const reveal = useSkeletonReveal(loading)

  let control: ReactNode
  if (loading) {
    control = <SkeletonLine width="100%" height={32} className="block rounded" />
  } else if (modelIds.length > 0) {
    control = (
      <Select
        options={modelIds.map((id) => ({ value: id, label: id }))}
        value={value}
        onValueChange={onChange}
        aria-label="Example model"
      />
    )
  } else {
    control = (
      <div className="flex h-8 items-center rounded border border-dashed border-border px-2.5 font-mono text-xs text-fg-faint">
        no matching model
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-fg-dim">Model</span>
      <div className={cn('w-56', reveal && 't-reveal')}>{control}</div>
    </div>
  )
}
