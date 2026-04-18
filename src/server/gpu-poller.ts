import { execFile } from 'node:child_process'

export type GpuInfo = {
  index: number
  name: string
  memoryUsedMiB: number
  memoryTotalMiB: number
  memoryPercent: number
  utilizationPercent: number
  temperatureC: number
  powerW: number | null
  powerMaxW: number | null
}

export type GpuSnapshot = {
  available: boolean
  driver: 'nvidia' | 'amd' | null
  gpus: Array<GpuInfo>
  polledAt: number
}

const POLL_INTERVAL_MS = 10_000
const EXEC_TIMEOUT_MS = 5_000

let cached: GpuSnapshot = { available: false, driver: null, gpus: [], polledAt: 0 }
let detectedDriver: 'nvidia' | 'amd' | null = null
let started = false
let pollTimer: ReturnType<typeof setInterval> | null = null

function run(bin: string, args: Array<string>): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: EXEC_TIMEOUT_MS }, (err, stdout) => {
      if (err) reject(err)
      else resolve(stdout)
    })
  })
}

function parseNvidia(csv: string): Array<GpuInfo> {
  const gpus: Array<GpuInfo> = []
  for (const raw of csv.trim().split('\n')) {
    const parts = raw.split(',').map((s) => s.trim())
    if (parts.length < 7) continue
    const [name, memUsed, memTotal, util, temp, power, powerMax] = parts
    const memoryUsedMiB = Number(memUsed)
    const memoryTotalMiB = Number(memTotal)
    gpus.push({
      index: gpus.length,
      name,
      memoryUsedMiB,
      memoryTotalMiB,
      memoryPercent: memoryTotalMiB > 0 ? Math.round((memoryUsedMiB / memoryTotalMiB) * 100) : 0,
      utilizationPercent: Number(util),
      temperatureC: Number(temp),
      powerW: Number.isFinite(Number(power)) ? Number(power) : null,
      powerMaxW: Number.isFinite(Number(powerMax)) ? Number(powerMax) : null,
    })
  }
  return gpus
}

function parseRocmSmi(output: string): Array<GpuInfo> {
  const gpus: Array<GpuInfo> = []
  for (const raw of output.trim().split('\n')) {
    const parts = raw.split(',').map((s) => s.trim())
    if (parts.length < 5) continue
    const [index, name, memUsed, memTotal, util, temp] = parts
    const memoryUsedMiB = Number(memUsed)
    const memoryTotalMiB = Number(memTotal)
    gpus.push({
      index: Number(index),
      name,
      memoryUsedMiB,
      memoryTotalMiB,
      memoryPercent: memoryTotalMiB > 0 ? Math.round((memoryUsedMiB / memoryTotalMiB) * 100) : 0,
      utilizationPercent: Number(util) || 0,
      temperatureC: Number(temp) || 0,
      powerW: null,
      powerMaxW: null,
    })
  }
  return gpus
}

async function pollNvidia(): Promise<Array<GpuInfo>> {
  const csv = await run('nvidia-smi', [
    '--query-gpu=name,memory.used,memory.total,utilization.gpu,temperature.gpu,power.draw,power.limit',
    '--format=csv,noheader,nounits',
  ])
  return parseNvidia(csv)
}

async function pollAmd(): Promise<Array<GpuInfo>> {
  const output = await run('rocm-smi', [
    '--showid',
    '--showproductname',
    '--showmeminfo',
    'vram',
    '--showuse',
    '--showtemp',
    '--csv',
  ])
  return parseRocmSmi(output)
}

async function detectDriver(): Promise<'nvidia' | 'amd' | null> {
  try {
    await run('nvidia-smi', ['--query-gpu=name', '--format=csv,noheader'])
    return 'nvidia'
  } catch {
    // not nvidia
  }
  try {
    await run('rocm-smi', ['--showid', '--csv'])
    return 'amd'
  } catch {
    // not amd
  }
  return null
}

async function poll() {
  if (!detectedDriver) return
  try {
    const gpus = detectedDriver === 'nvidia' ? await pollNvidia() : await pollAmd()
    cached = { available: true, driver: detectedDriver, gpus, polledAt: Date.now() }
  } catch {
    cached = { available: false, driver: detectedDriver, gpus: [], polledAt: Date.now() }
  }
}

export async function startGpuPoller() {
  if (started) return
  started = true

  detectedDriver = await detectDriver()
  if (!detectedDriver) {
    cached = { available: false, driver: null, gpus: [], polledAt: Date.now() }
    return
  }

  await poll()
  pollTimer = setInterval(poll, POLL_INTERVAL_MS)
}

export function stopGpuPoller() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  started = false
}

export function getGpuSnapshot(): GpuSnapshot {
  return cached
}
