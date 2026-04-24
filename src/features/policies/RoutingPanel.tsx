import { ArrowDown, ArrowUp, Circle, PenLine, Plus, X } from 'lucide-react'
import { type ReactElement, useMemo, useState } from 'react'
import type { RoutingAction, RoutingRule } from '../../lib/api'
import { cn } from '../../lib/cn'
import {
  useApiKeys,
  useCreateRoutingRule,
  useDeleteRoutingRule,
  useModels,
  useReorderRoutingRules,
  useRoutingRules,
  useUpdateRoutingRule,
} from '../../lib/queries'

type RoutingStreamMode = 'any' | 'stream' | 'non_stream'
type RoutingActionType = 'rewrite_model' | 'reject' | 'noop'

const INITIAL_RULES: RoutingRule[] = []

function emptyRule(order: number): RoutingRule {
  return {
    id: `route_new_${Date.now()}`,
    name: 'New routing rule',
    enabled: true,
    order,
    match: {
      endpoints: [],
      requestedModels: [],
      apiKeyIds: [],
      stream: 'any',
      minEstimatedPromptTokens: '',
      maxEstimatedPromptTokens: '',
    },
    action: { type: 'rewrite_model', model: '' },
    target: { type: 'llama_swap' },
    authMode: 'require_key',
    preserveAuthorization: false,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  }
}

function formatRuleSummary(rule: RoutingRule, keyMap: Map<string, string>) {
  const whenBits: string[] = []
  if (rule.match.endpoints.length > 0) whenBits.push(`endpoint is ${rule.match.endpoints.join(', ')}`)
  if (rule.match.requestedModels.length > 0)
    whenBits.push(`requested model is ${rule.match.requestedModels.join(', ')}`)
  if (rule.match.apiKeyIds.length > 0) {
    const names = rule.match.apiKeyIds.map((id) => keyMap.get(id) ?? id)
    whenBits.push(`api key is ${names.join(', ')}`)
  }
  if (rule.match.stream !== 'any')
    whenBits.push(`stream is ${rule.match.stream === 'stream' ? 'stream' : 'non-stream'}`)
  if (rule.match.minEstimatedPromptTokens) whenBits.push(`est. prompt tokens >= ${rule.match.minEstimatedPromptTokens}`)
  if (rule.match.maxEstimatedPromptTokens) whenBits.push(`est. prompt tokens <= ${rule.match.maxEstimatedPromptTokens}`)

  const then =
    rule.action.type === 'rewrite_model'
      ? `rewrite model to ${rule.action.model || '—'}`
      : rule.action.type === 'reject'
        ? `reject with reason "${rule.action.reason || '—'}"`
        : 'continue unchanged'
  const auth =
    rule.authMode === 'passthrough'
      ? `passthrough auth${rule.preserveAuthorization ? ' · keep Authorization' : ''}`
      : 'require llama-dash key'
  const target = rule.target.type === 'direct' ? `direct upstream ${rule.target.baseUrl}` : 'llama-swap'

  return {
    when: whenBits.length > 0 ? whenBits : ['matches any request'],
    then,
    auth,
    target,
  }
}

function cloneRule(rule: RoutingRule): RoutingRule {
  return structuredClone(rule)
}

