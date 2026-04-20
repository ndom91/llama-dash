export function formatSpeechClock(seconds: number) {
  const whole = Math.floor(seconds)
  const mins = Math.floor(whole / 60)
  const secs = whole % 60
  const tenths = Math.floor((seconds - whole) * 10)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`
}

export function buildSpeechFilename(input: string, createdAt: number) {
  const base =
    input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 5)
      .join('-') || 'speech'

  const date = new Date(Number.isFinite(createdAt) ? createdAt : Date.now())
  const stamp = Number.isFinite(date.getTime())
    ? date.toISOString().replace(/[-:]/g, '').slice(0, 15)
    : new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)

  return `${base}_${stamp}.mp3`
}

export function buildWaveformPeaks(buffer: AudioBuffer, bars: number) {
  const channel = buffer.getChannelData(0)
  const blockSize = Math.floor(channel.length / bars)
  const peaks: Array<number> = []
  let max = 0

  for (let i = 0; i < bars; i++) {
    let sum = 0
    const start = i * blockSize
    const end = Math.min(start + blockSize, channel.length)
    for (let j = start; j < end; j++) sum = Math.max(sum, Math.abs(channel[j]))
    peaks.push(sum)
    max = Math.max(max, sum)
  }

  const normalized = max > 0 ? peaks.map((value) => value / max) : peaks.map(() => 0.1)
  return normalized.map((value, index) => ({
    id: `peak-${index}-${Math.round(value * 1000)}`,
    index,
    value,
  }))
}
