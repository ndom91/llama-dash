import { Mic, MicOff, Send, Square } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Tooltip } from '../../components/Tooltip'
import { cn } from '../../lib/cn'
import type {
  RealtimeLevelSource,
  RealtimeMicState,
  RealtimeStatus,
  RealtimeTurnMode,
} from '../../lib/use-playground-realtime'
import { PlaygroundRealtimeLevelMeter } from './PlaygroundRealtimeLevelMeter'

type Props = {
  status: RealtimeStatus
  mode: RealtimeTurnMode
  micState: RealtimeMicState
  inputLevel: RealtimeLevelSource
  vadThreshold: number
  talking: boolean
  listening: boolean
  responseActive: boolean
  assistantSpeaking: boolean
  onStartTalking: () => void
  onStopTalking: () => void
  onToggleListening: () => void
  onInterrupt: () => void
  onSendText: (text: string) => void
}

export function PlaygroundRealtimeTalkBar({
  status,
  mode,
  micState,
  inputLevel,
  vadThreshold,
  talking,
  listening,
  responseActive,
  assistantSpeaking,
  onStartTalking,
  onStopTalking,
  onToggleListening,
  onInterrupt,
  onSendText,
}: Props) {
  const [draft, setDraft] = useState('')
  const connected = status === 'connected'
  const micLive = connected && micState === 'live'
  const busy = responseActive || assistantSpeaking

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    onSendText(draft)
    setDraft('')
  }

  const hint = !connected
    ? 'connect to start a session'
    : micState === 'starting'
      ? 'starting microphone…'
      : !micLive
        ? 'microphone unavailable · type below'
        : mode === 'push-to-talk'
          ? talking
            ? 'listening · release to send'
            : 'hold to talk · or hold Space'
          : !listening
            ? 'listening paused'
            : talking
              ? 'hearing you…'
              : busy
                ? 'waiting for the model to finish'
                : 'listening for speech'

  return (
    <div className="border-t border-border bg-surface-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        {mode === 'push-to-talk' ? (
          <button
            type="button"
            className={cn(
              'inline-flex h-10 select-none items-center justify-center gap-2 rounded px-4 font-mono text-xs font-medium transition-[background-color,color,transform,box-shadow] duration-100 ease-out disabled:cursor-not-allowed disabled:opacity-40',
              talking
                ? 'scale-[0.98] bg-accent text-accent-on shadow-[0_0_18px_color-mix(in_srgb,var(--accent)_30%,transparent)]'
                : 'border border-border bg-surface-2 text-fg hover:border-border-strong hover:bg-surface-3',
            )}
            disabled={!micLive}
            onPointerDown={(e) => {
              if (e.button !== 0) return
              e.currentTarget.setPointerCapture(e.pointerId)
              onStartTalking()
            }}
            onPointerUp={onStopTalking}
            onPointerCancel={onStopTalking}
            onContextMenu={(e) => e.preventDefault()}
            aria-pressed={talking}
          >
            <Mic className="size-3.5 shrink-0" strokeWidth={2} />
            {talking ? 'release to send' : 'hold to talk'}
          </button>
        ) : (
          <button
            type="button"
            className={cn(
              'inline-flex h-10 items-center justify-center gap-2 rounded px-4 font-mono text-xs font-medium transition-[background-color,color,transform] duration-100 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40',
              listening
                ? 'bg-accent text-accent-on hover:opacity-90'
                : 'border border-border bg-surface-2 text-fg hover:border-border-strong hover:bg-surface-3',
            )}
            disabled={!micLive}
            onClick={onToggleListening}
            aria-pressed={listening}
          >
            {listening ? (
              <Mic className="size-3.5 shrink-0" strokeWidth={2} />
            ) : (
              <MicOff className="size-3.5 shrink-0" strokeWidth={2} />
            )}
            {listening ? 'listening' : 'paused'}
          </button>
        )}

        <PlaygroundRealtimeLevelMeter
          source={inputLevel}
          muted={!micLive}
          threshold={mode === 'hands-free' && micLive ? vadThreshold : null}
          active={talking}
        />
        <span className="font-mono text-[11px] text-fg-dim">{hint}</span>

        {busy ? (
          <Tooltip label="Stop the current answer">
            <button type="button" className="btn btn-ghost btn-md ml-auto" onClick={onInterrupt}>
              <Square className="size-3 shrink-0" strokeWidth={2} />
              interrupt
            </button>
          </Tooltip>
        ) : null}
      </div>

      <form className="flex items-center gap-2 px-4 py-2.5" onSubmit={submit}>
        <label htmlFor="pg-realtime-text" className="sr-only">
          Send a text message
        </label>
        <input
          id="pg-realtime-text"
          className="h-8 min-w-0 flex-1 rounded border border-border bg-surface-2 px-2.5 text-[13px] text-fg transition-[border-color,background-color] duration-100 ease-out focus:border-accent focus:bg-surface-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          placeholder={connected ? 'Or type a message…' : 'Connect to send a message…'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={!connected}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className="btn btn-ghost btn-md" disabled={!connected || !draft.trim()}>
          <Send className="size-3.5 shrink-0" strokeWidth={2} />
          send
        </button>
      </form>
    </div>
  )
}
