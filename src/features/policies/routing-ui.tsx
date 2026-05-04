import { X } from 'lucide-react'
import { type ReactElement, useState } from 'react'
import type { RoutingAction } from '../../lib/api'
import { cn } from '../../lib/cn'

export type RoutingStreamMode = 'any' | 'stream' | 'non_stream'
export type RoutingActionType = 'rewrite_model' | 'reject' | 'continue'

export const segmentedSelectedClass =
  'm-0.5 rounded-sm bg-accent/15 text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_55%,transparent)]'

export function IconButton({
  icon,
  onClick,
  disabled = false,
  busy = false,
}: {
  icon: ReactElement
  onClick: () => void
  disabled?: boolean
  busy?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-surface-2 text-fg-dim transition-colors hover:border-border-strong hover:bg-surface-3 hover:text-fg focus-visible:outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-35"
    >
      {icon}
    </button>
  )
}

export function Chip({ children, tone = 'default' }: { children: string; tone?: 'default' | 'ok' | 'info' | 'err' }) {
  return (
    <span
      className={cn(
        'rounded border px-2 py-1 font-mono text-[11px]',
        tone === 'ok' && 'border-ok/35 bg-ok/12 text-ok',
        tone === 'info' && 'border-info/45 bg-info/15 text-info brightness-75 dark:brightness-100',
        tone === 'err' && 'border-err/35 bg-err/12 text-err',
        tone === 'default' && 'border-border bg-surface-1 text-fg-muted',
      )}
    >
      {children}
    </span>
  )
}

export function TokenInput({
  label,
  helper,
  placeholder,
  values,
  onAdd,
  onRemove,
  suggestions = [],
  renderValue,
}: {
  label: string
  helper?: string
  placeholder: string
  values: string[]
  onAdd: (value: string) => void
  onRemove: (value: string) => void
  suggestions?: string[]
  renderValue?: (value: string) => string
}) {
  const [draft, setDraft] = useState('')
  const availableSuggestions = suggestions.filter((item) => !values.includes(item))

  const submit = () => {
    const next = draft.trim()
    if (!next || values.includes(next)) return
    onAdd(next)
    setDraft('')
  }

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">{label}</div>
      <div className="flex min-h-10 flex-wrap items-center gap-2 rounded border border-border bg-surface-3 px-3 py-2 focus-within:border-accent/70 focus-within:shadow-focus">
        {values.map((value) => (
          <span
            key={value}
            className="inline-flex items-center gap-1 rounded border border-border bg-surface-1 px-2 py-1 font-mono text-[11px] text-fg"
          >
            {renderValue ? renderValue(value) : value}
            <button type="button" className="text-fg-dim hover:text-fg" onClick={() => onRemove(value)}>
              <X className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          type="text"
          className="min-w-[140px] flex-1 bg-transparent font-mono text-xs text-fg outline-none placeholder:text-fg-dim"
          placeholder={placeholder}
          value={draft}
          list={availableSuggestions.length > 0 ? `${label}-suggestions` : undefined}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
          }}
          onBlur={submit}
        />
        {availableSuggestions.length > 0 ? (
          <datalist id={`${label}-suggestions`}>
            {availableSuggestions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        ) : null}
      </div>
      {helper ? <div className="text-[11px] font-mono text-fg-dim">{helper}</div> : null}
    </div>
  )
}

export function coerceAction(type: RoutingActionType, current: RoutingAction): RoutingAction {
  if (type === current.type) return current
  if (type === 'rewrite_model') return { type, model: '' }
  if (type === 'continue') return { type }
  return { type, reason: '' }
}
