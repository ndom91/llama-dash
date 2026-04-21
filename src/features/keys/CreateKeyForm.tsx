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
    <form className="panel !rounded-none !border-x-0 !bg-surface-1 px-6 py-4 max-md:px-3" onSubmit={submit}>
      <div className="mb-4 flex items-center gap-2 border-b border-border pb-3 text-sm">
        <KeyRound size={16} strokeWidth={2} />
        <strong>New API key</strong>
      </div>

      <div className="flex flex-col gap-3.5">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-fg-dim">Name</span>
          <input
            className="rounded-sm border border-border bg-surface-0 px-2.5 py-1.5 font-mono text-[13px] text-fg transition-[border-color,box-shadow] duration-100 focus:border-accent focus:outline-none"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. open-webui, my-app"
          />
        </label>

        <div className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-fg-dim">Allowed models</span>
          <span className="text-[11px] text-fg-faint">empty = all models</span>
          <div className="flex flex-wrap gap-1.5">
            {models?.map((m) => (
              <button
                key={m.id}
                type="button"
                className={cn(
                  'rounded-full border border-border bg-surface-1 px-2.5 py-0.75 font-mono text-[11px] text-fg-dim transition-colors',
                  allowedModels.includes(m.id) && 'border-accent bg-accent-bg text-accent',
                )}
                onClick={() => toggleModel(m.id)}
              >
                {m.id}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 max-md:flex-col">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-fg-dim">RPM limit</span>
            <input
              className="rounded-sm border border-border bg-surface-0 px-2.5 py-1.5 font-mono text-[13px] text-fg transition-[border-color,box-shadow] duration-100 focus:border-accent focus:outline-none"
              type="number"
              min={1}
              value={rpm}
              onChange={(e) => setRpm(e.target.value)}
              placeholder="unlimited"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-fg-dim">TPM limit</span>
            <input
              className="rounded-sm border border-border bg-surface-0 px-2.5 py-1.5 font-mono text-[13px] text-fg transition-[border-color,box-shadow] duration-100 focus:border-accent focus:outline-none"
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
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-medium text-fg-dim">Default model</span>
              <span className="text-[11px] text-fg-faint">overrides the model in all requests using this key</span>
              <select
                className="cursor-pointer rounded-sm border border-border bg-surface-0 px-2.5 py-1.5 font-mono text-[13px] text-fg transition-[border-color,box-shadow] duration-100 focus:border-accent focus:outline-none"
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
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-medium text-fg-dim">System prompt</span>
              <span className="text-[11px] text-fg-faint">prepended to all chat completion requests</span>
              <textarea
                className="min-h-[60px] resize-y rounded-sm border border-border bg-surface-0 px-2.5 py-1.5 font-mono text-[13px] text-fg transition-[border-color,box-shadow] duration-100 focus:border-accent focus:outline-none"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Enter a system prompt..."
                maxLength={10000}
              />
            </label>
          </>
        ) : null}
      </div>

      <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
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
