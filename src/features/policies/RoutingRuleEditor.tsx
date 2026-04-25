import { Circle } from 'lucide-react'
import type { RoutingRule } from '../../lib/api'
import { cn } from '../../lib/cn'
import { RoutingRuleActionSection } from './RoutingRuleActionSection'
import { RoutingRuleAuthSection } from './RoutingRuleAuthSection'
import { RoutingRuleMatchSection } from './RoutingRuleMatchSection'
import { RoutingRulePreview } from './RoutingRulePreview'
import { RoutingRuleTargetSection } from './RoutingRuleTargetSection'

export function RoutingRuleEditor({
  draft,
  keyMap,
  keys,
  modelOptions,
  errorMessage,
  isMutating,
  onChange,
  onDiscard,
  onSave,
}: {
  draft: RoutingRule
  keyMap: Map<string, string>
  keys: Array<{ id: string }>
  modelOptions: string[]
  errorMessage?: string
  isMutating: boolean
  onChange: (draft: RoutingRule) => void
  onDiscard: () => void
  onSave: () => void
}) {
  return (
    <section className="border border-accent/70 bg-surface-0/80 px-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
          <Circle className="mr-2 inline-block icon-btn-12 fill-current" strokeWidth={0} aria-hidden="true" />
          editing · rule {String(draft.order).padStart(2, '0')} · {draft.action.type.replace(/_/g, ' ')}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost btn-xs" onClick={onDiscard}>
            cancel
          </button>
          <button type="button" className="btn btn-primary btn-xs" onClick={onSave} disabled={isMutating}>
            {isMutating ? 'saving rule…' : 'save rule'}
          </button>
        </div>
      </div>

      <div className="grid gap-6 pt-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="space-y-5">
          <div className="grid gap-4 items-end xl:grid-cols-[minmax(0,1fr)_120px]">
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">Name</span>
              <input
                type="text"
                className="h-9 border border-border bg-surface-3 px-3 font-mono text-xs text-fg"
                value={draft.name}
                onChange={(event) => onChange({ ...draft, name: event.target.value })}
              />
            </label>
            <label className="flex h-9 items-center justify-between gap-3 border border-border bg-surface-1 px-3 py-2.5">
              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">Enabled</span>
              <button
                type="button"
                onClick={() => onChange({ ...draft, enabled: !draft.enabled })}
                className={cn(
                  'relative inline-flex h-5 w-8 items-center rounded-full border transition-colors',
                  draft.enabled ? 'border-accent bg-accent/30' : 'border-border bg-surface-3',
                )}
                aria-pressed={draft.enabled}
              >
                <span
                  className={cn(
                    'inline-block h-3.5 w-3.5 rounded-full bg-fg transition-transform',
                    draft.enabled ? 'translate-x-[14px]' : 'translate-x-[2px]',
                  )}
                />
              </button>
            </label>
          </div>

          <RoutingRuleMatchSection
            draft={draft}
            keyMap={keyMap}
            keys={keys}
            modelOptions={modelOptions}
            onChange={onChange}
          />
        </div>

        <div className="space-y-5 border-t border-border pt-5 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
          <RoutingRuleActionSection draft={draft} modelOptions={modelOptions} onChange={onChange} />
          <RoutingRuleAuthSection draft={draft} onChange={onChange} />
          <RoutingRuleTargetSection draft={draft} onChange={onChange} />
          <RoutingRulePreview draft={draft} keyMap={keyMap} />
        </div>
      </div>

      {errorMessage ? (
        <div className="mt-4 border border-err/40 bg-err/10 px-3 py-2 font-mono text-[11px] text-err">
          {errorMessage}
        </div>
      ) : null}
    </section>
  )
}
