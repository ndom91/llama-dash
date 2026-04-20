import { Download, Loader2, Pause, Play, Volume2, X } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useModels } from '../lib/queries'
import { usePlaygroundSpeech } from '../lib/use-playground-speech'
import { Tooltip } from './Tooltip'

export function PlaygroundSpeech() {
  const speech = usePlaygroundSpeech()
  const { data: models } = useModels()
  const localModels = models?.filter((m) => m.kind === 'local') ?? []
  const peerModels = models?.filter((m) => m.kind === 'peer') ?? []

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      if (!speech.text.trim()) return
      speech.generate()
      speech.setText('')
    },
    [speech.generate, speech.text, speech.setText],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit(e as unknown as FormEvent)
      }
    },
    [handleSubmit],
  )

  const autoResize = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [])

  const downloadAudio = useCallback((audioUrl: string, input: string, createdAt: number) => {
    const link = document.createElement('a')
    link.href = audioUrl
    link.download = buildSpeechFilename(input, createdAt)
    link.click()
  }, [])

  const renderLabel = (renderMs: number | null) =>
    renderMs != null ? `${(renderMs / 1000).toFixed(1)} s render` : '— render'
  const ratioLabel = (renderMs: number | null, durationSec: number | null) =>
    renderMs != null && durationSec != null && renderMs > 0
      ? `${(durationSec / (renderMs / 1000)).toFixed(1)}× real-time`
      : '— real-time'
  const durationLabel = (durationSec: number | null) => (durationSec != null ? formatClock(durationSec) : '--:--.-')

  return (
    <div className="pg-compact-shell">
      <div className="pg-settings pg-compact-settings">
        <div className="pg-settings-row pg-speech-controls-row">
          <div className="pg-speech-control-block">
            <div className="pg-settings-label">model</div>
            <select
              id="pg-speech-model"
              className="pg-select pg-speech-toolbar-select"
              value={speech.model}
              onChange={(e) => speech.setModel(e.target.value)}
            >
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

          <div className="pg-speech-control-block">
            <div className="pg-settings-label">voice</div>
            {speech.voices ? (
              <select
                id="pg-speech-voice"
                className="pg-select pg-speech-toolbar-select"
                value={speech.voice}
                onChange={(e) => speech.setVoice(e.target.value)}
              >
                <option value="">default</option>
                {speech.voices.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="pg-speech-voice"
                type="text"
                className="pg-voice-input pg-speech-toolbar-input"
                placeholder="voice name…"
                value={speech.voice}
                onChange={(e) => speech.setVoice(e.target.value)}
              />
            )}
          </div>

          <div className="pg-speech-control-block pg-speech-format-block" aria-hidden="true">
            <div className="pg-settings-label">format</div>
            <div className="pg-speech-format-value">mp3 • 24 kHz</div>
          </div>
        </div>
      </div>

      <section className="panel pg-chat-panel pg-compact-panel pg-compact-surface">
        <div className="pg-chat-scroll pg-speech-stage">
          {speech.error ? <div className="pg-error">{speech.error}</div> : null}

          {speech.entries.length > 0 ? (
            <div className="pg-speech-stack">
              {speech.entries.map((entry) => (
                <div key={entry.id} className="pg-speech-preview-card">
                  <div className="pg-speech-preview-head">
                    <span className="pg-settings-label">preview</span>
                    <div className="pg-speech-preview-head-right">
                      <div className="pg-speech-preview-meta">
                        <span>{entry.voice}</span> ·<span>{durationLabel(entry.audioDurationSec)}</span> ·
                        <span>{renderLabel(entry.renderMs)}</span> ·
                        <span>{ratioLabel(entry.renderMs, entry.audioDurationSec)}</span>
                      </div>
                      <Tooltip label="Close">
                        <button
                          type="button"
                          className="pg-action-btn pg-speech-close-btn"
                          onClick={() => speech.removeEntry(entry.id)}
                          aria-label="Remove speech result"
                        >
                          <X className="icon-12" strokeWidth={2} />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="pg-speech-preview-text">{entry.input}</div>
                  <SpeechPreviewPlayer
                    key={entry.audioUrl}
                    src={entry.audioUrl}
                    durationHint={entry.audioDurationSec}
                    onDownload={() => downloadAudio(entry.audioUrl, entry.input, entry.createdAt ?? Date.now())}
                  />
                </div>
              ))}
            </div>
          ) : !speech.loading && !speech.error ? (
            <div className="pg-empty">
              <Volume2 className="pg-empty-icon" strokeWidth={1.25} />
              <span>Convert text to speech</span>
            </div>
          ) : null}
        </div>

        <form className="pg-input-bar pg-speech-prompt-bar" onSubmit={handleSubmit}>
          <textarea
            className="pg-input rounded!"
            placeholder={speech.model ? 'Enter text to speak…' : 'Select a model first…'}
            value={speech.text}
            onChange={(e) => speech.setText(e.target.value)}
            disabled={!speech.model}
            rows={1}
            onKeyDown={handleKeyDown}
            onInput={(e) => autoResize(e.currentTarget)}
            spellCheck={false}
          />
          <Tooltip label="Generate speech">
            <button
              type="submit"
              className="btn btn-primary btn-md"
              disabled={!speech.model || !speech.text.trim() || speech.loading}
            >
              {speech.loading ? (
                <Loader2 className="icon-14 animate-spin" strokeWidth={2} />
              ) : (
                <Volume2 className="icon-14" strokeWidth={2} />
              )}
              <span>speak</span>
            </button>
          </Tooltip>
        </form>
      </section>
    </div>
  )
}

