import { Eye, EyeOff, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CopyableCode } from '../../components/CopyableCode'
import type { RoutingRule } from '../../lib/api'
import {
  useApiKeys,
  useCreateUpstreamCredential,
  useCreateRoutingRule,
  useDeleteRoutingRule,
  useDeleteUpstreamCredential,
  useModels,
  useReorderRoutingRules,
  useRoutingRules,
  useUpstreamCredentials,
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
    credentialBindings: [],
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
  const { data: credentialState, error: credentialError } = useUpstreamCredentials()
  const createRuleMutation = useCreateRoutingRule()
  const createCredentialMutation = useCreateUpstreamCredential()
  const deleteCredentialMutation = useDeleteUpstreamCredential()
  const updateRuleMutation = useUpdateRoutingRule()
  const deleteRuleMutation = useDeleteRoutingRule()
  const reorderRulesMutation = useReorderRoutingRules()
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [draft, setDraft] = useState<RoutingRule | null>(null)

  const keyMap = useMemo(() => new Map(keys.map((key) => [key.id, key.name])), [keys])
  const credentials = credentialState?.credentials ?? []
  const modelOptions = models.map((model) => model.id)

  const enabledCount = rules.filter((rule) => rule.enabled).length
  const isMutating =
    createRuleMutation.isPending ||
    updateRuleMutation.isPending ||
    deleteRuleMutation.isPending ||
    reorderRulesMutation.isPending ||
    createCredentialMutation.isPending ||
    deleteCredentialMutation.isPending

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
      credentialBindings: draft.credentialBindings ?? [],
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
          <Plus className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
          new rule
        </button>
      </div>

      <div className="min-h-0 flex-1">
        <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto px-6 py-4 max-md:px-3">
          <div className="space-y-3">
            {rules.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-surface-0 px-5 py-6">
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-faint">
                  No routing rules yet
                </div>
                <div className="mt-2 max-w-3xl font-mono text-xs leading-6 text-fg-dim">
                  Ordered rules will evaluate before forwarding. Use them to rewrite requested models or reject requests
                  with a clear policy reason.
                </div>
                <div className="mt-4 flex gap-2">
                  <button type="button" className="btn btn-primary btn-xs" onClick={createRule} disabled={isMutating}>
                    <Plus className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
                    create first rule
                  </button>
                </div>
              </div>
            ) : null}
            {rules.map((rule, index) => (
              <div key={rule.id} className="space-y-3">
                <RoutingRuleRow
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
                {draft?.id === rule.id ? (
                  <>
                    <RoutingRuleEditor
                      draft={draft}
                      credentials={credentials}
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
                    <ObservabilityPanel rule={draft} keyMap={keyMap} totalRules={Math.max(rules.length, 1)} />
                  </>
                ) : null}
              </div>
            ))}
          </div>

          {createRuleMutation.error ||
          updateRuleMutation.error ||
          deleteRuleMutation.error ||
          reorderRulesMutation.error ? (
            <div className="rounded border border-err/40 bg-err/10 px-3 py-2 font-mono text-[11px] text-err">
              {createRuleMutation.error?.message ??
                updateRuleMutation.error?.message ??
                deleteRuleMutation.error?.message ??
                reorderRulesMutation.error?.message}
            </div>
          ) : null}

          {draft && !rules.some((rule) => rule.id === draft.id) ? (
            <>
              <RoutingRuleEditor
                draft={draft}
                credentials={credentials}
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
              <ObservabilityPanel rule={draft} keyMap={keyMap} totalRules={Math.max(rules.length, 1)} />
            </>
          ) : null}

          <CredentialVaultPanel
            credentials={credentials}
            vaultEnabled={credentialState?.vaultEnabled ?? false}
            vaultStatus={credentialState?.vaultStatus ?? 'missing_key'}
            errorMessage={credentialError?.message}
            createPending={createCredentialMutation.isPending}
            deletePending={deleteCredentialMutation.isPending}
            onCreate={(body) => createCredentialMutation.mutate(body)}
            onDelete={(id) => deleteCredentialMutation.mutate(id)}
          />
        </div>
      </div>
    </section>
  )
}

