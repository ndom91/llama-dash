import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { PageHeader } from '../../components/PageHeader'
import type { UsagePeriodDays } from '../../lib/api'
import { useUsageReport } from '../../lib/queries'
import { UsageClientsPanel } from './UsageClientsPanel'
import { GENERATED_SERIES, PROMPT_SERIES, UsageDailyChart } from './UsageDailyChart'
import { UsageKeysPanel } from './UsageKeysPanel'
import { UsageModelsPanel } from './UsageModelsPanel'
import { UsagePanel } from './UsagePanel'
import { UsagePeriodSwitch } from './UsagePeriodSwitch'
import { UsageTotalsRow } from './UsageTotalsRow'
import { formatUsageDay } from './usageUtils'

const usageRouteApi = getRouteApi('/usage')

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-[11px] text-fg-dim">
      <span className="inline-block size-2 shrink-0 rounded-sm" style={{ background: color }} aria-hidden="true" />
      {label}
    </span>
  )
}

export function UsagePage() {
  const navigate = useNavigate()
  const days: UsagePeriodDays = usageRouteApi.useSearch().days ?? 7
  const { data: report, error } = useUsageReport(days)
  const setDays = (next: UsagePeriodDays) => navigate({ to: '/usage', search: { days: next }, replace: true })
  const isEmpty = report != null && report.oldestDay == null

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
              sub={`last ${days} days`}
              aside={
                <>
                  <LegendSwatch color={GENERATED_SERIES} label="generated" />
                  <LegendSwatch color={PROMPT_SERIES} label="prompt" />
                </>
              }
            >
              <UsageDailyChart daily={report.daily} />
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
