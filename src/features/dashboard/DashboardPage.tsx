import { useQueryClient } from '@tanstack/react-query'
import { Download, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { Tooltip } from '../../components/Tooltip'
import { TopBar } from '../../components/TopBar'
import { cn } from '../../lib/cn'
import {
  qk,
  useGpu,
  useHealth,
  useModelTimeline,
  useModels,
  useRecentRequests,
  useRequestStats,
} from '../../lib/queries'
import { DashboardRecentRequestsPanel } from './DashboardRecentRequestsPanel'
import { DashboardResidencyPanel } from './DashboardResidencyPanel'
import { DashboardRunningModelsPanel } from './DashboardRunningModelsPanel'
import { DashboardStatCard } from './DashboardStatCard'
import { DashboardTelemetryPanel } from './DashboardTelemetryPanel'
import { formatLatency, formatRate } from './dashboardUtils'

export function DashboardPage() {
  const qc = useQueryClient()
  const { data: models } = useModels()
  const { data: requests } = useRecentRequests(12)
  const { data: stats } = useRequestStats()
  const { data: health } = useHealth()
  const { data: timelineEvents } = useModelTimeline()
  const { data: gpu } = useGpu()
  const [refreshing, setRefreshing] = useState(false)

  const doRefresh = async () => {
    setRefreshing(true)
    await Promise.all([
      qc.invalidateQueries({ queryKey: qk.models }),
      qc.invalidateQueries({ queryKey: qk.requestsRecent }),
      qc.invalidateQueries({ queryKey: qk.requestStats }),
      qc.invalidateQueries({ queryKey: qk.modelTimeline }),
      qc.invalidateQueries({ queryKey: qk.gpu }),
    ])
    setRefreshing(false)
  }

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
            action={
              <>
                <Tooltip label="Refresh">
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    onClick={doRefresh}
                    disabled={refreshing}
                    aria-label="Refresh dashboard"
                  >
                    <RefreshCw
                      className={cn('icon-14', refreshing && 'animate-spin')}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  </button>
                </Tooltip>
                <Tooltip label="Export CSV">
                  <button type="button" className="btn btn-ghost btn-icon" disabled aria-label="Export CSV">
                    <Download className="icon-14" strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </Tooltip>
              </>
            }
          />

          <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)] gap-0 [grid-template-areas:'telemetry_main'] max-[900px]:grid-cols-1 max-[900px]:[grid-template-areas:'telemetry''main']">
            <DashboardTelemetryPanel health={health} gpu={gpu} />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-0 border-l border-l-[color:color-mix(in_srgb,var(--border)_86%,transparent)] max-[900px]:border-l-0">
              <div className="dashboard-stats-row grid grid-cols-4 gap-0 border-b border-b-[color:color-mix(in_srgb,var(--border)_86%,transparent)] max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
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
