import * as v from 'valibot'
export { AttributionSettingsSchema, UpdateAttributionSettingsBodySchema } from './attribution'
export type { AttributionSettings, UpdateAttributionSettingsBody } from './attribution'

export const RequestLimitsSchema = v.object({
  maxMessages: v.nullable(v.number()),
  maxEstimatedTokens: v.nullable(v.number()),
})

export type RequestLimits = v.InferOutput<typeof RequestLimitsSchema>

export const PrivacySettingsSchema = v.object({
  captureRequestBodies: v.boolean(),
  captureResponseBodies: v.boolean(),
  maxStoredBodyBytes: v.number(),
})

export type PrivacySettings = v.InferOutput<typeof PrivacySettingsSchema>

export const UpdateRequestLimitsBodySchema = v.object({
  maxMessages: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1)))),
  maxEstimatedTokens: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1)))),
})

export type UpdateRequestLimitsBody = v.InferOutput<typeof UpdateRequestLimitsBodySchema>

export const UpdatePrivacySettingsBodySchema = v.object({
  captureRequestBodies: v.optional(v.boolean()),
  captureResponseBodies: v.optional(v.boolean()),
  maxStoredBodyBytes: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1024 * 1024))),
})

export type UpdatePrivacySettingsBody = v.InferOutput<typeof UpdatePrivacySettingsBodySchema>
