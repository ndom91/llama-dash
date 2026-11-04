import { createFileRoute } from '@tanstack/react-router'
import * as v from 'valibot'
import { SystemPage } from '../features/system/SystemPage'
import { type SystemTelemetryRange, SystemTelemetryRangeSchema } from '../lib/schemas/system'

type SystemSearch = { range?: SystemTelemetryRange }

export const Route = createFileRoute('/system')({
  validateSearch: (search: Record<string, unknown>): SystemSearch => {
    const parsed = v.safeParse(SystemTelemetryRangeSchema, search.range)
    return { range: parsed.success ? parsed.output : undefined }
  },
  component: SystemPage,
})
