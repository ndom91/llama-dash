import { Circle } from 'lucide-react'
import type { RoutingRule } from '../../lib/api'
import { cn } from '../../lib/cn'
import { Chip, coerceAction, type RoutingActionType, type RoutingStreamMode, TokenInput } from './routing-ui'
import { formatRuleSummary } from './routing-summary'

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
  const preview = formatRuleSummary(draft, keyMap)

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

          <div className="border-t border-border pt-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-accent">When</span>
              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">
                · match conditions
              </span>
            </div>
            <div className="space-y-4">
              <TokenInput
                label="Endpoint"
                helper="exact strings only · no wildcards in MVP"
                placeholder="add endpoint…"
                values={draft.match.endpoints}
                onAdd={(value) =>
                  onChange({
                    ...draft,
                    match: { ...draft.match, endpoints: [...draft.match.endpoints, value] },
                  })
                }
                onRemove={(value) =>
                  onChange({
                    ...draft,
                    match: {
                      ...draft.match,
                      endpoints: draft.match.endpoints.filter((item) => item !== value),
                    },
                  })
                }
              />

              <TokenInput
                label="Requested model"
                placeholder="add model…"
                values={draft.match.requestedModels}
                suggestions={modelOptions}
                onAdd={(value) =>
                  onChange({
                    ...draft,
                    match: { ...draft.match, requestedModels: [...draft.match.requestedModels, value] },
                  })
                }
                onRemove={(value) =>
                  onChange({
                    ...draft,
                    match: {
                      ...draft.match,
                      requestedModels: draft.match.requestedModels.filter((item) => item !== value),
                    },
                  })
                }
              />

              {draft.authMode === 'passthrough' ? (
                <div className="border-l border-warn px-4 py-3 font-mono text-xs text-fg-dim">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-warn">API key matcher disabled</div>
                  Passthrough rules run before llama-dash API-key auth, so they cannot match a stored llama-dash key.
                  Match by endpoint, requested model, stream mode, or estimated prompt tokens.
                </div>
              ) : (
                <TokenInput
                  label="API key"
                  helper="matches by stored key id, never raw token"
                  placeholder="add key…"
                  values={draft.match.apiKeyIds}
                  suggestions={keys.map((key) => key.id)}
                  renderValue={(value) => `${keyMap.get(value) ?? value}`}
                  onAdd={(value) =>
                    onChange({
                      ...draft,
                      match: { ...draft.match, apiKeyIds: [...draft.match.apiKeyIds, value] },
                    })
                  }
                  onRemove={(value) =>
                    onChange({
                      ...draft,
                      match: {
                        ...draft.match,
                        apiKeyIds: draft.match.apiKeyIds.filter((item) => item !== value),
                      },
                    })
                  }
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
                      onClick={() =>
                        onChange({ ...draft, match: { ...draft.match, stream: value as RoutingStreamMode } })
                      }
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
                <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">
                  Estimated prompt tokens
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="number"
                    min={0}
                    className="h-9 border border-border bg-surface-3 px-3 font-mono text-xs text-fg"
                    placeholder="min · —"
                    value={draft.match.minEstimatedPromptTokens}
                    onChange={(event) =>
                      onChange({
                        ...draft,
                        match: { ...draft.match, minEstimatedPromptTokens: event.target.value },
                      })
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    className="h-9 border border-border bg-surface-3 px-3 font-mono text-xs text-fg"
                    placeholder="max · —"
                    value={draft.match.maxEstimatedPromptTokens}
                    onChange={(event) =>
                      onChange({
                        ...draft,
                        match: { ...draft.match, maxEstimatedPromptTokens: event.target.value },
                      })
                    }
                  />
                </div>
                <div className="text-[11px] font-mono text-fg-dim">token-ish estimate · not raw bytes</div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5 border-t border-border pt-5 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-accent">Then</span>
              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">· one action</span>
            </div>
            <div className="flex border-b border-border font-mono text-xs text-fg-dim">
              {[
                ['rewrite_model', 'rewrite model'],
                ['reject', 'reject'],
                ['noop', 'continue'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onChange({ ...draft, action: coerceAction(value as RoutingActionType, draft.action) })}
                  className={cn(
                    'border-b-2 border-transparent px-3 py-2.5',
                    draft.action.type === value && 'border-accent text-accent',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {draft.action.type === 'rewrite_model' ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">
                Rewrite requested model to
              </span>
              <select
                className="select-native h-9 border border-border bg-surface-3 px-3 font-mono text-xs text-fg"
                value={draft.action.model}
                onChange={(event) =>
                  onChange({ ...draft, action: { type: 'rewrite_model', model: event.target.value } })
                }
              >
                <option value="">select model…</option>
                {modelOptions.map((modelId) => (
                  <option key={modelId} value={modelId}>
                    {modelId}
                  </option>
                ))}
              </select>
              <span className="text-[11px] font-mono text-fg-dim">applied before upstream selection</span>
            </label>
          ) : null}

          {draft.action.type === 'reject' ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">
                Reject with reason
              </span>
              <textarea
                className="min-h-[120px] border border-border bg-surface-3 px-3 py-2.5 font-mono text-xs text-fg"
                value={draft.action.reason}
                onChange={(event) => onChange({ ...draft, action: { type: 'reject', reason: event.target.value } })}
              />
            </label>
          ) : null}

          <div className="">
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
                  Passthrough auth lets the upstream provider validate the client's bearer token. llama-dash will not
                  apply key-specific rate limits, model allow-lists, or system prompts for requests matched by this
                  rule.
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

          <div className="border-t border-border pt-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-accent">Target</span>
              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">
                · upstream destination
              </span>
            </div>
            <div className="grid grid-cols-2 overflow-hidden border border-border bg-surface-3 text-xs font-mono">
              {[
                ['llama_swap', 'llama-swap'],
                ['direct', 'direct upstream'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...draft,
                      target:
                        value === 'direct'
                          ? {
                              type: 'direct',
                              baseUrl: draft.target.type === 'direct' ? draft.target.baseUrl : '',
                            }
                          : { type: 'llama_swap' },
                    })
                  }
                  className={cn(
                    'border-r border-border px-3 py-2 text-fg-dim last:border-r-0',
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
                    className="h-9 border border-border bg-surface-3 px-3 font-mono text-xs text-fg"
                    placeholder="https://api.openai.com/v1"
                    value={draft.target.baseUrl}
                    onChange={(event) =>
                      onChange({ ...draft, target: { type: 'direct', baseUrl: event.target.value } })
                    }
                  />
                </label>
                <div className="border-l border-info px-4 py-4 font-mono text-xs text-fg-dim">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-info">Direct target</div>
                  Direct upstreams must use HTTPS and end with /v1. llama-dash appends the incoming /v1 path suffix;
                  clients never choose the destination URL.
                </div>
              </div>
            ) : null}
          </div>

          <div className="border border-border bg-[#0b0d10] px-4 py-4 font-mono text-xs leading-6 text-fg-dim">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-accent">WHEN</span>
              {preview.when.map((item) => (
                <div key={`preview-when-${item}`} className="contents">
                  <Chip tone="info">{item}</Chip>
                  {item !== preview.when[preview.when.length - 1] ? <span>and</span> : null}
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-accent">THEN</span>
              <Chip tone={draft.action.type === 'reject' ? 'err' : draft.action.type === 'noop' ? 'info' : 'ok'}>
                {preview.then}
              </Chip>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-accent">AUTH</span>
              <Chip tone={draft.authMode === 'passthrough' ? 'info' : 'default'}>{preview.auth}</Chip>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-accent">TARGET</span>
              <Chip tone={draft.target.type === 'direct' ? 'info' : 'default'}>{preview.target}</Chip>
            </div>
          </div>
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
