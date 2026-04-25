import type { RoutingRule } from '../../lib/api'
import { cn } from '../../lib/cn'

export function RoutingRuleAuthSection({
  draft,
  onChange,
}: {
  draft: RoutingRule
  onChange: (draft: RoutingRule) => void
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-accent">Auth</span>
        <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">
          · request authentication
        </span>
      </div>
      <div className="grid grid-cols-2 overflow-hidden border border-border bg-surface-3 text-xs font-mono">
        {[
          ['require_key', 'require llama-dash key'],
          ['passthrough', 'passthrough auth'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() =>
              onChange({
                ...draft,
                authMode: value as RoutingRule['authMode'],
                preserveAuthorization: value === 'passthrough',
              })
            }
            className={cn(
              'border-r border-border px-3 py-2 text-fg-dim last:border-r-0',
              draft.authMode === value && 'bg-surface-1 text-fg',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {draft.authMode === 'passthrough' ? (
        <div className="mt-3 space-y-3">
          <label className="flex items-center justify-between gap-3 border border-border bg-surface-1 px-3 py-2.5">
            <span className="font-mono text-xs text-fg-dim">Pass through client Authorization header</span>
            <button
              type="button"
              onClick={() => onChange({ ...draft, preserveAuthorization: !draft.preserveAuthorization })}
              className={cn(
                'relative inline-flex h-5 w-8 items-center rounded-full border transition-colors',
                draft.preserveAuthorization ? 'border-accent bg-accent/30' : 'border-border bg-surface-3',
              )}
              aria-pressed={draft.preserveAuthorization}
            >
              <span
                className={cn(
                  'inline-block h-3.5 w-3.5 rounded-full bg-fg transition-transform',
                  draft.preserveAuthorization ? 'translate-x-[14px]' : 'translate-x-[2px]',
                )}
              />
            </button>
          </label>
          <div className="border-l border-warn px-4 py-4 font-mono text-xs text-fg-dim">
            <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-warn">Passthrough auth</div>
            Passthrough auth lets the upstream provider validate the client's bearer token. llama-dash will not apply
            key-specific rate limits, model allow-lists, or system prompts for requests matched by this rule.
          </div>
          {draft.match.requestedModels.length > 0 && draft.match.endpoints.length === 0 ? (
            <div className="border-l border-info px-4 py-4 font-mono text-xs text-fg-dim">
              <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-info">Bodyless requests</div>
              Model-only passthrough rules do not match bodyless requests such as GET /v1/models. Add an
              endpoint-specific passthrough rule if the client probes models before sending a completion.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
