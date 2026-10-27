import { Select as BaseSelect } from '@base-ui/react/select'
import { Check, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export type SelectOption = {
  value: string
  label: ReactNode
}

type CommonProps = {
  options: readonly SelectOption[]
  placeholder?: ReactNode
  className?: string
  'aria-label'?: string
}

type SingleProps = CommonProps & {
  multiple?: false
  value: string
  onValueChange: (value: string) => void
}

/** An empty `value` renders `placeholder`, so callers can treat it as "all". */
type MultipleProps = CommonProps & {
  multiple: true
  value: readonly string[]
  onValueChange: (value: string[]) => void
}

type SelectProps = SingleProps | MultipleProps

export function Select(props: SelectProps) {
  const { options, placeholder, className } = props
  const labelFor = (value: string) => options.find((o) => o.value === value)?.label ?? value

  const renderValue = (value: string | readonly string[] | null) => {
    if (typeof value === 'string') return <span className="min-w-0 truncate">{labelFor(value)}</span>
    if (value == null || value.length === 0) return <span className="text-fg-dim">{placeholder}</span>
    return (
      <>
        <span className="min-w-0 truncate">{labelFor(value[0])}</span>
        {value.length > 1 ? <span className="shrink-0 text-fg-dim">+{value.length - 1}</span> : null}
      </>
    )
  }

  const content = (
    <>
      <BaseSelect.Trigger
        aria-label={props['aria-label']}
        className={cn(
          'flex h-8 w-full cursor-pointer items-center gap-2 rounded border border-border-strong bg-surface-2 px-2.5 text-left font-mono text-xs text-fg outline-none transition-[border-color,box-shadow] duration-100 hover:border-fg-faint focus-visible:border-accent focus-visible:[box-shadow:var(--shadow-focus)] data-[popup-open]:border-accent',
          className,
        )}
      >
        <BaseSelect.Value className="flex min-w-0 flex-1 items-center gap-1.5">{renderValue}</BaseSelect.Value>
        <BaseSelect.Icon className="flex shrink-0 text-fg-dim">
          <ChevronDown size={12} strokeWidth={2} />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner className="z-50 outline-none" sideOffset={4} alignItemWithTrigger={false}>
          <BaseSelect.Popup className="max-h-[min(320px,var(--available-height))] min-w-[var(--anchor-width)] overflow-y-auto rounded border border-border-strong bg-surface-2 p-1 shadow-lg outline-none transition-[opacity,transform] duration-100 ease-out data-[ending-style]:opacity-0 data-[starting-style]:-translate-y-1 data-[starting-style]:opacity-0">
            <BaseSelect.List>
              {options.map((o) => (
                <BaseSelect.Item
                  key={o.value}
                  value={o.value}
                  className="flex cursor-pointer select-none items-center gap-2 rounded-sm py-1.5 pr-2.5 pl-2 font-mono text-xs text-fg-muted outline-none data-[highlighted]:bg-surface-3 data-[highlighted]:text-fg data-[selected]:text-fg"
                >
                  <span className="flex size-3 shrink-0 items-center justify-center">
                    <BaseSelect.ItemIndicator className="flex text-accent">
                      <Check size={12} strokeWidth={2.5} />
                    </BaseSelect.ItemIndicator>
                  </span>
                  <BaseSelect.ItemText className="min-w-0 truncate">{o.label}</BaseSelect.ItemText>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </>
  )

  if (props.multiple) {
    return (
      <BaseSelect.Root multiple value={props.value} onValueChange={(v) => props.onValueChange(v)}>
        {content}
      </BaseSelect.Root>
    )
  }
  return (
    <BaseSelect.Root
      value={props.value}
      onValueChange={(v) => {
        if (v != null) props.onValueChange(v)
      }}
    >
      {content}
    </BaseSelect.Root>
  )
}
