import { ChevronDown, ChevronRight, Eraser, Square } from 'lucide-react'
import { useState } from 'react'
import { useModels } from '../lib/queries'

export function PlaygroundSettings({
  model,
  setModel,
  systemPrompt,
  setSystemPrompt,
  temperature,
  setTemperature,
  isStreaming,
  hasMessages,
  onStop,
  onClear,
}: {
  model: string
  setModel: (v: string) => void
  systemPrompt: string
  setSystemPrompt: (v: string) => void
  temperature: number
  setTemperature: (v: number) => void
  isStreaming: boolean
  hasMessages: boolean
  onStop: () => void
  onClear: () => void
}) {
  const { data: models } = useModels()
  const [open, setOpen] = useState(false)

  const localModels = models?.filter((m) => m.kind === 'local') ?? []
  const peerModels = models?.filter((m) => m.kind === 'peer') ?? []

  return (
    <div className="pg-settings">
      <div className="pg-settings-row">
        {isStreaming ? (
          <button type="button" className="pg-settings-group pg-new-chat-btn" onClick={onStop}>
            <Square className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
            stop
          </button>
        ) : (
          <button
            type="button"
            className="pg-settings-group pg-new-chat-btn"
            onClick={onClear}
            disabled={!hasMessages && !isStreaming}
          >
            <Eraser className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
            new chat
          </button>
        )}

        <div className="pg-settings-group">
          <label className="pg-settings-label" htmlFor="pg-model-select">
            model
          </label>
          <select id="pg-model-select" className="pg-select" value={model} onChange={(e) => setModel(e.target.value)}>
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
        </div>

        <div className="pg-settings-group">
          <label className="pg-settings-label" htmlFor="pg-temp">
            temp
          </label>
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
          <span className="pg-temp-val">{temperature.toFixed(2)}</span>
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

      <div className={`pg-system-wrap${open ? ' pg-system-open' : ''}`}>
        <textarea
          className="pg-system-textarea"
          placeholder="System prompt (optional)…"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={3}
          spellCheck={false}
          tabIndex={open ? 0 : -1}
        />
      </div>
    </div>
  )
}
