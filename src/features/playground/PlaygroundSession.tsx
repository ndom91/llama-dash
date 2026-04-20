import { Plus, Save, Square, X } from 'lucide-react'
import { type KeyboardEvent, useState } from 'react'
import type { SamplingParams } from '../../lib/stream-chat'
import { PlaygroundKVRow } from './PlaygroundKVRow'
import { PlaygroundSegmented } from './PlaygroundSegmented'
import { PlaygroundSessionSection } from './PlaygroundSessionSection'
import { PlaygroundSlider } from './PlaygroundSlider'
import { PlaygroundToggle } from './PlaygroundToggle'

type Props = {
  model: string
  setModel: (v: string) => void
  models: Array<{ id: string; kind: 'local' | 'peer'; running: boolean }>
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
    <aside className="pg-rail pg-rail-left">
      <PlaygroundSessionSection label="session">
        {isStreaming ? (
          <button type="button" className="pg-rail-btn pg-rail-btn-danger" onClick={onStop}>
            <Square className="icon-12" strokeWidth={2} />
            stop
          </button>
        ) : (
          <button type="button" className="pg-rail-btn" onClick={onClear} disabled={!hasMessages}>
            <Plus className="icon-12" strokeWidth={2} />
            new chat
          </button>
        )}
        <button type="button" className="pg-rail-btn" onClick={handleSaveRun} disabled={!hasMessages}>
          <Save className="icon-12" strokeWidth={2} />
          save run
        </button>
      </PlaygroundSessionSection>

      <PlaygroundSessionSection label="model">
        <select className="pg-rail-select" value={model} onChange={(e) => setModel(e.target.value)}>
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
          className="pg-rail-textarea"
          placeholder="You are a terse technical assistant…"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={4}
          spellCheck={false}
        />
      </PlaygroundSessionSection>

      <PlaygroundSessionSection label="sampling">
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
        <div className="pg-chip-row">
          {sampling.stopSequences.map((sequence) => (
            <span key={sequence} className="pg-chip">
              <span className="font-mono text-[11px]">{escapeSeq(sequence)}</span>
              <button
                type="button"
                className="pg-chip-x"
                onClick={() => setSampling({ stopSequences: sampling.stopSequences.filter((s) => s !== sequence) })}
                aria-label={`Remove ${sequence}`}
              >
                <X className="icon-10" strokeWidth={2.5} />
              </button>
            </span>
          ))}
          <label className="pg-chip pg-chip-add">
            <Plus className="icon-10" strokeWidth={2.5} />
            <input
              className="pg-chip-input"
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
              className="pg-kv-input pg-kv-input-num"
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
              className="pg-kv-input pg-kv-input-num"
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
        <PlaygroundKVRow k="tools" v={<span className="pg-kv-val dim">0 defined</span>} />
        <PlaygroundKVRow k="tool_choice" v={<span className="pg-kv-val">auto</span>} />
        <PlaygroundKVRow k="json_schema" v={<span className="pg-kv-val dim">—</span>} />
      </PlaygroundSessionSection>

      <PlaygroundSessionSection label="use as template">
        <p className="pg-rail-note">
          Save this exact configuration as a preset; apply to any request as a starting point.
        </p>
      </PlaygroundSessionSection>
    </aside>
  )
}

function escapeSeq(value: string): string {
  return value.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
}
