import { StatusDot } from './StatusDot'

/** Request-row status cell: HTTP code + optional SSE indicator. */
export function StatusCell({ code, streamed }: { code: number; streamed: boolean }) {
  const ok = code >= 200 && code < 300
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <StatusDot tone={ok ? 'ok' : 'err'} />
      <span className="mono" style={{ color: ok ? 'var(--ok)' : 'var(--err)' }}>
        {code}
      </span>
      {streamed ? (
        <abbr
          className="mono"
          style={{ color: 'var(--fg-dim)', fontSize: 10, textDecoration: 'none' }}
          title="Server-sent events"
        >
          SSE
        </abbr>
      ) : null}
    </span>
  )
}
