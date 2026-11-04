import { Check, Copy, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Tooltip } from '../../components/Tooltip'
import { cn } from '../../lib/cn'
import { useCopyToClipboard } from '../../lib/use-copy-to-clipboard'

type Props = {
  rawKey: string
  message: string
  icon: ReactNode
  className: string
  onDismiss: () => void
  dismissLabel?: string
  copyLabel?: string
  copiedLabel?: string
}

export function KeyCreatedBanner({
  rawKey,
  message,
  icon,
  className,
  onDismiss,
  dismissLabel,
  copyLabel,
  copiedLabel,
}: Props) {
  const { copied, copy } = useCopyToClipboard(2000)

  return (
    <div className={cn('rounded border border-ok bg-ok-bg px-4 py-3', className)}>
      <div className="mb-2 flex items-center gap-2 text-[13px]">
        {icon}
        <strong>{message}</strong>
        <button type="button" className="btn btn-ghost btn-icon ml-auto" onClick={onDismiss} aria-label={dismissLabel}>
          <X size={14} strokeWidth={2} />
        </button>
      </div>
      <div className="flex items-center gap-2 rounded-sm border border-border bg-surface-1 px-3 py-2">
        <code className="mono flex-1 break-all text-xs">{rawKey}</code>
        <Tooltip label={copied ? 'Copied' : 'Copy'}>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => void copy(rawKey)}
            aria-label={copied ? copiedLabel : copyLabel}
          >
            <span className={cn('copy-icon-swap', copied && 'copy-icon-swap-done')}>
              <Copy className="copy-icon-swap-from" size={14} strokeWidth={2} />
              <Check className="copy-icon-swap-to text-ok" size={14} strokeWidth={2} />
            </span>
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
