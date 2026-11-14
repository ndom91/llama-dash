import { Loader2, PhoneOff, Plug, RotateCcw } from 'lucide-react'
import { Tooltip } from '../../components/Tooltip'
import { cn } from '../../lib/cn'
import type { ApiModel } from '../../lib/schemas/model'
import {
  DEFAULT_REALTIME_INSTRUCTIONS,
  DEFAULT_VAD_SILENCE_MS,
  DEFAULT_VAD_THRESHOLD,
  type RealtimeStatus,
  type RealtimeTurnMode,
} from '../../lib/use-playground-realtime'
import { PlaygroundSessionSection } from './PlaygroundSessionSection'
import { PlaygroundSlider } from './PlaygroundSlider'
import { splitRealtimeModels } from './playgroundRealtimeUtils'

const MODES: Array<{ id: RealtimeTurnMode; label: string }> = [
  { id: 'push-to-talk', label: 'push to talk' },
  { id: 'hands-free', label: 'hands-free' },
]

type Props = {
  models: Array<ApiModel>
  model: string
  setModel: (value: string) => void
  status: RealtimeStatus
  onConnect: () => void
  onDisconnect: () => void
  mode: RealtimeTurnMode
  setMode: (value: RealtimeTurnMode) => void
  vadThreshold: number
  setVadThreshold: (value: number) => void
  vadSilenceMs: number
  setVadSilenceMs: (value: number) => void
  instructions: string
  setInstructions: (value: string) => void
}

export function PlaygroundRealtimeSettings({
  models,
  model,
  setModel,
  status,
  onConnect,
  onDisconnect,
  mode,
  setMode,
  vadThreshold,
  setVadThreshold,
  vadSilenceMs,
  setVadSilenceMs,
  instructions,
  setInstructions,
}: Props) {
  const { audio, other } = splitRealtimeModels(models)
  const live = status === 'connected' || status === 'connecting'

  return (
    <aside className="pg-session-shell flex min-h-0 flex-col gap-2 overflow-y-auto border-r border-border bg-surface-1 px-4 pt-3.5 pb-5 shadow-[inset_-1px_0_0_rgba(255,255,255,0.02)]">
      <PlaygroundSessionSection label="session">
        {live ? (
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-sm border border-border bg-surface-2 px-2.5 text-xs text-fg transition-colors hover:border-border-strong hover:bg-surface-3"
            onClick={onDisconnect}
          >
            {status === 'connecting' ? (
              <Loader2 className="size-3 shrink-0 animate-spin" strokeWidth={2} />
            ) : (
              <PhoneOff className="size-3 shrink-0" strokeWidth={2} />
            )}
            {status === 'connecting' ? 'cancel' : 'disconnect'}
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-sm bg-accent px-2.5 text-xs font-medium text-accent-on transition-[opacity,transform] duration-100 ease-out hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            onClick={onConnect}
            disabled={!model}
          >
            <Plug className="size-3 shrink-0" strokeWidth={2} />
            connect
          </button>
        )}
      </PlaygroundSessionSection>

      <PlaygroundSessionSection label="model">
        <select
          className="select-native w-full rounded-sm border border-border bg-surface-2 px-2 py-1.5 font-mono text-xs text-fg focus:border-accent focus:outline-none disabled:opacity-50"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={live}
        >
          <option value="">select…</option>
          {audio.length > 0 ? (
            <optgroup label="Audio in + out">
              {audio.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id}
                  {m.running ? ' ●' : ''}
                </option>
              ))}
            </optgroup>
          ) : null}
          {other.length > 0 ? (
            <optgroup label={audio.length > 0 ? 'Other local models' : 'Local models (no audio capability reported)'}>
              {other.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id}
                  {m.running ? ' ●' : ''}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
        {audio.length === 0 && other.length > 0 ? (
          <p className="m-0 text-[11px] leading-4 text-fg-dim">
            No model reports audio input and output yet. Pick one you know serves /v1/realtime.
          </p>
        ) : null}
      </PlaygroundSessionSection>

      <PlaygroundSessionSection label="turns">
        <fieldset className="m-0 flex min-w-0 rounded border border-border bg-surface-2 p-0.5">
          <legend className="sr-only">Turn mode</legend>
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                'flex-1 rounded-sm px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] transition-[background-color,color] duration-100',
                mode === item.id ? 'bg-accent text-accent-on' : 'text-fg-dim hover:bg-surface-1 hover:text-fg',
              )}
              aria-pressed={mode === item.id}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </fieldset>
        <p className="m-0 text-[11px] leading-4 text-fg-dim">
          {mode === 'push-to-talk'
            ? 'Hold the talk button or Space. Releasing ends the turn.'
            : 'The turn ends after a pause. Listening pauses while the model answers.'}
        </p>
      </PlaygroundSessionSection>

      {mode === 'hands-free' ? (
        <PlaygroundSessionSection
          label="voice detection"
          action={
            <Tooltip label="Reset voice detection">
              <button
                type="button"
                className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-transparent text-fg-dim transition-[background-color,color,transform] duration-100 hover:bg-surface-1 hover:text-fg active:scale-[0.96]"
                onClick={() => {
                  setVadThreshold(DEFAULT_VAD_THRESHOLD)
                  setVadSilenceMs(DEFAULT_VAD_SILENCE_MS)
                }}
                aria-label="Reset voice detection"
              >
                <RotateCcw className="size-3 shrink-0" strokeWidth={2} />
              </button>
            </Tooltip>
          }
        >
          <PlaygroundSlider
            label="threshold"
            value={vadThreshold}
            min={0.005}
            max={0.1}
            step={0.005}
            decimals={3}
            onChange={setVadThreshold}
          />
          <PlaygroundSlider
            label="silence"
            value={vadSilenceMs}
            min={300}
            max={2000}
            step={50}
            decimals={0}
            onChange={(value) => setVadSilenceMs(Math.round(value))}
            format={(value) => `${Math.round(value)} ms`}
          />
        </PlaygroundSessionSection>
      ) : null}

      <PlaygroundSessionSection
        label="instructions"
        action={
          <Tooltip label="Reset instructions">
            <button
              type="button"
              className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-transparent text-fg-dim transition-[background-color,color,transform] duration-100 hover:bg-surface-1 hover:text-fg active:scale-[0.96] disabled:opacity-40"
              onClick={() => setInstructions(DEFAULT_REALTIME_INSTRUCTIONS)}
              disabled={live}
              aria-label="Reset instructions"
            >
              <RotateCcw className="size-3 shrink-0" strokeWidth={2} />
            </button>
          </Tooltip>
        }
      >
        <textarea
          className="w-full resize-y rounded-sm border border-border bg-surface-2 px-2.5 py-2 font-mono text-[11px] leading-[1.55] text-fg focus:border-accent focus:outline-none disabled:opacity-60"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={5}
          spellCheck={false}
          disabled={live}
        />
        <p className="m-0 text-[11px] leading-4 text-fg-dim">
          Sent once in session.update. Keep the first sentence so the model answers with speech.
        </p>
      </PlaygroundSessionSection>
    </aside>
  )
}
