import type { UsagePeriodDays } from '../../lib/api'
import { USAGE_PERIODS } from '../../lib/schemas/usage'
import { UsageSegmentedControl } from './UsageSegmentedControl'

type Props = {
  value: UsagePeriodDays
  onChange: (days: UsagePeriodDays) => void
}

const OPTIONS = USAGE_PERIODS.map((days) => ({ value: days, label: `${days}d` }))

export function UsagePeriodSwitch({ value, onChange }: Props) {
  return <UsageSegmentedControl legend="Period" options={OPTIONS} value={value} onChange={onChange} />
}
