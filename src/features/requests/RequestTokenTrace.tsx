import { Tooltip } from '../../components/Tooltip'
import { formatDuration } from './requestDetailUtils'

type Props = {
  durationMs: number
  completionTokens: number | null
  streamed: boolean
  tokPerSec: number | null
  prefillMs: number | null
  decodeMs: number | null
  firstOutputMs: number | null
  outputSpanMs: number | null
}

export function RequestTokenTrace({
  durationMs,
  completionTokens,
  tokPerSec,
  prefillMs,
  decodeMs,
  streamed,
  firstOutputMs,
  outputSpanMs,
}: Props) {
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
  const hasObserved = durationMs > 0 && firstOutputMs != null
  const firstOutputPct = hasObserved ? Math.max(0, Math.min(100, (firstOutputMs / durationMs) * 100)) : 0
  const outputSpanPct =
    hasObserved && outputSpanMs != null
      ? Math.max(0, Math.min(100 - firstOutputPct, (outputSpanMs / durationMs) * 100))
      : 0

  return (
    <section className="panel !rounded-none !border-l-0 !border-r border-r-border border-b-1 !bg-surface-1">
      <div className="panel-head bg-surface-1 px-4">
        <span className="panel-title">{streamed ? 'Stream' : 'Timing'}</span>
        <span className="panel-sub">· {streamed ? 'token trace' : 'phase breakdown'}</span>
        <span className="panel-sub ml-auto tabular-nums">
          {completionTokens?.toLocaleString() ?? '—'} tokens · {tokPerSec ?? '—'} tok/s overall
        </span>
      </div>
      <div className="px-4 py-3">
        {hasPhases ? (
          <div className="flex h-2 overflow-hidden rounded bg-surface-3" aria-hidden="true">
            {prefillPct > 0 && prefillMs != null ? (
              <Tooltip label={`prefill ${formatDuration(prefillMs)}`} side="top">
                <div style={{ width: `${prefillPct}%`, background: 'var(--series-2)' }} />
              </Tooltip>
            ) : null}
            {decodePct > 0 && decodeMs != null ? (
              <Tooltip label={`decode ${formatDuration(decodeMs)}`} side="top">
                <div style={{ width: `${decodePct}%`, background: 'var(--series-4)' }} />
              </Tooltip>
            ) : null}
          </div>
        ) : hasObserved ? (
          <div className="flex h-2 overflow-hidden rounded bg-surface-3" aria-hidden="true">
            {firstOutputPct > 0 && firstOutputMs != null ? (
              <Tooltip label={`first output ${formatDuration(firstOutputMs)} · proxy observed`} side="top">
                <div style={{ width: `${firstOutputPct}%`, background: 'var(--series-2)' }} />
              </Tooltip>
            ) : null}
            {outputSpanPct > 0 && outputSpanMs != null ? (
              <Tooltip label={`output span ${formatDuration(outputSpanMs)} · proxy observed`} side="top">
                <div style={{ width: `${outputSpanPct}%`, background: 'var(--series-4)' }} />
              </Tooltip>
            ) : null}
          </div>
        ) : null}
        <div
          className={`flex flex-wrap justify-between gap-x-4 gap-y-1 font-mono tabular-nums text-[11px] text-fg-dim${
            hasPhases || hasObserved ? ' mt-2' : ''
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
          ) : firstOutputMs == null ? (
            <span>no upstream phase timings</span>
          ) : null}
          {firstOutputMs != null ? <span>first output {formatDuration(firstOutputMs)} · proxy observed</span> : null}
          {outputSpanMs != null ? <span>output span {formatDuration(outputSpanMs)} · proxy observed</span> : null}
          <span>
            {streamed ? 'eos' : 'total'} {formatDuration(durationMs)}
          </span>
        </div>
      </div>
    </section>
  )
}
