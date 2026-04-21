import { Sparkline } from '../../components/Sparkline'

type Props = {
  label: string
  value: string
  unit: string
  sparkline?: Array<number>
  color?: string
}

export function DashboardStatCard({ label, value, unit, sparkline, color }: Props) {
  return (
    <div className="stat-card min-h-[68px] bg-surface-2 px-3.5 pt-3 pb-2.5">
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-row">
        <span className="stat-card-value">{value}</span>
        <span className="stat-card-unit">{unit}</span>
      </div>
      {sparkline ? (
        <div className="opacity-90">
          <Sparkline data={sparkline} height={32} color={color} />
        </div>
      ) : null}
    </div>
  )
}
