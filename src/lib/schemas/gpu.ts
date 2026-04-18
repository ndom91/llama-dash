import * as v from 'valibot'

export const GpuInfoSchema = v.object({
  index: v.number(),
  name: v.string(),
  memoryUsedMiB: v.nullable(v.number()),
  memoryTotalMiB: v.nullable(v.number()),
  memoryPercent: v.nullable(v.number()),
  utilizationPercent: v.nullable(v.number()),
  temperatureC: v.nullable(v.number()),
  powerW: v.nullable(v.number()),
  powerMaxW: v.nullable(v.number()),
  cores: v.nullable(v.number()),
})

export type GpuInfo = v.InferOutput<typeof GpuInfoSchema>

export const GpuSnapshotSchema = v.object({
  available: v.boolean(),
  driver: v.nullable(v.union([v.literal('nvidia'), v.literal('amd'), v.literal('apple')])),
  gpus: v.array(GpuInfoSchema),
  polledAt: v.number(),
})

export type GpuSnapshot = v.InferOutput<typeof GpuSnapshotSchema>

export type { GpuInfo as ApiGpuInfo, GpuSnapshot as ApiGpuSnapshot }
