import { Check, Copy, FileAudio, Loader2, Mic, Replace, Upload } from 'lucide-react'
import { type DragEvent, useCallback, useRef, useState } from 'react'
import { Tooltip } from '../../components/Tooltip'
import { cn } from '../../lib/cn'
import { useModels } from '../../lib/queries'
import { usePlaygroundTranscribe } from '../../lib/use-playground-transcribe'

export function PlaygroundTranscribe() {
  const tx = usePlaygroundTranscribe()
  const { data: models } = useModels()
  const localModels = models?.filter((m) => m.kind === 'local') ?? []
  const peerModels = models?.filter((m) => m.kind === 'peer') ?? []
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [copied, setCopied] = useState(false)
  const transcriptRows = (tx.transcriptData?.segments ?? []).map((segment, index) => ({
    id: segment.id != null ? `segment-${segment.id}` : `segment-${index}`,
    start: typeof segment.start === 'number' ? formatSegmentTime(segment.start) : '—',
    end: typeof segment.end === 'number' ? formatSegmentTime(segment.end) : '—',
    confidence: getSegmentConfidence(segment),
    text: segment.text?.trim() ?? '',
  }))

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) tx.setFile(file)
    },
    [tx.setFile],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) tx.setFile(file)
    },
    [tx.setFile],
  )

  const copyTranscript = useCallback(async () => {
    if (!tx.transcript) return
    await navigator.clipboard.writeText(tx.transcript)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [tx.transcript])

  return (
    <div className="pg-compact-shell">
      <div className="pg-settings pg-compact-settings">
        <div className="pg-settings-row pg-tx-controls-row">
          <div className="pg-tx-control-block">
            <div className="pg-settings-label">model</div>
            <select
              id="pg-tx-model"
              className="pg-select pg-tx-toolbar-select"
              value={tx.model}
              onChange={(e) => tx.setModel(e.target.value)}
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

          <div className="pg-tx-control-block pg-tx-lang-block" aria-hidden="true">
            <div className="pg-settings-label">lang</div>
            <div className="pg-tx-inline-value">auto → en</div>
          </div>

          <div className="pg-tx-control-block pg-tx-output-block" aria-hidden="true">
            <div className="pg-settings-label">output</div>
            <div className="pg-tx-inline-value">verbose_json</div>
          </div>

          <div className="pg-tx-controls-meta" aria-hidden="true">
            <span>3.8 s decode</span>
            <span>35× real-time</span>
          </div>
        </div>
      </div>

      <section className="panel pg-chat-panel pg-compact-panel pg-compact-surface">
        <div className="pg-chat-scroll pg-tx-stage">
          {tx.error ? <div className="pg-error">{tx.error}</div> : null}

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mpeg,audio/mp3,audio/ogg,audio/wav,audio/x-wav,audio/flac,audio/mp4,audio/m4a,audio/webm"
            onChange={handleFileInput}
            hidden
          />

          {tx.file ? (
            <div className="pg-tx-file-shell">
              <div className="pg-file-info pg-tx-file-card">
                <div className="pg-tx-file-card-main">
                  <FileAudio className="icon-16" strokeWidth={1.75} />
                  <div className="pg-file-meta">
                    <div className="pg-file-name">{tx.file.name}</div>
                    <div className="pg-file-size">
                      {formatSegmentTime(tx.transcriptData?.duration ?? 0)} · {fmtSize(tx.file.size)}
                    </div>
                  </div>
                </div>
                <div className="pg-tx-file-card-actions">
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => fileInputRef.current?.click()}>
                    <Replace className="icon-12" strokeWidth={2} />
                    replace
                  </button>
                  <button type="button" className="btn btn-danger btn-xs" onClick={tx.clear}>
                    clear
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={cn('pg-dropzone pg-tx-dropzone', dragging && 'pg-dropzone-active')}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
            >
              <Upload className="pg-dropzone-icon" strokeWidth={1.25} />
              <span>Drop an audio file here or click to browse</span>
              <span className="pg-file-hint">MP3, OGG, WAV, FLAC, M4A, WebM — max 20 MB</span>
            </button>
          )}

          {transcriptRows.length > 0 ? (
            <div className="pg-tx-transcript-shell">
              {transcriptRows.map((row) => (
                <div key={row.id} className="pg-tx-segment">
                  <div className="pg-tx-segment-time mono">
                    {row.start} → {row.end}
                  </div>
                  <div className="pg-tx-segment-confidence mono">{row.confidence ?? '—'}</div>
                  <div className="pg-tx-segment-text">{row.text}</div>
                </div>
              ))}
              <div className="pg-tx-transcript-actions">
                <Tooltip label="Copy">
                  <button type="button" className="pg-action-btn" onClick={copyTranscript}>
                    <span className={cn('copy-icon-swap', copied && 'copy-icon-swap-done')}>
                      <Copy className="copy-icon-swap-from icon-12" strokeWidth={2} />
                      <Check className="copy-icon-swap-to icon-12 text-ok" strokeWidth={2} />
                    </span>
                  </button>
                </Tooltip>
              </div>
            </div>
          ) : null}
        </div>

        <div className="pg-input-bar pg-tx-bar">
          {tx.recording ? (
            <button type="button" className="btn btn-danger-ghost" onClick={tx.stopRecording}>
              <span className="pg-rec-dot" />
              stop recording
            </button>
          ) : (
            <button type="button" className="btn btn-md btn-ghost" onClick={tx.startRecording} disabled={tx.loading}>
              <Mic className="icon-14" strokeWidth={2} />
              record
            </button>
          )}

          <Tooltip label="Transcribe">
            <button
              type="button"
              className="btn btn-primary btn-md"
              disabled={!tx.model || !tx.file || tx.loading}
              onClick={tx.transcribe}
            >
              {tx.loading ? (
                <Loader2 className="icon-14 animate-spin" strokeWidth={2} />
              ) : (
                <FileAudio className="icon-14" strokeWidth={2} />
              )}
              <span>transcribe</span>
            </button>
          </Tooltip>
        </div>
      </section>
    </div>
  )
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatSegmentTime(seconds: number) {
  const whole = Math.floor(seconds)
  const mins = Math.floor(whole / 60)
  const secs = whole % 60
  const hundredths = Math.floor((seconds - whole) * 100)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`
}

function getSegmentConfidence(segment: { avg_logprob?: number; words?: Array<{ probability?: number }> }) {
  if (segment.words && segment.words.length > 0) {
    const probs = segment.words
      .map((word) => word.probability)
      .filter((value): value is number => typeof value === 'number')
    if (probs.length > 0) return `${Math.round((probs.reduce((sum, value) => sum + value, 0) / probs.length) * 100)}%`
  }

  if (typeof segment.avg_logprob === 'number') {
    const approx = Math.exp(segment.avg_logprob)
    return `${Math.round(Math.max(0, Math.min(1, approx)) * 100)}%`
  }

  return null
}
