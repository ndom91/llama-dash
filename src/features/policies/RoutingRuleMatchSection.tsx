import type { RoutingRule } from '../../lib/api'
import { cn } from '../../lib/cn'
import { addMatchValue, asStreamMode, removeMatchValue, setMatchField } from './routing-draft'
import { TokenInput } from './routing-ui'

export function RoutingRuleMatchSection({
  draft,
  keyMap,
  keys,
  modelOptions,
  onChange,
}: {
  draft: RoutingRule
  keyMap: Map<string, string>
  keys: Array<{ id: string }>
  modelOptions: string[]
  onChange: (draft: RoutingRule) => void
}) {
  return (
    <div className="border-t border-border pt-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-accent">When</span>
        <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">· match conditions</span>
      </div>
      <div className="space-y-4">
        <TokenInput
          label="Endpoint"
          helper="exact strings only · no wildcards in MVP"
          placeholder="add endpoint…"
          values={draft.match.endpoints}
          onAdd={(value) => onChange(addMatchValue(draft, 'endpoints', value))}
          onRemove={(value) => onChange(removeMatchValue(draft, 'endpoints', value))}
        />

        <TokenInput
          label="Requested model"
          placeholder="add model…"
          values={draft.match.requestedModels}
          suggestions={modelOptions}
          onAdd={(value) => onChange(addMatchValue(draft, 'requestedModels', value))}
          onRemove={(value) => onChange(removeMatchValue(draft, 'requestedModels', value))}
        />

        {draft.authMode === 'passthrough' ? (
          <div className="font-mono text-[11px] leading-5 text-fg-dim">
            API-key matching is unavailable for passthrough rules because they run before llama-dash key auth.
          </div>
        ) : (
          <TokenInput
            label="API key"
            helper="matches by stored key id, never raw token"
            placeholder="add key…"
            values={draft.match.apiKeyIds}
            suggestions={keys.map((key) => key.id)}
            renderValue={(value) => `${keyMap.get(value) ?? value}`}
            onAdd={(value) => onChange(addMatchValue(draft, 'apiKeyIds', value))}
            onRemove={(value) => onChange(removeMatchValue(draft, 'apiKeyIds', value))}
          />
        )}

        <div className="space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">Stream</div>
          <div className="grid grid-cols-3 overflow-hidden rounded border border-border bg-surface-3 text-xs font-mono">
            {[
              ['any', 'any'],
              ['stream', 'stream only'],
              ['non_stream', 'non-stream only'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onChange(setMatchField(draft, 'stream', asStreamMode(value)))}
                className={cn(
                  'border-r border-border px-3 py-2 text-fg-dim transition-colors last:border-r-0 hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:shadow-focus',
                  draft.match.stream === value && 'bg-surface-1 text-fg',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">Estimated prompt tokens</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex h-9 items-center overflow-hidden rounded border border-border bg-surface-3 font-mono text-xs focus-within:shadow-focus">
              <span className="flex h-full items-center border-r border-border bg-surface-1 px-3 text-fg-dim">min</span>
              <input
                type="number"
                min={0}
                className="min-w-0 flex-1 bg-transparent px-3 text-fg outline-none"
                value={draft.match.minEstimatedPromptTokens}
                onChange={(event) => onChange(setMatchField(draft, 'minEstimatedPromptTokens', event.target.value))}
              />
            </label>
            <label className="flex h-9 items-center overflow-hidden rounded border border-border bg-surface-3 font-mono text-xs focus-within:shadow-focus">
              <span className="flex h-full items-center border-r border-border bg-surface-1 px-3 text-fg-dim">max</span>
              <input
                type="number"
                min={0}
                className="min-w-0 flex-1 bg-transparent px-3 text-fg outline-none"
                value={draft.match.maxEstimatedPromptTokens}
                onChange={(event) => onChange(setMatchField(draft, 'maxEstimatedPromptTokens', event.target.value))}
              />
            </label>
          </div>
          <div className="text-[11px] font-mono text-fg-dim">rough JSON-size heuristic · not model tokenization</div>
        </div>
      </div>
    </div>
  )
}
