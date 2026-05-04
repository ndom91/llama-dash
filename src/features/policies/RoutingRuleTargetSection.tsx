import type { RoutingRule } from '../../lib/api'
import { setDirectTargetBaseUrl, setTargetType } from './routing-draft'
import { SegmentedControl } from './routing-ui'

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
      <SegmentedControl
        options={[
          { value: 'llama_swap', label: 'llama-swap' },
          { value: 'direct', label: 'direct upstream' },
        ]}
        value={draft.target.type}
        onChange={(value) => onChange(setTargetType(draft, value))}
      />

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
          <div className="font-mono text-[11px] leading-5 text-fg-dim">
            Must use HTTPS and end with /v1. llama-dash appends the incoming /v1 path suffix.
          </div>
        </div>
      ) : null}
    </div>
  )
}