function formatClock(seconds: number) {
  const whole = Math.floor(seconds)
  const mins = Math.floor(whole / 60)
  const secs = whole % 60
  const tenths = Math.floor((seconds - whole) * 10)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`
}

function buildSpeechFilename(input: string, createdAt: number) {
  const base =
    input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 5)
      .join('-') || 'speech'

  const date = new Date(Number.isFinite(createdAt) ? createdAt : Date.now())
  const stamp = Number.isFinite(date.getTime())
    ? date.toISOString().replace(/[-:]/g, '').slice(0, 15)
    : new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)

  return `${base}_${stamp}.mp3`
}

function SpeechPreviewPlayer({
  src,
  durationHint,
  onDownload,
}: {
  src: string
  durationHint: number | null
  onDownload: () => void
}) {
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
        <span className="pg-speech-time mono">{formatClock(currentTime)}</span>
        <div className="pg-speech-progress" onPointerDown={onPointerDown} onPointerMove={onPointerMove}>
          <span className="pg-speech-progress-track" />
          <span className="pg-speech-progress-fill" style={{ width: `${progress * 100}%` }} />
          <span className="pg-speech-progress-thumb" style={{ left: `${progress * 100}%` }} />
        </div>
        <span className="pg-speech-time mono pg-speech-time-end">{formatClock(duration || 0)}</span>
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

function buildWaveformPeaks(buffer: AudioBuffer, bars: number) {
  const channel = buffer.getChannelData(0)
  const blockSize = Math.floor(channel.length / bars)
  const peaks: Array<number> = []
  let max = 0

  for (let i = 0; i < bars; i++) {
    let sum = 0
    const start = i * blockSize
    const end = Math.min(start + blockSize, channel.length)
    for (let j = start; j < end; j++) sum = Math.max(sum, Math.abs(channel[j]))
    peaks.push(sum)
    max = Math.max(max, sum)
  }

  const normalized = max > 0 ? peaks.map((value) => value / max) : peaks.map(() => 0.1)
  return normalized.map((value, index) => ({
    id: `peak-${index}-${Math.round(value * 1000)}`,
    index,
    value,
  }))
}
