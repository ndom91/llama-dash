import { formatDuration } from './requestDetailUtils'

type Props = {
  durationMs: number
  completionTokens: number
  tokPerSec: number | null
}

export function RequestTokenTrace({ durationMs, completionTokens, tokPerSec }: Props) {
  return (
    <section className="panel request-detail-panel">
      <div className="panel-head request-detail-panel-head">
        <span className="panel-title">Stream</span>
        <span className="panel-sub">· token trace</span>
        <span className="panel-sub" style={{ marginLeft: 'auto' }}>
          {completionTokens} tokens · {tokPerSec ?? '—'} tok/s
        </span>
      </div>
      <div className="token-trace">
        <div className="token-trace-track">
          <div className="token-trace-fill" />
        </div>
        <div className="token-trace-labels">
          <span className="token-trace-label" style={{ color: 'var(--accent-shifted)' }}>
            start
          </span>
          <span className="token-trace-label">
            {completionTokens} tokens · {tokPerSec ?? '—'} tok/s
          </span>
          <span className="token-trace-label">eos {formatDuration(durationMs)}</span>
        </div>
      </div>
    </section>
  )
}
