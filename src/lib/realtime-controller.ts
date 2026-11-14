import * as v from 'valibot'
import type { Dispatch, SetStateAction } from 'react'
import {
  base64ToPcm16,
  concatPcm16,
  DEFAULT_INPUT_RATE,
  DEFAULT_OUTPUT_RATE,
  describeRealtimeClose,
  encodeWav,
  floatToPcm16,
  mergeEventLog,
  pcm16ToBase64,
  type RealtimeEventDirection,
  type RealtimeEventEntry,
  realtimeProtocols,
  realtimeUrl,
  rms,
  StreamResampler,
  VoiceActivityDetector,
} from './realtime-audio'
import {
  createCaptureGraph,
  detectMicSupport,
  listInputDevices,
  loadCaptureWorklet,
  micErrorMessage,
  openMicStream,
  stopCapture,
} from './realtime-mic'
import { createRealtimePlayback, type RealtimePlayback } from './realtime-playback'
import {
  DEFAULT_VAD_SILENCE_MS,
  DEFAULT_VAD_THRESHOLD,
  EMPTY_TIMING,
  emptyTurn,
  type RealtimeInputDevice,
  type RealtimeLastResponse,
  type RealtimeMicState,
  type RealtimeStatus,
  type RealtimeTiming,
  type RealtimeTurn,
  type RealtimeTurnMode,
} from './realtime-types'
import { type RealtimeServerEvent, RealtimeServerEventSchema, type RealtimeSession } from './schemas/realtime'

// Push-to-talk taps shorter than this never reach the server.
const PTT_MIN_MS = 100
const VAD_MIN_SPEECH_MS = 250
// Hands-free keeps this much audio from before speech was detected.
const PREROLL_MS = 300
const LEVEL_UPDATE_MS = 80
const EVENT_FLUSH_MS = 50
const MAX_EVENTS = 400
const MAX_TURNS = 50

type ResponseState = {
  turnId: string
  startedAt: number
  chunks: Array<Int16Array>
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
  /** Bumped by stopMic so a startMic still awaiting knows it was superseded. */
  micGen: number
  nodes: Array<AudioNode>
  resampler: StreamResampler | null
  playback: RealtimePlayback
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
  chunks: Array<Int16Array>
}

export type Settings = {
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

export type ApiKeyFns = {
  loadApiKey: () => Promise<string | null>
  refreshApiKey: () => Promise<string | null>
}

export function createRealtimeController(
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
      micGen: 0,
      nodes: [],
      resampler: null,
      playback: createRealtimePlayback(ctx, {
        onStart: () => ui.setAssistantSpeaking(true),
        onDrained: () => {
          if (conn === next) ui.setAssistantSpeaking(false)
        },
      }),
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
          firstTextAt: null,
          firstAudioAt: null,
        })
        target.commitAt = null
        ui.setResponseActive(true)
        return
      }

      case 'response.output_text.delta': {
        logEvent('in', event.type)
        const response = responseFor(target, event)
        if (!response || !event.delta) return
        response.firstTextAt ??= Date.now()
        const delta = event.delta
        updateTurn(response.turnId, (turn) => ({ text: turn.text + delta }))
        return
      }

      case 'response.output_audio.delta': {
        logEvent('in', event.type)
        const response = responseFor(target, event)
        if (!response || !event.delta) return
        const pcm = base64ToPcm16(event.delta)
        response.firstAudioAt ??= Date.now()
        response.chunks.push(pcm)
        const responseId = event.response_id ?? target.activeResponseId
        if (!responseId || !target.silenced.has(responseId)) target.playback.play(pcm, target.outputRate)
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

  function stopPlayback(target: Connection) {
    target.playback.stop()
    ui.setAssistantSpeaking(false)
  }

  function assistantBusy(target: Connection): boolean {
    return target.awaitingResponse || target.activeResponseId != null || target.playback.isScheduled()
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
      const { inputDeviceId, voiceProcessing } = settingsRef.current
      const stream = await openMicStream({ deviceId: inputDeviceId, voiceProcessing }, () =>
        logEvent('local', 'mic.fallback', 'selected input not found, using the system default'),
      )
      if (superseded()) {
        stopCapture([], stream)
        return
      }
      target.stream = stream
      const label = stream.getAudioTracks()[0]?.label || null
      ui.setMicLabel(label)
      void refreshInputDevices()

      await loadCaptureWorklet(target.ctx)
      if (superseded()) return

      const { nodes, worklet } = createCaptureGraph(target.ctx, stream)
      target.nodes = nodes
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

  function stopMic(target: Connection) {
    target.micGen++
    stopCapture(target.nodes, target.stream)
    target.nodes = []
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
    const devices = await listInputDevices()
    if (devices) ui.setInputDevices(devices)
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
      if (!capture.confirmed && pcmLength(capture.chunks) >= (target.inputRate * PTT_MIN_MS) / 1000) confirmTurn(target)
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
    if (capture.confirmed) send(target, { type: 'input_audio_buffer.append', audio: pcm16ToBase64(pcm) })
  }

  function confirmTurn(target: Connection) {
    if (!capture.active || capture.confirmed) return
    capture.confirmed = true
    // Until now the turn's audio was only held locally in chunks.
    const held = concatPcm16(capture.chunks)
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
  return { active: false, confirmed: false, chunks: [] }
}

function pcmLength(chunks: ReadonlyArray<Int16Array>): number {
  let total = 0
  for (const chunk of chunks) total += chunk.length
  return total
}
