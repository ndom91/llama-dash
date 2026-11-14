/**
 * Pure audio and protocol helpers for the Realtime playground.
 *
 * llama-server's `/v1/realtime` exchanges little-endian mono PCM16 as base64
 * strings inside JSON events: 16 kHz in and 24 kHz out by default, with the
 * actual rates announced in `session.created`.
 */

export const DEFAULT_INPUT_RATE = 16_000
export const DEFAULT_OUTPUT_RATE = 24_000
export const REALTIME_KEY_PROTOCOL_PREFIX = 'openai-insecure-api-key.'

export function realtimeUrl(model: string, location: { protocol: string; host: string }): string {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${scheme}://${location.host}/v1/realtime?model=${encodeURIComponent(model)}`
}

/**
 * Subprotocols for the browser handshake. Only the key is offered: the proxy
 * forwards other offered subprotocols upstream, and llama-server's handshake
 * never selects one, which the proxy's WebSocket client treats as a failure.
 */
export function realtimeProtocols(apiKey: string | null): Array<string> {
  return apiKey ? [`${REALTIME_KEY_PROTOCOL_PREFIX}${apiKey}`] : []
}

export function floatToPcm16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    out[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff)
  }
  return out
}

export function pcm16ToFloat(input: Int16Array): Float32Array {
  const out = new Float32Array(input.length)
  for (let i = 0; i < input.length; i++) out[i] = input[i] / (input[i] < 0 ? 0x8000 : 0x7fff)
  return out
}

export function pcm16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength)
  let binary = ''
  // Chunked so String.fromCharCode never exceeds the engine's argument limit.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

export function base64ToPcm16(b64: string): Int16Array {
  const binary = atob(b64)
  // A trailing odd byte cannot form a sample.
  const out = new Int16Array(binary.length >> 1)
  for (let i = 0; i < out.length; i++) {
    out[i] = binary.charCodeAt(2 * i) | (binary.charCodeAt(2 * i + 1) << 8)
  }
  return out
}

export function concatPcm16(chunks: ReadonlyArray<Int16Array>): Int16Array {
  const out = new Int16Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

/** Root-mean-square level of a block, 0..1 for in-range samples. */
export function rms(input: Float32Array): number {
  if (input.length === 0) return 0
  let sum = 0
  for (let i = 0; i < input.length; i++) sum += input[i] * input[i]
  return Math.sqrt(sum / input.length)
}

/** 44-byte RIFF header plus little-endian mono PCM16 samples. */
// 44-byte RIFF header for mono 16-bit PCM.
export function wavHeader(samples: number, sampleRate: number): Uint8Array {
  const out = new Uint8Array(44)
  const view = new DataView(out.buffer)
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + samples * 2, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  ascii(36, 'data')
  view.setUint32(40, samples * 2, true)
  return out
}

// WAV is little-endian, as are the Int16Array bytes on every platform browsers run on.
export function encodeWav(pcm: Int16Array, sampleRate: number): Blob {
  return new Blob([wavHeader(pcm.length, sampleRate) as Uint8Array<ArrayBuffer>, pcm as Int16Array<ArrayBuffer>], {
    type: 'audio/wav',
  })
}

/**
 * Streaming sample-rate converter for mono float blocks.
 *
 * Downsampling runs a Hann-windowed sinc low-pass first so content above the
 * new Nyquist frequency does not alias, then linearly interpolates at the
 * output positions. Filter history and the fractional read position carry over
 * between blocks, so feeding a stream in blocks matches feeding it at once.
 */
export class StreamResampler {
  private readonly step: number
  private readonly taps: Float32Array
  private history: Float32Array
  // Read position relative to the current filtered block. -1 refers to the
  // previous block's last filtered sample.
  private position = 0
  private lastSample = 0

  constructor(
    readonly fromRate: number,
    readonly toRate: number,
    tapCount = 47,
  ) {
    this.step = fromRate / toRate
    this.taps = toRate < fromRate ? lowPassTaps(tapCount, (0.5 * toRate * 0.9) / fromRate) : new Float32Array([1])
    this.history = new Float32Array(this.taps.length - 1)
  }

  process(input: Float32Array): Float32Array {
    if (this.fromRate === this.toRate) return input
    if (input.length === 0) return new Float32Array(0)

    const historyLength = this.history.length
    const padded = new Float32Array(historyLength + input.length)
    padded.set(this.history)
    padded.set(input, historyLength)

    const filtered = new Float32Array(input.length)
    for (let i = 0; i < filtered.length; i++) {
      let acc = 0
      for (let k = 0; k < this.taps.length; k++) acc += this.taps[k] * padded[historyLength + i - k]
      filtered[i] = acc
    }
    this.history = padded.slice(padded.length - historyLength)

    const out: Array<number> = []
    while (this.position < filtered.length - 1) {
      const index = Math.floor(this.position)
      const frac = this.position - index
      const a = index < 0 ? this.lastSample : filtered[index]
      out.push(a + (filtered[index + 1] - a) * frac)
      this.position += this.step
    }
    this.position -= filtered.length
    this.lastSample = filtered[filtered.length - 1]
    return Float32Array.from(out)
  }
}

/** Unity-gain Hann-windowed sinc low-pass; cutoff is in cycles per sample. */
function lowPassTaps(count: number, cutoff: number): Float32Array {
  const taps = new Float32Array(count)
  const mid = (count - 1) / 2
  let sum = 0
  for (let i = 0; i < count; i++) {
    const t = i - mid
    const sinc = t === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * t) / (Math.PI * t)
    const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (count - 1))
    taps[i] = sinc * window
    sum += taps[i]
  }
  for (let i = 0; i < count; i++) taps[i] /= sum
  return taps
}

