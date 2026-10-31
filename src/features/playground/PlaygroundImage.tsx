import { ImageIcon, Loader2, Trash2 } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useCallback } from 'react'
import { Tooltip } from '../../components/Tooltip'
import { useModels, useProviderConnections } from '../../lib/queries'
import { usePlaygroundImage } from '../../lib/use-playground-image'
import { PlaygroundDropOverlay } from './PlaygroundDropOverlay'
import { usePlaygroundFileDrop } from './use-playground-file-drop'
import { PlaygroundImageEntryCard } from './PlaygroundImageEntryCard'

export function PlaygroundImage() {
  const img = usePlaygroundImage()
  const { data: models } = useModels()
  const { data: providerConnections = [] } = useProviderConnections()
  const providerModels = providerConnections.flatMap((connection) => connection.models)
  const localModels = models?.filter((m) => m.kind === 'local') ?? []
  const peerModels = models?.filter((m) => m.kind === 'peer') ?? []
  // Text-to-image takes no file input — the drop shield only replaces the
  // browser's white drag chrome and explains where files ARE accepted.
  const { dragging, dropHandlers } = usePlaygroundFileDrop({ accepts: () => false, onFile: () => {} })

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
    <div className="relative flex min-h-0 flex-1 flex-col" {...dropHandlers}>
      <PlaygroundDropOverlay
        show={dragging}
        title="No file input in this tab"
        hint="Image generation runs from the prompt. Drop audio in Transcribe, or a text file in Speech."
      />
      <div className="border-b border-border bg-surface-1/70 px-6 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex min-w-[220px] items-center gap-3 border-r border-border pr-4">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-fg-faint">model</div>
            <select
              id="pg-img-model"
              className="select-native min-w-0 border-0 bg-transparent py-0 font-mono text-xs text-fg outline-none"
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
              {providerModels.length > 0 ? (
                <optgroup label="Providers">
                  {providerModels.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </div>

          <div className="flex min-w-[140px] items-center gap-3 border-r border-border pr-4">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-fg-faint">size</div>
            <select
              id="pg-img-size"
              className="select-native min-w-0 border-0 bg-transparent py-0 font-mono text-xs text-fg outline-none"
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
              <button
                type="button"
                className="ml-auto flex h-6 w-6 items-center justify-center rounded-sm bg-transparent text-fg-dim transition-[background-color,color,transform] duration-100 hover:bg-surface-2 hover:text-fg active:scale-[0.96]"
                onClick={img.clearEntries}
              >
                <Trash2 className="size-3.5 shrink-0" strokeWidth={2} />
              </button>
            </Tooltip>
          ) : null}
        </div>
      </div>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-surface-0 px-6 pt-5 pb-4">
          {img.error ? (
            <div className="rounded border border-err bg-err-bg px-3.5 py-2.5 font-mono text-xs text-err">
              {img.error}
            </div>
          ) : null}

          {img.entries.length > 0 ? (
            <div className="mx-auto flex w-full max-w-[920px] flex-col gap-4">
              {img.entries.map((entry) => (
                <PlaygroundImageEntryCard key={entry.id} entry={entry} onDownload={downloadImage} />
              ))}
            </div>
          ) : !img.loading && !img.error ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[13px] text-fg-faint">
              <ImageIcon className="h-10 w-10 opacity-30" strokeWidth={1.25} />
              <span>Generate images from text prompts</span>
            </div>
          ) : null}
        </div>

        <form className="flex items-end gap-2 border-t border-border px-4 py-3" onSubmit={handleSubmit}>
          <textarea
            className="max-h-[200px] flex-1 resize-none overflow-hidden rounded border border-border bg-surface-1 px-3 py-2 text-[13px] leading-6 text-fg transition-[border-color,box-shadow] duration-100 ease-out focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
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
                <Loader2 className="size-3.5 shrink-0 animate-spin" strokeWidth={2} />
              ) : (
                <ImageIcon className="size-3.5 shrink-0" strokeWidth={2} />
              )}
              <span>generate</span>
            </button>
          </Tooltip>
        </form>
      </section>
    </div>
  )
}
