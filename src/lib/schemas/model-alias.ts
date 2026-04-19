import * as v from 'valibot'

export const ModelAliasSchema = v.object({
  id: v.string(),
  alias: v.string(),
  model: v.string(),
  createdAt: v.string(),
})

export type ModelAliasItem = v.InferOutput<typeof ModelAliasSchema>

export const ModelAliasListResponseSchema = v.object({
  aliases: v.array(ModelAliasSchema),
})

export const CreateModelAliasBodySchema = v.object({
  alias: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  model: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
})

export type CreateModelAliasBody = v.InferOutput<typeof CreateModelAliasBodySchema>

export const UpdateModelAliasBodySchema = v.object({
  alias: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
  model: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
})

export type UpdateModelAliasBody = v.InferOutput<typeof UpdateModelAliasBodySchema>
