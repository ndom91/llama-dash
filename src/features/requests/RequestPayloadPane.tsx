import { ChevronDown } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { CopyButton } from '../../components/CopyButton'
import { cn } from '../../lib/cn'
import type { ParsedSseStream } from './requestDetailUtils'
import { groupHeaders, maskSensitive, prettyPrintJsonLenient, tryPrettyJson } from './requestDetailUtils'
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
  const groupedHeaders = useMemo(() => groupHeaders(headerEntries), [headerEntries])
  const [showBoilerplate, setShowBoilerplate] = useState(false)
  const usesCustomPrettyBody = pretty != null

  return (
    <section className="request-payload-pane flex h-full min-h-0 min-w-0 flex-col border-r border-border last:border-r-0">
      <div className="flex min-h-10 min-w-0 items-center gap-2.5 border-b border-border bg-surface-1 px-4 max-[1200px]:px-3">
        <span className="shrink-0 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-fg-dim">
          {title}
        </span>
        <span className="panel-sub min-w-0 truncate">{subtitle}</span>
        <div className="ml-auto" />
        <CopyButton text={body} variant="button" icon="clipboard" ariaLabel={`Copy ${title} payload`} />
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
              {groupedHeaders.primary.map(([k, v]) => (
                <tr key={k}>
                  <td className="mono header-key">{k}</td>
                  <td className="mono header-value">{maskSensitive(k, v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {groupedHeaders.boilerplate.length > 0 ? (
            <div className="t-acc border-t border-border" data-open={showBoilerplate}>
              <button
                type="button"
                className="t-acc-head flex w-full items-center gap-1.5 bg-surface-0 px-3.5 py-1.5 text-left"
                onClick={() => setShowBoilerplate((prev) => !prev)}
                aria-expanded={showBoilerplate}
                aria-controls={`request-${title}-browser-headers`}
              >
                <span className="t-acc-chevron">
                  <ChevronDown className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="font-mono text-[11px] text-fg-dim">
                  {showBoilerplate ? 'hide' : 'show'} {groupedHeaders.boilerplate.length} browser{' '}
                  {groupedHeaders.boilerplate.length === 1 ? 'header' : 'headers'}
                </span>
              </button>
              <div id={`request-${title}-browser-headers`} className="t-acc-panel" aria-hidden={!showBoilerplate}>
                <div className="t-acc-panel-inner">
                  <table className="dtable headers-table">
                    <tbody>
                      {groupedHeaders.boilerplate.map(([k, v]) => (
                        <tr key={k}>
                          <td className="mono header-key header-key-muted">{k}</td>
                          <td className="mono header-value">{maskSensitive(k, v)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
