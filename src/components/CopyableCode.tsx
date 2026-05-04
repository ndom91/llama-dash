import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../lib/cn'
import { Tooltip } from './Tooltip'

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
    <Tooltip label={copied ? 'Copied' : 'Click to copy'} side="top">
      <button
        type="button"
        className="group inline-flex cursor-pointer items-center gap-[5px] rounded-sm border border-border bg-surface-3 px-1.5 py-px font-mono text-[length:inherit] text-fg-muted transition-[background,border-color,color,transform] duration-150 active:scale-[0.97] hover:border-border-strong hover:bg-surface-4 hover:text-fg focus-visible:shadow-focus"
        onClick={copy}
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
    </Tooltip>
  )
}
