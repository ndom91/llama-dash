import { Download, Pause, Play } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Tooltip } from '../../components/Tooltip'
import { buildWaveformPeaks, formatSpeechClock } from './playgroundSpeechUtils'

const WAVEFORM_BAR_WIDTH = 4
const WAVEFORM_BAR_GAP = 3
const WAVEFORM_SIDE_PADDING = 16

type Props = {
  src: string
  durationHint: number | null
  onDownload: () => void
  autoPlay?: boolean
  onEnded?: () => void
}

export function PlaygroundSpeechPreviewPlayer({ src, durationHint, onDownload, autoPlay = false, onEnded }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const waveformRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const onEndedRef = useRef(onEnded)
  const [duration, setDuration] = useState(durationHint ?? 0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null)
  const [waveformWidth, setWaveformWidth] = useState(0)

  useEffect(() => {
    setDuration(durationHint ?? 0)
    setCurrentTime(0)
    setIsPlaying(false)
  }, [durationHint])

  useEffect(() => {
    const node = waveformRef.current
    if (!node) return

    const updateWidth = () => setWaveformWidth(node.clientWidth)
    updateWidth()

    const observer = new ResizeObserver(updateWidth)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false

    async function decodeWaveform() {
      try {
        const res = await fetch(src)
        const buffer = await res.arrayBuffer()
        const AudioCtx =
          window.AudioContext ||
          (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!AudioCtx) return
        const ctx = new AudioCtx()
        const decoded = await ctx.decodeAudioData(buffer.slice(0))
        if (cancelled) {
          void ctx.close()
          return
        }
        setBuffer(decoded)
        if (!durationHint && Number.isFinite(decoded.duration)) setDuration(decoded.duration)
        void ctx.close()
      } catch {
        if (!cancelled) setBuffer(null)
      }
    }

    void decodeWaveform()
    return () => {
      cancelled = true
    }
  }, [src, durationHint])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const sync = () => setCurrentTime(audio.currentTime)
    const onLoaded = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration)
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => {
      setIsPlaying(false)
      setCurrentTime(audio.duration || 0)
      onEndedRef.current?.()
    }

    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('timeupdate', sync)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('timeupdate', sync)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
    }
  }, [])

  useEffect(() => {
    onEndedRef.current = onEnded
  }, [onEnded])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !autoPlay) return
    audio.play().catch(() => {})
  }, [autoPlay, src])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !isPlaying) return

    const tick = () => {
      setCurrentTime(audio.currentTime)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [isPlaying])

  const barCount = useMemo(() => {
    const usableWidth = Math.max(waveformWidth - WAVEFORM_SIDE_PADDING, 0)
    const barSpan = WAVEFORM_BAR_WIDTH + WAVEFORM_BAR_GAP
    if (usableWidth <= 0) return 48
    return Math.max(1, Math.floor((usableWidth + WAVEFORM_BAR_GAP) / barSpan))
  }, [waveformWidth])

  const peaks = useMemo(() => {
    if (!buffer) return []
    return buildWaveformPeaks(buffer, barCount)
  }, [buffer, barCount])

  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0
  const activeBars = useMemo(() => Math.round(progress * peaks.length), [progress, peaks.length])

  const seekToClientX = useCallback(
    (clientX: number) => {
      const audio = audioRef.current
      const node = waveformRef.current
      if (!audio || !node || duration <= 0) return
      const rect = node.getBoundingClientRect()
      const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
      audio.currentTime = ratio * duration
      setCurrentTime(audio.currentTime)
    },
    [duration],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      seekToClientX(e.clientX)
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [seekToClientX],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if ((e.buttons & 1) !== 1) return
      seekToClientX(e.clientX)
    },
    [seekToClientX],
  )

  const togglePlayback = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) await audio.play()
    else audio.pause()
  }, [])

  return (
    <div className="rounded border border-border bg-surface-1 p-2.5">
      {/* biome-ignore lint/a11y/useMediaCaption: generated speech preview has no caption source */}
      <audio ref={audioRef} src={src} preload="metadata" className="sr-only" />
      <div className="flex flex-row items-center gap-3">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-on shadow-[0_0_18px_color-mix(in_srgb,var(--accent)_20%,transparent)] transition-[opacity,transform] duration-100 hover:opacity-90 active:scale-95"
          onClick={togglePlayback}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="size-3.5 shrink-0" strokeWidth={2.5} />
          ) : (
            <Play className="size-3.5 shrink-0" strokeWidth={2.5} />
          )}
        </button>

        <span className="mono min-w-[6.5rem] text-[11px] text-fg-dim">
          {formatSpeechClock(currentTime)} / {formatSpeechClock(duration || 0)}
        </span>

        <div
          ref={waveformRef}
          className="relative flex h-16 min-w-0 flex-1 cursor-pointer items-center gap-[3px] overflow-hidden rounded border border-border bg-surface-0 px-2 py-2 outline-none transition-[border-color,background-color] duration-100 hover:border-accent/60 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          role="slider"
          tabIndex={0}
          aria-label="Audio timeline"
          aria-valuemin={0}
          aria-valuemax={duration || 0}
          aria-valuenow={currentTime}
          onKeyDown={(e) => {
            const audio = audioRef.current
            if (!audio || duration <= 0) return
            if (e.key === 'ArrowLeft') {
              e.preventDefault()
              audio.currentTime = Math.max(0, audio.currentTime - 2)
              setCurrentTime(audio.currentTime)
            }
            if (e.key === 'ArrowRight') {
              e.preventDefault()
              audio.currentTime = Math.min(duration, audio.currentTime + 2)
              setCurrentTime(audio.currentTime)
            }
          }}
        >
          {peaks.map((peak) => (
            <span
              key={peak.id}
              className={peak.index < activeBars ? 'bg-accent' : 'bg-fg-faint/35'}
              style={{ height: `${Math.max(8, peak.value * 48)}px`, width: '4px', borderRadius: '9999px' }}
            />
          ))}
          <span
            className="pointer-events-none absolute top-1.5 bottom-1.5 w-px bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.55)]"
            style={{ left: `${progress * 100}%` }}
          />
        </div>

        <span className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-dim">
          mp3
        </span>

        <Tooltip label="Download">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-sm bg-surface-2 text-fg-dim transition-[background-color,color,transform] duration-100 hover:bg-surface-3 hover:text-fg active:scale-90"
            onClick={onDownload}
            aria-label="Download audio"
          >
            <Download className="size-3.5 shrink-0" strokeWidth={2} />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
