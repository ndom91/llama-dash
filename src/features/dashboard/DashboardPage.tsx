import { useMemo } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { TopBar } from '../../components/TopBar'
import { useGpu, useHealth, useModelTimeline, useModels, useRecentRequests, useRequestStats } from '../../lib/queries'
import { DashboardRecentRequestsPanel } from './DashboardRecentRequestsPanel'
import { DashboardResidencyPanel } from './DashboardResidencyPanel'
import { DashboardRunningModelsPanel } from './DashboardRunningModelsPanel'
import { DashboardStatCard } from './DashboardStatCard'
import { DashboardTelemetryPanel } from './DashboardTelemetryPanel'
import { formatLatency, formatRate } from './dashboardUtils'

export function DashboardPage() {
  const { data: models } = useModels()
  const { data: requests } = useRecentRequests(12)
  const { data: stats } = useRequestStats()
  const { data: health } = useHealth()
  const { data: timelineEvents } = useModelTimeline()
  const { data: gpu } = useGpu()

  const active = useMemo(() => models?.filter((m) => m.running || m.kind === 'peer') ?? [], [models])

  return (
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page min-h-full px-0">
          <PageHeader
            kicker="dsh · overview"
            title="Operator dashboard"
            subtitle="system overview and recent activity"
            variant="integrated"
          />

          <div className="grid min-h-0 flex-1 grid-cols-[250px_minmax(0,1fr)] gap-0 [grid-template-areas:'telemetry_main'] max-[900px]:grid-cols-1 max-[900px]:[grid-template-areas:'telemetry''main']">
            <DashboardTelemetryPanel health={health} gpu={gpu} />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-0 border-l border-border max-[900px]:border-l-0">
              <div className="dashboard-stats-row grid grid-cols-4 gap-0 border-b border-border max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
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
                  color="var(--err)"
                />
              </div>

              <DashboardResidencyPanel events={timelineEvents ?? []} active={active} />
              <DashboardRunningModelsPanel active={active} total={models?.length ?? null} />
              <DashboardRecentRequestsPanel requests={requests ?? null} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
