import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../../lib/cn'

type Props = {
  text: string
}

export function PlaygroundCopyButton({ text }: Props) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-sm border border-transparent px-1.5 py-1 text-[11px] text-fg-dim transition-[background-color,border-color,color,transform] hover:border-border hover:bg-surface-2 hover:text-fg active:scale-[0.97] focus-visible:outline-none focus-visible:shadow-focus"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        })
      }}
    >
      <span className={cn('copy-icon-swap', copied && 'copy-icon-swap-done')}>
        <Copy className="copy-icon-swap-from icon-12" strokeWidth={2} />
        <Check className="copy-icon-swap-to icon-12 text-ok" strokeWidth={2} />
      </span>
      copy
    </button>
  )
}
