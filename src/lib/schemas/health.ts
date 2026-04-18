import * as v from 'valibot'

export const ApiHealthSchema = v.object({
  upstream: v.union([
    v.object({
      reachable: v.literal(true),
      host: v.string(),
      health: v.string(),
      latencyMs: v.number(),
      version: v.string(),
      commit: v.string(),
      build_date: v.string(),
    }),
    v.object({
      reachable: v.literal(false),
      error: v.string(),
    }),
  ]),
})

export type ApiHealth = v.InferOutput<typeof ApiHealthSchema>
