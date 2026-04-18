import { execFile } from 'node:child_process'
import { platform } from 'node:os'

export type GpuInfo = {
  index: number
  name: string
  memoryUsedMiB: number | null
  memoryTotalMiB: number | null
  memoryPercent: number | null
  utilizationPercent: number | null
  temperatureC: number | null
  powerW: number | null
  powerMaxW: number | null
  cores: number | null
}

export type GpuSnapshot = {
  available: boolean
  driver: 'nvidia' | 'amd' | 'apple' | null
  gpus: Array<GpuInfo>
  polledAt: number
}

const POLL_INTERVAL_MS = 10_000
const EXEC_TIMEOUT_MS = 5_000

let cached: GpuSnapshot = { available: false, driver: null, gpus: [], polledAt: 0 }
let detectedDriver: 'nvidia' | 'amd' | 'apple' | null = null
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
      cores: null,
    })
  }
  return gpus
}

function parseRocmSmi(output: string): Array<GpuInfo> {
  const lines = output.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim())
  const gpus: Array<GpuInfo> = []

  const colIdx = (...needles: Array<string>): number => {
    for (const needle of needles) {
      const idx = headers.findIndex((h) => h.toLowerCase().includes(needle.toLowerCase()))
      if (idx >= 0) return idx
    }
    return -1
  }

  const iName = colIdx('Card Series')
  const iGfx = colIdx('GFX Version')
  const iGttTotal = colIdx('GTT Total Memory')
  const iGttUsed = colIdx('GTT Total Used Memory')
  const iVramTotal = colIdx('VRAM Total Memory')
  const iVramUsed = colIdx('VRAM Total Used Memory')
  const iGpuUse = colIdx('GPU use (%)')
  const iTemp = colIdx('Temperature (Sensor edge)', 'Temperature (Sensor junction)')
  const isBytes = headers.some((h) => h.includes('(B)') && (h.includes('VRAM') || h.includes('Memory')))

  const hasGtt = iGttTotal >= 0 && iGttUsed >= 0

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map((s) => s.trim())
    const baseName = iName >= 0 ? parts[iName] : 'AMD GPU'
    const gfxVer = iGfx >= 0 ? parts[iGfx] : null
    const name = gfxVer ? `${baseName} (${gfxVer})` : baseName

    const iUsed = hasGtt ? iGttUsed : iVramUsed
    const iTotal = hasGtt ? iGttTotal : iVramTotal
    let memUsed = iUsed >= 0 ? Number(parts[iUsed]) : null
    let memTotal = iTotal >= 0 ? Number(parts[iTotal]) : null
    if (isBytes) {
      if (memUsed != null) memUsed = Math.round(memUsed / (1024 * 1024))
      if (memTotal != null) memTotal = Math.round(memTotal / (1024 * 1024))
    }

    const util = iGpuUse >= 0 ? Number(parts[iGpuUse]) : null
    const temp = iTemp >= 0 ? Number(parts[iTemp]) : null

    gpus.push({
      index: gpus.length,
      name,
      memoryUsedMiB: memUsed != null && Number.isFinite(memUsed) ? memUsed : null,
      memoryTotalMiB: memTotal != null && Number.isFinite(memTotal) ? memTotal : null,
      memoryPercent:
        memUsed != null && memTotal != null && memTotal > 0 ? Math.round((memUsed / memTotal) * 100) : null,
      utilizationPercent: util != null && Number.isFinite(util) ? Math.round(util) : null,
      temperatureC: temp != null && Number.isFinite(temp) ? Math.round(temp) : null,
      powerW: null,
      powerMaxW: null,
      cores: null,
    })
  }
  return gpus
}

type AppleGpuEntry = {
  sppci_model?: string
  sppci_cores?: string
}

function parseApple(jsonStr: string): Array<GpuInfo> {
  const data = JSON.parse(jsonStr) as { SPDisplaysDataType?: Array<AppleGpuEntry> }
  const entries = data.SPDisplaysDataType ?? []
  const gpus: Array<GpuInfo> = []
  for (const entry of entries) {
    const name = entry.sppci_model ?? 'Apple GPU'
    const cores = entry.sppci_cores ? Number(entry.sppci_cores) : null
    gpus.push({
      index: gpus.length,
      name,
      memoryUsedMiB: null,
      memoryTotalMiB: null,
      memoryPercent: null,
      utilizationPercent: null,
      temperatureC: null,
      powerW: null,
      powerMaxW: null,
      cores,
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
    '--showproductname',
    '--showmeminfo',
    'vram',
    'gtt',
    '--showuse',
    '--showtemp',
    '--csv',
  ])
  return parseRocmSmi(output)
}

async function pollApple(): Promise<Array<GpuInfo>> {
  const jsonStr = await run('system_profiler', ['SPDisplaysDataType', '-json'])
  return parseApple(jsonStr)
}

async function detectDriver(): Promise<'nvidia' | 'amd' | 'apple' | null> {
  try {
    await run('nvidia-smi', ['--query-gpu=name', '--format=csv,noheader'])
    return 'nvidia'
  } catch {
    // not nvidia
  }
  try {
    await run('rocm-smi', ['--showproductname', '--csv'])
    return 'amd'
  } catch {
    // not amd
  }
  if (platform() === 'darwin') {
    try {
      await run('system_profiler', ['SPDisplaysDataType', '-json'])
      return 'apple'
    } catch {
      // no system_profiler
    }
  }
  return null
}

async function poll() {
  if (!detectedDriver) return
  try {
    let gpus: Array<GpuInfo>
    switch (detectedDriver) {
      case 'nvidia':
        gpus = await pollNvidia()
        break
      case 'amd':
        gpus = await pollAmd()
        break
      case 'apple':
        gpus = await pollApple()
        break
    }
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
  if (detectedDriver !== 'apple') {
    pollTimer = setInterval(poll, POLL_INTERVAL_MS)
  }
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
