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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border bg-surface-1/70 px-6 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex min-w-[220px] items-center gap-3 border-r border-border pr-4">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-fg-faint">model</div>
            <select
              id="pg-tx-model"
              className="select-native min-w-0 border-0 bg-transparent py-0 font-mono text-xs text-fg outline-none"
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

          <div className="flex items-center gap-3 border-r border-border pr-4" aria-hidden="true">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-fg-faint">lang</div>
            <div className="font-mono text-xs text-fg">auto-detect</div>
          </div>

          <div className="flex items-center gap-3 border-r border-border pr-4" aria-hidden="true">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-fg-faint">output</div>
            <div className="font-mono text-xs text-fg">verbose_json</div>
          </div>
        </div>
      </div>

      <section className="panel !rounded-none !border-t-0 !bg-transparent flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-surface-0 px-6 pt-5 pb-4">
          {tx.error ? (
            <div className="rounded border border-err bg-err-bg px-3.5 py-2.5 font-mono text-xs text-err">
              {tx.error}
            </div>
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mpeg,audio/mp3,audio/ogg,audio/wav,audio/x-wav,audio/flac,audio/mp4,audio/m4a,audio/webm"
            onChange={handleFileInput}
            hidden
          />

          {tx.file ? (
            <div className="mx-auto w-full max-w-[686px]">
              <div className="flex items-center justify-between gap-4 rounded border border-border bg-surface-2 px-4 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <FileAudio className="icon-16" strokeWidth={1.75} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-fg">{tx.file.name}</div>
                    <div className="font-mono text-[11px] text-fg-dim">
                      {formatSegmentTime(tx.transcriptData?.duration ?? 0)} · {fmtSize(tx.file.size)}
                    </div>
                  </div>
                </div>
                <div className="inline-flex gap-2">
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
              className={cn(
                'mx-auto mt-12 flex min-h-[240px] w-full max-w-[520px] flex-col items-center justify-center gap-2 rounded border border-dashed border-border bg-surface-2 px-6 py-7 text-center text-[13px] text-fg-dim shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] transition-colors hover:border-accent hover:bg-surface-3',
                dragging && 'border-accent bg-surface-3',
              )}
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
              <Upload className="h-[34px] w-[34px] opacity-30" strokeWidth={1.25} />
              <span>Drop an audio file here or click to browse</span>
              <span className="max-w-[320px] text-[11px] leading-[1.5] text-fg-faint">
                MP3, OGG, WAV, FLAC, M4A, WebM — max 20 MB
              </span>
            </button>
          )}

          {transcriptRows.length > 0 ? (
            <div className="mx-auto mb-6 w-full max-w-[686px] overflow-hidden rounded border border-border bg-surface-2">
              {transcriptRows.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[130px_40px_minmax(0,1fr)] items-center gap-2 border-t border-border px-3 py-1 first:border-t-0"
                >
                  <div className="mono text-[11px] whitespace-nowrap text-fg-dim">
                    {row.start} → {row.end}
                  </div>
                  <div className="mono text-[11px] text-accent">{row.confidence ?? '—'}</div>
                  <div className="text-sm leading-[1.6] text-fg">{row.text}</div>
                </div>
              ))}
              <div className="flex justify-end border-t border-border px-3 py-2.5">
                <Tooltip label="Copy">
                  <button
                    type="button"
                    className="flex h-6 w-6 items-center justify-center rounded-sm bg-transparent text-fg-dim transition-[background-color,color,transform] duration-100 hover:bg-surface-1 hover:text-fg active:scale-90"
                    onClick={copyTranscript}
                  >
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

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          {tx.recording ? (
            <button type="button" className="btn btn-md btn-danger-ghost" onClick={tx.stopRecording}>
              <span className="h-2 w-2 rounded-full bg-err" />
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
