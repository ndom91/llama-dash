import { Download, ImageIcon, Loader2, Trash2 } from 'lucide-react'
import { type FormEvent, useCallback } from 'react'
import { useModels } from '../lib/queries'
import { usePlaygroundImage } from '../lib/use-playground-image'

export function PlaygroundImage() {
  const img = usePlaygroundImage()
  const { data: models } = useModels()
  const localModels = models?.filter((m) => m.kind === 'local') ?? []
  const peerModels = models?.filter((m) => m.kind === 'peer') ?? []

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      img.generate()
    },
    [img.generate],
  )

  const downloadImage = useCallback((url: string, index: number) => {
    const link = document.createElement('a')
    link.href = url
    link.download = `generated-${index}.png`
    link.click()
  }, [])

  return (
    <section className="panel pg-modality-panel">
      <div className="pg-modality-settings">
        <div className="pg-settings-group">
          <label className="pg-settings-label" htmlFor="pg-img-model">
            model
          </label>
          <select
            id="pg-img-model"
            className="pg-select"
            value={img.model}
            onChange={(e) => img.setModel(e.target.value)}
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
          <label className="pg-settings-label" htmlFor="pg-img-size">
            size
          </label>
          <select id="pg-img-size" className="pg-select" value={img.size} onChange={(e) => img.setSize(e.target.value)}>
            <option value="256x256">256×256</option>
            <option value="512x512">512×512</option>
            <option value="1024x1024">1024×1024</option>
          </select>
        </div>

        {img.images.length > 0 ? (
          <button type="button" className="pg-settings-group pg-new-chat-btn" onClick={img.clearImages}>
            <Trash2 className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
            clear
          </button>
        ) : null}
      </div>

      <form className="pg-gen-form" onSubmit={handleSubmit}>
        <textarea
          className="pg-gen-input"
          placeholder={img.model ? 'Describe the image you want to generate…' : 'Select a model first…'}
          value={img.prompt}
          onChange={(e) => img.setPrompt(e.target.value)}
          disabled={!img.model}
          rows={3}
          spellCheck={false}
        />
        <button type="submit" className="btn btn-primary" disabled={!img.model || !img.prompt.trim() || img.loading}>
          {img.loading ? (
            <Loader2 className="icon-14 animate-spin" strokeWidth={2} />
          ) : (
            <ImageIcon className="icon-14" strokeWidth={2} />
          )}
          {img.loading ? 'generating…' : 'generate'}
        </button>
      </form>

      {img.error ? <div className="pg-error">{img.error}</div> : null}

      {img.images.length > 0 ? (
        <div className="pg-img-grid">
          {img.images.map((image, i) => (
            <div key={image.id} className="pg-img-card">
              <img src={image.url} alt={image.revisedPrompt ?? 'Generated image'} className="pg-img-result" />
              <button
                type="button"
                className="pg-img-download"
                onClick={() => downloadImage(image.url, i)}
                title="Download"
              >
                <Download className="icon-14" strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {!img.loading && img.images.length === 0 && !img.error ? (
        <div className="pg-empty">
          <ImageIcon className="pg-empty-icon" strokeWidth={1.25} />
          <span>Generate images from text prompts</span>
        </div>
      ) : null}
    </section>
  )
}
