import { Sparkline } from '../../components/Sparkline'

/**
 * `tone` is the *state* the value is reporting, not the identity of the metric,
 * so an error-rate card at 0.0% stays neutral rather than drawing red.
 */
type StatTone = 'neutral' | 'err'

type Props = {
  label: string
  value: string
  unit: string
  sparkline?: Array<number>
  tone?: StatTone
}

const TONE_COLOR: Record<StatTone, string> = {
  neutral: 'var(--accent)',
  err: 'var(--err)',
}

export function DashboardStatCard({ label, value, unit, sparkline, tone = 'neutral' }: Props) {
  return (
    <div className="stat-card min-h-[68px]">
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-row">
        <span className={tone === 'err' ? 'stat-card-value text-err' : 'stat-card-value'}>{value}</span>
        <span className="stat-card-unit">{unit}</span>
      </div>
      {sparkline ? (
        <div className="opacity-90">
          <Sparkline data={sparkline} height={32} color={TONE_COLOR[tone]} />
        </div>
      ) : null}
    </div>
  )
}
