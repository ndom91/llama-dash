import { useCallback, useEffect, useRef, useState } from 'react'
import { loadString } from './playground-storage'
import type { RealtimeEventEntry } from './realtime-audio'
import { type ApiKeyFns, createRealtimeController, type Settings } from './realtime-controller'
import { detectMicSupport } from './realtime-mic'
import {
  createLevelStore,
  DEFAULT_REALTIME_INSTRUCTIONS,
  DEFAULT_VAD_SILENCE_MS,
  DEFAULT_VAD_THRESHOLD,
  EMPTY_TIMING,
  type RealtimeInputDevice,
  type RealtimeMicState,
  type RealtimeMicSupport,
  type RealtimeStatus,
  type RealtimeTiming,
  type RealtimeTurn,
  type RealtimeTurnMode,
} from './realtime-types'
import type { RealtimeSession } from './schemas/realtime'
import { usePlaygroundApiKey } from './use-playground-api-key'

const LS_MODEL = 'playground-realtime-model'
const LS_INSTRUCTIONS = 'playground-realtime-instructions'
const LS_MODE = 'playground-realtime-mode'
const LS_VAD_THRESHOLD = 'playground-realtime-vad-threshold'
const LS_VAD_SILENCE = 'playground-realtime-vad-silence-ms'
const LS_INPUT_DEVICE = 'playground-realtime-input-device'
const LS_VOICE_PROCESSING = 'playground-realtime-voice-processing'

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

  // Runs after the settingsRef sync above, so the restart reads the new input.
  // A no-op until a session is live, including on first render.
  // biome-ignore lint/correctness/useExhaustiveDependencies: restart only when the input settings change
  useEffect(() => {
    controller.restartMic()
  }, [controller, inputDeviceId, voiceProcessing])

  const setInputDeviceId = useCallback((value: string) => {
    setInputDeviceIdState(value)
    localStorage.setItem(LS_INPUT_DEVICE, value)
  }, [])

  const setVoiceProcessing = useCallback((value: boolean) => {
    setVoiceProcessingState(value)
    localStorage.setItem(LS_VOICE_PROCESSING, value ? 'on' : 'off')
  }, [])

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

function loadNumber(key: string, fallback: number, min: number, max: number): number {
  const value = Number(loadString(key, ''))
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback
}
