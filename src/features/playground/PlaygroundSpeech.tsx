import { Loader2, Volume2, X } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useCallback } from 'react'
import { Tooltip } from '../../components/Tooltip'
import { useModels } from '../../lib/queries'
import { usePlaygroundSpeech } from '../../lib/use-playground-speech'
import { PlaygroundSpeechPreviewPlayer } from './PlaygroundSpeechPreviewPlayer'
import { buildSpeechFilename, formatSpeechClock } from './playgroundSpeechUtils'

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
  const durationLabel = (durationSec: number | null) =>
    durationSec != null ? formatSpeechClock(durationSec) : '--:--.-'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border bg-surface-1/70 px-6 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex min-w-[220px] items-center gap-3 border-r border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] pr-4">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-fg-faint">model</div>
            <select
              id="pg-speech-model"
              className="min-w-0 border-0 bg-transparent font-mono text-xs text-fg outline-none"
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

          <div className="flex min-w-[180px] items-center gap-3 border-r border-[color:color-mix(in_srgb,var(--border)_86%,transparent)] pr-4">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-fg-faint">voice</div>
            {speech.voices ? (
              <select
                id="pg-speech-voice"
                className="min-w-0 border-0 bg-transparent font-mono text-xs text-fg outline-none"
                value={speech.voice}
                onChange={(e) => speech.setVoice(e.target.value)}
              >
                <option value="">default</option>
                {speech.voices.map((voice) => (
                  <option key={voice} value={voice}>
                    {voice}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="pg-speech-voice"
                type="text"
                className="min-w-0 border-0 bg-transparent font-mono text-xs text-fg outline-none"
                placeholder="voice name…"
                value={speech.voice}
                onChange={(e) => speech.setVoice(e.target.value)}
              />
            )}
          </div>

          <div
            className="ml-auto flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.08em] text-fg-dim"
            aria-hidden="true"
          >
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-fg-faint">format</div>
            <div className="text-xs normal-case tracking-normal text-fg">mp3 • 24 kHz</div>
          </div>
        </div>
      </div>

      <section className="panel !rounded-none !border-t-0 !bg-transparent flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-surface-0 px-6 pt-5 pb-4">
          {speech.error ? (
            <div className="rounded border border-err bg-err-bg px-3.5 py-2.5 font-mono text-xs text-err">
              {speech.error}
            </div>
          ) : null}

          {speech.entries.length > 0 ? (
            <div className="mx-auto flex w-full max-w-[920px] flex-col gap-4">
              {speech.entries.map((entry) => (
                <div key={entry.id} className="flex flex-col gap-3 rounded border border-border bg-surface-2 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-fg-faint">
                      preview
                    </span>
                    <div className="flex items-start gap-2">
                      <div className="text-right font-mono text-[11px] leading-[1.45] text-fg-dim">
                        <span>{entry.voice}</span> ·<span>{durationLabel(entry.audioDurationSec)}</span> ·
                        <span>{renderLabel(entry.renderMs)}</span> ·
                        <span>{ratioLabel(entry.renderMs, entry.audioDurationSec)}</span>
                      </div>
                      <Tooltip label="Close">
                        <button
                          type="button"
                          className="flex h-6 w-6 items-center justify-center rounded-sm bg-transparent text-fg-dim transition-[background-color,color,transform] duration-100 hover:bg-surface-1 hover:text-fg active:scale-90"
                          onClick={() => speech.removeEntry(entry.id)}
                          aria-label="Remove speech result"
                        >
                          <X className="icon-12" strokeWidth={2} />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="text-[13px] leading-[1.6] text-fg">{entry.input}</div>
                  <PlaygroundSpeechPreviewPlayer
                    key={entry.audioUrl}
                    src={entry.audioUrl}
                    durationHint={entry.audioDurationSec}
                    onDownload={() => downloadAudio(entry.audioUrl, entry.input, entry.createdAt ?? Date.now())}
                  />
                </div>
              ))}
            </div>
          ) : !speech.loading && !speech.error ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[13px] text-fg-faint">
              <Volume2 className="h-10 w-10 opacity-30" strokeWidth={1.25} />
              <span>Convert text to speech</span>
            </div>
          ) : null}
        </div>

        <form className="flex items-end gap-2 border-t border-border px-4 py-3" onSubmit={handleSubmit}>
          <textarea
            className="max-h-[200px] flex-1 resize-none overflow-hidden rounded border border-border bg-surface-1 px-3 py-2 text-[13px] leading-6 text-fg transition-[border-color,box-shadow] duration-100 ease-out focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
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
