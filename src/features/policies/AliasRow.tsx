import { Pencil, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import type { ModelAliasItem } from '../../lib/api'
import { useUpdateAlias } from '../../lib/queries'

type Props = {
  alias: ModelAliasItem
  models: Array<string>
  onDelete: () => void
}

export function AliasRow({ alias, models, onDelete }: Props) {
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
