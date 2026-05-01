import { Check, KeyRound } from 'lucide-react'
import { useState } from 'react'
import { NumberInput } from '../../components/NumberInput'
import type { ApiKeyCreated } from '../../lib/api'
import { cn } from '../../lib/cn'
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
          <span className="text-[11px] text-fg-faint">
            {allowedModels.length === 0 ? 'empty = all models' : `${allowedModels.length} selected`}
          </span>
          {allowedModels.length > 0 ? (
            <div className="font-mono text-[11px] leading-5 text-fg-dim" translate="no">
              Selected: <span className="text-fg">{allowedModels.join(', ')}</span>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {models?.map((m) => {
              const selected = allowedModels.includes(m.id)
              return (
                <button
                  key={m.id}
                  type="button"
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border border-border bg-surface-1 px-2.5 py-0.75 font-mono text-[11px] text-fg-dim transition-colors hover:border-border-strong hover:bg-surface-3 hover:text-fg focus-visible:outline-none focus-visible:shadow-focus',
                    selected &&
                      'border-accent bg-accent text-accent-on hover:border-accent hover:bg-accent-strong hover:text-accent-on',
                  )}
                  aria-pressed={selected}
                  onClick={() => toggleModel(m.id)}
                >
                  {selected ? <Check className="h-3 w-3" strokeWidth={2} aria-hidden="true" /> : null}
                  {m.id}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex gap-3 max-md:flex-col">
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-fg-dim" htmlFor="create-key-rpm-limit">
              RPM limit
            </label>
            <NumberInput
              id="create-key-rpm-limit"
              className="h-9 rounded-sm bg-surface-0 text-[13px]"
              min={1}
              value={rpm}
              onChange={(e) => setRpm(e.target.value)}
              placeholder="unlimited"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-fg-dim" htmlFor="create-key-tpm-limit">
              TPM limit
            </label>
            <NumberInput
              id="create-key-tpm-limit"
              className="h-9 rounded-sm bg-surface-0 text-[13px]"
              min={1}
              value={tpm}
              onChange={(e) => setTpm(e.target.value)}
              placeholder="unlimited"
            />
          </div>
        </div>

        <button
          type="button"
          className="text-xs font-mono text-fg-dim hover:text-fg bg-transparent border-none cursor-pointer p-0 self-start"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? '▾ Hide advanced' : '▸ Advanced options'}
        </button>

        {showAdvanced ? (
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
