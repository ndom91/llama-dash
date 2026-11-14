import type { RealtimeInputDevice, RealtimeMicSupport } from './realtime-types'

const CAPTURE_FRAME_MS = 20
const WORKLET_NAME = 'llama-dash-realtime-capture'

// Batches 128-frame render quanta into ~20 ms blocks for the main thread.
// Loaded from a Blob URL so it needs no bundler configuration.
const WORKLET_SOURCE = `
class LlamaDashRealtimeCapture extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this.size = (options.processorOptions && options.processorOptions.frames) || 960
    this.buffer = new Float32Array(this.size)
    this.length = 0
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (!channel) return true
    let offset = 0
    while (offset < channel.length) {
      const n = Math.min(channel.length - offset, this.size - this.length)
      this.buffer.set(channel.subarray(offset, offset + n), this.length)
      this.length += n
      offset += n
      if (this.length === this.size) {
        this.port.postMessage(this.buffer, [this.buffer.buffer])
        this.buffer = new Float32Array(this.size)
        this.length = 0
      }
    }
    return true
  }
}
registerProcessor('${WORKLET_NAME}', LlamaDashRealtimeCapture)
`

/** registerProcessor throws on a second load in the same AudioContext. */
const workletContexts = new WeakSet<BaseAudioContext>()

export type MicCaptureGraph = {
  nodes: Array<AudioNode>
  worklet: AudioWorkletNode
}

export async function openMicStream(
  options: { deviceId: string; voiceProcessing: boolean },
  onFallback: () => void,
): Promise<MediaStream> {
  const { deviceId, voiceProcessing } = options
  const base: MediaTrackConstraints = {
    channelCount: 1,
    echoCancellation: voiceProcessing,
    noiseSuppression: voiceProcessing,
    autoGainControl: voiceProcessing,
  }
  if (!deviceId) return navigator.mediaDevices.getUserMedia({ audio: base })
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: { ...base, deviceId: { exact: deviceId } } })
  } catch (err) {
    // A saved device that was unplugged shouldn't block the session.
    const name = err instanceof DOMException ? err.name : ''
    if (name !== 'OverconstrainedError' && name !== 'NotFoundError') throw err
    onFallback()
    return navigator.mediaDevices.getUserMedia({ audio: base })
  }
}

export async function loadCaptureWorklet(ctx: AudioContext): Promise<void> {
  if (workletContexts.has(ctx)) return
  const moduleUrl = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'text/javascript' }))
  try {
    await ctx.audioWorklet.addModule(moduleUrl)
    workletContexts.add(ctx)
  } finally {
    URL.revokeObjectURL(moduleUrl)
  }
}

/** Requires loadCaptureWorklet to have completed for this context. */
export function createCaptureGraph(ctx: AudioContext, stream: MediaStream): MicCaptureGraph {
  const source = ctx.createMediaStreamSource(stream)
  const worklet = new AudioWorkletNode(ctx, WORKLET_NAME, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    processorOptions: { frames: Math.round((ctx.sampleRate * CAPTURE_FRAME_MS) / 1000) },
  })
  // A silent path to the destination keeps the worklet pulled in every browser.
  const sink = ctx.createGain()
  sink.gain.value = 0
  source.connect(worklet)
  worklet.connect(sink)
  sink.connect(ctx.destination)
  return { nodes: [source, worklet, sink], worklet }
}

export function stopCapture(nodes: ReadonlyArray<AudioNode>, stream: MediaStream | null) {
  for (const node of nodes) {
    if (node instanceof AudioWorkletNode) node.port.onmessage = null
    node.disconnect()
  }
  for (const track of stream?.getTracks() ?? []) track.stop()
}

/** Resolves null when the browser cannot enumerate devices. */
export async function listInputDevices(): Promise<Array<RealtimeInputDevice> | null> {
  const media = navigator.mediaDevices
  if (!media?.enumerateDevices) return null
  try {
    const devices = await media.enumerateDevices()
    return devices
      .filter((device) => device.kind === 'audioinput' && device.deviceId && device.deviceId !== 'default')
      .map((device) => ({ deviceId: device.deviceId, label: device.label }))
  } catch {
    return []
  }
}

export function detectMicSupport(): RealtimeMicSupport {
  if (typeof window === 'undefined') return 'unknown'
  if (!window.isSecureContext) return 'insecure'
  if (!navigator.mediaDevices?.getUserMedia || typeof AudioWorkletNode === 'undefined') return 'unsupported'
  return 'ok'
}

export function micErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Microphone access was blocked. Allow it in the browser site settings and reconnect.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone was found.'
  if (name === 'NotReadableError') return 'The microphone is in use by another application.'
  return err instanceof Error ? err.message : String(err)
}
