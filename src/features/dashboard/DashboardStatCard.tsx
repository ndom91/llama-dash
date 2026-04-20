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
    <div className="stat-card dashboard-stat-card">
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-row">
        <span className="stat-card-value">{value}</span>
        <span className="stat-card-unit">{unit}</span>
      </div>
      {sparkline ? <Sparkline data={sparkline} height={32} color={color} /> : null}
    </div>
  )
}
