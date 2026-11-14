import * as v from 'valibot'
import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef, useState } from 'react'
import { loadString } from './playground-storage'
import {
  concatPcm16,
  DEFAULT_INPUT_RATE,
  DEFAULT_OUTPUT_RATE,
  describeRealtimeClose,
  encodeWav,
  floatToPcm16,
  mergeEventLog,
  nextPlaybackStart,
  pcm16ToBase64,
  pcm16ToFloat,
  type RealtimeEventDirection,
  type RealtimeEventEntry,
  base64ToPcm16,
  realtimeProtocols,
  realtimeUrl,
  rms,
  StreamResampler,
  VoiceActivityDetector,
} from './realtime-audio'
import { type RealtimeServerEvent, RealtimeServerEventSchema, type RealtimeSession } from './schemas/realtime'
import { usePlaygroundApiKey } from './use-playground-api-key'

const LS_MODEL = 'playground-realtime-model'
const LS_INSTRUCTIONS = 'playground-realtime-instructions'
const LS_MODE = 'playground-realtime-mode'
const LS_VAD_THRESHOLD = 'playground-realtime-vad-threshold'
const LS_VAD_SILENCE = 'playground-realtime-vad-silence-ms'
const LS_INPUT_DEVICE = 'playground-realtime-input-device'
const LS_VOICE_PROCESSING = 'playground-realtime-voice-processing'

export const DEFAULT_REALTIME_INSTRUCTIONS = 'Respond with interleaved text and audio.'
export const DEFAULT_VAD_THRESHOLD = 0.02
export const DEFAULT_VAD_SILENCE_MS = 700

// Push-to-talk taps shorter than this never reach the server.
const PTT_MIN_MS = 100
const VAD_MIN_SPEECH_MS = 250
// Hands-free keeps this much audio from before speech was detected.
const PREROLL_MS = 300
const PLAYBACK_LEAD_S = 0.05
const CAPTURE_FRAME_MS = 20
const LEVEL_UPDATE_MS = 80
const EVENT_FLUSH_MS = 50
const MAX_EVENTS = 400
const MAX_TURNS = 50
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

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'error'

export type RealtimeInputDevice = { deviceId: string; label: string }

/** Mic level read by the meters directly, so level updates don't re-render the tab. */
export type RealtimeLevelSource = {
  get: () => number
  subscribe: (onChange: () => void) => () => void
}

