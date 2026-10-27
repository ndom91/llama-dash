import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { Settings2 } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import type { UsagePeriodDays } from '../../lib/api'
import { cn } from '../../lib/cn'
import { useUsageReport } from '../../lib/queries'
import { useStickyToggle } from '../../lib/use-sticky-toggle'
import { UsageBreakdownPanel } from './UsageBreakdownPanel'
import { UsageContentSkeleton, UsageTotalsSkeleton } from './UsageContentSkeleton'
import { GENERATED_SERIES, PROMPT_SERIES, UsageDailyChart } from './UsageDailyChart'
import { UsageLegendSwatch } from './UsageLegendSwatch'
import { UsagePanel } from './UsagePanel'
import { UsagePeriodSwitch } from './UsagePeriodSwitch'
import { UsageSegmentedControl } from './UsageSegmentedControl'
import { UsageTotalsRow } from './UsageTotalsRow'
import { USAGE_DIMENSION_META } from './usageDimensions'
import { formatUsageDay, type UsageChartMode } from './usageUtils'

const usageRouteApi = getRouteApi('/usage')

/** Panels are positional: Chart 1 and 2 (half width), Chart 3 (full width). */
const PANEL_SLOTS = ['chart-1', 'chart-2', 'chart-3']

const CHART_MODES: ReadonlyArray<{ value: UsageChartMode; label: string }> = [
  { value: 'all', label: 'all' },
  { value: 'generated', label: 'output' },
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
    <div className="content overflow-hidden">
      <div className="page h-full min-h-0 px-0">
        <PageHeader
          kicker="dsh · usage"
          title="Usage"
          subtitle={
            report
              ? `${report.from === report.to ? formatUsageDay(report.from) : `${formatUsageDay(report.from)} – ${formatUsageDay(report.to)}`} · UTC ${days === 1 ? 'day' : 'days'}${
                  report.oldestDay ? ` · history since ${formatUsageDay(report.oldestDay, { year: 'numeric' })}` : ''
                }`
              : 'tokens by day, app, model and key'
          }
          variant="integrated"
          action={<UsagePeriodSwitch value={days} onChange={setDays} />}
        />

        {report && !isEmpty ? <UsageTotalsRow report={report} /> : !report && !error ? <UsageTotalsSkeleton /> : null}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {error ? <div className="err-banner m-4">{error.message}</div> : null}

          {report == null ? (
            error ? null : (
              <UsageContentSkeleton />
            )
          ) : isEmpty ? (
            <div className="empty-state">
              No usage recorded yet. Token counts appear here once requests go through <code translate="no">/v1/*</code>
              .
            </div>
          ) : (
            <div className="flex min-w-0 flex-col">
              <UsagePanel
                title="Tokens per day"
                sub={<span className="max-[520px]:hidden">{days === 1 ? 'today · UTC' : `last ${days} days`}</span>}
                aside={
                  <>
                    <span className="flex items-center gap-3 max-[520px]:hidden">
                      <UsageLegendSwatch color={GENERATED_SERIES} label="output" />
                      {chartMode === 'all' ? <UsageLegendSwatch color={PROMPT_SERIES} label="input" /> : null}
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
              <div className="flex h-9 items-center gap-2.5 border-b border-border bg-surface-1 px-4">
                <span className="panel-title">Breakdowns</span>
                <span className="panel-sub truncate max-[520px]:hidden">
                  {report.panels.map((panel) => USAGE_DIMENSION_META[panel.dimension].title).join(' · ')}
                </span>
                <Link
                  to="/settings"
                  hash="usage"
                  className="panel-link ml-auto inline-flex items-center gap-1 font-mono text-[11px]"
                >
                  <Settings2 className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
                  configure
                </Link>
              </div>
              <div className="grid min-w-0 grid-cols-2 max-[1100px]:grid-cols-1">
                {report.panels.map((panel, i) => (
                  <div
                    key={PANEL_SLOTS[i]}
                    className={cn(
                      'min-w-0',
                      i === 0 && 'border-r border-border max-[1100px]:border-r-0',
                      i < 2 && '[&>section]:!border-b-0',
                      i === 0 && 'max-[1100px]:[&>section]:!border-b',
                      i >= 2 && 'col-span-2 border-t border-border max-[1100px]:col-span-1',
                    )}
                  >
                    <UsageBreakdownPanel panel={panel} retentionDays={report.retentionDays} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
