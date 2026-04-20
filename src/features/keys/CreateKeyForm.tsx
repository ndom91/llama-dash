import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../../lib/cn'
import type { ApiKeyCreated } from '../../lib/api'
import { useCreateApiKey, useModels } from '../../lib/queries'

type Props = {
  onCreated: (r: ApiKeyCreated) => void
  onCancel: () => void
}

export function CreateKeyForm({ onCreated, onCancel }: Props) {
  const createKey = useCreateApiKey()
  const { data: models } = useModels()
  const [name, setName] = useState('')
  const [allowedModels, setAllowedModels] = useState<Array<string>>([])
  const [rpm, setRpm] = useState('')
  const [tpm, setTpm] = useState('')
  const [defaultModel, setDefaultModel] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    createKey.mutate(
      {
        name: name.trim(),
        allowedModels,
        rateLimitRpm: rpm ? Number(rpm) : null,
        rateLimitTpm: tpm ? Number(tpm) : null,
        defaultModel: defaultModel || null,
        systemPrompt: systemPrompt.trim() || null,
      },
      { onSuccess: (data) => onCreated(data) },
    )
  }

  const toggleModel = (id: string) => {
    setAllowedModels((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]))
  }

  return (
    <form className="key-create-form panel keys-panel" onSubmit={submit}>
      <div className="key-create-form-header">
        <KeyRound size={16} strokeWidth={2} />
        <strong>New API key</strong>
      </div>

      <div className="key-create-fields">
        <label className="key-field">
          <span className="key-field-label">Name</span>
          <input
            className="key-field-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. open-webui, my-app"
          />
        </label>

        <div className="key-field">
          <span className="key-field-label">Allowed models</span>
          <span className="key-field-hint">empty = all models</span>
          <div className="key-model-chips">
            {models?.map((m) => (
              <button
                key={m.id}
                type="button"
                className={cn('key-model-chip', allowedModels.includes(m.id) && 'is-active')}
                onClick={() => toggleModel(m.id)}
              >
                {m.id}
              </button>
            ))}
          </div>
        </div>

        <div className="key-field-row">
          <label className="key-field">
            <span className="key-field-label">RPM limit</span>
            <input
              className="key-field-input"
              type="number"
              min={1}
              value={rpm}
              onChange={(e) => setRpm(e.target.value)}
              placeholder="unlimited"
            />
          </label>
          <label className="key-field">
            <span className="key-field-label">TPM limit</span>
            <input
              className="key-field-input"
              type="number"
              min={1}
              value={tpm}
              onChange={(e) => setTpm(e.target.value)}
              placeholder="unlimited"
            />
          </label>
        </div>

        <button
          type="button"
          className="text-xs font-mono text-fg-dim hover:text-fg bg-transparent border-none cursor-pointer p-0 self-start"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? '▾ Hide advanced' : '▸ Advanced options'}
        </button>

        {showAdvanced ? (
          <>
            <label className="key-field">
              <span className="key-field-label">Default model</span>
              <span className="key-field-hint">overrides the model in all requests using this key</span>
              <select
                className="key-field-input cursor-pointer"
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
              >
                <option value="">none (use client's model)</option>
                {models?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="key-field">
              <span className="key-field-label">System prompt</span>
              <span className="key-field-hint">prepended to all chat completion requests</span>
              <textarea
                className="key-field-input resize-y min-h-[60px]"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Enter a system prompt..."
                maxLength={10000}
              />
            </label>
          </>
        ) : null}
      </div>

      <div className="key-create-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={!name.trim() || createKey.isPending}>
          {createKey.isPending ? 'Creating…' : 'Create'}
        </button>
      </div>
    </form>
  )
}
