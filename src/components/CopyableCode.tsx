import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../lib/cn'

export function CopyableCode({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const copy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => {},
    )
  }

  return (
    <button
      type="button"
      className="group inline-flex items-center gap-[5px] px-1.5 py-px rounded-sm bg-surface-3 border border-border font-mono text-[length:inherit] text-fg-muted cursor-pointer transition-[background,border-color] duration-150 hover:bg-surface-4 hover:border-border-strong hover:text-fg focus-visible:shadow-focus"
      onClick={copy}
      title="Click to copy"
    >
      <code className="[font:inherit]" translate="no">
        {text}
      </code>
      <span className={cn('copy-icon-swap', copied && 'copy-icon-swap-done')}>
        <Copy
          className="copy-icon-swap-from shrink-0 opacity-50 group-hover:opacity-80"
          size={12}
          strokeWidth={2}
          aria-hidden="true"
        />
        <Check className="copy-icon-swap-to shrink-0 text-ok" size={12} strokeWidth={2} aria-hidden="true" />
      </span>
    </button>
  )
}
