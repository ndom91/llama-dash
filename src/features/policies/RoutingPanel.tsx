import { ArrowDown, ArrowUp, Circle, PenLine, Plus, X } from 'lucide-react'
import { type ReactElement, useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { useApiKeys, useModels } from '../../lib/queries'

type RoutingStreamMode = 'any' | 'stream' | 'non_stream'
type RoutingActionType = 'rewrite_model' | 'route_preference' | 'fallback_chain' | 'reject'
type RoutePreference = 'local_first' | 'peer_first' | 'peer_only'

type RoutingMatch = {
  endpoints: string[]
  requestedModels: string[]
  apiKeyIds: string[]
  stream: RoutingStreamMode
  minEstimatedPromptTokens: string
  maxEstimatedPromptTokens: string
}

type RoutingAction =
  | { type: 'rewrite_model'; model: string }
  | { type: 'route_preference'; preference: RoutePreference; peerId: string }
  | { type: 'fallback_chain'; models: string[] }
  | { type: 'reject'; reason: string }

type RoutingRule = {
  id: string
  name: string
  enabled: boolean
  order: number
  match: RoutingMatch
  action: RoutingAction
  lastMatchText: string
  hitsToday: number
  stageLabel?: string
}

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
    lastMatchText: 'never matched',
    hitsToday: 0,
  }
}

function reorderRules(rules: RoutingRule[]) {
  return rules.map((rule, index) => ({ ...rule, order: index + 1 }))
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
      : rule.action.type === 'route_preference'
        ? `route preference ${rule.action.preference}${rule.action.peerId ? ` on peer ${rule.action.peerId}` : ''}`
        : rule.action.type === 'fallback_chain'
          ? `fallback chain ${rule.action.models.join(' -> ') || '—'}`
          : `reject with reason "${rule.action.reason || '—'}"`

  return {
    when: whenBits.length > 0 ? whenBits : ['matches any request'],
    then,
  }
}

function cloneRule(rule: RoutingRule): RoutingRule {
  return structuredClone(rule)
}

