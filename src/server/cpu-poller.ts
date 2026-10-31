import { readFile } from 'node:fs/promises'
type CpuSample = {
  idle: number
  total: number
}

let previousSample: CpuSample | null = null

// LXC exposes its aggregate counters through procfs, unlike this service's cgroup, which would
// only measure llswap-dash and miss the sibling llama-swap container.
export async function pollCpuUtilizationPercent(): Promise<number | null> {
  const current = await readCpuSample()
  if (current === null) return null

  const previous = previousSample
  previousSample = current
  if (previous === null) return null

  return calculateCpuUtilizationPercent(previous, current)
}

export function calculateCpuUtilizationPercent(previous: CpuSample, current: CpuSample): number | null {
  const total = current.total - previous.total
  const idle = current.idle - previous.idle
  if (total <= 0 || idle < 0 || idle > total) return null

  return Math.round(((total - idle) / total) * 100)
}

export function parseProcStat(contents: string): CpuSample | null {
  const line = contents.split('\n').find((candidate) => candidate.startsWith('cpu '))
  if (!line) return null

  const values = line.trim().split(/\s+/).slice(1).map(Number)
  if (values.length < 4 || values.some((value) => !Number.isSafeInteger(value) || value < 0)) return null

  return { idle: values[3] + (values[4] ?? 0), total: values.reduce((sum, value) => sum + value, 0) }
}

async function readCpuSample(): Promise<CpuSample | null> {
  try {
    return parseProcStat(await readFile('/proc/stat', 'utf8'))
  } catch {
    return null
  }
}
