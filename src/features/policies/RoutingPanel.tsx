import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { RoutingRule } from '../../lib/api'
import {
  useApiKeys,
  useCreateRoutingRule,
  useDeleteRoutingRule,
  useModels,
  useReorderRoutingRules,
  useRoutingRules,
  useUpdateRoutingRule,
} from '../../lib/queries'
import { RoutingRuleEditor } from './RoutingRuleEditor'
import { RoutingRuleRow } from './RoutingRuleRow'

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
            {rules.map((rule, index) => (
              <RoutingRuleRow
                key={rule.id}
                rule={rule}
                index={index}
                totalRules={rules.length}
                keyMap={keyMap}
                editingRuleId={editingRuleId}
                reorderPending={reorderRulesMutation.isPending}
                updatePending={updateRuleMutation.isPending}
                deletePending={deleteRuleMutation.isPending}
                onToggle={toggleRule}
                onMove={moveRule}
                onEdit={startEdit}
                onDelete={deleteRule}
              />
            ))}
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
            <RoutingRuleEditor
              draft={draft}
              keyMap={keyMap}
              keys={keys}
              modelOptions={modelOptions}
              errorMessage={
                createRuleMutation.error?.message ??
                updateRuleMutation.error?.message ??
                deleteRuleMutation.error?.message ??
                reorderRulesMutation.error?.message
              }
              isMutating={isMutating}
              onChange={setDraft}
              onDiscard={discardDraft}
              onSave={saveDraft}
            />
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
