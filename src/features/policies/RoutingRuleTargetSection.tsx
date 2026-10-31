import type { RoutingRule } from '../../lib/api'
import { PROVIDER_ENDPOINTS, type ProviderEndpoint } from '../../lib/providers'
import {
  setDirectTargetBaseUrl,
  setDirectTargetCredential,
  setDirectTargetProvider,
  setTargetType,
} from './routing-draft'
import { SegmentedControl } from './routing-ui'

export function RoutingRuleTargetSection({
  draft,
  credentials,
  onChange,
}: {
  draft: RoutingRule
  credentials: Array<{ id: string; name: string; type: string }>
  onChange: (draft: RoutingRule) => void
}) {
  const targetBaseUrl = draft.target.type === 'direct' ? draft.target.baseUrl : null
  const selected = targetBaseUrl ? PROVIDER_ENDPOINTS.find((endpoint) => endpoint.baseUrl === targetBaseUrl) : undefined

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
            <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">Provider surface</span>
            <select
              className="h-9 rounded border border-border bg-surface-3 px-3 font-mono text-xs text-fg focus-visible:outline-none focus-visible:shadow-focus"
              value={selected?.id ?? ''}
              onChange={(event) => {
                const endpoint = PROVIDER_ENDPOINTS.find((item) => item.id === event.target.value)
                if (!endpoint) return
                onChange(setDirectTargetProvider(draft, endpoint.baseUrl, endpoint.pathJoin))
              }}
            >
              <option value="">Custom base URL…</option>
              {PROVIDER_ENDPOINTS.map((endpoint) => (
                <option key={endpoint.id} value={endpoint.id}>
                  {endpoint.label} · {endpoint.baseUrl}
                </option>
              ))}
            </select>
          </label>
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
            {selected ? (
              <>
                {selected.label} surface. llswap-dash joins the incoming path as{' '}
                {selected.pathJoin === 'keep-v1' ? 'path + /v1/…' : 'path minus /v1 + /…'}.
              </>
            ) : (
              'Must use HTTPS and point at a supported provider endpoint.'
            )}
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">Upstream credential</span>
            <select
              className="h-9 rounded border border-border bg-surface-3 px-3 font-mono text-xs text-fg focus-visible:outline-none focus-visible:shadow-focus"
              value={draft.target.credentialId ?? ''}
              onChange={(event) => onChange(setDirectTargetCredential(draft, event.target.value || null))}
            >
              <option value="">None · pass no provider credential</option>
              {credentials.map((credential) => (
                <option key={credential.id} value={credential.id}>
                  {credential.name} · {credential.type}
                </option>
              ))}
            </select>
          </label>
          {selected ? <ProviderSurfaceHint endpoint={selected} /> : null}
        </div>
      ) : null}
    </div>
  )
}

function ProviderSurfaceHint({ endpoint }: { endpoint: ProviderEndpoint }) {
  return (
    <div className="rounded border border-border bg-surface-0 px-3 py-2 font-mono text-[11px] text-fg-faint">
      <div className="text-[10px] uppercase tracking-[0.12em]">serves</div>
      <div className="mt-1 text-fg-dim">{endpoint.matchEndpoints.join(', ')}</div>
    </div>
  )
}
