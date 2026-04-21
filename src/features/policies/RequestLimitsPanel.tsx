import { useState } from 'react'
import { useRequestLimits, useUpdateRequestLimits } from '../../lib/queries'

export function RequestLimitsPanel() {
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
    <section className="panel !rounded-none !border-x-0 !border-t-0 !bg-surface-1">
      <div className="panel-head bg-transparent px-6 max-md:px-3">
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