function CredentialVaultPanel({
  credentials,
  vaultEnabled,
  vaultStatus,
  errorMessage,
  createPending,
  deletePending,
  onCreate,
  onDelete,
}: {
  credentials: Array<{
    id: string
    name: string
    slug: string
    type: 'bearer'
    lastUsedAt: string | null
  }>
  vaultEnabled: boolean
  vaultStatus: 'ready' | 'missing_key' | 'key_too_short'
  errorMessage?: string
  createPending: boolean
  deletePending: boolean
  onCreate: (body: { name: string; slug?: string; type: 'bearer'; value: string }) => void
  onDelete: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [value, setValue] = useState('')
  const [showValue, setShowValue] = useState(false)

  const submit = () => {
    if (!name.trim() || !value.trim()) return
    onCreate({
      name: name.trim(),
      slug: slug.trim() || undefined,
      type: 'bearer',
      value: value.trim(),
    })
    setName('')
    setSlug('')
    setValue('')
    setShowValue(false)
  }
  const statusText = errorMessage
    ? 'disabled · credential status unavailable'
    : vaultEnabled
      ? 'encrypted at rest'
      : vaultStatus === 'key_too_short'
        ? 'disabled · CREDENTIAL_ENCRYPTION_KEY must be 32+ chars'
        : 'disabled · set CREDENTIAL_ENCRYPTION_KEY and restart'

  return (
    <section className="rounded-lg border border-border bg-surface-0 px-5 py-5 font-mono text-xs text-fg-dim">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.12em] text-fg-faint">Upstream credential vault</span>
        <span className="text-[10px] uppercase tracking-[0.12em] text-fg-faint">· {statusText}</span>
      </div>
      {errorMessage ? (
        <div className="mb-3 rounded border border-err/40 bg-err/10 px-3 py-2 text-[11px] text-err">
          Failed to load credential vault status: {errorMessage}
        </div>
      ) : null}
      <div className="grid gap-2 lg:grid-cols-[minmax(0,180px)_minmax(0,180px)_minmax(0,1fr)_auto]">
        <input
          type="text"
          className="h-9 rounded border border-border bg-surface-3 px-3 font-mono text-xs text-fg focus-visible:outline-none focus-visible:shadow-focus"
          placeholder="Credential name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={!vaultEnabled}
        />
        <input
          type="text"
          data-1p-ignore="true"
          data-lpignore="true"
          data-form-type="other"
          className="h-9 rounded border border-border bg-surface-3 px-3 font-mono text-xs text-fg focus-visible:outline-none focus-visible:shadow-focus"
          placeholder="slug (optional)"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          disabled={!vaultEnabled}
        />
        <div className="relative min-w-0">
          <input
            type={showValue ? 'text' : 'password'}
            data-1p-ignore="true"
            data-lpignore="true"
            data-form-type="other"
            className="h-9 w-full rounded border border-border bg-surface-3 px-3 pr-10 font-mono text-xs text-fg focus-visible:outline-none focus-visible:shadow-focus"
            placeholder="Bearer token"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            disabled={!vaultEnabled}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r text-fg-faint transition-colors hover:text-fg focus-visible:outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => setShowValue((visible) => !visible)}
            disabled={!vaultEnabled || !value}
            aria-label={showValue ? 'Hide secret value' : 'Show secret value'}
            aria-pressed={showValue}
          >
            {showValue ? (
              <EyeOff className="size-3.5" strokeWidth={2} aria-hidden="true" />
            ) : (
              <Eye className="size-3.5" strokeWidth={2} aria-hidden="true" />
            )}
          </button>
        </div>
        <button
          type="button"
          className="btn btn-primary h-9 px-3 text-xs"
          onClick={submit}
          disabled={!vaultEnabled || createPending || !name.trim() || !value.trim()}
        >
          add credential
        </button>
      </div>
      <div className="mt-4 divide-y divide-border rounded border border-border bg-surface-1">
        {credentials.length === 0 ? (
          <div className="px-3 py-3 text-fg-faint">No upstream credentials stored.</div>
        ) : (
          credentials.map((credential) => (
            <div key={credential.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <span className="text-fg">{credential.name}</span>
              <span className="text-fg-faint">{credential.slug}</span>
              <span className="text-fg-faint">{credential.type}</span>
              <CopyableCode text={`{{llama-dash:credential:${credential.slug}}}`} />
              <span className="text-fg-faint">last used {credential.lastUsedAt ?? 'never'}</span>
              <button
                type="button"
                className="btn btn-ghost btn-xs ml-auto"
                onClick={() => onDelete(credential.id)}
                disabled={deletePending}
              >
                delete
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function ObservabilityPanel({
  rule,
  keyMap,
  totalRules,
}: {
  rule?: RoutingRule
  keyMap?: Map<string, string>
  totalRules?: number
}) {
  return (
    <section className="rounded-lg border border-border bg-surface-0 px-5 py-5 font-mono text-xs text-fg-dim">
      <div className="mb-3 text-[10px] uppercase tracking-[0.12em] text-fg-faint">
        Observability · how a routed request surfaces on request detail
      </div>
      {rule && keyMap && totalRules ? (
        <ObservabilityPreview rule={rule} keyMap={keyMap} totalRules={totalRules} />
      ) : (
        <div>Select a rule to preview its request-detail surface.</div>
      )}
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
    ['credential', rule.target.type === 'direct' ? (rule.target.credentialId ?? '—') : '—'],
    ['endpoint', rule.match.endpoints[0] ?? '—'],
    ['evaluation order', `evaluated ${rule.order} of ${totalRules} rules`],
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
