import { NumberInput } from '../../components/NumberInput'
import type { RoutingRule } from '../../lib/api'
import { addMatchValue, asStreamMode, removeMatchValue, setMatchField } from './routing-draft'
import { SegmentedControl, TokenInput } from './routing-ui'

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
          <SegmentedControl
            options={[
              { value: 'any', label: 'any' },
              { value: 'stream', label: 'stream only' },
              { value: 'non_stream', label: 'non-stream only' },
            ]}
            value={draft.match.stream}
            onChange={(value) => onChange(setMatchField(draft, 'stream', asStreamMode(value)))}
          />
        </div>

        <div className="space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">Estimated prompt tokens</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberInput
              prefix="min"
              aria-label="Minimum estimated prompt tokens"
              min={0}
              value={draft.match.minEstimatedPromptTokens}
              onChange={(event) => onChange(setMatchField(draft, 'minEstimatedPromptTokens', event.target.value))}
            />
            <NumberInput
              prefix="max"
              aria-label="Maximum estimated prompt tokens"
              min={0}
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
