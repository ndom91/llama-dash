import { StatusDot } from './StatusDot'

/** Request-row status cell: HTTP code + optional SSE indicator. */
export function StatusCell({ code, streamed }: { code: number; streamed: boolean }) {
  const ok = code >= 200 && code < 300
  return (
    <span className="inline-flex items-center gap-1.5 leading-none">
      <StatusDot tone={ok ? 'ok' : 'err'} />
      <span className="mono tabular-nums leading-none" style={{ color: ok ? 'var(--ok)' : 'var(--err)' }}>
        {code}
      </span>
      {streamed ? (
        <abbr className="mono text-[10px] leading-none text-fg-dim no-underline" title="Server-sent events">
          SSE
        </abbr>
      ) : null}
    </span>
  )
}