function createLevelStore(): RealtimeLevelSource & { set: (level: number) => void } {
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

const EMPTY_TIMING: RealtimeTiming = {
  connectMs: null,
  sessionStartedAt: null,
  inputRate: null,
  outputRate: null,
  responses: 0,
  outputTokens: 0,
  last: null,
}

type ResponseState = {
  turnId: string
  startedAt: number
  chunks: Array<Int16Array>
  samples: number
  firstTextAt: number | null
  firstAudioAt: number | null
}

type Connection = {
  model: string
  ws: WebSocket | null
  ctx: AudioContext
  connectStartedAt: number
  opened: boolean
  sessionReady: boolean
  retried: boolean
  userClosed: boolean
  serverError: string | null
  inputRate: number
  outputRate: number
  stream: MediaStream | null
  /** registerProcessor throws on a second load in the same AudioContext. */
  workletLoaded: boolean
  /** Bumped by stopMic so a startMic still awaiting knows it was superseded. */
  micGen: number
  nodes: Array<AudioNode>
  resampler: StreamResampler | null
  playhead: number
  sources: Set<AudioBufferSourceNode>
  activeResponseId: string | null
  awaitingResponse: boolean
  commitAt: number | null
  silenced: Set<string>
  /** The user interrupted before response.created named the pending response. */
  cancelPending: boolean
  responses: Map<string, ResponseState>
  pendingUserTurnId: string | null
  itemTurns: Map<string, string>
}

type Capture = {
  active: boolean
  confirmed: boolean
  held: Array<Int16Array>
  heldSamples: number
  chunks: Array<Int16Array>
}

type Settings = {
  model: string
  instructions: string
  mode: RealtimeTurnMode
  vadThreshold: number
  vadSilenceMs: number
  listening: boolean
  /** Empty string means the system default input. */
  inputDeviceId: string
  /** Browser echo cancellation, noise suppression and auto gain. */
  voiceProcessing: boolean
}

type Ui = {
  setStatus: Dispatch<SetStateAction<RealtimeStatus>>
  setError: Dispatch<SetStateAction<string | null>>
  setMicState: Dispatch<SetStateAction<RealtimeMicState>>
  setMicError: Dispatch<SetStateAction<string | null>>
  setMicLabel: Dispatch<SetStateAction<string | null>>
  setInputDevices: Dispatch<SetStateAction<Array<RealtimeInputDevice>>>
  setSession: Dispatch<SetStateAction<RealtimeSession | null>>
  setTiming: Dispatch<SetStateAction<RealtimeTiming>>
  setTurns: Dispatch<SetStateAction<Array<RealtimeTurn>>>
  setEvents: Dispatch<SetStateAction<Array<RealtimeEventEntry>>>
  setInputLevel: (level: number) => void
  setTalking: Dispatch<SetStateAction<boolean>>
  setResponseActive: Dispatch<SetStateAction<boolean>>
  setAssistantSpeaking: Dispatch<SetStateAction<boolean>>
}

type ApiKeyFns = {
  loadApiKey: () => Promise<string | null>
  refreshApiKey: () => Promise<string | null>
}

export function usePlaygroundRealtime() {
  const [model, setModelState] = useState(() => loadString(LS_MODEL, ''))
  const [instructions, setInstructionsState] = useState(() =>
    loadString(LS_INSTRUCTIONS, DEFAULT_REALTIME_INSTRUCTIONS),
  )
  const [mode, setModeState] = useState<RealtimeTurnMode>(() =>
    loadString(LS_MODE, 'push-to-talk') === 'hands-free' ? 'hands-free' : 'push-to-talk',
  )
  const [vadThreshold, setVadThresholdState] = useState(() =>
    loadNumber(LS_VAD_THRESHOLD, DEFAULT_VAD_THRESHOLD, 0.001, 0.2),
  )
  const [vadSilenceMs, setVadSilenceMsState] = useState(() =>
    loadNumber(LS_VAD_SILENCE, DEFAULT_VAD_SILENCE_MS, 200, 3000),
  )
  const [listening, setListening] = useState(true)
  const [inputDeviceId, setInputDeviceIdState] = useState(() => loadString(LS_INPUT_DEVICE, ''))
  const [voiceProcessing, setVoiceProcessingState] = useState(() => loadString(LS_VOICE_PROCESSING, 'on') !== 'off')
  const [inputDevices, setInputDevices] = useState<Array<RealtimeInputDevice>>([])
  const [micLabel, setMicLabel] = useState<string | null>(null)

  const [status, setStatus] = useState<RealtimeStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [micState, setMicState] = useState<RealtimeMicState>('off')
  const [micError, setMicError] = useState<string | null>(null)
  const [micSupport, setMicSupport] = useState<RealtimeMicSupport>('unknown')
  const [session, setSession] = useState<RealtimeSession | null>(null)
  const [timing, setTiming] = useState<RealtimeTiming>(EMPTY_TIMING)
  const [turns, setTurns] = useState<Array<RealtimeTurn>>([])
  const [events, setEvents] = useState<Array<RealtimeEventEntry>>([])
  const [inputLevel] = useState(createLevelStore)
  const [talking, setTalking] = useState(false)
  const [responseActive, setResponseActive] = useState(false)
  const [assistantSpeaking, setAssistantSpeaking] = useState(false)

  const { loadApiKey, refreshApiKey } = usePlaygroundApiKey()
  const apiKeyRef = useRef<ApiKeyFns>({ loadApiKey, refreshApiKey })
  const settingsRef = useRef<Settings>({
    model,
    instructions,
    mode,
    vadThreshold,
    vadSilenceMs,
    listening,
    inputDeviceId,
    voiceProcessing,
  })

  useEffect(() => {
    apiKeyRef.current = { loadApiKey, refreshApiKey }
  }, [loadApiKey, refreshApiKey])

  useEffect(() => {
    settingsRef.current = {
      model,
      instructions,
      mode,
      vadThreshold,
      vadSilenceMs,
      listening,
      inputDeviceId,
      voiceProcessing,
    }
  }, [model, instructions, mode, vadThreshold, vadSilenceMs, listening, inputDeviceId, voiceProcessing])

  useEffect(() => {
    setMicSupport(detectMicSupport())
  }, [])

  const [controller] = useState(() =>
    createRealtimeController(
      {
        setStatus,
        setError,
        setMicState,
        setMicError,
        setMicLabel,
        setInputDevices,
        setSession,
        setTiming,
        setTurns,
        setEvents,
        setInputLevel: inputLevel.set,
        setTalking,
        setResponseActive,
        setAssistantSpeaking,
      },
      settingsRef,
      apiKeyRef,
    ),
  )

  useEffect(() => () => controller.dispose(), [controller])

  // Device labels stay empty until mic permission is granted; the list is
  // refreshed again once the mic goes live.
  useEffect(() => {
    const media = navigator.mediaDevices
    if (!media?.enumerateDevices) return
    void controller.refreshInputDevices()
    const onChange = () => void controller.refreshInputDevices()
    media.addEventListener('devicechange', onChange)
    return () => media.removeEventListener('devicechange', onChange)
  }, [controller])

  const setInputDeviceId = useCallback(
    (value: string) => {
      setInputDeviceIdState(value)
      localStorage.setItem(LS_INPUT_DEVICE, value)
      settingsRef.current = { ...settingsRef.current, inputDeviceId: value }
      controller.restartMic()
    },
    [controller],
  )

  const setVoiceProcessing = useCallback(
    (value: boolean) => {
      setVoiceProcessingState(value)
      localStorage.setItem(LS_VOICE_PROCESSING, value ? 'on' : 'off')
      settingsRef.current = { ...settingsRef.current, voiceProcessing: value }
      controller.restartMic()
    },
    [controller],
  )

  const setModel = useCallback((value: string) => {
    setModelState(value)
    localStorage.setItem(LS_MODEL, value)
  }, [])

  const setInstructions = useCallback((value: string) => {
    setInstructionsState(value)
    localStorage.setItem(LS_INSTRUCTIONS, value)
  }, [])

  const setMode = useCallback(
    (value: RealtimeTurnMode) => {
      setModeState(value)
      localStorage.setItem(LS_MODE, value)
      controller.cancelTurn()
    },
    [controller],
  )

  const setVadThreshold = useCallback((value: number) => {
    setVadThresholdState(value)
    localStorage.setItem(LS_VAD_THRESHOLD, String(value))
  }, [])

  const setVadSilenceMs = useCallback((value: number) => {
    setVadSilenceMsState(value)
    localStorage.setItem(LS_VAD_SILENCE, String(value))
  }, [])

  const toggleListening = useCallback(() => {
    setListening((prev) => !prev)
    controller.cancelTurn()
  }, [controller])

  return {
    model,
    setModel,
    instructions,
    setInstructions,
    mode,
    setMode,
    vadThreshold,
    setVadThreshold,
    vadSilenceMs,
    setVadSilenceMs,
    listening,
    toggleListening,
    inputDeviceId,
    setInputDeviceId,
    inputDevices,
    voiceProcessing,
    setVoiceProcessing,
    micLabel,
    status,
    error,
    micState,
    micError,
    micSupport,
    session,
    timing,
    turns,
    events,
    inputLevel,
    talking,
    responseActive,
    assistantSpeaking,
    connect: controller.connect,
    disconnect: controller.disconnect,
    startTalking: controller.startTalking,
    stopTalking: controller.stopTalking,
    interrupt: controller.interruptActive,
    sendText: controller.sendText,
    clearTurns: controller.clearTurns,
    clearEvents: controller.clearEvents,
  }
}

function createRealtimeController(
  ui: Ui,
  settingsRef: { readonly current: Settings },
  apiKeyRef: { readonly current: ApiKeyFns },
) {
  let conn: Connection | null = null
  let capture: Capture = idleCapture()
  let preroll: Array<Int16Array> = []
  let prerollSamples = 0
  let turnSeq = 0
  let eventSeq = 0
  let lastLevelAt = 0
  let pendingEvents: Array<RealtimeEventEntry> = []
  let flushTimer: ReturnType<typeof setTimeout> | null = null
  const urls = new Set<string>()
  const vad = new VoiceActivityDetector(DEFAULT_VAD_THRESHOLD, DEFAULT_VAD_SILENCE_MS, VAD_MIN_SPEECH_MS)

  const nextTurnId = () => `turn_${++turnSeq}`

  function logEvent(direction: RealtimeEventDirection, type: string, detail: string | null = null) {
    pendingEvents.push({ id: ++eventSeq, at: Date.now(), direction, type, count: 1, detail })
    if (flushTimer) return
    flushTimer = setTimeout(() => {
      flushTimer = null
      const batch = pendingEvents
      pendingEvents = []
      ui.setEvents((prev) => mergeEventLog(prev, batch, MAX_EVENTS))
    }, EVENT_FLUSH_MS)
  }

  function addTurn(turn: Omit<RealtimeTurn, 'id' | 'createdAt'> & { id?: string }): string {
    const id = turn.id ?? nextTurnId()
    ui.setTurns((prev) => {
      const next = [...prev, { ...turn, id, createdAt: Date.now() }]
      if (next.length <= MAX_TURNS) return next
      // Each turn holds a WAV blob and a decoded waveform, so long sessions drop the oldest.
      const dropped = next.slice(0, next.length - MAX_TURNS)
      for (const old of dropped) releaseTurn(old)
      return next.slice(-MAX_TURNS)
    })
    return id
  }

  function releaseTurn(turn: RealtimeTurn) {
    if (turn.audioUrl) {
      URL.revokeObjectURL(turn.audioUrl)
      urls.delete(turn.audioUrl)
    }
    if (!conn) return
    for (const [itemId, turnId] of conn.itemTurns) {
      if (turnId === turn.id) conn.itemTurns.delete(itemId)
    }
  }

  function updateTurn(id: string, update: (turn: RealtimeTurn) => Partial<RealtimeTurn>) {
    ui.setTurns((prev) => prev.map((turn) => (turn.id === id ? { ...turn, ...update(turn) } : turn)))
  }

  function addError(message: string) {
    addTurn({ ...emptyTurn('error'), text: message })
  }

  function wavUrl(chunks: ReadonlyArray<Int16Array>, rate: number): { url: string; seconds: number } | null {
    const pcm = concatPcm16(chunks)
    if (pcm.length === 0) return null
    const url = URL.createObjectURL(encodeWav(pcm, rate))
    urls.add(url)
    return { url, seconds: pcm.length / rate }
  }

  function send(target: Connection, event: Record<string, unknown>) {
    const ws = target.ws
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify(event))
    logEvent('out', String(event.type))
  }

  // --- connection -------------------------------------------------------

  async function connect() {
    const model = settingsRef.current.model
    if (!model || conn) return

    const AudioCtx =
      window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) {
      ui.setStatus('error')
      ui.setError('This browser has no Web Audio support.')
      return
    }

    // Created inside the click so autoplay policy lets it play responses.
    const ctx = new AudioCtx()
    void ctx.resume().catch(() => {})
    const next: Connection = {
      model,
      ws: null,
      ctx,
      connectStartedAt: Date.now(),
      opened: false,
      sessionReady: false,
      retried: false,
      userClosed: false,
      serverError: null,
      inputRate: DEFAULT_INPUT_RATE,
      outputRate: DEFAULT_OUTPUT_RATE,
      stream: null,
      workletLoaded: false,
      micGen: 0,
      nodes: [],
      resampler: null,
      playhead: 0,
      sources: new Set(),
      activeResponseId: null,
      awaitingResponse: false,
      commitAt: null,
      silenced: new Set(),
      cancelPending: false,
      responses: new Map(),
      pendingUserTurnId: null,
      itemTurns: new Map(),
    }
    conn = next
    ui.setStatus('connecting')
    ui.setError(null)
    ui.setMicError(null)
    ui.setSession(null)
    ui.setTiming(EMPTY_TIMING)

    const key = await apiKeyRef.current.loadApiKey()
    if (conn !== next) return
    openSocket(next, key)
  }

  function openSocket(target: Connection, apiKey: string | null) {
    let ws: WebSocket
    try {
      ws = new WebSocket(realtimeUrl(target.model, window.location), realtimeProtocols(apiKey))
    } catch (err) {
      teardown(target)
      ui.setStatus('error')
      ui.setError(err instanceof Error ? err.message : String(err))
      return
    }
    target.ws = ws
    logEvent('local', 'socket.connecting', target.retried ? 'retrying with a refreshed key' : target.model)

    const isCurrent = () => conn === target && target.ws === ws

    ws.onopen = () => {
      if (!isCurrent()) return
      target.opened = true
      logEvent('local', 'socket.open', ws.protocol || null)
    }

    ws.onmessage = (message) => {
      if (!isCurrent() || typeof message.data !== 'string') return
      let raw: unknown
      try {
        raw = JSON.parse(message.data)
      } catch {
        logEvent('in', 'invalid', 'frame was not JSON')
        return
      }
      const parsed = v.safeParse(RealtimeServerEventSchema, raw)
      if (!parsed.success) {
        logEvent('in', 'invalid', 'unrecognised event shape')
        return
      }
      handleServerEvent(target, parsed.output)
    }

    ws.onclose = (event) => {
      if (!isCurrent()) return
      logEvent('local', 'socket.close', event.reason ? `${event.code} ${event.reason}` : String(event.code))
      // A refused handshake is often a proxy key that rotated on restart.
      if (!target.opened && !target.retried && !target.userClosed) {
        target.retried = true
        void apiKeyRef.current.refreshApiKey().then((fresh) => {
          if (conn === target) openSocket(target, fresh)
        })
        return
      }
      const message = describeRealtimeClose({
        code: event.code,
        reason: event.reason,
        opened: target.opened,
        sessionReady: target.sessionReady,
        serverError: target.serverError,
        userInitiated: target.userClosed,
      })
      teardown(target)
      ui.setStatus(message ? 'error' : 'idle')
      ui.setError(message)
    }
  }

  function disconnect() {
    const target = conn
    if (!target) return
    target.userClosed = true
    if (target.ws && target.ws.readyState <= WebSocket.OPEN) target.ws.close(1000)
    logEvent('local', 'socket.disconnect')
    teardown(target)
    ui.setStatus('idle')
    ui.setError(null)
  }

  function teardown(target: Connection) {
    if (conn === target) conn = null
    capture = idleCapture()
    preroll = []
    prerollSamples = 0
    vad.reset()

    stopMic(target)
    stopPlayback(target)
    void target.ctx.close().catch(() => {})
    if (target.ws) {
      target.ws.onopen = null
      target.ws.onmessage = null
      target.ws.onclose = null
    }

    for (const response of target.responses.values()) finishResponse(target, response, 'interrupted', null)
    target.responses.clear()

    ui.setTalking(false)
    ui.setResponseActive(false)
    ui.setAssistantSpeaking(false)
    ui.setMicState('off')
    ui.setInputLevel(0)
  }

  // --- server events ----------------------------------------------------

  function handleServerEvent(target: Connection, event: RealtimeServerEvent) {
    switch (event.type) {
      case 'session.created': {
        const sessionInfo = event.session
        target.inputRate = sessionInfo?.audio?.input?.format?.rate ?? DEFAULT_INPUT_RATE
        target.outputRate = sessionInfo?.audio?.output?.format?.rate ?? DEFAULT_OUTPUT_RATE
        target.sessionReady = true
        logEvent('in', event.type, `in ${target.inputRate} Hz · out ${target.outputRate} Hz`)
        ui.setSession(sessionInfo ?? null)
        const now = Date.now()
        ui.setTiming({
          ...EMPTY_TIMING,
          connectMs: now - target.connectStartedAt,
          sessionStartedAt: now,
          inputRate: target.inputRate,
          outputRate: target.outputRate,
        })

        const instructions = settingsRef.current.instructions.trim()
        send(target, {
          type: 'session.update',
          session: {
            type: 'realtime',
            output_modalities: ['text', 'audio'],
            ...(instructions ? { instructions } : {}),
          },
        })
        ui.setStatus('connected')
        void startMic(target)
        return
      }

      case 'session.updated':
        logEvent('in', event.type)
        if (event.session) ui.setSession(event.session)
        return

      case 'input_audio_buffer.committed':
        logEvent('in', event.type)
        if (target.pendingUserTurnId && event.item_id) target.itemTurns.set(event.item_id, target.pendingUserTurnId)
        target.pendingUserTurnId = null
        return

      case 'conversation.item.input_audio_transcription.delta':
      case 'conversation.item.input_audio_transcription.completed': {
        logEvent('in', event.type)
        const turnId = event.item_id ? target.itemTurns.get(event.item_id) : undefined
        if (!turnId) return
        if (event.type.endsWith('.completed') && event.transcript != null) {
          const transcript = event.transcript
          updateTurn(turnId, () => ({ text: transcript }))
        } else if (event.delta) {
          const delta = event.delta
          updateTurn(turnId, (turn) => ({ text: turn.text + delta }))
        }
        return
      }

      case 'response.created': {
        logEvent('in', event.type)
        const responseId = event.response?.id ?? `response_${turnSeq + 1}`
        target.activeResponseId = responseId
        // From here activeResponseId marks the assistant as busy.
        target.awaitingResponse = false
        if (target.cancelPending) {
          target.cancelPending = false
          target.silenced.add(responseId)
          send(target, { type: 'response.cancel' })
        }
        const turnId = addTurn({ ...emptyTurn('assistant'), pending: true })
        target.responses.set(responseId, {
          turnId,
          startedAt: target.commitAt ?? Date.now(),
          chunks: [],
          samples: 0,
          firstTextAt: null,
          firstAudioAt: null,
        })
        target.commitAt = null
        ui.setResponseActive(true)
        return
      }

      // llama.cpp emits output_text; the others are OpenAI GA/beta names.
      case 'response.output_text.delta':
      case 'response.text.delta':
      case 'response.output_audio_transcript.delta':
      case 'response.audio_transcript.delta': {
        logEvent('in', event.type)
        const response = responseFor(target, event)
        if (!response || !event.delta) return
        response.firstTextAt ??= Date.now()
        const delta = event.delta
        updateTurn(response.turnId, (turn) => ({ text: turn.text + delta }))
        return
      }

      case 'response.output_audio.delta':
      case 'response.audio.delta': {
        logEvent('in', event.type)
        const response = responseFor(target, event)
        if (!response || !event.delta) return
        const pcm = base64ToPcm16(event.delta)
        response.firstAudioAt ??= Date.now()
        response.chunks.push(pcm)
        response.samples += pcm.length
        const responseId = event.response_id ?? target.activeResponseId
        if (!responseId || !target.silenced.has(responseId)) playChunk(target, pcm)
        return
      }

      case 'response.done': {
        const status = event.response?.status ?? 'completed'
        const outputTokens = event.response?.usage?.output_tokens ?? null
        logEvent('in', event.type, outputTokens != null ? `${status} · ${outputTokens} tok` : status)
        const responseId = event.response?.id ?? target.activeResponseId
        if (!responseId) return
        if (responseId === target.activeResponseId) {
          target.activeResponseId = null
          ui.setResponseActive(false)
        }
        target.silenced.delete(responseId)
        const response = target.responses.get(responseId)
        if (!response) return
        target.responses.delete(responseId)
        finishResponse(target, response, status, outputTokens)
        return
      }

      case 'error': {
        const message = event.error?.message ?? 'llama-server reported an error'
        logEvent('in', event.type, message)
        target.serverError = message
        target.awaitingResponse = false
        addError(message)
        return
      }

      default:
        logEvent('in', event.type)
    }
  }

  function responseFor(target: Connection, event: RealtimeServerEvent): ResponseState | null {
    const responseId = event.response_id ?? target.activeResponseId
    return responseId ? (target.responses.get(responseId) ?? null) : null
  }

  function finishResponse(target: Connection, response: ResponseState, status: string, outputTokens: number | null) {
    const now = Date.now()
    const audio = wavUrl(response.chunks, target.outputRate)
    const last: RealtimeLastResponse = {
      status,
      firstTextMs: response.firstTextAt != null ? response.firstTextAt - response.startedAt : null,
      firstAudioMs: response.firstAudioAt != null ? response.firstAudioAt - response.startedAt : null,
      totalMs: now - response.startedAt,
      audioSeconds: audio?.seconds ?? null,
      outputTokens,
    }
    updateTurn(response.turnId, () => ({
      pending: false,
      cancelled: status !== 'completed',
      audioUrl: audio?.url ?? null,
      audioSeconds: audio?.seconds ?? null,
      outputTokens,
      firstAudioMs: last.firstAudioMs,
      totalMs: last.totalMs,
    }))
    ui.setTiming((prev) => ({
      ...prev,
      responses: prev.responses + 1,
      outputTokens: prev.outputTokens + (outputTokens ?? 0),
      last,
    }))
  }

  // --- playback ---------------------------------------------------------

  function playChunk(target: Connection, pcm: Int16Array) {
    if (pcm.length === 0 || target.ctx.state === 'closed') return
    const buffer = target.ctx.createBuffer(1, pcm.length, target.outputRate)
    buffer.getChannelData(0).set(pcm16ToFloat(pcm))
    const source = target.ctx.createBufferSource()
    source.buffer = buffer
    source.connect(target.ctx.destination)
    const startAt = nextPlaybackStart(target.playhead, target.ctx.currentTime, PLAYBACK_LEAD_S)
    source.start(startAt)
    target.playhead = startAt + buffer.duration
    target.sources.add(source)
    ui.setAssistantSpeaking(true)
    source.onended = () => {
      target.sources.delete(source)
      if (target.sources.size === 0 && conn === target) ui.setAssistantSpeaking(false)
    }
  }

  function stopPlayback(target: Connection) {
    for (const source of target.sources) {
      source.onended = null
      try {
        source.stop()
      } catch {
        // Already stopped.
      }
    }
    target.sources.clear()
    target.playhead = 0
    ui.setAssistantSpeaking(false)
  }

  function assistantBusy(target: Connection): boolean {
    return target.awaitingResponse || target.activeResponseId != null || target.playhead > target.ctx.currentTime
  }

  // Stops what the assistant is saying so the user can talk over it.
  function interrupt(target: Connection) {
    stopPlayback(target)
    const responseId = target.activeResponseId
    if (responseId && !target.silenced.has(responseId)) {
      target.silenced.add(responseId)
      send(target, { type: 'response.cancel' })
    } else if (!responseId && target.awaitingResponse) {
      // Cancelled once response.created names it, so it never plays over the new turn.
      target.cancelPending = true
      target.awaitingResponse = false
    }
  }

  // --- microphone -------------------------------------------------------

  async function startMic(target: Connection) {
    const support = detectMicSupport()
    if (support !== 'ok') {
      logEvent('local', 'mic.unavailable', support)
      return
    }
    ui.setMicState('starting')
    const gen = target.micGen
    const superseded = () => conn !== target || target.micGen !== gen
    try {
      const stream = await openMicStream()
      if (superseded()) {
        for (const track of stream.getTracks()) track.stop()
        return
      }
      target.stream = stream
      const label = stream.getAudioTracks()[0]?.label || null
      ui.setMicLabel(label)
      void refreshInputDevices()

      if (!target.workletLoaded) {
        const moduleUrl = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'text/javascript' }))
        try {
          await target.ctx.audioWorklet.addModule(moduleUrl)
          target.workletLoaded = true
        } finally {
          URL.revokeObjectURL(moduleUrl)
        }
      }
      if (superseded()) return

      const source = target.ctx.createMediaStreamSource(stream)
      const worklet = new AudioWorkletNode(target.ctx, WORKLET_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        processorOptions: { frames: Math.round((target.ctx.sampleRate * CAPTURE_FRAME_MS) / 1000) },
      })
      // A silent path to the destination keeps the worklet pulled in every browser.
      const sink = target.ctx.createGain()
      sink.gain.value = 0
      source.connect(worklet)
      worklet.connect(sink)
      sink.connect(target.ctx.destination)
      target.nodes = [source, worklet, sink]
      target.resampler = new StreamResampler(target.ctx.sampleRate, target.inputRate)
      worklet.port.onmessage = (message: MessageEvent<Float32Array>) => onMicFrame(target, message.data)
      ui.setMicState('live')
      logEvent('local', 'mic.live', `${label ?? 'microphone'} · ${target.ctx.sampleRate} Hz → ${target.inputRate} Hz`)
    } catch (err) {
      if (superseded()) return
      const message = micErrorMessage(err)
      ui.setMicState('blocked')
      ui.setMicError(message)
      logEvent('local', 'mic.error', message)
    }
  }

  async function openMicStream(): Promise<MediaStream> {
    const { inputDeviceId, voiceProcessing } = settingsRef.current
    const base: MediaTrackConstraints = {
      channelCount: 1,
      echoCancellation: voiceProcessing,
      noiseSuppression: voiceProcessing,
      autoGainControl: voiceProcessing,
    }
    if (!inputDeviceId) return navigator.mediaDevices.getUserMedia({ audio: base })
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: { ...base, deviceId: { exact: inputDeviceId } } })
    } catch (err) {
      // A saved device that was unplugged shouldn't block the session.
      const name = err instanceof DOMException ? err.name : ''
      if (name !== 'OverconstrainedError' && name !== 'NotFoundError') throw err
      logEvent('local', 'mic.fallback', 'selected input not found, using the system default')
      return navigator.mediaDevices.getUserMedia({ audio: base })
    }
  }

  function stopMic(target: Connection) {
    target.micGen++
    for (const node of target.nodes) {
      if (node instanceof AudioWorkletNode) node.port.onmessage = null
      node.disconnect()
    }
    target.nodes = []
    for (const track of target.stream?.getTracks() ?? []) track.stop()
    target.stream = null
    target.resampler = null
    ui.setMicLabel(null)
  }

  // Applies a new input device or processing setting to a live session.
  function restartMic() {
    const target = conn
    // Also restarts a mic that is still starting or was blocked.
    if (!target?.sessionReady) return
    cancelTurn()
    stopMic(target)
    ui.setInputLevel(0)
    void startMic(target)
  }

  async function refreshInputDevices() {
    const media = navigator.mediaDevices
    if (!media?.enumerateDevices) return
    try {
      const devices = await media.enumerateDevices()
      ui.setInputDevices(
        devices
          .filter((device) => device.kind === 'audioinput' && device.deviceId && device.deviceId !== 'default')
          .map((device) => ({ deviceId: device.deviceId, label: device.label })),
      )
    } catch {
      ui.setInputDevices([])
    }
  }

  function onMicFrame(target: Connection, frame: Float32Array) {
    if (conn !== target || !target.resampler) return
    const level = rms(frame)
    const now = performance.now()
    if (now - lastLevelAt >= LEVEL_UPDATE_MS) {
      lastLevelAt = now
      ui.setInputLevel(level)
    }

    const pcm = floatToPcm16(target.resampler.process(frame))
    if (pcm.length === 0) return
    const settings = settingsRef.current

    if (settings.mode === 'push-to-talk') {
      if (!capture.active) return
      pushTurnAudio(target, pcm)
      if (!capture.confirmed && capture.heldSamples >= (target.inputRate * PTT_MIN_MS) / 1000) confirmTurn(target)
      return
    }

    vad.threshold = settings.vadThreshold
    vad.silenceMs = settings.vadSilenceMs
    if (!settings.listening || (!capture.active && assistantBusy(target))) {
      vad.reset()
      pushPreroll(target, pcm)
      return
    }

    const vadEvent = vad.feed(level, (frame.length / target.ctx.sampleRate) * 1000)
    if ((vadEvent === 'start' || vadEvent === 'confirm') && !capture.active) beginTurn(target, true)
    if (capture.active) pushTurnAudio(target, pcm)
    else pushPreroll(target, pcm)

    if (vadEvent === 'confirm') confirmTurn(target)
    else if (vadEvent === 'end') endTurn(target)
    else if (vadEvent === 'discard') cancelTurn()
  }

  function pushPreroll(target: Connection, pcm: Int16Array) {
    preroll.push(pcm)
    prerollSamples += pcm.length
    const limit = (target.inputRate * PREROLL_MS) / 1000
    while (preroll.length > 1 && prerollSamples - preroll[0].length >= limit) {
      prerollSamples -= preroll[0].length
      preroll.shift()
    }
  }

  // --- turns ------------------------------------------------------------

  function beginTurn(target: Connection, withPreroll: boolean) {
    interrupt(target)
    const initial = withPreroll ? preroll : []
    capture = {
      active: true,
      confirmed: false,
      held: [...initial],
      heldSamples: initial.reduce((sum, chunk) => sum + chunk.length, 0),
      chunks: [...initial],
    }
    preroll = []
    prerollSamples = 0
    ui.setTalking(true)
  }

  // Audio is held locally until the turn is long enough to keep, because
  // llama-server cannot drop audio once it has been appended.
  function pushTurnAudio(target: Connection, pcm: Int16Array) {
    capture.chunks.push(pcm)
    if (capture.confirmed) {
      send(target, { type: 'input_audio_buffer.append', audio: pcm16ToBase64(pcm) })
      return
    }
    capture.held.push(pcm)
    capture.heldSamples += pcm.length
  }

  function confirmTurn(target: Connection) {
    if (!capture.active || capture.confirmed) return
    capture.confirmed = true
    const held = concatPcm16(capture.held)
    capture.held = []
    capture.heldSamples = 0
    if (held.length > 0) send(target, { type: 'input_audio_buffer.append', audio: pcm16ToBase64(held) })
  }

  function endTurn(target: Connection) {
    if (!capture.active) return
    const finished = capture
    capture = idleCapture()
    vad.reset()
    ui.setTalking(false)
    if (!finished.confirmed) {
      logEvent('local', 'turn.discarded', 'too short')
      return
    }
    send(target, { type: 'input_audio_buffer.commit' })
    send(target, { type: 'response.create' })
    target.commitAt = Date.now()
    target.awaitingResponse = true
    const audio = wavUrl(finished.chunks, target.inputRate)
    target.pendingUserTurnId = addTurn({
      ...emptyTurn('user'),
      audioUrl: audio?.url ?? null,
      audioSeconds: audio?.seconds ?? null,
    })
  }

  function cancelTurn() {
    if (!capture.active) return
    capture = idleCapture()
    vad.reset()
    ui.setTalking(false)
  }

  function startTalking() {
    const target = conn
    if (!target?.sessionReady || capture.active || settingsRef.current.mode !== 'push-to-talk') return
    if (!target.resampler) return
    beginTurn(target, false)
  }

  function stopTalking() {
    if (conn) endTurn(conn)
  }

  function interruptActive() {
    if (conn) interrupt(conn)
  }

  function sendText(text: string) {
    const target = conn
    const value = text.trim()
    if (!target?.sessionReady || !value) return
    cancelTurn()
    interrupt(target)
    send(target, {
      type: 'conversation.item.create',
      item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: value }] },
    })
    send(target, { type: 'response.create' })
    target.commitAt = Date.now()
    target.awaitingResponse = true
    addTurn({ ...emptyTurn('user'), text: value })
  }

  function clearTurns() {
    for (const url of urls) URL.revokeObjectURL(url)
    urls.clear()
    ui.setTurns([])
  }

  function clearEvents() {
    pendingEvents = []
    ui.setEvents([])
  }

  function dispose() {
    if (conn) {
      conn.userClosed = true
      if (conn.ws && conn.ws.readyState <= WebSocket.OPEN) conn.ws.close(1000)
      teardown(conn)
    }
    if (flushTimer) clearTimeout(flushTimer)
    flushTimer = null
    for (const url of urls) URL.revokeObjectURL(url)
    urls.clear()
  }

  return {
    connect: () => void connect(),
    disconnect,
    startTalking,
    stopTalking,
    interruptActive,
    cancelTurn,
    sendText,
    clearTurns,
    clearEvents,
    restartMic,
    refreshInputDevices,
    dispose,
  }
}

function idleCapture(): Capture {
  return { active: false, confirmed: false, held: [], heldSamples: 0, chunks: [] }
}

function emptyTurn(role: RealtimeTurn['role']): Omit<RealtimeTurn, 'id' | 'createdAt'> {
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

function detectMicSupport(): RealtimeMicSupport {
  if (typeof window === 'undefined') return 'unknown'
  if (!window.isSecureContext) return 'insecure'
  if (!navigator.mediaDevices?.getUserMedia || typeof AudioWorkletNode === 'undefined') return 'unsupported'
  return 'ok'
}

function micErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Microphone access was blocked. Allow it in the browser site settings and reconnect.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone was found.'
  if (name === 'NotReadableError') return 'The microphone is in use by another application.'
  return err instanceof Error ? err.message : String(err)
}

function loadNumber(key: string, fallback: number, min: number, max: number): number {
  const value = Number(loadString(key, ''))
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback
}
