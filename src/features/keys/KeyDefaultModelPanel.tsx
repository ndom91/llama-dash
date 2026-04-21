import { useState } from 'react'
import { useModels, useUpdateKeyDefaultModel } from '../../lib/queries'

type Props = {
  keyId: string
  defaultModel: string | null
  isRevoked: boolean
}

export function KeyDefaultModelPanel({ keyId, defaultModel, isRevoked }: Props) {
  const { data: allModels } = useModels()
  const updateDefault = useUpdateKeyDefaultModel()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(defaultModel ?? '')

  const save = () => {
    const val = draft.trim() || null
    if (val === defaultModel) {
      setEditing(false)
      return
    }
    updateDefault.mutate({ id: keyId, defaultModel: val }, { onSuccess: () => setEditing(false) })
  }

  return (
    <section className="panel detail-stacked-section">
      <div className="panel-head">
        <span className="panel-title text-fg-muted">Default model</span>
        <span className="panel-sub">· {defaultModel ? `pinned to ${defaultModel}` : 'not set'}</span>
        {!isRevoked && !editing ? (
          <button
            type="button"
            className="btn btn-ghost btn-xs ml-auto"
            onClick={() => {
              setDraft(defaultModel ?? '')
              setEditing(true)
            }}
          >
            {defaultModel ? 'change' : 'set'}
          </button>
        ) : null}
      </div>
      {editing ? (
        <div className="p-4 flex gap-2 items-center">
          <select
            className="bg-surface-3 border border-border rounded px-2 py-1.5 font-mono text-xs text-fg cursor-pointer flex-1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          >
            <option value="">none (use client's model)</option>
            {allModels?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={updateDefault.isPending}>
            Save
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      ) : defaultModel ? (
        <div className="p-4">
          <p className="text-xs text-fg-dim font-mono m-0">
            All requests using this key will have their model overridden to{' '}
            <code className="text-fg">{defaultModel}</code>, regardless of what the client sends.
          </p>
        </div>
      ) : (
        <div className="p-4">
          <p className="text-xs text-fg-dim font-mono m-0">
            No default model set. The client's requested model is used as-is.
          </p>
        </div>
      )}
    </section>
  )
}
