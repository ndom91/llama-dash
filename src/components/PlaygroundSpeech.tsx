import { Download, Loader2, Volume2 } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useCallback } from 'react'
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

  const downloadAudio = useCallback(() => {
    if (!speech.audioUrl) return
    const link = document.createElement('a')
    link.href = speech.audioUrl
    link.download = 'speech.mp3'
    link.click()
  }, [speech.audioUrl])

  const renderLabel = speech.renderMs != null ? `${(speech.renderMs / 1000).toFixed(1)} s render` : '— render'
  const ratioLabel =
    speech.renderMs != null && speech.audioDurationSec != null && speech.renderMs > 0
      ? `${(speech.audioDurationSec / (speech.renderMs / 1000)).toFixed(1)}× real-time`
      : '— real-time'
  const previewMeta =
    speech.audioDurationSec != null
      ? `${speech.voice || 'default'} • ${formatClock(speech.audioDurationSec)}`
      : `${speech.voice || 'default'} • --:--.-`

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

          <div className="pg-speech-controls-meta" aria-hidden="true">
            <span>{renderLabel}</span>
            <span>{ratioLabel}</span>
          </div>
        </div>
      </div>

      <section className="panel pg-chat-panel pg-compact-panel pg-compact-surface">
        <div className="pg-chat-scroll pg-speech-stage">
          {speech.error ? <div className="pg-error">{speech.error}</div> : null}

          {speech.audioUrl ? (
            <div className="pg-speech-stack">
              <div className="pg-speech-preview-card">
                <div className="pg-speech-preview-head">
                  <span className="pg-settings-label">preview</span>
                  <span className="pg-speech-preview-meta">{previewMeta}</span>
                </div>
                <div className="pg-speech-preview-player pg-speech-preview-player-simple">
                  {/* biome-ignore lint/a11y/useMediaCaption: generated speech has no caption source */}
                  <audio src={speech.audioUrl} controls className="pg-audio-player" />
                  <Tooltip label="Download">
                    <button type="button" className="pg-action-btn" onClick={downloadAudio}>
                      <Download className="icon-14" strokeWidth={2} />
                    </button>
                  </Tooltip>
                </div>
              </div>
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
            className="pg-input pg-speech-prompt-input"
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
              className="btn btn-primary pg-speech-generate-btn"
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
