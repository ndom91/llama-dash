import { Download, Pause, Play } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Tooltip } from '../../components/Tooltip'
import { buildWaveformPeaks, formatSpeechClock } from './playgroundSpeechUtils'

type Props = {
  src: string
  durationHint: number | null
  onDownload: () => void
}

export function PlaygroundSpeechPreviewPlayer({ src, durationHint, onDownload }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const waveformRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const [duration, setDuration] = useState(durationHint ?? 0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [peaks, setPeaks] = useState<Array<{ id: string; index: number; value: number }>>([])

  useEffect(() => {
    setDuration(durationHint ?? 0)
    setCurrentTime(0)
    setIsPlaying(false)
  }, [durationHint])

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
        setPeaks(buildWaveformPeaks(decoded, 72))
        if (!durationHint && Number.isFinite(decoded.duration)) setDuration(decoded.duration)
        void ctx.close()
      } catch {
        if (!cancelled) setPeaks([])
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
    <div className="pg-speech-preview-player-shell">
      {/* biome-ignore lint/a11y/useMediaCaption: generated speech preview has no caption source */}
      <audio ref={audioRef} src={src} preload="metadata" className="sr-only" />
      <div
        ref={waveformRef}
        className="pg-speech-waveform"
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
            className={peak.index < activeBars ? 'is-active' : ''}
            style={{ height: `${Math.max(8, peak.value * 60)}px` }}
          />
        ))}
        <span className="pg-speech-playhead" style={{ left: `${progress * 100}%` }} />
      </div>

      <div className="pg-speech-preview-player">
        <button
          type="button"
          className="pg-speech-play-btn"
          onClick={togglePlayback}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="icon-14" strokeWidth={2.5} /> : <Play className="icon-14" strokeWidth={2.5} />}
        </button>
        <span className="pg-speech-time mono">{formatSpeechClock(currentTime)}</span>
        <div className="pg-speech-progress" onPointerDown={onPointerDown} onPointerMove={onPointerMove}>
          <span className="pg-speech-progress-track" />
          <span className="pg-speech-progress-fill" style={{ width: `${progress * 100}%` }} />
          <span className="pg-speech-progress-thumb" style={{ left: `${progress * 100}%` }} />
        </div>
        <span className="pg-speech-time mono pg-speech-time-end">{formatSpeechClock(duration || 0)}</span>
        <span className="pg-speech-format-chip">mp3</span>
        <Tooltip label="Download">
          <button type="button" className="pg-action-btn" onClick={onDownload}>
            <Download className="icon-14" strokeWidth={2} />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
