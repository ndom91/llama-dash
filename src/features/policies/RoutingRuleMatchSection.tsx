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
          <div className="border-l border-warn px-4 py-3 font-mono text-xs text-fg-dim">
            <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-warn">API key matcher disabled</div>
            Passthrough rules run before llama-dash API-key auth, so they cannot match a stored llama-dash key. Match by
            endpoint, requested model, stream mode, or estimated prompt tokens.
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
          <div className="grid grid-cols-3 overflow-hidden border border-border bg-surface-3 text-xs font-mono">
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
                  'border-r border-border px-3 py-2 text-fg-dim last:border-r-0',
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
            <input
              type="number"
              min={0}
              className="h-9 border border-border bg-surface-3 px-3 font-mono text-xs text-fg"
              placeholder="min · —"
              value={draft.match.minEstimatedPromptTokens}
              onChange={(event) => onChange(setMatchField(draft, 'minEstimatedPromptTokens', event.target.value))}
            />
            <input
              type="number"
              min={0}
              className="h-9 border border-border bg-surface-3 px-3 font-mono text-xs text-fg"
              placeholder="max · —"
              value={draft.match.maxEstimatedPromptTokens}
              onChange={(event) => onChange(setMatchField(draft, 'maxEstimatedPromptTokens', event.target.value))}
            />
          </div>
          <div className="text-[11px] font-mono text-fg-dim">rough JSON-size heuristic · not model tokenization</div>
        </div>
      </div>
    </div>
  )
}
