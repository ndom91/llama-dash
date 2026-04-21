import { Sparkline } from '../../components/Sparkline'
import type { ApiKeyStats } from '../../lib/api'
import { formatDuration } from './keyUtils'

type Props = {
  stats: ApiKeyStats
}

export function KeyStatsRow({ stats }: Props) {
  return (
    <div className="stats-row stats-row-flat detail-stacked-section detail-stacked-stats-row">
      <div className="stat-card stat-card-flat">
        <div className="stat-card-label">requests · 30m</div>
        <div className="stat-card-row">
          <span className="stat-card-value">{stats.totalRequests.toLocaleString()}</span>
        </div>
        <Sparkline data={stats.sparklines.reqs} height={32} />
      </div>
      <div className="stat-card stat-card-flat">
        <div className="stat-card-label">error rate</div>
        <div className="stat-card-row">
          <span className="stat-card-value">{stats.errorRate.toFixed(1)}</span>
          <span className="stat-card-unit">%</span>
        </div>
      </div>
      <div className="stat-card stat-card-flat">
        <div className="stat-card-label">tokens · 30m</div>
        <div className="stat-card-row">
          <span className="stat-card-value">
            {(stats.totalPromptTokens + stats.totalCompletionTokens).toLocaleString()}
          </span>
        </div>
        <Sparkline data={stats.sparklines.toks} height={32} />
      </div>
      <div className="stat-card stat-card-flat">
        <div className="stat-card-label">avg duration</div>
        <div className="stat-card-row">
          <span className="stat-card-value">{formatDuration(stats.avgDurationMs)}</span>
        </div>
      </div>
      <div className="stat-card stat-card-flat">
        <div className="stat-card-label">avg tok/s</div>
        <div className="stat-card-row">
          <span className="stat-card-value">{stats.avgTokPerSec.toLocaleString()}</span>
          <span className="stat-card-unit">tok-sec</span>
        </div>
      </div>
    </div>
  )
}
