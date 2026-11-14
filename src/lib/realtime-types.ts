export const DEFAULT_REALTIME_INSTRUCTIONS = 'Respond with interleaved text and audio.'
export const DEFAULT_VAD_THRESHOLD = 0.02
export const DEFAULT_VAD_SILENCE_MS = 700

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'error'

export type RealtimeInputDevice = { deviceId: string; label: string }

/** Mic level read by the meters directly, so level updates don't re-render the tab. */
export type RealtimeLevelSource = {
  get: () => number
  subscribe: (onChange: () => void) => () => void
}

export function createLevelStore(): RealtimeLevelSource & { set: (level: number) => void } {
  let level = 0
  const listeners = new Set<() => void>()
  return {
    get: () => level,
    subscribe(onChange) {
      listeners.add(onChange)
      return () => {
        listeners.delete(onChange)
      }
    },
    set(next) {
      if (next === level) return
      level = next
      for (const listener of listeners) listener()
    },
  }
}
export type RealtimeTurnMode = 'push-to-talk' | 'hands-free'
export type RealtimeMicState = 'off' | 'starting' | 'live' | 'blocked'
export type RealtimeMicSupport = 'unknown' | 'ok' | 'insecure' | 'unsupported'

export type RealtimeTurn = {
  id: string
  role: 'user' | 'assistant' | 'error'
  text: string
  pending: boolean
  cancelled: boolean
  createdAt: number
  audioUrl: string | null
  audioSeconds: number | null
  outputTokens: number | null
  firstAudioMs: number | null
  totalMs: number | null
}

export type RealtimeLastResponse = {
  status: string | null
  firstTextMs: number | null
  firstAudioMs: number | null
  totalMs: number | null
  audioSeconds: number | null
  outputTokens: number | null
}

export type RealtimeTiming = {
  connectMs: number | null
  sessionStartedAt: number | null
  inputRate: number | null
  outputRate: number | null
  responses: number
  outputTokens: number
  last: RealtimeLastResponse | null
}

export const EMPTY_TIMING: RealtimeTiming = {
  connectMs: null,
  sessionStartedAt: null,
  inputRate: null,
  outputRate: null,
  responses: 0,
  outputTokens: 0,
  last: null,
}

export function emptyTurn(role: RealtimeTurn['role']): Omit<RealtimeTurn, 'id' | 'createdAt'> {
  return {
    role,
    text: '',
    pending: false,
    cancelled: false,
    audioUrl: null,
    audioSeconds: null,
    outputTokens: null,
    firstAudioMs: null,
    totalMs: null,
  }
}
