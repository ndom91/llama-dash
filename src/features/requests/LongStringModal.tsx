import { X } from 'lucide-react'
import { useEffect } from 'react'
import { CopyButton } from '../../components/CopyButton'

type Props = {
  text: string
  onClose: () => void
}

export function LongStringModal({ text, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex w-[min(90vw,720px)] max-h-[80vh] flex-col overflow-hidden rounded-lg border border-border bg-surface-1 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border bg-surface-0 px-4 py-2.5">
          <span className="flex-1 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-fg-dim">
            String content
          </span>
          <CopyButton text={text} variant="button" icon="clipboard" ariaLabel="Copy string content" />
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <pre className="m-0 flex-1 overflow-auto border-t-0 px-4 py-3 font-mono text-[12px] leading-[1.6] whitespace-pre-wrap break-words text-fg">
          {text}
        </pre>
      </div>
    </div>
  )
}
