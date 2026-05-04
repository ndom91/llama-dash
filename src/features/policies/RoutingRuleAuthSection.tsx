import type { RoutingRule } from '../../lib/api'
import { cn } from '../../lib/cn'
import { setAuthMode, togglePreserveAuthorization } from './routing-draft'
import { SegmentedControl } from './routing-ui'

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
      <SegmentedControl
        options={[
          { value: 'require_key', label: 'require llama-dash key' },
          { value: 'passthrough', label: 'passthrough auth' },
        ]}
        value={draft.authMode}
        onChange={(value) => onChange(setAuthMode(draft, value))}
      />

      {draft.authMode === 'passthrough' ? (
        <div className="mt-3 space-y-3">
          <label className="flex items-center justify-between gap-3 rounded border border-border bg-surface-1 px-3 py-2.5">
            <span className="font-mono text-xs text-fg-dim">Pass through client Authorization header</span>
            <button
              type="button"
              onClick={() => onChange(togglePreserveAuthorization(draft))}
              className={cn(
                'relative inline-flex h-5 w-8 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:shadow-focus',
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
          <div className="font-mono text-[11px] leading-5 text-fg-dim">
            Upstream validates the bearer token. Key-specific rate limits, allow-lists, and system prompts are skipped.
          </div>
          {draft.target.type === 'direct' &&
          draft.match.endpoints.length === 0 &&
          draft.match.requestedModels.length === 0 &&
          draft.match.stream === 'any' &&
          draft.match.minEstimatedPromptTokens === '' &&
          draft.match.maxEstimatedPromptTokens === '' ? (
            <div className="rounded border border-err/35 bg-err/10 px-4 py-4 font-mono text-xs text-fg-dim">
              <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-err">Matcher required</div>
              Direct passthrough rules must include at least one matcher so they cannot accidentally proxy every
              request.
            </div>
          ) : null}
          {draft.match.requestedModels.length > 0 && draft.match.endpoints.length === 0 ? (
            <div className="font-mono text-[11px] leading-5 text-fg-dim">
              Model-only passthrough rules do not match bodyless requests like GET /v1/models.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
