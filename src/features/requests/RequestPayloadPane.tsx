import { Check, Clipboard } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../../lib/cn'
import { maskSensitive, tryPrettyJson } from './requestDetailUtils'
import { RequestJsonHighlight } from './RequestJsonHighlight'

type Props = {
  title: string
  subtitle: string
  body: string
  headers: Record<string, string> | null
  mode: 'pretty' | 'raw'
}

export function RequestPayloadPane({ title, subtitle, body, headers, mode }: Props) {
  const [copied, setCopied] = useState(false)
  const pretty = mode === 'pretty' ? tryPrettyJson(body) : null
  const display = pretty ?? body
  const headerEntries = headers ? Object.entries(headers) : []

  const onCopy = () => {
    navigator.clipboard.writeText(body)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section className="flex min-h-0 h-full flex-col border-r border-border last:border-r-0">
      <div className="flex min-h-10 items-center gap-2.5 border-b border-border bg-surface-1 px-3">
        <span className="panel-title">{title}</span>
        <span className="panel-sub">{subtitle}</span>
        <div className="ml-auto inline-flex gap-1">
          <span
            className={cn(
              'rounded-[3px] border border-transparent px-1.5 py-0.5 font-mono text-[10px] text-fg-dim',
              mode === 'pretty' && 'border-border-strong bg-surface-3 text-fg',
            )}
          >
            pretty
          </span>
          <span
            className={cn(
              'rounded-[3px] border border-transparent px-1.5 py-0.5 font-mono text-[10px] text-fg-dim',
              mode === 'raw' && 'border-border-strong bg-surface-3 text-fg',
            )}
          >
            raw
          </span>
        </div>
        <button type="button" className="btn btn-ghost btn-xs" onClick={onCopy}>
          <span className={cn('copy-icon-swap', copied && 'copy-icon-swap-done')}>
            <Clipboard className="copy-icon-swap-from icon-btn-12" strokeWidth={2} aria-hidden="true" />
            <Check className="copy-icon-swap-to icon-btn-12" strokeWidth={2} aria-hidden="true" />
          </span>
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <pre className="body-pre flex-1 min-h-[50%] border-t-0">
        {pretty ? <RequestJsonHighlight json={display} /> : display}
      </pre>
      {headerEntries.length > 0 ? (
        <div className="min-h-[25%] max-h-[50%] overflow-auto border-t border-border">
          <div className="px-3 pt-2.5 pb-0 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">Headers</div>
          <table className="dtable headers-table">
            <tbody>
              {headerEntries.map(([k, v]) => (
                <tr key={k}>
                  <td className="mono header-key">{k}</td>
                  <td className="mono">{maskSensitive(k, v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}
