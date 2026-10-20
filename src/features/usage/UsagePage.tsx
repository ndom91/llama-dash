import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { PageHeader } from '../../components/PageHeader'
import type { UsagePeriodDays } from '../../lib/api'
import { useUsageReport } from '../../lib/queries'
import { useStickyToggle } from '../../lib/use-sticky-toggle'
import { UsageClientsPanel } from './UsageClientsPanel'
import { GENERATED_SERIES, PROMPT_SERIES, UsageDailyChart } from './UsageDailyChart'
import { UsageKeysPanel } from './UsageKeysPanel'
import { UsageLegendSwatch } from './UsageLegendSwatch'
import { UsageModelsPanel } from './UsageModelsPanel'
import { UsagePanel } from './UsagePanel'
import { UsagePeriodSwitch } from './UsagePeriodSwitch'
import { UsageSegmentedControl } from './UsageSegmentedControl'
import { UsageTotalsRow } from './UsageTotalsRow'
import { formatUsageDay, type UsageChartMode } from './usageUtils'

const usageRouteApi = getRouteApi('/usage')

const CHART_MODES: ReadonlyArray<{ value: UsageChartMode; label: string }> = [
  { value: 'all', label: 'all' },
  { value: 'generated', label: 'generated' },
]

export function UsagePage() {
  const navigate = useNavigate()
  const days: UsagePeriodDays = usageRouteApi.useSearch().days ?? 7
  const { data: report, error } = useUsageReport(days)
  const setDays = (next: UsagePeriodDays) => navigate({ to: '/usage', search: { days: next }, replace: true })
  const isEmpty = report != null && report.oldestDay == null
  // localStorage-backed like other UI toggles. Hydration-safe here because the
  // chart only renders once the client-side usage query has data.
  const [generatedOnly, toggleGeneratedOnly] = useStickyToggle('usage-chart-generated-only', false)
  const chartMode: UsageChartMode = generatedOnly ? 'generated' : 'all'

  return (
    <div className="content">
      <div className="page min-h-full px-0">
        <PageHeader
          kicker="dsh · usage"
          title="Usage"
          subtitle={
            report
              ? `${formatUsageDay(report.from)} – ${formatUsageDay(report.to)} · UTC days${
                  report.oldestDay ? ` · history since ${formatUsageDay(report.oldestDay, { year: 'numeric' })}` : ''
                }`
              : 'tokens by day, app, model and key'
          }
          variant="integrated"
          action={<UsagePeriodSwitch value={days} onChange={setDays} />}
        />

        {error ? <div className="err-banner m-4">{error.message}</div> : null}

        {report == null ? (
          <div className="empty-state">loading…</div>
        ) : isEmpty ? (
          <div className="empty-state border-t border-border">
            No usage recorded yet. Token counts appear here once requests go through <code translate="no">/v1/*</code>.
          </div>
        ) : (
          <div className="flex min-w-0 flex-col border-t border-border">
            <UsageTotalsRow report={report} />
            <UsagePanel
              title="Tokens per day"
              sub={<span className="max-[520px]:hidden">{`last ${days} days`}</span>}
              aside={
                <>
                  <span className="flex items-center gap-3 max-[520px]:hidden">
                    <UsageLegendSwatch color={GENERATED_SERIES} label="generated" />
                    {chartMode === 'all' ? <UsageLegendSwatch color={PROMPT_SERIES} label="prompt" /> : null}
                  </span>
                  <UsageSegmentedControl
                    legend="Chart series"
                    options={CHART_MODES}
                    value={chartMode}
                    onChange={(mode) => {
                      if (mode !== chartMode) toggleGeneratedOnly()
                    }}
                  />
                </>
              }
            >
              <UsageDailyChart daily={report.daily} mode={chartMode} />
            </UsagePanel>
            <div className="grid min-w-0 grid-cols-2 max-[1100px]:grid-cols-1">
              <div className="min-w-0 border-r border-border max-[1100px]:border-r-0">
                <UsageClientsPanel clients={report.byClient} />
              </div>
              <div className="min-w-0">
                <UsageKeysPanel keys={report.byKey} />
              </div>
            </div>
            <UsageModelsPanel models={report.byModel} />
          </div>
        )}
      </div>
    </div>
  )
}
