import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useAliases, useCreateAlias, useDeleteAlias, useModels } from '../../lib/queries'
import { AliasRow } from './AliasRow'

export function AliasPanel() {
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
    <section className="panel policies-panel">
      <div className="panel-head policies-panel-head">
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
