import { createFileRoute } from '@tanstack/react-router'
import { UsagePage } from '../features/usage/UsagePage'
import { UsagePagePending } from '../features/usage/UsagePagePending'
import { parseUsagePeriod } from '../features/usage/usageUtils'
import type { UsagePeriodDays } from '../lib/api'

export type UsageSearch = {
  days?: UsagePeriodDays
}

export const Route = createFileRoute('/usage')({
  component: UsagePage,
  pendingComponent: UsagePagePending,
  validateSearch: (search: Record<string, unknown>): UsageSearch => ({
    days: parseUsagePeriod(search.days),
  }),
})
