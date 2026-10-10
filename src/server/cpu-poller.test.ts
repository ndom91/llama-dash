import { describe, expect, it } from 'vitest'
import { calculateCpuUtilizationPercent, parseProcStat } from './cpu-poller.ts'

describe('CPU telemetry', () => {
  it('calculates system CPU utilization from consecutive procfs counters', () => {
    expect(calculateCpuUtilizationPercent({ idle: 800, total: 1_000 }, { idle: 1_700, total: 2_000 })).toBe(10)
  })

  it('reads idle and total counters from /proc/stat', () => {
    expect(parseProcStat('cpu  100 20 30 400 50 5 6 7 8 9\ncpu0 50 10 15 200\n')).toEqual({ idle: 450, total: 635 })
  })

  it('declines malformed or regressing samples', () => {
    expect(parseProcStat('cpu broken\n')).toBeNull()
    expect(calculateCpuUtilizationPercent({ idle: 800, total: 1_000 }, { idle: 700, total: 1_100 })).toBeNull()
  })
})
