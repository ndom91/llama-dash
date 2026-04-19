import { Check, Copy, FileAudio, Loader2, Mic, Trash2, Upload } from 'lucide-react'
import { type DragEvent, useCallback, useRef, useState } from 'react'
import { cn } from '../lib/cn'
import { useModels } from '../lib/queries'
import { usePlaygroundTranscribe } from '../lib/use-playground-transcribe'

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function PlaygroundTranscribe() {
  const tx = usePlaygroundTranscribe()
  const { data: models } = useModels()
  const localModels = models?.filter((m) => m.kind === 'local') ?? []
  const peerModels = models?.filter((m) => m.kind === 'peer') ?? []
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [copied, setCopied] = useState(false)

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
    <>
      <div className="pg-settings">
        <div className="pg-settings-row">
          {tx.file || tx.transcript ? (
            <button type="button" className="pg-settings-group pg-new-chat-btn" onClick={tx.clear}>
              <Trash2 className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
              clear
            </button>
          ) : null}

          <div className="pg-settings-group">
            <label className="pg-settings-label" htmlFor="pg-tx-model">
              model
            </label>
            <select
              id="pg-tx-model"
              className="pg-select"
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
        </div>
      </div>

      <section className="panel pg-chat-panel">
        <div className="pg-chat-scroll">
          {tx.error ? <div className="pg-error">{tx.error}</div> : null}

          {/* biome-ignore lint/a11y/useKeyWithClickEvents: dropzone delegates to hidden file input */}
          <div
            role="button"
            tabIndex={tx.file ? -1 : 0}
            className={cn('pg-dropzone', dragging && 'pg-dropzone-active', tx.file && 'pg-dropzone-has-file')}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !tx.file && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/mpeg,audio/mp3,audio/ogg,audio/wav,audio/x-wav,audio/flac,audio/mp4,audio/m4a,audio/webm"
              onChange={handleFileInput}
              hidden
            />

            {tx.file ? (
              <div className="pg-file-info">
                <FileAudio className="icon-16" strokeWidth={1.75} />
                <div className="pg-file-meta">
                  <div className="pg-file-name">{tx.file.name}</div>
                  <div className="pg-file-size">{fmtSize(tx.file.size)}</div>
                </div>
                <button
                  type="button"
                  className="pg-action-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    tx.setFile(null)
                  }}
                  title="Remove file"
                >
                  <Trash2 className="icon-12" strokeWidth={2} />
                </button>
              </div>
            ) : (
              <>
                <Upload className="pg-dropzone-icon" strokeWidth={1.25} />
                <span>Drop an audio file here or click to browse</span>
                <span className="pg-file-hint">MP3, OGG, WAV, FLAC, M4A, WebM — max 20 MB</span>
              </>
            )}
          </div>

          {tx.transcript != null ? (
            <div className="pg-transcript">
              <div className="pg-transcript-header">
                <span className="pg-settings-label">transcript</span>
                <button type="button" className="pg-action-btn" onClick={copyTranscript} title="Copy">
                  <span className={cn('copy-icon-swap', copied && 'copy-icon-swap-done')}>
                    <Copy className="copy-icon-swap-from icon-12" strokeWidth={2} />
                    <Check className="copy-icon-swap-to icon-12 text-ok" strokeWidth={2} />
                  </span>
                </button>
              </div>
              <p className="pg-transcript-text">{tx.transcript}</p>
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
            <button type="button" className="btn btn-ghost" onClick={tx.startRecording} disabled={tx.loading}>
              <Mic className="icon-14" strokeWidth={2} />
              record
            </button>
          )}

          <button
            type="button"
            className="pg-send-btn"
            disabled={!tx.model || !tx.file || tx.loading}
            onClick={tx.transcribe}
            title="Transcribe"
          >
            {tx.loading ? (
              <Loader2 className="icon-14 animate-spin" strokeWidth={2} />
            ) : (
              <FileAudio className="icon-14" strokeWidth={2} />
            )}
          </button>
        </div>
      </section>
    </>
  )
}
