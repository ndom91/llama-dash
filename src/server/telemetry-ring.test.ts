import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { PerformanceResponseSchema } from './llama-swap/schemas.ts'
import { TelemetryRing } from './telemetry-ring.ts'

describe('TelemetryRing', () => {
  it('reads back pushed values oldest first and maps missing values to null', () => {
    const ring = new TelemetryRing(4)
    ring.push(1, { cpu: 10 })
    ring.push(2, { cpu: 20, gpuTemp: 50 })
    const series = ring.read(0, 100)
    expect(series.t).toEqual([1, 2])
    expect(series.cpu).toEqual([10, 20])
    expect(series.gpuTemp).toEqual([null, 50])
  })

  it('overwrites the oldest slot once full', () => {
    const ring = new TelemetryRing(3)
    for (let t = 1; t <= 5; t++) ring.push(t, { cpu: t })
    expect(ring.read(0, 100).t).toEqual([3, 4, 5])
  })

  it('filters by timestamp', () => {
    const ring = new TelemetryRing(10)
    for (let t = 1; t <= 5; t++) ring.push(t, { cpu: t })
    expect(ring.read(4, 100).t).toEqual([4, 5])
  })

  it('downsamples with mean for usage fields and max for temperature', () => {
    const ring = new TelemetryRing(10)
    ring.push(1, { cpu: 10, gpuTemp: 60 })
    ring.push(2, { cpu: 30, gpuTemp: 90 })
    ring.push(3, { cpu: 50, gpuTemp: 70 })
    ring.push(4, { cpu: 70, gpuTemp: 80 })
    const series = ring.read(0, 2)
    expect(series.t).toEqual([2, 4])
    expect(series.cpu).toEqual([20, 60])
    expect(series.gpuTemp).toEqual([90, 80])
  })
})

describe('llama-swap performance schema', () => {
  it('parses a v266 /api/performance response with null gpu stats', () => {
    const fixture = {
      enabled: true,
      gpu_stats: null,
      sys_stats: [
        {
          timestamp: '2026-11-04T14:16:15.550228409+01:00',
          cpu_util_per_core: [32.7, 0.4, 0.6, 1.0, 2.2, 5.2, 0.4, 0.2],
          mem_total_mb: 98304,
          mem_used_mb: 9168,
          mem_free_mb: 87498,
          swap_total_mb: 64044,
          swap_used_mb: 88,
          load_avg_1: 1.15,
          load_avg_5: 1.39,
          load_avg_15: 1.59,
          net_io: [{ name: 'eth0', bytes_recv: 1, bytes_sent: 2 }],
        },
      ],
    }
    const parsed = v.parse(PerformanceResponseSchema, fixture)
    expect(parsed.sys_stats?.[0].cpu_util_per_core).toHaveLength(8)
    expect(Date.parse(parsed.sys_stats![0].timestamp)).not.toBeNaN()
  })
})
