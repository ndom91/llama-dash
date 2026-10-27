import * as v from 'valibot'

export const USAGE_PERIODS = [7, 30, 90] as const

export const UsagePeriodDaysSchema = v.picklist(USAGE_PERIODS)

export type UsagePeriodDays = v.InferOutput<typeof UsagePeriodDaysSchema>

const TokenCountsEntries = {
  requests: v.number(),
  promptTokens: v.number(),
  completionTokens: v.number(),
  totalTokens: v.number(),
}

export const ApiUsageTotalsSchema = v.object({
  ...TokenCountsEntries,
  errors: v.number(),
  /** Null when no request in the period had a price estimate. */
  costUsd: v.nullable(v.number()),
})

export type ApiUsageTotals = v.InferOutput<typeof ApiUsageTotalsSchema>

export const ApiUsageDaySchema = v.object({
  /** UTC calendar day, `YYYY-MM-DD`. */
  day: v.string(),
  requests: v.number(),
  promptTokens: v.number(),
  completionTokens: v.number(),
})

export type ApiUsageDay = v.InferOutput<typeof ApiUsageDaySchema>

/**
 * Dimensions a usage panel can break down by, mirroring the Requests page
 * filters. `status` groups into 2xx/3xx/4xx/5xx/error; `session` is computed
 * from the raw request log only (it is not rolled up).
 */
export const USAGE_DIMENSIONS = ['client', 'key', 'model', 'status', 'routing', 'host', 'endUser', 'session'] as const

export const UsageDimensionSchema = v.picklist(USAGE_DIMENSIONS)

export type UsageDimension = v.InferOutput<typeof UsageDimensionSchema>

export const UsagePanelsSchema = v.tuple([UsageDimensionSchema, UsageDimensionSchema, UsageDimensionSchema])

export type UsagePanels = v.InferOutput<typeof UsagePanelsSchema>

/** Chart 1 (half, left), Chart 2 (half, right), Chart 3 (full width). */
export const DEFAULT_USAGE_PANELS: UsagePanels = ['client', 'key', 'model']

export const UsagePanelSettingsSchema = v.object({ panels: UsagePanelsSchema })

export type UsagePanelSettings = v.InferOutput<typeof UsagePanelSettingsSchema>

export const UpdateUsagePanelSettingsBodySchema = UsagePanelSettingsSchema

export type UpdateUsagePanelSettingsBody = v.InferOutput<typeof UpdateUsagePanelSettingsBodySchema>

/** Parses the stored `usage_panels` setting; anything missing or invalid falls back to the defaults. */
export function parseUsagePanelsSetting(raw: string | null): UsagePanels {
  if (raw == null) return [...DEFAULT_USAGE_PANELS]
  try {
    const result = v.safeParse(UsagePanelsSchema, JSON.parse(raw))
    return result.success ? result.output : [...DEFAULT_USAGE_PANELS]
  } catch {
    return [...DEFAULT_USAGE_PANELS]
  }
}

export const ApiUsageBreakdownRowSchema = v.object({
  /** Dimension value (model id, client name, status class, key id, …); null when not attributed. */
  value: v.nullable(v.string()),
  /** Display label when it differs from `value` (API key name, "N more"). */
  label: v.nullable(v.string()),
  ...TokenCountsEntries,
  errors: v.number(),
  /** Completion tokens per second of wall time over successful streamed requests. */
  avgGenTokPerSec: v.nullable(v.number()),
})

export type ApiUsageBreakdownRow = v.InferOutput<typeof ApiUsageBreakdownRowSchema>

export const ApiUsagePanelSchema = v.object({
  dimension: UsageDimensionSchema,
  /** Distinct values in the period, including those folded into `others`. */
  values: v.number(),
  /** Top rows by tokens. */
  rows: v.array(ApiUsageBreakdownRowSchema),
  /** Everything beyond the top rows, folded together; null when nothing was folded. */
  others: v.nullable(ApiUsageBreakdownRowSchema),
  /** True when the period reaches past the raw-log retention window for a raw-only dimension (sessions). */
  partial: v.boolean(),
})

export type ApiUsagePanel = v.InferOutput<typeof ApiUsagePanelSchema>

export const ApiUsageReportSchema = v.object({
  days: UsagePeriodDaysSchema,
  /** First and last UTC day of the period (inclusive). */
  from: v.string(),
  to: v.string(),
  /** Earliest UTC day with any recorded usage, or null when there is none. */
  oldestDay: v.nullable(v.string()),
  totals: ApiUsageTotalsSchema,
  /** The same number of days immediately before `from`. */
  previous: ApiUsageTotalsSchema,
  daily: v.array(ApiUsageDaySchema),
  /** Request-log retention in days, for the session panel's note. */
  retentionDays: v.number(),
  /** The three configured breakdowns (see `UsagePanels`). */
  panels: v.array(ApiUsagePanelSchema),
})

export type ApiUsageReport = v.InferOutput<typeof ApiUsageReportSchema>

export const ApiUsageWindowSchema = v.object({
  completionTokens: v.number(),
  /** Generated tokens in the comparison window. */
  previous: v.number(),
  series: v.array(v.number()),
})

export type ApiUsageWindow = v.InferOutput<typeof ApiUsageWindowSchema>

export const ApiUsageSummarySchema = v.object({
  /** Today (UTC) so far vs yesterday up to the same time; hourly series. */
  today: ApiUsageWindowSchema,
  /** Last 7 / 30 UTC days vs the window before; daily series. */
  days7: ApiUsageWindowSchema,
  days30: ApiUsageWindowSchema,
})

export type ApiUsageSummary = v.InferOutput<typeof ApiUsageSummarySchema>
