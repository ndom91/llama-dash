import { useState } from 'react'
import type { ContextCompressionMatch } from '../../lib/api'
import {
  useCreateContextCompressionPolicy,
  useDeleteContextCompressionPolicy,
  useUpdateContextCompressionPolicy,
} from '../../lib/queries'
import { useContextCompressionPolicies } from '../../lib/queries'
import { SegmentedControl, TokenInput } from './routing-ui'

const emptyMatch: ContextCompressionMatch = {
  endpoints: ['/v1/chat/completions'],
  effectiveModels: [],
  apiKeyIds: [],
  stream: 'any' as const,
  minEstimatedPromptTokens: '1000',
  maxEstimatedPromptTokens: '',
}

export function ContextCompressionPanel() {
  const { data: policies = [] } = useContextCompressionPolicies()
  const create = useCreateContextCompressionPolicy()
  const update = useUpdateContextCompressionPolicy()
  const remove = useDeleteContextCompressionPolicy()
  const [name, setName] = useState('Compress agent context')
  const [match, setMatch] = useState(emptyMatch)
  const add = () => create.mutate({ name, enabled: true, match })
  const updateList = (field: 'endpoints' | 'effectiveModels' | 'apiKeyIds', values: string[]) =>
    setMatch({ ...match, [field]: values })
  return (
    <section className="panel flex min-h-0 flex-1 flex-col !rounded-none !border-x-0 border-t-0 !bg-surface-1">
      <div className="panel-head shrink-0 bg-transparent px-6 max-md:px-3">
        <span className="panel-title">Context Compression</span>
        <span className="panel-sub">· safe, message-only Headroom compression · first match wins</span>
      </div>
      <div className="space-y-3 overflow-y-auto px-6 py-4 max-md:px-3">
        <p className="max-w-3xl font-mono text-xs leading-6 text-fg-dim">
          Compression is active only when <code>HEADROOM_BASE_URL</code> is configured. System prompts and tool schemas
          are preserved; unavailable sidecars forward the original request.
        </p>
        {policies.map((policy) => (
          <div key={policy.id} className="flex items-center gap-3 rounded border border-border bg-surface-0 px-3 py-3">
            <input
              type="checkbox"
              checked={policy.enabled}
              onChange={() => update.mutate({ id: policy.id, body: { enabled: !policy.enabled } })}
              aria-label={`Enable ${policy.name}`}
            />
            <div className="min-w-0 flex-1">
              <div className="font-mono text-xs text-fg">{policy.name}</div>
              <div className="mt-1 font-mono text-[11px] text-fg-faint">
                {policy.match.endpoints.join(', ')} · min {policy.match.minEstimatedPromptTokens || 'any'} tokens
              </div>
            </div>
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => remove.mutate(policy.id)}>
              delete
            </button>
          </div>
        ))}
        <div className="space-y-3 rounded border border-border bg-surface-0 p-3">
          <input className="input w-full" value={name} onChange={(event) => setName(event.target.value)} />
          <TokenInput
            label="Endpoints"
            placeholder="/v1/messages"
            values={match.endpoints}
            onAdd={(value) => updateList('endpoints', [...match.endpoints, value])}
            onRemove={(value) =>
              updateList(
                'endpoints',
                match.endpoints.filter((item) => item !== value),
              )
            }
          />
          <TokenInput
            label="Effective models (optional)"
            placeholder="model id"
            values={match.effectiveModels}
            onAdd={(value) => updateList('effectiveModels', [...match.effectiveModels, value])}
            onRemove={(value) =>
              updateList(
                'effectiveModels',
                match.effectiveModels.filter((item) => item !== value),
              )
            }
          />
          <TokenInput
            label="API keys (optional)"
            placeholder="key id"
            values={match.apiKeyIds}
            onAdd={(value) => updateList('apiKeyIds', [...match.apiKeyIds, value])}
            onRemove={(value) =>
              updateList(
                'apiKeyIds',
                match.apiKeyIds.filter((item) => item !== value),
              )
            }
          />
          <SegmentedControl
            options={[
              { value: 'any', label: 'Any stream' },
              { value: 'stream', label: 'Streaming' },
              { value: 'non_stream', label: 'Non-streaming' },
            ]}
            value={match.stream}
            onChange={(stream) => setMatch({ ...match, stream })}
          />
          <label className="block font-mono text-[11px] text-fg-dim">
            Minimum estimated message tokens
            <input
              className="input mt-1 w-full"
              inputMode="numeric"
              value={match.minEstimatedPromptTokens}
              onChange={(event) =>
                setMatch({ ...match, minEstimatedPromptTokens: event.target.value.replace(/\D/g, '') })
              }
            />
          </label>
          <button
            type="button"
            className="btn btn-primary btn-xs"
            onClick={add}
            disabled={!name.trim() || match.endpoints.length === 0 || create.isPending}
          >
            add policy
          </button>
        </div>
      </div>
    </section>
  )
}
