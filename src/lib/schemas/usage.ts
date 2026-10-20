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

export const ApiUsageClientSchema = v.object({
  /** Null for requests without an attributed client. */
  clientName: v.nullable(v.string()),
  ...TokenCountsEntries,
})

export type ApiUsageClient = v.InferOutput<typeof ApiUsageClientSchema>

export const ApiUsageModelSchema = v.object({
  model: v.nullable(v.string()),
  ...TokenCountsEntries,
  errors: v.number(),
  /** Completion tokens per second of wall time over successful streamed requests. */
  avgGenTokPerSec: v.nullable(v.number()),
})

export type ApiUsageModel = v.InferOutput<typeof ApiUsageModelSchema>

export const ApiUsageKeySchema = v.object({
  /** Null for requests made without an API key. */
  keyId: v.nullable(v.string()),
  /** Null when the key has been deleted (or for keyless requests). */
  keyName: v.nullable(v.string()),
  ...TokenCountsEntries,
})

export type ApiUsageKey = v.InferOutput<typeof ApiUsageKeySchema>

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
  byClient: v.array(ApiUsageClientSchema),
  byModel: v.array(ApiUsageModelSchema),
  byKey: v.array(ApiUsageKeySchema),
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
