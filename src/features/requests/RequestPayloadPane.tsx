import { Check, Clipboard } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import type { ParsedSseStream } from './requestDetailUtils'
import { maskSensitive, prettyPrintJsonLenient, tryPrettyJson } from './requestDetailUtils'
import { RequestJsonHighlight } from './RequestJsonHighlight'
import { RequestSseEvents } from './RequestSseEvents'

type Props = {
  title: string
  subtitle: string
  body: string
  headers: Record<string, string> | null
  mode: 'pretty' | 'raw' | 'sse'
  sseStream?: ParsedSseStream | null
}

export function RequestPayloadPane({ title, subtitle, body, headers, mode, sseStream = null }: Props) {
  const [copied, setCopied] = useState(false)
  const hasBody = body.trim().length > 0
  const deferredBody = useDeferredValue(body)
  const deferredHeaders = useDeferredValue(headers)

  // Prefer strict JSON.parse → stringify formatting. If the body won't parse
  // (most often because the truncation marker lopped off the tail), fall back
  // to the lenient token-by-token re-indenter so we still get pretty layout
  // and syntax highlighting on the surviving prefix.
  const pretty = useMemo(
    () => (mode === 'pretty' ? (tryPrettyJson(deferredBody) ?? prettyPrintJsonLenient(deferredBody)) : null),
    [deferredBody, mode],
  )
  const bodyContent = useMemo(() => {
    if (mode === 'sse') return <RequestSseEvents body={deferredBody} stream={sseStream} />
    if (pretty) return <RequestJsonHighlight json={pretty} className="flex-1" />
    return deferredBody
  }, [deferredBody, mode, pretty, sseStream])
  const headerEntries = useMemo(() => (deferredHeaders ? Object.entries(deferredHeaders) : []), [deferredHeaders])
  const usesCustomPrettyBody = pretty != null

  const onCopy = () => {
    navigator.clipboard.writeText(body)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section className="request-payload-pane flex min-h-0 h-full flex-col border-r border-border last:border-r-0">
      <div className="flex min-h-10 items-center gap-2.5 border-b border-border bg-surface-1 px-4">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-fg-dim">{title}</span>
        <span className="panel-sub">{subtitle}</span>
        <div className="ml-auto" />
        <button type="button" className="btn btn-ghost btn-xs" onClick={onCopy} aria-label={`Copy ${title} payload`}>
          <span className={cn('copy-icon-swap', copied && 'copy-icon-swap-done')}>
            <Clipboard className="copy-icon-swap-from icon-btn-12" strokeWidth={2} aria-hidden="true" />
            <Check className="copy-icon-swap-to icon-btn-12" strokeWidth={2} aria-hidden="true" />
          </span>
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      {hasBody ? (
        usesCustomPrettyBody ? (
          <div className="flex flex-1 min-h-[50%] min-w-0">{bodyContent}</div>
        ) : (
          <pre className={cn('body-pre border-t-0', 'flex-1 min-h-[50%]')}>{bodyContent}</pre>
        )
      ) : (
        <pre className={cn('body-pre border-t-0', 'h-14 flex-none overflow-hidden py-4')}>
          <span className="text-fg-faint">No body payload</span>
        </pre>
      )}
      {headerEntries.length > 0 ? (
        <div
          className={cn(
            'headers-scroll overflow-auto border-t border-border',
            hasBody ? 'min-h-[25%] max-h-[50%]' : 'min-h-0 flex-1 max-h-none',
          )}
        >
          <div className="headers-scroll-head sticky top-0 z-[1] border-b border-border bg-surface-0 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-dim">
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