export type VadEvent = 'start' | 'confirm' | 'end' | 'discard'

/**
 * Energy-based voice activity detection for hands-free turns. llama-server has
 * no server-side turn detection, so the browser decides when a turn ends.
 *
 * `start` fires on the first loud block, `confirm` once speech has lasted
 * `minSpeechMs`, `end` after `silenceMs` of quiet following confirmed speech,
 * and `discard` after quiet following speech too short to be a turn.
 */
export class VoiceActivityDetector {
  private speaking = false
  private speechMs = 0
  private quietMs = 0

  constructor(
    public threshold: number,
    public silenceMs: number,
    public minSpeechMs = 250,
  ) {}

  reset() {
    this.speaking = false
    this.speechMs = 0
    this.quietMs = 0
  }

  feed(level: number, blockMs: number): VadEvent | null {
    const loud = level >= this.threshold
    if (!this.speaking) {
      if (!loud) return null
      this.speaking = true
      this.speechMs = blockMs
      this.quietMs = 0
      return this.speechMs >= this.minSpeechMs ? 'confirm' : 'start'
    }
    if (loud) {
      const wasConfirmed = this.speechMs >= this.minSpeechMs
      this.speechMs += blockMs
      this.quietMs = 0
      return !wasConfirmed && this.speechMs >= this.minSpeechMs ? 'confirm' : null
    }
    this.quietMs += blockMs
    if (this.quietMs < this.silenceMs) return null
    const confirmed = this.speechMs >= this.minSpeechMs
    this.reset()
    return confirmed ? 'end' : 'discard'
  }
}

/**
 * Start time for the next playback chunk. Chunks are scheduled back to back on
 * the AudioContext clock; after an underrun the queue restarts a little ahead
 * of now so the first chunk is not clipped.
 */
export function nextPlaybackStart(playhead: number, now: number, leadSeconds: number): number {
  return playhead > now ? playhead : now + leadSeconds
}

export function buildRealtimeFilename(model: string, role: 'user' | 'assistant', createdAt: number): string {
  const stamp = new Date(createdAt).toISOString().replace(/[:.]/g, '-').replace(/Z$/, '')
  const slug = model.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'realtime'
  return `${slug}-${role}-${stamp}.wav`
}

export type RealtimeCloseInfo = {
  code: number
  reason: string
  opened: boolean
  sessionReady: boolean
  serverError: string | null
  userInitiated: boolean
}

/** Readable message for a socket close, or null for an expected close. */
export function describeRealtimeClose(info: RealtimeCloseInfo): string | null {
  if (info.userInitiated) return null
  const detail = info.reason || info.serverError
  if (!info.opened) {
    return 'The realtime handshake was refused. The model may not support /v1/realtime, may have failed to load, or the proxy rejected the API key. The Requests log has the status for /v1/realtime.'
  }
  if (!info.sessionReady) {
    return detail
      ? `The session closed before it started: ${detail}`
      : 'The session closed before llama-server sent session.created.'
  }
  switch (info.code) {
    case 1000:
    case 1005:
      return info.serverError ? `Session ended: ${info.serverError}` : null
    case 1008:
      return `Session rejected: ${detail ?? 'policy violation'}`
    case 1009:
      return `Session closed: ${detail ?? 'a message was too large'}`
    case 1011:
      return `Server error: ${detail ?? 'llama-server closed the session'}`
    case 1006:
      return 'The connection dropped unexpectedly.'
    default:
      return `Connection closed (${info.code})${detail ? `: ${detail}` : ''}`
  }
}

export type RealtimeEventDirection = 'in' | 'out' | 'local'

export type RealtimeEventEntry = {
  id: number
  at: number
  direction: RealtimeEventDirection
  type: string
  count: number
  detail: string | null
}

/**
 * Appends events to the log, folding consecutive identical events without
 * detail (audio appends and deltas) into one entry with a count.
 */
export function mergeEventLog(
  log: ReadonlyArray<RealtimeEventEntry>,
  batch: ReadonlyArray<RealtimeEventEntry>,
  max: number,
): Array<RealtimeEventEntry> {
  const out = log.slice()
  for (const entry of batch) {
    const last = out[out.length - 1]
    if (
      last &&
      last.detail == null &&
      entry.detail == null &&
      last.type === entry.type &&
      last.direction === entry.direction
    ) {
      out[out.length - 1] = { ...last, at: entry.at, count: last.count + entry.count }
    } else {
      out.push(entry)
    }
  }
  return out.length > max ? out.slice(out.length - max) : out
}
