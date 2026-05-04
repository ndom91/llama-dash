import { Check, Copy, Link } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../lib/cn'

type CopyButtonVariant = 'text' | 'icon' | 'button'
type CopyButtonIcon = 'copy' | 'clipboard' | 'link'

type Props = {
  text: string
  label?: string
  copiedLabel?: string
  ariaLabel?: string
  variant?: CopyButtonVariant
  icon?: CopyButtonIcon
  className?: string
}

const variantClasses: Record<CopyButtonVariant, string> = {
  text: 'inline-flex items-center gap-1 rounded-sm border border-transparent px-1.5 py-1 text-[11px] text-fg-dim transition-[background-color,border-color,color,transform] hover:border-border hover:bg-surface-2 hover:text-fg active:scale-[0.97] focus-visible:outline-none focus-visible:shadow-focus',
  icon: 'flex h-6 w-6 items-center justify-center rounded-sm bg-transparent text-fg-dim transition-[background-color,color,transform] duration-100 hover:bg-surface-1 hover:text-fg active:scale-90 focus-visible:outline-none focus-visible:shadow-focus',
  button: 'btn btn-ghost btn-sm',
}

export function CopyButton({
  text,
  label = 'copy',
  copiedLabel = 'copied',
  ariaLabel,
  variant = 'text',
  icon = 'copy',
  className,
}: Props) {
  const [copied, setCopied] = useState(false)
  const Icon = icon === 'link' ? Link : Copy

  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <button type="button" className={cn(variantClasses[variant], className)} onClick={copy} aria-label={ariaLabel}>
      <span className={cn('copy-icon-swap', copied && 'copy-icon-swap-done')}>
        <Icon
          className={cn('copy-icon-swap-from', icon === 'clipboard' ? 'icon-btn-12' : 'icon-12')}
          strokeWidth={2}
          aria-hidden="true"
        />
        <Check className="copy-icon-swap-to icon-12 text-ok" strokeWidth={2} aria-hidden="true" />
      </span>
      {variant === 'icon' ? null : copied ? copiedLabel : label}
    </button>
  )
}
