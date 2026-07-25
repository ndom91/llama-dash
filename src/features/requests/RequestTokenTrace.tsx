import { formatDuration } from './requestDetailUtils'

type Props = {
  durationMs: number
  completionTokens: number
  tokPerSec: number | null
  prefillMs: number | null
  decodeMs: number | null
}

export function RequestTokenTrace({ durationMs, completionTokens, tokPerSec, prefillMs, decodeMs }: Props) {
  // The bar previously had a hard-coded `w-full` and an infinite 4.2s gradient
  // sweep, so a request that finished minutes ago animated forever as though
  // tokens were still arriving — decoration standing in for data, while the real
  // phase split the parent already computed was never passed in. Now the
  // segments are proportional to measured prefill and decode time, and the
  // remainder (queue, network, stream teardown) shows as untinted track.
  const hasPhases = durationMs > 0 && (prefillMs != null || decodeMs != null)
  const prefillPct = prefillMs != null && hasPhases ? Math.max(0, Math.min(100, (prefillMs / durationMs) * 100)) : 0
  const decodePct =
    decodeMs != null && hasPhases ? Math.max(0, Math.min(100 - prefillPct, (decodeMs / durationMs) * 100)) : 0

  return (
    <section className="panel !rounded-none !border-l-0 !border-r border-r-border border-b-1 !bg-surface-1">
      <div className="panel-head bg-surface-1 px-4">
        <span className="panel-title">Stream</span>
        <span className="panel-sub">· token trace</span>
        <span className="panel-sub ml-auto tabular-nums">
          {completionTokens.toLocaleString()} tokens · {tokPerSec ?? '—'} tok/s
        </span>
      </div>
      <div className="px-4 py-3">
        {hasPhases ? (
          <div className="flex h-2 overflow-hidden rounded bg-surface-3" aria-hidden="true">
            <div style={{ width: `${prefillPct}%`, background: 'var(--series-2)' }} />
            <div style={{ width: `${decodePct}%`, background: 'var(--series-4)' }} />
          </div>
        ) : null}
        <div
          className={`flex flex-wrap justify-between gap-x-4 gap-y-1 font-mono tabular-nums text-[11px] text-fg-dim${
            hasPhases ? ' mt-2' : ''
          }`}
        >
          {hasPhases ? (
            <>
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-sm"
                  style={{ background: 'var(--series-2)' }}
                  aria-hidden="true"
                />
                prefill {prefillMs != null ? formatDuration(prefillMs) : '—'}
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-sm"
                  style={{ background: 'var(--series-4)' }}
                  aria-hidden="true"
                />
                decode {decodeMs != null ? formatDuration(decodeMs) : '—'}
              </span>
            </>
          ) : (
            <span>no upstream phase timings</span>
          )}
          <span>eos {formatDuration(durationMs)}</span>
        </div>
      </div>
    </section>
  )
}
