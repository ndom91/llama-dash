import { Download } from 'lucide-react'
import { Tooltip } from '../../components/Tooltip'
import type { ImageEntry } from '../../lib/use-playground-image'

type Props = {
  entry: ImageEntry
  onDownload: (url: string, index: number) => void
}

export function PlaygroundImageEntryCard({ entry, onDownload }: Props) {
  return (
    <div className="flex flex-col gap-3 rounded border border-border bg-surface-2 p-3">
      <div className="font-mono text-[11px] leading-[1.5] text-fg-dim">{entry.prompt}</div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
        {entry.images.map((image, index) => (
          <div key={image.url} className="group relative overflow-hidden rounded border border-border bg-surface-1">
            <img
              src={image.url}
              alt={image.revisedPrompt ?? 'Generated image'}
              className="block aspect-square h-auto w-full object-cover"
            />
            <Tooltip label="Download">
              <button
                type="button"
                className="absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded bg-surface-0/85 text-fg opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-0"
                onClick={() => onDownload(image.url, index)}
              >
                <Download className="icon-14" strokeWidth={2} />
              </button>
            </Tooltip>
          </div>
        ))}
      </div>
    </div>
  )
}
