import { AlertCircle } from 'lucide-react'
import { useCallback } from 'react'
import { cn } from '../../lib/cn'
import { buildRealtimeFilename } from '../../lib/realtime-audio'
import type { RealtimeTurn } from '../../lib/use-playground-realtime'
import { PlaygroundSpeechPreviewPlayer } from './PlaygroundSpeechPreviewPlayer'
import { formatRealtimeMs } from './playgroundRealtimeUtils'

type Props = {
  turn: RealtimeTurn
  model: string
}

export function PlaygroundRealtimeTurn({ turn, model }: Props) {
  const audioUrl = turn.audioUrl
  const download = useCallback(() => {
    if (!audioUrl || turn.role === 'error') return
    const link = document.createElement('a')
    link.href = audioUrl
    link.download = buildRealtimeFilename(model, turn.role, turn.createdAt)
    link.click()
  }, [audioUrl, model, turn.role, turn.createdAt])

  if (turn.role === 'error') {
    return (
      <div className="mx-auto flex w-full max-w-[760px] items-start gap-2 rounded border border-err bg-err-bg px-3.5 py-2.5 font-mono text-xs text-err">
        <AlertCircle className="mt-px size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
        <span className="min-w-0 break-words">{turn.text}</span>
      </div>
    )
  }

  const isUser = turn.role === 'user'
  const meta = isUser
    ? [turn.audioSeconds != null ? `${turn.audioSeconds.toFixed(1)} s audio` : 'text']
    : [
        turn.pending ? 'streaming' : null,
        turn.cancelled ? 'interrupted' : null,
        turn.firstAudioMs != null ? `first audio ${formatRealtimeMs(turn.firstAudioMs)}` : null,
        turn.totalMs != null ? `total ${formatRealtimeMs(turn.totalMs)}` : null,
        turn.outputTokens != null ? `${turn.outputTokens} tok` : null,
      ]

  return (
    <div className={cn('mx-auto flex w-full max-w-[760px] flex-col gap-2', isUser && 'items-end')}>
      <div
        className={cn(
          'flex w-full flex-col gap-2 rounded border px-3 py-2.5',
          isUser ? 'max-w-[560px] border-border bg-surface-2' : 'border-border bg-surface-1',
        )}
      >
        <div className="flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-faint">
          <span className="font-semibold">{isUser ? 'you' : 'assistant'}</span>
          <span className="normal-case tracking-normal text-fg-dim tabular-nums">
            {meta.filter(Boolean).join(' · ')}
          </span>
        </div>
        {turn.text ? (
          <div className="whitespace-pre-wrap text-[13px] leading-[1.6] text-fg">{turn.text}</div>
        ) : turn.pending ? (
          <div className="flex gap-1 py-1">
            <span className="sr-only">Waiting for the response</span>
            <span className="size-1.5 animate-pulse rounded-full bg-fg-dim" aria-hidden="true" />
            <span
              className="size-1.5 animate-pulse rounded-full bg-fg-dim [animation-delay:150ms]"
              aria-hidden="true"
            />
            <span
              className="size-1.5 animate-pulse rounded-full bg-fg-dim [animation-delay:300ms]"
              aria-hidden="true"
            />
          </div>
        ) : !isUser && !audioUrl ? (
          <div className="text-[12px] text-fg-dim">No text or audio in this response.</div>
        ) : null}
        {audioUrl ? (
          <PlaygroundSpeechPreviewPlayer
            key={audioUrl}
            src={audioUrl}
            durationHint={turn.audioSeconds}
            onDownload={download}
            format="wav"
          />
        ) : null}
      </div>
    </div>
  )
}
