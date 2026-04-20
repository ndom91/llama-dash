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
