import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useModels } from '../lib/queries'

export function PlaygroundSettings({
  model,
  setModel,
  systemPrompt,
  setSystemPrompt,
  temperature,
  setTemperature,
}: {
  model: string
  setModel: (v: string) => void
  systemPrompt: string
  setSystemPrompt: (v: string) => void
  temperature: number
  setTemperature: (v: number) => void
}) {
  const { data: models } = useModels()
  const [open, setOpen] = useState(false)

  const localModels = models?.filter((m) => m.kind === 'local') ?? []
  const peerModels = models?.filter((m) => m.kind === 'peer') ?? []

  return (
    <div className="pg-settings">
      <div className="pg-settings-row">
        <label className="pg-settings-label" htmlFor="pg-model-select">
          model
        </label>
        <select id="pg-model-select" className="pg-select" value={model} onChange={(e) => setModel(e.target.value)}>
          <option value="">select model…</option>
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

        <label className="pg-settings-label" htmlFor="pg-temp">
          temperature
        </label>
        <div className="pg-temp-group">
          <input
            id="pg-temp"
            type="range"
            className="pg-slider"
            min={0}
            max={2}
            step={0.05}
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
          />
          <span className="pg-temp-val mono">{temperature.toFixed(2)}</span>
        </div>

        <button type="button" className="pg-settings-toggle btn btn-ghost btn-xs" onClick={() => setOpen(!open)}>
          {open ? (
            <ChevronDown className="icon-12" strokeWidth={2} />
          ) : (
            <ChevronRight className="icon-12" strokeWidth={2} />
          )}
          system prompt
        </button>
      </div>

      {open ? (
        <textarea
          className="pg-system-textarea"
          placeholder="System prompt (optional)…"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={3}
          spellCheck={false}
        />
      ) : null}
    </div>
  )
}
