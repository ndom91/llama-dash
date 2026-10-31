import { useMemo } from 'react'
import { PageHeader } from '../../components/PageHeader'
import {
  useGpu,
  useHealth,
  useModels,
  useModelTimeline,
  useRecentRequests,
  useRequestStats,
  useUsageSummary,
} from '../../lib/queries'
import { DashboardRecentRequestsPanel } from './DashboardRecentRequestsPanel'
import { DashboardResidencyPanel } from './DashboardResidencyPanel'
import { DashboardRunningModelsPanel } from './DashboardRunningModelsPanel'
import { DashboardStatCard } from './DashboardStatCard'
import { DashboardTelemetryPanel } from './DashboardTelemetryPanel'
import { DashboardUsageCard } from './DashboardUsageCard'
import { formatLatency, formatRate } from './dashboardUtils'

export function DashboardPage() {
  const { data: models } = useModels()
  const { data: requests } = useRecentRequests(30)
  const { data: stats } = useRequestStats()
  const { data: health } = useHealth()
  const { data: timelineEvents } = useModelTimeline()
  const { data: gpu } = useGpu()
  const { data: usage } = useUsageSummary()

  const active = useMemo(
    () => models?.filter((m) => m.kind !== 'selector' && (m.running || m.kind === 'peer')) ?? [],
    [models],
  )
  return (
    <div className="content">
      <div className="page min-h-full">
        <PageHeader
          kicker="dsh · overview"
          title="Operator dashboard"
          subtitle="system overview and recent activity"
          variant="integrated"
        />

        <div className="flex min-h-0 flex-col gap-3">
          <div className="grid grid-cols-[280px_minmax(0,1fr)] gap-3 max-[900px]:grid-cols-1">
            <DashboardTelemetryPanel health={health} gpu={gpu} />
            <div className="grid min-w-0 gap-3">
              <div className="grid grid-cols-4 gap-3 max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
                <DashboardStatCard
                  label="req/s · 1m"
                  value={stats ? formatRate(stats.reqPerSec) : '—'}
                  unit="per-sec"
                  sparkline={stats?.sparklines.reqs}
                />
                <DashboardStatCard
                  label="tok/s · 1m"
                  value={stats ? Math.round(stats.tokPerSec).toLocaleString() : '—'}
                  unit="tok-sec"
                  sparkline={stats?.sparklines.toks}
                />
                <DashboardStatCard
                  label="p50 latency"
                  value={stats ? formatLatency(stats.p50Latency) : '—'}
                  unit="seconds"
                  sparkline={stats?.sparklines.latency}
                />
                <DashboardStatCard
                  label="error rate"
                  value={stats ? stats.errorRate.toFixed(1) : '—'}
                  unit="percent"
                  sparkline={stats?.sparklines.errors}
                  tone={stats && stats.errorRate > 0 ? 'err' : 'neutral'}
                />
              </div>
              <div className="grid grid-cols-3 gap-3 max-[700px]:grid-cols-1">
                <DashboardUsageCard label="output · 24 hours" window={usage?.hours24} against="vs prev 24h" days={1} />
                <DashboardUsageCard label="output · 7 days" window={usage?.days7} against="vs prev 7d" days={7} />
                <DashboardUsageCard label="output · 30 days" window={usage?.days30} against="vs prev 30d" days={30} />
              </div>
            </div>
          </div>

          <DashboardResidencyPanel events={timelineEvents ?? []} active={active} />

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3 max-[1100px]:grid-cols-1">
            <DashboardRunningModelsPanel active={active} total={models?.length ?? null} />
            <DashboardRecentRequestsPanel requests={requests ?? null} />
          </div>
        </div>
      </div>
    </div>
  )
}
