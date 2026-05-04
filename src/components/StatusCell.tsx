import { StatusDot } from './StatusDot'
import { Tooltip } from './Tooltip'

/** Request-row status cell: HTTP code + optional SSE indicator. */
export function StatusCell({ code, streamed }: { code: number; streamed: boolean }) {
  const ok = code >= 200 && code < 300
  return (
    <span className="inline-flex items-baseline gap-1.5 leading-none">
      <StatusDot tone={ok ? 'ok' : 'err'} />
      <span className="mono tabular-nums" style={{ color: ok ? 'var(--ok)' : 'var(--err)' }}>
        {code}
      </span>
      {streamed ? (
        <Tooltip label="Server-sent events" side="top">
          <abbr className="mono tabular-nums text-[10px] text-fg-dim no-underline">SSE</abbr>
        </Tooltip>
      ) : null}
    </span>
  )
}
