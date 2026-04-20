import { ImageIcon, Loader2, Trash2 } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useCallback } from 'react'
import { Tooltip } from '../../components/Tooltip'
import { useModels } from '../../lib/queries'
import { usePlaygroundImage } from '../../lib/use-playground-image'
import { PlaygroundImageEntryCard } from './PlaygroundImageEntryCard'

export function PlaygroundImage() {
  const img = usePlaygroundImage()
  const { data: models } = useModels()
  const localModels = models?.filter((m) => m.kind === 'local') ?? []
  const peerModels = models?.filter((m) => m.kind === 'peer') ?? []

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      if (!img.prompt.trim()) return
      img.generate()
      img.setPrompt('')
    },
    [img.generate, img.prompt, img.setPrompt],
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

  const downloadImage = useCallback((url: string, index: number) => {
    const link = document.createElement('a')
    link.href = url
    link.download = `generated-${index}.png`
    link.click()
  }, [])

  return (
    <div className="pg-compact-shell">
      <div className="pg-settings pg-compact-settings">
        <div className="pg-settings-row pg-img-controls-row">
          <div className="pg-img-control-block">
            <div className="pg-img-control-label">model</div>
            <select
              id="pg-img-model"
              className="pg-select pg-img-toolbar-select"
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

          <div className="pg-img-control-block">
            <div className="pg-img-control-label">size</div>
            <select
              id="pg-img-size"
              className="pg-select pg-img-toolbar-select"
              value={img.size}
              onChange={(e) => img.setSize(e.target.value)}
            >
              <option value="256x256">256×256</option>
              <option value="512x512">512×512</option>
              <option value="1024x1024">1024×1024</option>
            </select>
          </div>

          {img.entries.length > 0 ? (
            <Tooltip label="Clear">
              <button type="button" className="pg-action-btn pg-img-clear" onClick={img.clearEntries}>
                <Trash2 className="icon-14" strokeWidth={2} />
              </button>
            </Tooltip>
          ) : null}
        </div>
      </div>

      <section className="panel pg-chat-panel pg-compact-panel pg-compact-surface">
        <div className="pg-chat-scroll pg-img-stage">
          {img.error ? <div className="pg-error">{img.error}</div> : null}

          {img.entries.length > 0 ? (
            <div className="pg-img-entries">
              {img.entries.map((entry) => (
                <PlaygroundImageEntryCard key={entry.id} entry={entry} onDownload={downloadImage} />
              ))}
            </div>
          ) : !img.loading && !img.error ? (
            <div className="pg-empty">
              <ImageIcon className="pg-empty-icon" strokeWidth={1.25} />
              <span>Generate images from text prompts</span>
            </div>
          ) : null}
        </div>

        <form className="pg-input-bar pg-img-prompt-bar" onSubmit={handleSubmit}>
          <textarea
            className="pg-input rounded!"
            placeholder={img.model ? 'Describe the image…' : 'Select a model first…'}
            value={img.prompt}
            onChange={(e) => img.setPrompt(e.target.value)}
            disabled={!img.model}
            rows={1}
            onKeyDown={handleKeyDown}
            onInput={(e) => autoResize(e.currentTarget)}
            spellCheck={false}
          />
          <Tooltip label="Generate image">
            <button
              type="submit"
              className="btn btn-primary btn-md"
              disabled={!img.model || !img.prompt.trim() || img.loading}
            >
              {img.loading ? (
                <Loader2 className="icon-14 animate-spin" strokeWidth={2} />
              ) : (
                <ImageIcon className="icon-14" strokeWidth={2} />
              )}
              <span>generate</span>
            </button>
          </Tooltip>
        </form>
      </section>
    </div>
  )
}
