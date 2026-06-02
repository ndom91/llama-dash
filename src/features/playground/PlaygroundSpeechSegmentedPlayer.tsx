import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { cn } from '../../lib/cn'
import type { SpeechSegment } from '../../lib/use-playground-speech'
import { PlaygroundSpeechPreviewPlayer } from './PlaygroundSpeechPreviewPlayer'

type Props = {
  segments: SpeechSegment[]
  totalSegments: number
  status: 'generating' | 'complete' | 'cancelled' | 'error'
  onDownloadSegment: (segment: SpeechSegment) => void
}

export function PlaygroundSpeechSegmentedPlayer({ segments, totalSegments, status, onDownloadSegment }: Props) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [autoPlay, setAutoPlay] = useState(() => status === 'generating')
  const [waitingForNext, setWaitingForNext] = useState(false)
  const activeSegment = segments[activeIndex] ?? segments[0] ?? null

  useEffect(() => {
    if (segments.length === 0) setActiveIndex(0)
    else if (activeIndex >= segments.length) setActiveIndex(segments.length - 1)
  }, [activeIndex, segments.length])

  useEffect(() => {
    if (!waitingForNext || activeIndex + 1 >= segments.length) return
    setWaitingForNext(false)
    setAutoPlay(true)
    setActiveIndex(activeIndex + 1)
  }, [activeIndex, segments.length, waitingForNext])

  const advance = useCallback(() => {
    setActiveIndex((current) => {
      const next = current + 1
      if (next >= segments.length) {
        if (status === 'generating') setWaitingForNext(true)
        setAutoPlay(false)
        return current
      }
      setWaitingForNext(false)
      setAutoPlay(true)
      return next
    })
  }, [segments.length, status])

  const selectSegment = useCallback((index: number) => {
    setWaitingForNext(false)
    setAutoPlay(false)
    setActiveIndex(index)
  }, [])

  if (!activeSegment) {
    const emptyLabel = status === 'generating' ? 'Generating first audio segment...' : 'No playable audio segments were generated.'
    return (
      <div className="flex items-center gap-2 rounded border border-border bg-surface-1 px-3 py-2 font-mono text-[11px] text-fg-dim">
        {status === 'generating' ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
        <span>{emptyLabel}</span>
      </div>
    )
  }

  const generatedLabel = `${segments.length} / ${totalSegments} segments generated`
  const statusLabel = status === 'generating' ? generatedLabel : `${status} · ${generatedLabel}`

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-surface-1 px-3 py-2">
        <div className="font-mono text-[11px] text-fg-dim">
          Segment {activeSegment.index + 1} of {totalSegments} · {waitingForNext ? 'waiting for next segment' : statusLabel}
        </div>
        {status === 'generating' ? <Loader2 className="size-3.5 animate-spin text-fg-dim" aria-hidden="true" /> : null}
      </div>

      <div className="flex flex-wrap gap-1.5" aria-label="Speech segments">
        {Array.from({ length: totalSegments }, (_, index) => {
          const ready = index < segments.length
          return (
            <button
              key={index}
              type="button"
              className={cn(
                'h-7 min-w-7 rounded-sm border border-border px-2 font-mono text-[10px] transition-[background-color,color,opacity] duration-100',
                ready && index === activeIndex
                  ? 'bg-accent text-accent-on'
                  : 'bg-surface-1 text-fg-dim hover:bg-surface-2 hover:text-fg',
                !ready && 'cursor-not-allowed opacity-40 hover:bg-surface-1 hover:text-fg-dim',
              )}
              disabled={!ready}
              onClick={() => selectSegment(index)}
              aria-label={`Play segment ${index + 1}`}
            >
              {index + 1}
            </button>
          )
        })}
      </div>

      <PlaygroundSpeechPreviewPlayer
        key={activeSegment.audioUrl}
        src={activeSegment.audioUrl}
        durationHint={activeSegment.audioDurationSec}
        autoPlay={autoPlay}
        onEnded={advance}
        onDownload={() => onDownloadSegment(activeSegment)}
      />
    </div>
  )
}