export function RoutingPanel() {
  const { data: models = [] } = useModels()
  const { data: keys = [] } = useApiKeys()
  const [rules, setRules] = useState<RoutingRule[]>(INITIAL_RULES)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [draft, setDraft] = useState<RoutingRule | null>(null)

  const keyMap = useMemo(() => new Map(keys.map((key) => [key.id, key.name])), [keys])
  const modelOptions = models.map((model) => model.id)
  const peerOptions = Array.from(
    new Set(models.map((model) => model.peerId).filter((peerId): peerId is string => Boolean(peerId))),
  )

  const editingRule = useMemo(() => rules.find((rule) => rule.id === editingRuleId) ?? null, [editingRuleId, rules])
  const enabledCount = rules.filter((rule) => rule.enabled).length

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
    setRules((current) => {
      const existingIndex = current.findIndex((rule) => rule.id === draft.id)
      if (existingIndex >= 0) {
        const next = [...current]
        next[existingIndex] = draft
        return reorderRules(next)
      }
      return reorderRules([...current, draft])
    })
    setEditingRuleId(null)
    setDraft(null)
  }

  const toggleRule = (id: string) => {
    setRules((current) => current.map((rule) => (rule.id === id ? { ...rule, enabled: !rule.enabled } : rule)))
    if (draft?.id === id) setDraft({ ...draft, enabled: !draft.enabled })
  }

  const moveRule = (id: string, direction: -1 | 1) => {
    setRules((current) => {
      const index = current.findIndex((rule) => rule.id === id)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current
      const next = [...current]
      ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
      return reorderRules(next)
    })
  }

  const deleteRule = (id: string) => {
    setRules((current) => reorderRules(current.filter((rule) => rule.id !== id)))
    if (editingRuleId === id) discardDraft()
  }

  return (
    <section className="panel flex min-h-0 flex-1 flex-col !rounded-none !border-x-0 border-t-0 !bg-surface-1">
      <div className="panel-head shrink-0 bg-transparent px-6 max-md:px-3">
        <span className="panel-title">Routing</span>
        <span className="panel-sub">
          · ordered rules evaluated before forwarding · first match wins · {rules.length} rules · {enabledCount} enabled
        </span>
        <button type="button" className="btn btn-ghost btn-xs ml-auto" onClick={createRule}>
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
                  Ordered rules will evaluate before forwarding. Use them to rewrite models, prefer peers or local
                  backends, reject requests with a policy reason, and eventually configure fallback chains.
                </div>
                <div className="mt-4 flex gap-2">
                  <button type="button" className="btn btn-primary btn-xs" onClick={createRule}>
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
                        {rule.stageLabel ? (
                          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-warn">
                            {rule.stageLabel}
                          </span>
                        ) : null}
                        <span className="font-mono text-[11px] text-fg-dim">
                          {rule.lastMatchText} · {rule.hitsToday.toLocaleString()} hits today
                        </span>
                      </div>

                      <div className="space-y-2 font-mono text-xs leading-6 text-fg-dim">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-ok">WHEN</span>
                          {summary.when.map((item) => (
                            <div key={`${rule.id}-when-${item}`} className="contents">
                              <Chip tone="info">{item}</Chip>
                              {item !== summary.when[summary.when.length - 1] ? <span>and</span> : null}
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-ok">THEN</span>
                          <Chip tone={rule.action.type === 'reject' ? 'err' : 'ok'}>{summary.then}</Chip>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1 self-start">
                      <IconButton
                        icon={<ArrowUp className="icon-btn-12" strokeWidth={2} />}
                        disabled={index === 0}
                        onClick={() => moveRule(rule.id, -1)}
                      />
                      <IconButton
                        icon={<ArrowDown className="icon-btn-12" strokeWidth={2} />}
                        disabled={index === rules.length - 1}
                        onClick={() => moveRule(rule.id, 1)}
                      />
                      <IconButton
                        icon={<PenLine className="icon-btn-12" strokeWidth={2} />}
                        onClick={() => startEdit(rule)}
                      />
                      <IconButton
                        icon={<X className="icon-btn-12" strokeWidth={2} />}
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
            <div>· one action per rule: rewrite model · route preference · fallback chain · reject.</div>
            <div>· no match = default behavior, unchanged. routing outcomes should surface on request detail.</div>
          </div>

          {draft ? (
            <section className="border border-accent/70 bg-surface-0/80 px-5 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
                  <Circle className="mr-2 inline-block icon-btn-12 fill-current" strokeWidth={0} aria-hidden="true" />
                  editing · rule {String(draft.order).padStart(2, '0')} · {draft.action.type.replace(/_/g, ' ')}
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" className="btn btn-ghost btn-xs" onClick={discardDraft}>
                    discard
                  </button>
                  <button type="button" className="btn btn-primary btn-xs" onClick={saveDraft}>
                    save
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
                        ['route_preference', 'route preference'],
                        ['fallback_chain', 'fallback chain'],
                        ['reject', 'reject'],
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
                      <span className="text-[11px] font-mono text-fg-dim">
                        applied before upstream selection · distinct from global aliases
                      </span>
                    </label>
                  ) : null}

                  {draft.action.type === 'route_preference'
                    ? (() => {
                        const action = draft.action as Extract<RoutingAction, { type: 'route_preference' }>
                        return (
                          <div className="space-y-4">
                            <label className="flex flex-col gap-1.5">
                              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">
                                Route preference
                              </span>
                              <select
                                className="select-native h-9 border border-border bg-surface-3 px-3 font-mono text-xs text-fg"
                                value={action.preference}
                                onChange={(event) =>
                                  setDraft({
                                    ...draft,
                                    action: {
                                      type: 'route_preference',
                                      preference: event.target.value as RoutePreference,
                                      peerId: action.peerId,
                                    },
                                  })
                                }
                              >
                                <option value="local_first">local_first</option>
                                <option value="peer_first">peer_first</option>
                                <option value="peer_only">peer_only</option>
                              </select>
                            </label>

                            <label className="flex flex-col gap-1.5">
                              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">
                                Specific peer
                              </span>
                              <select
                                className="select-native h-9 border border-border bg-surface-3 px-3 font-mono text-xs text-fg"
                                value={action.peerId}
                                onChange={(event) =>
                                  setDraft({
                                    ...draft,
                                    action: {
                                      type: 'route_preference',
                                      preference: action.preference,
                                      peerId: event.target.value,
                                    },
                                  })
                                }
                              >
                                <option value="">any peer</option>
                                {peerOptions.map((peerId) => (
                                  <option key={peerId} value={peerId}>
                                    {peerId}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        )
                      })()
                    : null}

                  {draft.action.type === 'fallback_chain'
                    ? (() => {
                        const action = draft.action as Extract<RoutingAction, { type: 'fallback_chain' }>
                        return (
                          <TokenInput
                            label="Fallback chain"
                            helper="phase 2 candidate · ordered top to bottom"
                            placeholder="add fallback model…"
                            values={action.models}
                            suggestions={modelOptions}
                            onAdd={(value) =>
                              setDraft({
                                ...draft,
                                action: { type: 'fallback_chain', models: [...action.models, value] },
                              })
                            }
                            onRemove={(value) =>
                              setDraft({
                                ...draft,
                                action: {
                                  type: 'fallback_chain',
                                  models: action.models.filter((item: string) => item !== value),
                                },
                              })
                            }
                          />
                        )
                      })()
                    : null}

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

                  {(() => {
                    const preview = formatRuleSummary(draft, keyMap)
                    return (
                      <div className="border border-border bg-[#0b0d10] px-4 py-4 font-mono text-xs leading-6 text-fg-dim">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-ok">WHEN</span>
                          {preview.when.map((item) => (
                            <div key={`preview-when-${item}`} className="contents">
                              <Chip tone="info">{item}</Chip>
                              {item !== preview.when[preview.when.length - 1] ? <span>and</span> : null}
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-ok">THEN</span>
                          <Chip tone={draft.action.type === 'reject' ? 'err' : 'ok'}>{preview.then}</Chip>
                        </div>
                      </div>
                    )
                  })()}

                  <div className="border-l border-info px-4 py-4 font-mono text-xs text-fg-dim">
                    <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-info">Note</div>
                    This rule takes precedence over global aliases and request limits once it matches. Keep rules
                    ordered so more specific matches sit above broad default behavior.
                  </div>
                </div>
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
}: {
  icon: ReactElement
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
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
  if (type === 'route_preference') return { type, preference: 'local_first', peerId: '' }
  if (type === 'fallback_chain') return { type, models: [] }
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
  const routedModel =
    rule.action.type === 'rewrite_model'
      ? rule.action.model || '—'
      : rule.action.type === 'fallback_chain'
        ? (rule.action.models[0] ?? '—')
        : '—'

  const rows = [
    ['matched rule', `${String(rule.order).padStart(2, '0')} · ${rule.name}`],
    ['action applied', rule.action.type],
    ['requested model', requestedModel],
    ['routed model', routedModel],
    ['api key', keyLabel],
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
