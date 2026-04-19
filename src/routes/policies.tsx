import { createFileRoute } from '@tanstack/react-router'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { TopBar } from '../components/TopBar'
import {
  useAliases,
  useCreateAlias,
  useDeleteAlias,
  useModels,
  useRequestLimits,
  useUpdateAlias,
  useUpdateRequestLimits,
} from '../lib/queries'
import type { ModelAliasItem } from '../lib/api'

export const Route = createFileRoute('/policies')({ component: PoliciesPage })

function PoliciesPage() {
  return (
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page">
          <PageHeader kicker="§09 · govern" title="Policies" subtitle="proxy-layer request transforms" />
          <AliasPanel />
          <RequestLimitsPanel />
        </div>
      </div>
    </div>
  )
}

function AliasPanel() {
  const { data: aliases = [] } = useAliases()
  const { data: models = [] } = useModels()
  const createAlias = useCreateAlias()
  const deleteAlias = useDeleteAlias()

  const [alias, setAlias] = useState('')
  const [model, setModel] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const a = alias.trim()
    const m = model.trim()
    if (!a || !m) return
    createAlias.mutate(
      { alias: a, model: m },
      {
        onSuccess: () => {
          setAlias('')
          setModel('')
        },
      },
    )
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-title">Model Aliases</span>
        <span className="panel-sub">· map client model names to llama-swap model IDs</span>
      </div>
      <div className="p-4 flex flex-col gap-4">
        <form onSubmit={submit} className="flex gap-2 items-end flex-wrap">
          <label className="flex flex-col gap-1 flex-1 min-w-[140px]">
            <span className="text-[10px] font-mono uppercase tracking-wide text-fg-faint">
              Alias (what clients send)
            </span>
            <input
              type="text"
              className="bg-surface-3 border border-border rounded px-2 py-1.5 font-mono text-xs text-fg"
              placeholder="gpt-4"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1 flex-1 min-w-[140px]">
            <span className="text-[10px] font-mono uppercase tracking-wide text-fg-faint">Model (llama-swap ID)</span>
            <select
              className="bg-surface-3 border border-border rounded px-2 py-1.5 font-mono text-xs text-fg cursor-pointer"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              required
            >
              <option value="">select model…</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-primary" disabled={createAlias.isPending}>
            <Plus size={14} /> Add
          </button>
        </form>

        {aliases.length > 0 ? (
          <table className="dtable">
            <thead>
              <tr>
                <th>Alias</th>
                <th>Model</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {aliases.map((a) => (
                <AliasRow
                  key={a.id}
                  alias={a}
                  models={models.map((m) => m.id)}
                  onDelete={() => deleteAlias.mutate(a.id)}
                />
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-xs text-fg-dim font-mono m-0">
            No aliases configured. Clients must use exact llama-swap model IDs.
          </p>
        )}
      </div>
    </section>
  )
}

function AliasRow({ alias, models, onDelete }: { alias: ModelAliasItem; models: Array<string>; onDelete: () => void }) {
  const updateAlias = useUpdateAlias()
  const [editing, setEditing] = useState(false)
  const [editAlias, setEditAlias] = useState(alias.alias)
  const [editModel, setEditModel] = useState(alias.model)

  const save = () => {
    const a = editAlias.trim()
    const m = editModel.trim()
    if (!a || !m) return
    if (a === alias.alias && m === alias.model) {
      setEditing(false)
      return
    }
    updateAlias.mutate(
      { id: alias.id, alias: a !== alias.alias ? a : undefined, model: m !== alias.model ? m : undefined },
      { onSuccess: () => setEditing(false) },
    )
  }

  if (editing) {
    return (
      <tr>
        <td>
          <input
            type="text"
            className="bg-surface-3 border border-border rounded px-2 py-1 font-mono text-xs text-fg w-full"
            value={editAlias}
            onChange={(e) => setEditAlias(e.target.value)}
          />
        </td>
        <td>
          <select
            className="bg-surface-3 border border-border rounded px-2 py-1 font-mono text-xs text-fg w-full cursor-pointer"
            value={editModel}
            onChange={(e) => setEditModel(e.target.value)}
          >
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </td>
        <td>
          <div className="flex gap-1">
            <button type="button" className="btn btn-xs btn-primary" onClick={save} disabled={updateAlias.isPending}>
              Save
            </button>
            <button type="button" className="btn btn-xs" onClick={() => setEditing(false)}>
              <X size={12} />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td>
        <code className="font-mono text-xs">{alias.alias}</code>
      </td>
      <td>
        <code className="font-mono text-xs text-fg-muted">{alias.model}</code>
      </td>
      <td>
        <div className="flex gap-1">
          <button
            type="button"
            className="btn btn-xs"
            onClick={() => {
              setEditAlias(alias.alias)
              setEditModel(alias.model)
              setEditing(true)
            }}
          >
            <Pencil size={12} />
          </button>
          <button type="button" className="btn btn-xs btn-danger" onClick={onDelete}>
            <Trash2 size={12} />
          </button>
        </div>
      </td>
    </tr>
  )
}

function RequestLimitsPanel() {
  const { data: limits } = useRequestLimits()
  const updateLimits = useUpdateRequestLimits()
  const [maxMessages, setMaxMessages] = useState('')
  const [maxTokens, setMaxTokens] = useState('')
  const [editing, setEditing] = useState(false)

  const startEdit = () => {
    setMaxMessages(limits?.maxMessages != null ? String(limits.maxMessages) : '')
    setMaxTokens(limits?.maxEstimatedTokens != null ? String(limits.maxEstimatedTokens) : '')
    setEditing(true)
  }

  const save = () => {
    updateLimits.mutate(
      {
        maxMessages: maxMessages ? Number(maxMessages) : null,
        maxEstimatedTokens: maxTokens ? Number(maxTokens) : null,
      },
      { onSuccess: () => setEditing(false) },
    )
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-title">Request Limits</span>
        <span className="panel-sub">· global size limits on proxied requests</span>
        {!editing ? (
          <button type="button" className="btn btn-ghost btn-xs ml-auto" onClick={startEdit}>
            edit
          </button>
        ) : null}
      </div>
      <div className="p-4">
        {editing ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-4 flex-wrap">
              <label className="flex flex-col gap-1 flex-1 min-w-[160px]">
                <span className="text-[10px] font-mono uppercase tracking-wide text-fg-faint">
                  Max messages per request
                </span>
                <input
                  type="number"
                  min={1}
                  className="bg-surface-3 border border-border rounded px-2 py-1.5 font-mono text-xs text-fg"
                  value={maxMessages}
                  onChange={(e) => setMaxMessages(e.target.value)}
                  placeholder="unlimited"
                />
              </label>
              <label className="flex flex-col gap-1 flex-1 min-w-[160px]">
                <span className="text-[10px] font-mono uppercase tracking-wide text-fg-faint">
                  Max estimated prompt tokens
                </span>
                <input
                  type="number"
                  min={1}
                  className="bg-surface-3 border border-border rounded px-2 py-1.5 font-mono text-xs text-fg"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(e.target.value)}
                  placeholder="unlimited"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn btn-primary btn-xs" onClick={save} disabled={updateLimits.isPending}>
                Save
              </button>
              <button type="button" className="btn btn-xs" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-6 text-xs font-mono">
            <div>
              <span className="text-fg-dim">max messages: </span>
              <span className="text-fg">{limits?.maxMessages ?? 'unlimited'}</span>
            </div>
            <div>
              <span className="text-fg-dim">max est. tokens: </span>
              <span className="text-fg">{limits?.maxEstimatedTokens ?? 'unlimited'}</span>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
