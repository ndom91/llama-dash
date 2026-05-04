import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../lib/cn'
import { Tooltip } from './Tooltip'

type CopyableCodeSize = 's' | 'm' | 'l'

type Props = {
  text: string
  size?: CopyableCodeSize
}

const sizeClasses: Record<CopyableCodeSize, string> = {
  s: 'inline-flex gap-[5px] rounded-sm px-1.5 py-px text-[length:inherit] active:scale-[0.97]',
  m: 'flex w-full gap-2 rounded px-3 py-1.5 text-xs active:scale-[0.985]',
  l: 'flex h-8 w-full gap-2.5 rounded px-3 text-sm active:scale-[0.99]',
}

export function CopyableCode({ text, size = 's' }: Props) {
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
        className={cn(
          'group cursor-pointer items-center border border-border bg-surface-3 font-mono text-fg-muted transition-[background,border-color,color,transform] duration-150 hover:border-border-strong hover:bg-surface-4 hover:text-fg focus-visible:shadow-focus',
          sizeClasses[size],
        )}
        onClick={copy}
      >
        <code className="min-w-0 flex-1 truncate text-left [font:inherit]" translate="no">
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
