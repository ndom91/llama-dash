import * as v from 'valibot'

export const ApiHealthSchema = v.object({
  upstream: v.union([
    v.object({
      reachable: v.literal(true),
      backend: v.string(),
      host: v.string(),
      health: v.optional(v.string()),
      latencyMs: v.optional(v.number()),
      version: v.optional(v.string()),
      commit: v.optional(v.string()),
      build_date: v.optional(v.string()),
    }),
    v.object({
      reachable: v.literal(false),
      backend: v.string(),
      error: v.string(),
    }),
  ]),
})

export type ApiHealth = v.InferOutput<typeof ApiHealthSchema>
