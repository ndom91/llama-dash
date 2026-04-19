import { Plus, Save, Square, X } from 'lucide-react'
import { type KeyboardEvent, useState } from 'react'
import type { SamplingParams } from '../lib/stream-chat'

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
    const v = stopDraft.trim()
    if (!v) return
    if (sampling.stopSequences.includes(v)) return
    setSampling({ stopSequences: [...sampling.stopSequences, v] })
    setStopDraft('')
  }

  const removeStop = (v: string) => {
    setSampling({ stopSequences: sampling.stopSequences.filter((s) => s !== v) })
  }

  const onStopKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addStop()
    }
  }

  const handleSaveRun = () => {
    const name = window.prompt('Save run as:', `run-${new Date().toISOString().slice(11, 19)}`)
    if (name) onSaveRun(name)
  }

  return (
    <aside className="pg-rail pg-rail-left">
      <Section label="session">
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
      </Section>

      <Section label="model">
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
      </Section>

      <Section label="system prompt">
        <textarea
          className="pg-rail-textarea"
          placeholder="You are a terse technical assistant…"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={4}
          spellCheck={false}
        />
      </Section>

      <Section label="sampling">
        <Slider
          label="temperature"
          value={sampling.temperature}
          min={0}
          max={2}
          step={0.05}
          decimals={2}
          onChange={(v) => setSampling({ temperature: v })}
        />
        <Slider
          label="top_p"
          value={sampling.topP}
          min={0}
          max={1}
          step={0.01}
          decimals={2}
          onChange={(v) => setSampling({ topP: v })}
        />
        <Slider
          label="top_k"
          value={sampling.topK}
          min={0}
          max={100}
          step={1}
          decimals={0}
          onChange={(v) => setSampling({ topK: Math.round(v) })}
        />
        <Slider
          label="max_tokens"
          value={sampling.maxTokens}
          min={64}
          max={8192}
          step={64}
          decimals={0}
          onChange={(v) => setSampling({ maxTokens: Math.round(v) })}
          format={(v) => v.toLocaleString()}
        />
        <Slider
          label="frequency"
          value={sampling.frequencyPenalty}
          min={-2}
          max={2}
          step={0.01}
          decimals={2}
          onChange={(v) => setSampling({ frequencyPenalty: v })}
        />
        <Slider
          label="presence"
          value={sampling.presencePenalty}
          min={-2}
          max={2}
          step={0.01}
          decimals={2}
          onChange={(v) => setSampling({ presencePenalty: v })}
        />
      </Section>

      <Section label="stop sequences">
        <div className="pg-chip-row">
          {sampling.stopSequences.map((s) => (
            <span key={s} className="pg-chip">
              <span className="font-mono text-[11px]">{escapeSeq(s)}</span>
              <button type="button" className="pg-chip-x" onClick={() => removeStop(s)} aria-label={`Remove ${s}`}>
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
      </Section>

      <Section label="seed & output">
        <KVRow
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
                const n = Number(raw)
                if (Number.isFinite(n)) setSampling({ seed: Math.floor(n) })
              }}
            />
          }
        />
        <KVRow
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
        <KVRow
          k="stream"
          v={<Toggle value={sampling.stream} onChange={(v) => setSampling({ stream: v })} labels={['off', 'on']} />}
        />
        <KVRow
          k="response"
          v={
            <Segmented
              value={sampling.responseFormat}
              options={[
                { value: 'text', label: 'text' },
                { value: 'json', label: 'json' },
              ]}
              onChange={(v) => setSampling({ responseFormat: v as 'text' | 'json' })}
            />
          }
        />
        <KVRow
          k="logprobs"
          v={<Toggle value={sampling.logprobs} onChange={(v) => setSampling({ logprobs: v })} labels={['off', 'on']} />}
        />
      </Section>

      <Section label="tools & format">
        <KVRow k="tools" v={<span className="pg-kv-val dim">0 defined</span>} />
        <KVRow k="tool_choice" v={<span className="pg-kv-val">auto</span>} />
        <KVRow k="json_schema" v={<span className="pg-kv-val dim">—</span>} />
      </Section>

      <Section label="use as template">
        <p className="pg-rail-note">
          Save this exact configuration as a preset; apply to any request as a starting point.
        </p>
      </Section>
    </aside>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="pg-rail-section">
      <div className="pg-rail-heading">{label}</div>
      <div className="pg-rail-body">{children}</div>
    </section>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  decimals,
  onChange,
  format,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  decimals: number
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  const pct = ((value - min) / (max - min)) * 100
  const display = format ? format(value) : value.toFixed(decimals)
  return (
    <div className="pg-slider-row">
      <div className="pg-slider-head">
        <span className="pg-slider-label">{label}</span>
        <span className="pg-slider-value">{display}</span>
      </div>
      <input
        type="range"
        className="pg-rail-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--pct': `${pct}%` } as React.CSSProperties}
      />
      <div className="pg-slider-scale">
        <span>{format ? format(min) : min}</span>
        <span>{format ? format((min + max) / 2) : ((min + max) / 2).toFixed(decimals)}</span>
        <span>{format ? format(max) : max}</span>
      </div>
    </div>
  )
}

function KVRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="pg-kv-row">
      <span className="pg-kv-key">{k}</span>
      <span className="pg-kv-val-wrap">{v}</span>
    </div>
  )
}

function Toggle({
  value,
  onChange,
  labels,
}: {
  value: boolean
  onChange: (v: boolean) => void
  labels: [string, string]
}) {
  return (
    <button
      type="button"
      className={`pg-toggle ${value ? 'pg-toggle-on' : 'pg-toggle-off'}`}
      onClick={() => onChange(!value)}
    >
      {value ? labels[1] : labels[0]}
    </button>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
}) {
  return (
    <span className="pg-segmented">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`pg-seg-btn ${value === o.value ? 'pg-seg-btn-active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </span>
  )
}

function escapeSeq(s: string): string {
  return s.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
}
