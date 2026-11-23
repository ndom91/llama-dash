import { Select } from '../../components/Select'
import { cn } from '../../lib/cn'

type Props = {
  modelIds: ReadonlyArray<string>
  value: string
  onChange: (model: string) => void
  className?: string
}

export function EndpointModelPicker({ modelIds, value, onChange, className }: Props) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-fg-dim">Model</span>
      <div className="w-56">
        {modelIds.length > 0 ? (
          <Select
            options={modelIds.map((id) => ({ value: id, label: id }))}
            value={value}
            onValueChange={onChange}
            aria-label="Example model"
          />
        ) : (
          <div className="flex h-8 items-center rounded border border-dashed border-border px-2.5 font-mono text-xs text-fg-faint">
            no matching model
          </div>
        )}
      </div>
    </div>
  )
}
