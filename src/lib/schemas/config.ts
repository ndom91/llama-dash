import * as v from 'valibot'

export const ApiConfigReadSchema = v.object({
  content: v.string(),
  modifiedAt: v.number(),
})

export type ApiConfigRead = v.InferOutput<typeof ApiConfigReadSchema>

export const ApiConfigValidationSchema = v.union([
  v.object({ valid: v.literal(true) }),
  v.object({ valid: v.literal(false), errors: v.array(v.string()) }),
])

export type ApiConfigValidation = v.InferOutput<typeof ApiConfigValidationSchema>

export const ApiConfigSaveResultSchema = v.union([
  v.object({ saved: v.literal(true), modifiedAt: v.number() }),
  v.object({
    saved: v.literal(false),
    errors: v.optional(v.array(v.string())),
    conflict: v.optional(v.boolean()),
    message: v.optional(v.string()),
  }),
])

export type ApiConfigSaveResult = v.InferOutput<typeof ApiConfigSaveResultSchema>

export const ConfigSaveBodySchema = v.object({
  content: v.string(),
  modifiedAt: v.number(),
})

export const ConfigValidateBodySchema = v.object({
  content: v.string(),
})
