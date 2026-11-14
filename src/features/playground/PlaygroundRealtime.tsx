import { AudioLines, Info, Trash2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { StatusDot } from '../../components/StatusDot'
import { Tooltip } from '../../components/Tooltip'
import { isTypingTarget } from '../../lib/is-typing-target'
import { useModels } from '../../lib/queries'
import { usePlaygroundRealtime } from '../../lib/use-playground-realtime'
import { PlaygroundRealtimeInspector } from './PlaygroundRealtimeInspector'
import { PlaygroundRealtimeSettings } from './PlaygroundRealtimeSettings'
import { PlaygroundRealtimeTalkBar } from './PlaygroundRealtimeTalkBar'
import { PlaygroundRealtimeTurn } from './PlaygroundRealtimeTurn'

const STATUS_TONE = {
  idle: 'idle',
  connecting: 'warn',
  connected: 'ok',
  error: 'err',
} as const

export function PlaygroundRealtime() {
  const rt = usePlaygroundRealtime()
  const { data: models } = useModels()
  const scrollRef = useRef<HTMLDivElement>(null)
  const pushToTalk = rt.status === 'connected' && rt.mode === 'push-to-talk' && rt.micState === 'live'
  const { startTalking, stopTalking } = rt

  // Hold Space to talk, unless focus is in a text field.
  useEffect(() => {
    if (!pushToTalk) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isTypingTarget(e)) return
      e.preventDefault()
      if (!e.repeat) startTalking()
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isTypingTarget(e)) return
      e.preventDefault()
      stopTalking()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', stopTalking)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', stopTalking)
    }
  }, [pushToTalk, startTalking, stopTalking])

  // biome-ignore lint/correctness/useExhaustiveDependencies: follow new turns and streamed text
  useEffect(() => {
    const el = scrollRef.current
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 120) el.scrollTo({ top: el.scrollHeight })
  }, [rt.turns])

  const statusLabel =
    rt.status === 'connecting'
      ? 'connecting · the model may need to load'
      : rt.status === 'connected'
        ? rt.timing.inputRate && rt.timing.outputRate
          ? `in ${rt.timing.inputRate / 1000} kHz · out ${rt.timing.outputRate / 1000} kHz`
          : 'connected'
        : rt.status

  return (
    <div className="pg-chat-grid grid min-h-0 flex-1 items-stretch gap-0">
      <PlaygroundRealtimeSettings
        models={models ?? []}
        model={rt.model}
        setModel={rt.setModel}
        status={rt.status}
        onConnect={rt.connect}
        onDisconnect={rt.disconnect}
        mode={rt.mode}
        setMode={rt.setMode}
        vadThreshold={rt.vadThreshold}
        setVadThreshold={rt.setVadThreshold}
        vadSilenceMs={rt.vadSilenceMs}
        setVadSilenceMs={rt.setVadSilenceMs}
        instructions={rt.instructions}
        setInstructions={rt.setInstructions}
      />

      <section className="panel !rounded-none !border-t-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden !border-b-0 !border-l-0 !border-r border-r-border !bg-surface-0">
        <div className="flex h-10 items-center justify-between gap-4 border-b border-border bg-surface-1 px-4 py-2 font-mono text-[11px] text-fg-dim">
          <div className="flex min-w-0 items-center gap-1.5">
            <StatusDot tone={STATUS_TONE[rt.status]} live={rt.status === 'connected'} />
            <span className="truncate text-fg" translate="no">
              {rt.model || '—'}
            </span>
            <span>·</span>
            <span className="truncate">{statusLabel}</span>
          </div>
          {rt.turns.length > 0 ? (
            <Tooltip label="Clear transcript">
              <button
                type="button"
                className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-transparent text-fg-dim transition-[background-color,color,transform] duration-100 hover:bg-surface-2 hover:text-fg active:scale-[0.96]"
                onClick={rt.clearTurns}
                aria-label="Clear transcript"
              >
                <Trash2 className="size-3 shrink-0" strokeWidth={2} />
              </button>
            </Tooltip>
          ) : null}
        </div>

        <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto bg-surface-0 px-4 pt-5 pb-4">
          {rt.micSupport === 'insecure' ? (
            <Notice>
              The browser only allows microphone access on HTTPS or localhost, and this page is served over plain HTTP.
              Open llama-dash over HTTPS (or through localhost, e.g. an SSH tunnel) to talk. You can still connect and
              type messages to hear spoken replies.
            </Notice>
          ) : null}
          {rt.micSupport === 'unsupported' ? (
            <Notice>
              This browser does not support microphone capture with AudioWorklet. Typed messages still work.
            </Notice>
          ) : null}
          {rt.micError ? (
            <div className="mx-auto w-full max-w-[760px] rounded border border-warn bg-warn-bg px-3.5 py-2.5 font-mono text-xs text-warn">
              {rt.micError}
            </div>
          ) : null}
          {rt.error ? (
            <div className="mx-auto w-full max-w-[760px] rounded border border-err bg-err-bg px-3.5 py-2.5 font-mono text-xs text-err">
              {rt.error}
            </div>
          ) : null}

          {rt.turns.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-[13px] text-fg-faint">
              <AudioLines className="h-10 w-10 opacity-30" strokeWidth={1.25} />
              <span>
                {rt.status === 'connected'
                  ? rt.mode === 'push-to-talk'
                    ? 'Hold the talk button or Space and speak'
                    : 'Start speaking'
                  : 'Pick an audio model and connect to start a voice session'}
              </span>
            </div>
          ) : (
            rt.turns.map((turn) => <PlaygroundRealtimeTurn key={turn.id} turn={turn} model={rt.model} />)
          )}
        </div>

        <PlaygroundRealtimeTalkBar
          status={rt.status}
          mode={rt.mode}
          micState={rt.micState}
          inputLevel={rt.inputLevel}
          vadThreshold={rt.vadThreshold}
          talking={rt.talking}
          listening={rt.listening}
          responseActive={rt.responseActive}
          assistantSpeaking={rt.assistantSpeaking}
          onStartTalking={rt.startTalking}
          onStopTalking={rt.stopTalking}
          onToggleListening={rt.toggleListening}
          onInterrupt={rt.interrupt}
          onSendText={rt.sendText}
        />
      </section>

      <PlaygroundRealtimeInspector
        events={rt.events}
        timing={rt.timing}
        session={rt.session}
        connected={rt.status === 'connected'}
        onClearEvents={rt.clearEvents}
      />
    </div>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[760px] items-start gap-2 rounded border border-border bg-surface-2 px-3.5 py-2.5 text-[12px] leading-5 text-fg-muted">
      <Info className="mt-0.5 size-3.5 shrink-0 text-fg-dim" strokeWidth={2} aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}
