import * as v from 'valibot'

export const RequestLimitsSchema = v.object({
  maxMessages: v.nullable(v.number()),
  maxEstimatedTokens: v.nullable(v.number()),
})

export type RequestLimits = v.InferOutput<typeof RequestLimitsSchema>

export const UpdateRequestLimitsBodySchema = v.object({
  maxMessages: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1)))),
  maxEstimatedTokens: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1)))),
})

export type UpdateRequestLimitsBody = v.InferOutput<typeof UpdateRequestLimitsBodySchema>
