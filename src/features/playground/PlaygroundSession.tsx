import { Plus, RotateCcw, Save, Square, X } from 'lucide-react'
import { type KeyboardEvent, useState } from 'react'
import { Tooltip } from '../../components/Tooltip'
import type { SamplingParams } from '../../lib/stream-chat'
import { DEFAULT_SAMPLING } from '../../lib/use-playground-chat'
import { PlaygroundKVRow } from './PlaygroundKVRow'
import { PlaygroundSegmented } from './PlaygroundSegmented'
import { PlaygroundSessionSection } from './PlaygroundSessionSection'
import { PlaygroundSlider } from './PlaygroundSlider'
import { PlaygroundToggle } from './PlaygroundToggle'

type Props = {
  model: string
  setModel: (v: string) => void
  models: Array<{ id: string; kind: 'local' | 'peer'; running: boolean; contextLength: number | null }>
  systemPrompt: string
  setSystemPrompt: (v: string) => void
  sampling: SamplingParams
  setSampling: (p: Partial<SamplingParams>) => void
  isStreaming: boolean
  hasMessages: boolean
  onStop: () => void
  onClear: () => void
  onSaveRun: (name: string) => void
}

export function PlaygroundSession({
  model,
  setModel,
  models,
  systemPrompt,
  setSystemPrompt,
  sampling,
  setSampling,
  isStreaming,
  hasMessages,
  onStop,
  onClear,
  onSaveRun,
}: Props) {
  const localModels = models.filter((m) => m.kind === 'local')
  const peerModels = models.filter((m) => m.kind === 'peer')
  const [stopDraft, setStopDraft] = useState('')

  const addStop = () => {
    const value = stopDraft.trim()
    if (!value || sampling.stopSequences.includes(value)) return
    setSampling({ stopSequences: [...sampling.stopSequences, value] })
    setStopDraft('')
  }

  const handleSaveRun = () => {
    const name = window.prompt('Save run as:', `run-${new Date().toISOString().slice(11, 19)}`)
    if (name) onSaveRun(name)
  }

  const onStopKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addStop()
    }
  }

  return (
    <aside className="pg-session-shell flex min-h-0 flex-col gap-2 overflow-y-auto border-r border-border bg-surface-0 px-4 pt-3.5 pb-5 shadow-[inset_-1px_0_0_rgba(255,255,255,0.02)]">
      <PlaygroundSessionSection label="session">
        {isStreaming ? (
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 rounded-sm border border-[color:color-mix(in_srgb,var(--err)_40%,var(--border))] bg-[color:color-mix(in_srgb,var(--err)_8%,var(--bg-2))] px-2.5 py-[7px] text-xs text-err transition-colors hover:border-border-strong hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={onStop}
          >
            <Square className="icon-12" strokeWidth={2} />
            stop
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 rounded-sm border border-border bg-surface-2 px-2.5 py-[7px] text-xs text-fg transition-colors hover:border-border-strong hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={onClear}
            disabled={!hasMessages}
          >
            <Plus className="icon-12" strokeWidth={2} />
            new chat
          </button>
        )}
        <button
          type="button"
          className="inline-flex items-center justify-center gap-1.5 rounded-sm border border-border bg-surface-2 px-2.5 py-[7px] text-xs text-fg transition-colors hover:border-border-strong hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={handleSaveRun}
          disabled={!hasMessages}
        >
          <Save className="icon-12" strokeWidth={2} />
          save run
        </button>
      </PlaygroundSessionSection>

      <PlaygroundSessionSection label="model">
        <select
          className="w-full rounded-sm border border-border bg-surface-2 px-2 py-1.5 font-mono text-xs text-fg focus:border-accent focus:outline-none"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        >
          <option value="">select…</option>
          {localModels.length > 0 ? (
            <optgroup label="Local">
              {localModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id}
                  {m.running ? ' ●' : ''}
                </option>
              ))}
            </optgroup>
          ) : null}
          {peerModels.length > 0 ? (
            <optgroup label="Peers">
              {peerModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
      </PlaygroundSessionSection>

      <PlaygroundSessionSection label="system prompt">
        <textarea
          className="w-full resize-y rounded-sm border border-border bg-surface-2 px-2.5 py-2 font-mono text-[11px] leading-[1.55] text-fg focus:border-accent focus:outline-none"
          placeholder="You are a terse technical assistant…"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={4}
          spellCheck={false}
        />
      </PlaygroundSessionSection>

      <PlaygroundSessionSection
        label="sampling"
        action={
          <Tooltip label="Reset Sampling Settings">
            <button
              type="button"
              className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-transparent text-fg-dim transition-[background-color,color,transform] duration-100 hover:bg-surface-1 hover:text-fg active:scale-90"
              onClick={() => setSampling(DEFAULT_SAMPLING)}
              aria-label="Reset Sampling Settings"
            >
              <RotateCcw className="icon-12" strokeWidth={2} />
            </button>
          </Tooltip>
        }
      >
        <PlaygroundSlider
          label="temperature"
          value={sampling.temperature}
          min={0}
          max={2}
          step={0.05}
          decimals={2}
          onChange={(v) => setSampling({ temperature: v })}
        />
        <PlaygroundSlider
          label="top_p"
          value={sampling.topP}
          min={0}
          max={1}
          step={0.01}
          decimals={2}
          onChange={(v) => setSampling({ topP: v })}
        />
        <PlaygroundSlider
          label="top_k"
          value={sampling.topK}
          min={0}
          max={100}
          step={1}
          decimals={0}
          onChange={(v) => setSampling({ topK: Math.round(v) })}
        />
        <PlaygroundSlider
          label="max_tokens"
          value={sampling.maxTokens}
          min={64}
          max={8192}
          step={64}
          decimals={0}
          onChange={(v) => setSampling({ maxTokens: Math.round(v) })}
          format={(v) => v.toLocaleString()}
        />
        <PlaygroundSlider
          label="frequency"
          value={sampling.frequencyPenalty}
          min={-2}
          max={2}
          step={0.01}
          decimals={2}
          onChange={(v) => setSampling({ frequencyPenalty: v })}
        />
        <PlaygroundSlider
          label="presence"
          value={sampling.presencePenalty}
          min={-2}
          max={2}
          step={0.01}
          decimals={2}
          onChange={(v) => setSampling({ presencePenalty: v })}
        />
      </PlaygroundSessionSection>

      <PlaygroundSessionSection label="stop sequences">
        <div className="flex flex-wrap gap-1">
          {sampling.stopSequences.map((sequence) => (
            <span
              key={sequence}
              className="inline-flex items-center gap-1 rounded-sm border border-border bg-surface-2 px-1.5 py-[3px] text-[11px]"
            >
              <span className="font-mono text-[11px]">{escapeSeq(sequence)}</span>
              <button
                type="button"
                className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] bg-transparent p-0 text-fg-faint transition-colors hover:bg-surface-3 hover:text-err"
                onClick={() => setSampling({ stopSequences: sampling.stopSequences.filter((s) => s !== sequence) })}
                aria-label={`Remove ${sequence}`}
              >
                <X className="icon-10" strokeWidth={2.5} />
              </button>
            </span>
          ))}
          <label className="inline-flex cursor-text items-center gap-1 rounded-sm border border-border bg-surface-2 px-1.5 py-[3px] text-fg-dim">
            <Plus className="icon-10" strokeWidth={2.5} />
            <input
              className="w-12 border-none bg-transparent p-0 font-mono text-[11px] text-fg outline-none"
              placeholder="add"
              value={stopDraft}
              onChange={(e) => setStopDraft(e.target.value)}
              onKeyDown={onStopKey}
              onBlur={addStop}
            />
          </label>
        </div>
      </PlaygroundSessionSection>

      <PlaygroundSessionSection label="seed & output">
        <PlaygroundKVRow
          k="seed"
          v={
            <input
              className="w-[76px] rounded-[3px] border border-border bg-surface-2 px-1.5 py-0.5 text-right font-mono text-[11px] text-fg outline-none focus:border-accent"
              type="text"
              inputMode="numeric"
              placeholder="auto"
              value={sampling.seed ?? ''}
              onChange={(e) => {
                const raw = e.target.value.trim()
                if (!raw) return setSampling({ seed: null })
                const next = Number(raw)
                if (Number.isFinite(next)) setSampling({ seed: Math.floor(next) })
              }}
            />
          }
        />
        <PlaygroundKVRow
          k="n (choices)"
          v={
            <input
              className="w-[76px] rounded-[3px] border border-border bg-surface-2 px-1.5 py-0.5 text-right font-mono text-[11px] text-fg outline-none focus:border-accent"
              type="number"
              min={1}
              max={8}
              value={sampling.n}
              onChange={(e) => setSampling({ n: Math.max(1, Math.min(8, Number(e.target.value) || 1)) })}
            />
          }
        />
        <PlaygroundKVRow
          k="stream"
          v={
            <PlaygroundToggle
              value={sampling.stream}
              onChange={(v) => setSampling({ stream: v })}
              labels={['off', 'on']}
            />
          }
        />
        <PlaygroundKVRow
          k="response"
          v={
            <PlaygroundSegmented
              value={sampling.responseFormat}
              options={[
                { value: 'text', label: 'text' },
                { value: 'json', label: 'json' },
              ]}
              onChange={(v) => setSampling({ responseFormat: v as 'text' | 'json' })}
            />
          }
        />
        <PlaygroundKVRow
          k="logprobs"
          v={
            <PlaygroundToggle
              value={sampling.logprobs}
              onChange={(v) => setSampling({ logprobs: v })}
              labels={['off', 'on']}
            />
          }
        />
      </PlaygroundSessionSection>

      <PlaygroundSessionSection label="tools & format">
        <PlaygroundKVRow k="tools" v={<span className="text-fg dim">0 defined</span>} />
        <PlaygroundKVRow k="tool_choice" v={<span className="text-fg">auto</span>} />
        <PlaygroundKVRow k="json_schema" v={<span className="text-fg dim">—</span>} />
      </PlaygroundSessionSection>

      <PlaygroundSessionSection label="use as template">
        <p className="m-0 text-[11px] leading-[1.55] text-fg-dim">
          Save this exact configuration as a preset; apply to any request as a starting point.
        </p>
      </PlaygroundSessionSection>
    </aside>
  )
}

function escapeSeq(value: string): string {
  return value.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
}
