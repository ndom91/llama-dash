import { Check, Clipboard } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../../lib/cn'
import { maskSensitive, prettyPrintJsonLenient, tryPrettyJson } from './requestDetailUtils'
import { RequestJsonHighlight } from './RequestJsonHighlight'
import { RequestSseEvents } from './RequestSseEvents'

type Props = {
  title: string
  subtitle: string
  body: string
  headers: Record<string, string> | null
  mode: 'pretty' | 'raw' | 'sse'
}

export function RequestPayloadPane({ title, subtitle, body, headers, mode }: Props) {
  const [copied, setCopied] = useState(false)
  // Prefer strict JSON.parse → stringify formatting. If the body won't parse
  // (most often because the truncation marker lopped off the tail), fall back
  // to the lenient token-by-token re-indenter so we still get pretty layout
  // and syntax highlighting on the surviving prefix.
  const pretty = mode === 'pretty' ? (tryPrettyJson(body) ?? prettyPrintJsonLenient(body)) : null
  const display = pretty ?? body
  const bodyContent =
    mode === 'sse' ? <RequestSseEvents body={body} /> : pretty ? <RequestJsonHighlight json={display} /> : display
  const headerEntries = headers ? Object.entries(headers) : []

  const onCopy = () => {
    navigator.clipboard.writeText(body)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section className="flex min-h-0 h-full flex-col border-r border-border last:border-r-0">
      <div className="flex min-h-10 items-center gap-2.5 border-b border-border bg-surface-1 px-4">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-fg-dim">{title}</span>
        <span className="panel-sub">{subtitle}</span>
        <div className="ml-auto" />
        <button type="button" className="btn btn-ghost btn-xs" onClick={onCopy}>
          <span className={cn('copy-icon-swap', copied && 'copy-icon-swap-done')}>
            <Clipboard className="copy-icon-swap-from icon-btn-12" strokeWidth={2} aria-hidden="true" />
            <Check className="copy-icon-swap-to icon-btn-12" strokeWidth={2} aria-hidden="true" />
          </span>
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <pre className="body-pre flex-1 min-h-[50%] border-t-0">{bodyContent}</pre>
      {headerEntries.length > 0 ? (
        <div className="headers-scroll min-h-[25%] max-h-[50%] overflow-auto border-t border-border">
          <div className="headers-scroll-head sticky top-0 z-[1] border-b border-border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim [background:color-mix(in_srgb,var(--bg-0)_72%,var(--bg-1))]">
            Headers
          </div>
          <table className="dtable headers-table">
            <tbody>
              {headerEntries.map(([k, v]) => (
                <tr key={k}>
                  <td className="mono header-key">{k}</td>
                  <td className="mono header-value">{maskSensitive(k, v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}
