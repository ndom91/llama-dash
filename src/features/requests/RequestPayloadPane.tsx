import { ChevronRight, List } from 'lucide-react'
import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { CopyButton } from '../../components/CopyButton'
import { cn } from '../../lib/cn'
import { useStickyToggle } from '../../lib/use-sticky-toggle'
import { ParsedPayloadBlocks } from './ParsedPayloadBlocks'
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
  /** 'request' or 'response' — drives parsed payload block layout. */
  direction?: 'request' | 'response'
  sseStream?: ParsedSseStream | null
  assembledReasoning?: string | null
  assembledResponse?: string | null
  assembledToolCalls?: string | null
  assembledCitations?: string | null
}

export function RequestPayloadPane({
  title,
  subtitle,
  body,
  headers,
  mode,
  direction = 'request',
  sseStream = null,
  assembledReasoning = null,
  assembledResponse = null,
  assembledToolCalls = null,
  assembledCitations = null,
}: Props) {
  const hasBody = body.trim().length > 0
  const hasAssembled = Boolean(assembledReasoning || assembledResponse)
  const showPayload = hasBody || (mode === 'sse' && hasAssembled)
  const scrollRef = useRef<HTMLDivElement>(null)
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
    if (mode === 'sse') {
      return (
        <RequestSseEvents
          body={deferredBody}
          stream={sseStream}
          assembledReasoning={assembledReasoning}
          assembledResponse={assembledResponse}
          assembledToolCalls={assembledToolCalls}
          assembledCitations={assembledCitations}
        />
      )
    }
    if (mode === 'pretty') {
      const parsed = (
        <ParsedPayloadBlocks
          body={deferredBody}
          direction={direction}
          baseKey={`${title.toLowerCase()}-${deferredBody.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '-')}`}
        />
      )
      const hasParsed = deferredBody.trim().length > 0 && deferredBody.trim().startsWith('{')
      return hasParsed ? (
        parsed
      ) : (
        <RequestJsonHighlight
          json={pretty ?? deferredBody}
          getScrollElement={() => scrollRef.current}
          className="!h-auto !max-h-none !overflow-visible"
        />
      )
    }
    return deferredBody
  }, [
    assembledReasoning,
    assembledResponse,
    assembledToolCalls,
    assembledCitations,
    deferredBody,
    direction,
    mode,
    pretty,
    sseStream,
    title,
  ])
  const headerEntries = useMemo(() => (deferredHeaders ? Object.entries(deferredHeaders) : []), [deferredHeaders])
  const groupedHeaders = useMemo(() => groupHeaders(headerEntries), [headerEntries])

  return (
    <section className="request-payload-pane flex h-full min-h-0 min-w-0 flex-col border-r border-border last:border-r-0">
      <div className="flex min-h-10 min-w-0 shrink-0 items-center gap-2.5 border-b border-border bg-surface-1 px-4 max-[1200px]:px-3">
        <span className="shrink-0 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-fg-dim">
          {title}
        </span>
        <span className="panel-sub min-w-0 truncate">{subtitle}</span>
        <div className="ml-auto" />
        <CopyButton text={body} variant="button" icon="clipboard" ariaLabel={`Copy ${title} payload`} />
      </div>

      <div ref={scrollRef} className="payload-body-scroll min-h-0 flex-1 overflow-auto">
        {headerEntries.length > 0 ? (
          <HeadersSection groupedHeaders={groupedHeaders} storageKey={`${title.toLowerCase()}-headers-open`} />
        ) : null}

        {showPayload ? (
          mode === 'sse' || mode === 'pretty' ? (
            bodyContent
          ) : (
            <pre className={cn('body-pre border-t-0', '!h-auto !max-h-none !overflow-visible')}>{bodyContent}</pre>
          )
        ) : (
          <pre className={cn('body-pre border-t-0', 'overflow-hidden py-4')}>
            <span className="text-fg-faint">No body payload</span>
          </pre>
        )}
      </div>
    </section>
  )
}

function HeadersSection({
  groupedHeaders,
  storageKey,
}: {
  groupedHeaders: ReturnType<typeof groupHeaders>
  storageKey: string
}) {
  const [open, toggleOpen] = useStickyToggle(storageKey, false)
  const [showBoilerplate, setShowBoilerplate] = useState(false)
  const count = groupedHeaders.primary.length + groupedHeaders.boilerplate.length
  return (
    <div className="overflow-hidden border-t border-border text-xs">
      <div className="flex w-full items-center bg-surface-0">
        <button
          type="button"
          className="flex flex-1 items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-fg-dim hover:bg-surface-1"
          onClick={toggleOpen}
        >
          <ChevronRight
            className={cn('size-3 shrink-0 transition-transform duration-150', open && 'rotate-90')}
            strokeWidth={2}
          />
          <List size={12} strokeWidth={2} aria-hidden="true" />
          <span>headers</span>
          <span className="ml-auto dim normal-case tracking-normal">({count})</span>
        </button>
      </div>
      {open ? (
        <div className="border-t border-border">
          <table className="dtable headers-table">
            <tbody>
              {groupedHeaders.primary.map(([k, v]) => (
                <tr key={k}>
                  <td className="mono header-key">{k}</td>
                  <td className="mono header-value">{maskSensitive(k, v)}</td>
                </tr>
              ))}
              {showBoilerplate
                ? groupedHeaders.boilerplate.map(([k, v]) => (
                    <tr key={k}>
                      <td className="mono header-key header-key-muted">{k}</td>
                      <td className="mono header-value">{maskSensitive(k, v)}</td>
                    </tr>
                  ))
                : null}
              {groupedHeaders.boilerplate.length > 0 ? (
                <tr>
                  <td colSpan={2} className="!py-1.5">
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => setShowBoilerplate((prev) => !prev)}
                      aria-expanded={showBoilerplate}
                    >
                      {showBoilerplate ? 'hide' : 'show'} {groupedHeaders.boilerplate.length} browser{' '}
                      {groupedHeaders.boilerplate.length === 1 ? 'header' : 'headers'}
                    </button>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
