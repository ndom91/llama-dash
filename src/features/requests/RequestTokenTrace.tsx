import { formatDuration } from './requestDetailUtils'

type Props = {
  durationMs: number
  completionTokens: number
  tokPerSec: number | null
}

export function RequestTokenTrace({ durationMs, completionTokens, tokPerSec }: Props) {
  return (
    <section className="panel !rounded-none !border-l-0 !border-r border-r-border !border-b-0 !bg-surface-1">
      <div className="panel-head bg-surface-1 px-4">
        <span className="panel-title">Stream</span>
        <span className="panel-sub">· token trace</span>
        <span className="panel-sub ml-auto">
          {completionTokens} tokens · {tokPerSec ?? '—'} tok/s
        </span>
      </div>
      <div className="px-4 py-3">
        <div className="h-2 overflow-hidden rounded bg-surface-3">
          <div className="h-full w-full rounded bg-accent" />
        </div>
        <div className="mt-2 flex flex-wrap justify-between gap-2 font-mono text-[11px] text-fg-dim">
          <span style={{ color: 'var(--accent-shifted)' }}>start</span>
          <span>
            {completionTokens} tokens · {tokPerSec ?? '—'} tok/s
          </span>
          <span>eos {formatDuration(durationMs)}</span>
        </div>
      </div>
    </section>
  )
}
