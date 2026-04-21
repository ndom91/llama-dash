import { Check, Copy, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Tooltip } from '../../components/Tooltip'
import { cn } from '../../lib/cn'
import type { ApiKeyCreated } from '../../lib/api'

type Props = {
  created: ApiKeyCreated
  onDismiss: () => void
}

export function KeyCreatedBanner({ created, onDismiss }: Props) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(() => {
    navigator.clipboard.writeText(created.rawKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [created.rawKey])

  return (
    <div className="mx-6 mt-3 rounded border border-ok bg-ok-bg px-4 py-3 max-md:mx-3">
      <div className="mb-2 flex items-center gap-2 text-[13px]">
        <Check size={16} strokeWidth={2} style={{ color: 'var(--ok)' }} />
        <strong>Key created — copy it now, it won't be shown again</strong>
        <button type="button" className="btn btn-ghost btn-icon" onClick={onDismiss} style={{ marginLeft: 'auto' }}>
          <X size={14} strokeWidth={2} />
        </button>
      </div>
      <div className="flex items-center gap-2 rounded-sm border border-border bg-surface-1 px-3 py-2">
        <code className="mono flex-1 break-all text-xs">{created.rawKey}</code>
        <Tooltip label={copied ? 'Copied' : 'Copy'}>
          <button type="button" className="btn btn-ghost btn-icon" onClick={copy}>
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
