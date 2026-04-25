import * as v from 'valibot'

export const ApiSystemStatusSchema = v.object({
  runtime: v.object({
    uptimeSec: v.number(),
    nodeVersion: v.string(),
    gitCommit: v.string(),
  }),
  database: v.object({
    path: v.string(),
    specialPath: v.boolean(),
  }),
  proxy: v.object({
    upstreamBaseUrl: v.string(),
    upstreamHost: v.string(),
    insecureTls: v.boolean(),
    directTargets: v.array(v.string()),
  }),
  logging: v.object({
    queued: v.number(),
    dropped: v.number(),
  }),
  gpu: v.object({
    available: v.boolean(),
    driver: v.nullable(v.union([v.literal('nvidia'), v.literal('amd'), v.literal('apple')])),
    gpuCount: v.number(),
    polledAt: v.number(),
    ageMs: v.nullable(v.number()),
  }),
})

export type ApiSystemStatus = v.InferOutput<typeof ApiSystemStatusSchema>
