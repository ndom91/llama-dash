import type { RoutingRule } from '../../lib/api'
import { cn } from '../../lib/cn'
import { setDirectTargetBaseUrl, setTargetType } from './routing-draft'

export function RoutingRuleTargetSection({
  draft,
  onChange,
}: {
  draft: RoutingRule
  onChange: (draft: RoutingRule) => void
}) {
  return (
    <div className="border-t border-border pt-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-accent">Target</span>
        <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">· upstream destination</span>
      </div>
      <div className="grid grid-cols-2 overflow-hidden rounded border border-border bg-surface-3 text-xs font-mono">
        {[
          ['llama_swap', 'llama-swap'],
          ['direct', 'direct upstream'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(setTargetType(draft, value === 'direct' ? 'direct' : 'llama_swap'))}
            className={cn(
              'border-r border-border px-3 py-2 text-fg-dim transition-colors last:border-r-0 hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:shadow-focus',
              draft.target.type === value && 'bg-surface-1 text-fg',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {draft.target.type === 'direct' ? (
        <div className="mt-3 space-y-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">
              Direct upstream base URL
            </span>
            <input
              type="url"
              className="h-9 rounded border border-border bg-surface-3 px-3 font-mono text-xs text-fg focus-visible:outline-none focus-visible:shadow-focus"
              placeholder="https://api.openai.com/v1"
              value={draft.target.baseUrl}
              onChange={(event) => onChange(setDirectTargetBaseUrl(draft, event.target.value))}
            />
          </label>
          <div className="rounded border border-info/35 bg-info/10 px-4 py-4 font-mono text-xs text-fg-dim">
            <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-info">Direct target</div>
            Direct upstreams must use HTTPS, end with /v1, and currently target api.openai.com or api.anthropic.com.
            llama-dash appends the incoming /v1 path suffix; clients never choose the destination URL.
          </div>
        </div>
      ) : null}
    </div>
  )
}
