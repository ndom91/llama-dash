import { Download } from 'lucide-react'
import { Tooltip } from '../../components/Tooltip'
import type { ImageEntry } from '../../lib/use-playground-image'

type Props = {
  entry: ImageEntry
  onDownload: (url: string, index: number) => void
}

export function PlaygroundImageEntryCard({ entry, onDownload }: Props) {
  return (
    <div className="pg-img-entry">
      <div className="pg-img-entry-prompt">{entry.prompt}</div>
      <div className="pg-img-grid">
        {entry.images.map((image, index) => (
          <div key={image.url} className="pg-img-card">
            <img src={image.url} alt={image.revisedPrompt ?? 'Generated image'} className="pg-img-result" />
            <Tooltip label="Download">
              <button type="button" className="pg-img-download" onClick={() => onDownload(image.url, index)}>
                <Download className="icon-14" strokeWidth={2} />
              </button>
            </Tooltip>
          </div>
        ))}
      </div>
    </div>
  )
}
