import { cn } from '../../lib/cn'
import type { EndpointTypeInfo } from './endpointTypes'

const MAX_CHIPS = 2

type Props = {
  info: EndpointTypeInfo
  modelIds: ReadonlyArray<string>
  loading: boolean
  selected: boolean
  onSelect: () => void
}

export function RequestTypeCard({ info, modelIds, loading, selected, onSelect }: Props) {
  const empty = !loading && modelIds.length === 0
  const shown = modelIds.slice(0, MAX_CHIPS)
  const hidden = modelIds.length - shown.length

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'relative flex w-[200px] shrink-0 cursor-pointer flex-col gap-1.5 overflow-hidden rounded-sm border px-3.5 py-3 text-left transition-[background-color,border-color] duration-100 ease-out focus-visible:outline-none focus-visible:shadow-focus @min-[640px]:w-auto @min-[640px]:min-w-0',
        selected ? 'border-border-strong bg-surface-2' : 'border-border bg-surface-1 hover:bg-surface-2',
        empty && 'opacity-45',
      )}
    >
      {selected ? <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-accent" /> : null}
      <span className="flex items-center gap-2 text-[13px] font-semibold text-fg">
        <span aria-hidden className={cn('font-mono text-xs', selected ? 'text-accent' : 'text-fg-dim')}>
          {info.glyph}
        </span>
        {info.label}
      </span>
      <span className="truncate font-mono text-[11px] text-fg-dim">
        {info.method} {info.path}
      </span>
      <span className="mt-1 flex h-4 min-w-0 items-center gap-1">
        {empty ? <ModelChip>no model loaded</ModelChip> : null}
        {shown.map((id) => (
          <ModelChip key={id}>{id}</ModelChip>
        ))}
        {hidden > 0 ? <span className="shrink-0 font-mono text-[10px] text-fg-dim">+{hidden}</span> : null}
      </span>
    </button>
  )
}

function ModelChip({ children }: { children: string }) {
  return (
    <span className="min-w-0 truncate rounded-sm bg-surface-3 px-1.5 py-px font-mono text-[10px] text-fg-muted">
      {children}
    </span>
  )
}