export function RoutingPanel() {
  const { data: models = [] } = useModels()
  const { data: keys = [] } = useApiKeys()
  const { data: rules = INITIAL_RULES } = useRoutingRules()
  const createRuleMutation = useCreateRoutingRule()
  const updateRuleMutation = useUpdateRoutingRule()
  const deleteRuleMutation = useDeleteRoutingRule()
  const reorderRulesMutation = useReorderRoutingRules()
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [draft, setDraft] = useState<RoutingRule | null>(null)

  const keyMap = useMemo(() => new Map(keys.map((key) => [key.id, key.name])), [keys])
  const modelOptions = models.map((model) => model.id)

  const editingRule = useMemo(() => rules.find((rule) => rule.id === editingRuleId) ?? null, [editingRuleId, rules])
  const enabledCount = rules.filter((rule) => rule.enabled).length
  const isMutating =
    createRuleMutation.isPending ||
    updateRuleMutation.isPending ||
    deleteRuleMutation.isPending ||
    reorderRulesMutation.isPending

  const startEdit = (rule: RoutingRule) => {
    setEditingRuleId(rule.id)
    setDraft(cloneRule(rule))
  }

  const createRule = () => {
    const rule = emptyRule(rules.length + 1)
    setEditingRuleId(rule.id)
    setDraft(rule)
  }

  const discardDraft = () => {
    setEditingRuleId(null)
    setDraft(null)
  }

  const saveDraft = () => {
    if (!draft) return
    const body = {
      name: draft.name,
      enabled: draft.enabled,
      match: draft.match,
      action: draft.action,
      target: draft.target,
      authMode: draft.authMode,
      preserveAuthorization: draft.authMode === 'passthrough' && draft.preserveAuthorization,
    }
    const existing = rules.some((rule) => rule.id === draft.id)
    if (existing) {
      updateRuleMutation.mutate(
        { id: draft.id, body },
        {
          onSuccess: () => {
            setEditingRuleId(null)
            setDraft(null)
          },
        },
      )
      return
    }
    createRuleMutation.mutate(body, {
      onSuccess: () => {
        setEditingRuleId(null)
        setDraft(null)
      },
    })
  }

  const toggleRule = (id: string) => {
    const rule = rules.find((item) => item.id === id)
    if (!rule) return
    updateRuleMutation.mutate({ id, body: { enabled: !rule.enabled } })
    if (draft?.id === id) setDraft({ ...draft, enabled: !draft.enabled })
  }

  const moveRule = (id: string, direction: -1 | 1) => {
    const index = rules.findIndex((rule) => rule.id === id)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= rules.length) return
    const next = [...rules]
    ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
    reorderRulesMutation.mutate(next.map((rule) => rule.id))
  }

  const deleteRule = (id: string) => {
    deleteRuleMutation.mutate(id)
    if (editingRuleId === id) discardDraft()
  }

  return (
    <section className="panel flex min-h-0 flex-1 flex-col !rounded-none !border-x-0 border-t-0 !bg-surface-1">
      <div className="panel-head shrink-0 bg-transparent px-6 max-md:px-3">
        <span className="panel-title">Routing</span>
        <span className="panel-sub">
          · ordered rules evaluated before forwarding · first match wins · {rules.length} rules · {enabledCount} enabled
        </span>
        <button type="button" className="btn btn-ghost btn-xs ml-auto" onClick={createRule} disabled={isMutating}>
          <Plus className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
          new rule
        </button>
      </div>

      <div className="min-h-0 flex-1">
        <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto px-6 py-4 max-md:px-3">
          <div className="space-y-3">
            {rules.length === 0 ? (
              <div className="border border-dashed border-border bg-surface-0 px-5 py-6">
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-faint">
                  No routing rules yet
                </div>
                <div className="mt-2 max-w-3xl font-mono text-xs leading-6 text-fg-dim">
                  Ordered rules will evaluate before forwarding. Use them to rewrite requested models or reject requests
                  with a clear policy reason.
                </div>
                <div className="mt-4 flex gap-2">
                  <button type="button" className="btn btn-primary btn-xs" onClick={createRule} disabled={isMutating}>
                    <Plus className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
                    create first rule
                  </button>
                </div>
              </div>
            ) : null}
            {rules.map((rule, index) => {
              const summary = formatRuleSummary(rule, keyMap)
              return (
                <article
                  key={rule.id}
                  className={cn(
                    'border border-border bg-surface-0 px-5 py-4 transition-colors',
                    rule.enabled ? 'opacity-100' : 'opacity-65',
                    editingRuleId === rule.id && 'border-accent/60 bg-surface-1',
                  )}
                >
                  <div className="flex items-start gap-4 max-md:flex-col">
                    <div className="flex min-w-[70px] items-center gap-3 font-mono text-xs text-fg-dim">
                      <span>{String(rule.order).padStart(2, '0')}</span>
                      <button
                        type="button"
                        onClick={() => toggleRule(rule.id)}
                        className={cn(
                          'relative inline-flex h-5 w-8 items-center rounded-full border transition-colors',
                          rule.enabled ? 'border-accent bg-accent/30' : 'border-border bg-surface-3',
                        )}
                        aria-pressed={rule.enabled}
                      >
                        <span
                          className={cn(
                            'inline-block h-3.5 w-3.5 rounded-full bg-fg transition-transform',
                            rule.enabled ? 'translate-x-[14px]' : 'translate-x-[2px]',
                          )}
                        />
                      </button>
                    </div>

                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h3 className="m-0 text-base font-semibold text-fg">{rule.name}</h3>
                        <span className="font-mono text-[11px] text-fg-dim">
                          {rule.enabled ? 'enabled' : 'disabled'} · updated{' '}
                          {new Date(rule.updatedAt).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="space-y-2 font-mono text-xs leading-6 text-fg-dim">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-accent">WHEN</span>
                          {summary.when.map((item) => (
                            <div key={`${rule.id}-when-${item}`} className="contents">
                              <Chip tone="info">{item}</Chip>
                              {item !== summary.when[summary.when.length - 1] ? <span>and</span> : null}
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-accent">THEN</span>
                          <Chip
                            tone={rule.action.type === 'reject' ? 'err' : rule.action.type === 'noop' ? 'info' : 'ok'}
                          >
                            {summary.then}
                          </Chip>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-accent">AUTH</span>
                          <Chip tone={rule.authMode === 'passthrough' ? 'info' : 'default'}>{summary.auth}</Chip>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-accent">TARGET</span>
                          <Chip tone={rule.target.type === 'direct' ? 'info' : 'default'}>{summary.target}</Chip>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1 self-start">
                      <IconButton
                        icon={<ArrowUp className="icon-btn-12" strokeWidth={2} />}
                        disabled={index === 0}
                        busy={reorderRulesMutation.isPending}
                        onClick={() => moveRule(rule.id, -1)}
                      />
                      <IconButton
                        icon={<ArrowDown className="icon-btn-12" strokeWidth={2} />}
                        disabled={index === rules.length - 1}
                        busy={reorderRulesMutation.isPending}
                        onClick={() => moveRule(rule.id, 1)}
                      />
                      <IconButton
                        icon={<PenLine className="icon-btn-12" strokeWidth={2} />}
                        busy={updateRuleMutation.isPending && editingRuleId === rule.id}
                        onClick={() => startEdit(rule)}
                      />
                      <IconButton
                        icon={<X className="icon-btn-12" strokeWidth={2} />}
                        busy={deleteRuleMutation.isPending}
                        onClick={() => deleteRule(rule.id)}
                      />
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          <div className="border border-dashed border-border bg-surface-0 px-4 py-3 font-mono text-xs text-fg-dim">
            <div>· rules are ordered. they run top-to-bottom and the first match wins.</div>
            <div>· one action per rule in MVP: rewrite model · reject.</div>
            <div>· no match = default behavior, unchanged. routing outcomes should surface on request detail.</div>
          </div>

          {createRuleMutation.error ||
          updateRuleMutation.error ||
          deleteRuleMutation.error ||
          reorderRulesMutation.error ? (
            <div className="border border-err/40 bg-err/10 px-3 py-2 font-mono text-[11px] text-err">
              {createRuleMutation.error?.message ??
                updateRuleMutation.error?.message ??
                deleteRuleMutation.error?.message ??
                reorderRulesMutation.error?.message}
            </div>
          ) : null}

          {draft ? (
            <section className="border border-accent/70 bg-surface-0/80 px-5 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
                  <Circle className="mr-2 inline-block icon-btn-12 fill-current" strokeWidth={0} aria-hidden="true" />
                  editing · rule {String(draft.order).padStart(2, '0')} · {draft.action.type.replace(/_/g, ' ')}
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
                        onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                      />
                    </label>
                    <label className="flex h-9 items-center justify-between gap-3 border border-border bg-surface-1 px-3 py-2.5">
                      <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">Enabled</span>
                      <button
                        type="button"
                        onClick={() => setDraft({ ...draft, enabled: !draft.enabled })}
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
                          setDraft({
                            ...draft,
                            match: { ...draft.match, endpoints: [...draft.match.endpoints, value] },
                          })
                        }
                        onRemove={(value) =>
                          setDraft({
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
                          setDraft({
                            ...draft,
                            match: { ...draft.match, requestedModels: [...draft.match.requestedModels, value] },
                          })
                        }
                        onRemove={(value) =>
                          setDraft({
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
                          <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-warn">
                            API key matcher disabled
                          </div>
                          Passthrough rules run before llama-dash API-key auth, so they cannot match a stored llama-dash
                          key. Match by endpoint, requested model, stream mode, or estimated prompt tokens.
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
                            setDraft({
                              ...draft,
                              match: { ...draft.match, apiKeyIds: [...draft.match.apiKeyIds, value] },
                            })
                          }
                          onRemove={(value) =>
                            setDraft({
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
                                setDraft({ ...draft, match: { ...draft.match, stream: value as RoutingStreamMode } })
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
                              setDraft({
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
                              setDraft({
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
                      <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">
                        · one action
                      </span>
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
                          onClick={() =>
                            setDraft({ ...draft, action: coerceAction(value as RoutingActionType, draft.action) })
                          }
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
                          setDraft({ ...draft, action: { type: 'rewrite_model', model: event.target.value } })
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
                        onChange={(event) =>
                          setDraft({ ...draft, action: { type: 'reject', reason: event.target.value } })
                        }
                      />
                    </label>
                  ) : null}

                  <div className="border-t border-border pt-5">
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
                            setDraft({
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
                          <span className="font-mono text-xs text-fg-dim">
                            Pass through client Authorization header
                          </span>
                          <button
                            type="button"
                            onClick={() => setDraft({ ...draft, preserveAuthorization: !draft.preserveAuthorization })}
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
                          Passthrough auth lets the upstream provider validate the client's bearer token. llama-dash
                          will not apply key-specific rate limits, model allow-lists, or system prompts for requests
                          matched by this rule.
                        </div>
                        {draft.match.requestedModels.length > 0 && draft.match.endpoints.length === 0 ? (
                          <div className="border-l border-info px-4 py-4 font-mono text-xs text-fg-dim">
                            <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-info">
                              Bodyless requests
                            </div>
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
                            setDraft({
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
                              setDraft({ ...draft, target: { type: 'direct', baseUrl: event.target.value } })
                            }
                          />
                        </label>
                        <div className="border-l border-info px-4 py-4 font-mono text-xs text-fg-dim">
                          <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-info">Direct target</div>
                          Direct upstreams must use HTTPS and end with /v1. llama-dash appends the incoming /v1 path
                          suffix; clients never choose the destination URL.
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {(() => {
                    const preview = formatRuleSummary(draft, keyMap)
                    return (
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
                          <Chip
                            tone={draft.action.type === 'reject' ? 'err' : draft.action.type === 'noop' ? 'info' : 'ok'}
                          >
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
                    )
                  })()}

                  <div className="border-l border-info px-4 py-4 font-mono text-xs text-fg-dim">
                    <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-info">Note</div>
                    This rule applies as soon as it matches. Keep more specific rules above broad default behavior.
                  </div>
                </div>
              </div>

              {createRuleMutation.error ||
              updateRuleMutation.error ||
              deleteRuleMutation.error ||
              reorderRulesMutation.error ? (
                <div className="mt-4 border border-err/40 bg-err/10 px-3 py-2 font-mono text-[11px] text-err">
                  {createRuleMutation.error?.message ??
                    updateRuleMutation.error?.message ??
                    deleteRuleMutation.error?.message ??
                    reorderRulesMutation.error?.message}
                </div>
              ) : null}

              <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
                <button type="button" className="btn btn-ghost btn-xs" onClick={discardDraft}>
                  discard
                </button>
                <button type="button" className="btn btn-primary btn-xs" onClick={saveDraft} disabled={isMutating}>
                  {isMutating ? 'saving rule…' : 'save rule'}
                </button>
              </div>
            </section>
          ) : null}

          <section className="border border-border bg-surface-0 px-5 py-5 font-mono text-xs text-fg-dim">
            <div className="mb-3 text-[10px] uppercase tracking-[0.12em] text-fg-faint">
              Observability · how a routed request surfaces on request detail
            </div>
            {editingRule ? (
              <ObservabilityPreview
                rule={draft ?? editingRule}
                keyMap={keyMap}
                totalRules={Math.max(rules.length, 1)}
              />
            ) : (
              <div>Select a rule to preview its request-detail surface.</div>
            )}
          </section>
        </div>
      </div>
    </section>
  )
}

function IconButton({
  icon,
  onClick,
  disabled = false,
  busy = false,
}: {
  icon: ReactElement
  onClick: () => void
  disabled?: boolean
  busy?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="inline-flex h-8 w-8 items-center justify-center border border-border bg-surface-1 text-fg-dim transition-colors hover:bg-surface-3 hover:text-fg disabled:cursor-not-allowed disabled:opacity-35"
    >
      {icon}
    </button>
  )
}

function Chip({ children, tone = 'default' }: { children: string; tone?: 'default' | 'ok' | 'info' | 'err' }) {
  return (
    <span
      className={cn(
        'border px-2 py-1 font-mono text-[11px]',
        tone === 'ok' && 'border-ok/30 bg-ok/10 text-ok',
        tone === 'info' && 'border-info/30 bg-info/10 text-info',
        tone === 'err' && 'border-err/30 bg-err/10 text-err',
        tone === 'default' && 'border-border bg-surface-1 text-fg-dim',
      )}
    >
      {children}
    </span>
  )
}

function TokenInput({
  label,
  helper,
  placeholder,
  values,
  onAdd,
  onRemove,
  suggestions = [],
  renderValue,
}: {
  label: string
  helper?: string
  placeholder: string
  values: string[]
  onAdd: (value: string) => void
  onRemove: (value: string) => void
  suggestions?: string[]
  renderValue?: (value: string) => string
}) {
  const [draft, setDraft] = useState('')
  const availableSuggestions = suggestions.filter((item) => !values.includes(item))

  const submit = () => {
    const next = draft.trim()
    if (!next || values.includes(next)) return
    onAdd(next)
    setDraft('')
  }

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">{label}</div>
      <div className="flex min-h-10 flex-wrap items-center gap-2 border border-border bg-surface-3 px-3 py-2">
        {values.map((value) => (
          <span
            key={value}
            className="inline-flex items-center gap-1 border border-border bg-surface-1 px-2 py-1 font-mono text-[11px] text-fg"
          >
            {renderValue ? renderValue(value) : value}
            <button type="button" className="text-fg-dim hover:text-fg" onClick={() => onRemove(value)}>
              <X className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          type="text"
          className="min-w-[140px] flex-1 bg-transparent font-mono text-xs text-fg outline-none placeholder:text-fg-dim"
          placeholder={placeholder}
          value={draft}
          list={availableSuggestions.length > 0 ? `${label}-suggestions` : undefined}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
          }}
          onBlur={submit}
        />
        {availableSuggestions.length > 0 ? (
          <datalist id={`${label}-suggestions`}>
            {availableSuggestions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        ) : null}
      </div>
      {helper ? <div className="text-[11px] font-mono text-fg-dim">{helper}</div> : null}
    </div>
  )
}

function coerceAction(type: RoutingActionType, current: RoutingAction): RoutingAction {
  if (type === current.type) return current
  if (type === 'rewrite_model') return { type, model: '' }
  if (type === 'noop') return { type }
  return { type, reason: '' }
}

function ObservabilityPreview({
  rule,
  keyMap,
  totalRules,
}: {
  rule: RoutingRule
  keyMap: Map<string, string>
  totalRules: number
}) {
  const keyLabel = rule.match.apiKeyIds[0] ? (keyMap.get(rule.match.apiKeyIds[0]) ?? rule.match.apiKeyIds[0]) : '—'
  const requestedModel = rule.match.requestedModels[0] ?? '—'
  const routedModel = rule.action.type === 'rewrite_model' ? rule.action.model || '—' : '—'

  const rows = [
    ['matched rule', `${String(rule.order).padStart(2, '0')} · ${rule.name}`],
    ['action applied', rule.action.type],
    ['requested model', requestedModel],
    ['routed model', routedModel],
    ['api key', keyLabel],
    ['auth mode', rule.authMode],
    ['authorization', rule.preserveAuthorization ? 'preserved' : 'default'],
    ['target', rule.target.type],
    ['upstream', rule.target.type === 'direct' ? rule.target.baseUrl : '—'],
    ['endpoint', rule.match.endpoints[0] ?? '—'],
    ['eval time', `0.4 ms · evaluated ${rule.order} of ${totalRules} rules`],
  ]

  return (
    <dl className="grid gap-2 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-x-4 sm:gap-y-2">
      {rows.map(([label, value]) => (
        <span key={label} className="contents">
          <dt className="text-fg-faint">{label}</dt>
          <dd className="m-0 text-fg">{value}</dd>
        </span>
      ))}
    </dl>
  )
}
