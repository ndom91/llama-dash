import { createFileRoute } from '@tanstack/react-router'
import { UsagePage } from '../features/usage/UsagePage'
import { parseUsagePeriod } from '../features/usage/usageUtils'
import type { UsagePeriodDays } from '../lib/api'

export type UsageSearch = {
  days?: UsagePeriodDays
}

export const Route = createFileRoute('/usage')({
  component: UsagePage,
  validateSearch: (search: Record<string, unknown>): UsageSearch => ({
    days: parseUsagePeriod(search.days),
  }),
})
