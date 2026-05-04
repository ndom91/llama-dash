import * as v from 'valibot'
import { GpuInfoSchema } from './gpu'

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
  inference: v.object({
    kind: v.string(),
    label: v.string(),
    capabilities: v.object({
      models: v.boolean(),
      runningModels: v.boolean(),
      lifecycle: v.boolean(),
      logs: v.boolean(),
      config: v.boolean(),
      metrics: v.boolean(),
    }),
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
    gpus: v.array(GpuInfoSchema),
  }),
})

export type ApiSystemStatus = v.InferOutput<typeof ApiSystemStatusSchema>

export const LoginMetaSchema = v.object({
  instanceLabel: v.string(),
  uptimeLabel: v.string(),
  commitLabel: v.string(),
  tlsLabel: v.string(),
  signupAllowed: v.boolean(),
})

export type LoginMeta = v.InferOutput<typeof LoginMetaSchema>
