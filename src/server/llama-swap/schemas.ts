import * as v from 'valibot'

export const OpenAiModelSchema = v.object({
  id: v.string(),
  object: v.literal('model'),
  created: v.number(),
  owned_by: v.string(),
  name: v.optional(v.string()),
  context_length: v.optional(v.number()),
  contextLength: v.optional(v.number()),
  n_ctx: v.optional(v.number()),
  meta: v.optional(
    v.object({
      context_length: v.optional(v.number()),
      contextLength: v.optional(v.number()),
      n_ctx: v.optional(v.number()),
      llamaswap: v.optional(
        v.object({
          peerID: v.optional(v.string()),
          context_length: v.optional(v.number()),
          contextLength: v.optional(v.number()),
          n_ctx: v.optional(v.number()),
        }),
      ),
    }),
  ),
})

export type OpenAiModel = v.InferOutput<typeof OpenAiModelSchema>

export const RunningModelSchema = v.object({
  model: v.string(),
  name: v.string(),
  description: v.string(),
  state: v.string(),
  proxy: v.string(),
  ttl: v.number(),
  cmd: v.string(),
})

export type RunningModel = v.InferOutput<typeof RunningModelSchema>

export const ModelsListResponseSchema = v.object({
  data: v.array(OpenAiModelSchema),
  object: v.literal('list'),
})

export const RunningResponseSchema = v.object({
  running: v.array(RunningModelSchema),
})

export const VersionResponseSchema = v.object({
  version: v.string(),
  commit: v.string(),
  build_date: v.string(),
})
