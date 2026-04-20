import { useState } from 'react'
import { useUpdateKeySystemPrompt } from '../../lib/queries'

type Props = {
  keyId: string
  systemPrompt: string | null
  isRevoked: boolean
}

export function KeySystemPromptPanel({ keyId, systemPrompt, isRevoked }: Props) {
  const updatePrompt = useUpdateKeySystemPrompt()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(systemPrompt ?? '')

  const save = () => {
    const val = draft.trim() || null
    if (val === systemPrompt) {
      setEditing(false)
      return
    }
    updatePrompt.mutate({ id: keyId, systemPrompt: val }, { onSuccess: () => setEditing(false) })
  }

  return (
    <section className="panel detail-stacked-section">
      <div className="panel-head">
        <span className="panel-title">System prompt</span>
        <span className="panel-sub">· {systemPrompt ? 'active' : 'not set'}</span>
        {!isRevoked && !editing ? (
          <button
            type="button"
            className="btn btn-ghost btn-xs ml-auto"
            onClick={() => {
              setDraft(systemPrompt ?? '')
              setEditing(true)
            }}
          >
            {systemPrompt ? 'edit' : 'set'}
          </button>
        ) : null}
      </div>
      {editing ? (
        <div className="p-4 flex flex-col gap-2">
          <textarea
            className="bg-surface-3 border border-border rounded px-3 py-2 font-mono text-xs text-fg resize-y min-h-[80px]"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={10000}
            placeholder="Enter a system prompt to prepend to all chat completion requests..."
          />
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary btn-xs" onClick={save} disabled={updatePrompt.isPending}>
              Save
            </button>
            <button type="button" className="btn btn-xs" onClick={() => setEditing(false)}>
              Cancel
            </button>
            {systemPrompt ? (
              <button
                type="button"
                className="btn btn-xs btn-danger ml-auto"
                onClick={() => {
                  updatePrompt.mutate({ id: keyId, systemPrompt: null }, { onSuccess: () => setEditing(false) })
                }}
                disabled={updatePrompt.isPending}
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
      ) : systemPrompt ? (
        <div className="p-4">
          <pre className="bg-surface-3 border border-border rounded p-3 font-mono text-xs text-fg whitespace-pre-wrap m-0 max-h-[200px] overflow-y-auto">
            {systemPrompt}
          </pre>
        </div>
      ) : (
        <div className="p-4">
          <p className="text-xs text-fg-dim font-mono m-0">
            No system prompt configured. Set one to prepend a system message to all chat completion requests using this
            key.
          </p>
        </div>
      )}
    </section>
  )
}
