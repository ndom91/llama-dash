import { nextPlaybackStart, pcm16ToFloat } from './realtime-audio'

const PLAYBACK_LEAD_S = 0.05

export type RealtimePlayback = {
  /** Schedules a PCM16 chunk directly after the previously scheduled audio. */
  play: (pcm: Int16Array, rate: number) => void
  stop: () => void
  /** Whether scheduled audio extends past the current context time. */
  isScheduled: () => boolean
}

export function createRealtimePlayback(
  ctx: AudioContext,
  callbacks: { onStart: () => void; onDrained: () => void },
): RealtimePlayback {
  let playhead = 0
  const sources = new Set<AudioBufferSourceNode>()

  function play(pcm: Int16Array, rate: number) {
    if (pcm.length === 0 || ctx.state === 'closed') return
    const buffer = ctx.createBuffer(1, pcm.length, rate)
    buffer.getChannelData(0).set(pcm16ToFloat(pcm))
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    const startAt = nextPlaybackStart(playhead, ctx.currentTime, PLAYBACK_LEAD_S)
    source.start(startAt)
    playhead = startAt + buffer.duration
    sources.add(source)
    callbacks.onStart()
    source.onended = () => {
      sources.delete(source)
      if (sources.size === 0) callbacks.onDrained()
    }
  }

  function stop() {
    for (const source of sources) {
      source.onended = null
      try {
        source.stop()
      } catch {
        // Already stopped.
      }
    }
    sources.clear()
    playhead = 0
  }

  return {
    play,
    stop,
    isScheduled: () => playhead > ctx.currentTime,
  }
}
