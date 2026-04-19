import { Download, Loader2, Volume2 } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useCallback } from 'react'
import { useModels } from '../lib/queries'
import { usePlaygroundSpeech } from '../lib/use-playground-speech'

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

  return (
    <>
      <div className="pg-settings">
        <div className="pg-settings-row">
          <div className="pg-settings-group">
            <label className="pg-settings-label" htmlFor="pg-speech-model">
              model
            </label>
            <select
              id="pg-speech-model"
              className="pg-select"
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

          <div className="pg-settings-group">
            <label className="pg-settings-label" htmlFor="pg-speech-voice">
              voice
            </label>
            {speech.voices ? (
              <select
                id="pg-speech-voice"
                className="pg-select"
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
                className="pg-voice-input"
                placeholder="voice name…"
                value={speech.voice}
                onChange={(e) => speech.setVoice(e.target.value)}
              />
            )}
          </div>
        </div>
      </div>

      <section className="panel pg-chat-panel">
        <div className="pg-chat-scroll pg-center-content">
          {speech.error ? <div className="pg-error">{speech.error}</div> : null}

          {speech.audioUrl ? (
            <div className="pg-audio-result">
              {/* biome-ignore lint/a11y/useMediaCaption: generated speech has no caption source */}
              <audio src={speech.audioUrl} controls className="pg-audio-player" />
              <button type="button" className="btn btn-ghost btn-xs" onClick={downloadAudio}>
                <Download className="icon-12" strokeWidth={2} />
                download
              </button>
            </div>
          ) : !speech.loading && !speech.error ? (
            <div className="pg-empty">
              <Volume2 className="pg-empty-icon" strokeWidth={1.25} />
              <span>Convert text to speech</span>
            </div>
          ) : null}
        </div>

        <form className="pg-input-bar" onSubmit={handleSubmit}>
          <textarea
            className="pg-input"
            placeholder={speech.model ? 'Enter text to speak…' : 'Select a model first…'}
            value={speech.text}
            onChange={(e) => speech.setText(e.target.value)}
            disabled={!speech.model}
            rows={1}
            onKeyDown={handleKeyDown}
            onInput={(e) => autoResize(e.currentTarget)}
            spellCheck={false}
          />
          <button
            type="submit"
            className="pg-send-btn"
            disabled={!speech.model || !speech.text.trim() || speech.loading}
            title="Generate speech"
          >
            {speech.loading ? (
              <Loader2 className="icon-14 animate-spin" strokeWidth={2} />
            ) : (
              <Volume2 className="icon-14" strokeWidth={2} />
            )}
          </button>
        </form>
      </section>
    </>
  )
}
