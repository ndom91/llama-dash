import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage, SamplingParams } from './stream-chat'

const LS_MESSAGES = 'playground-messages'
const LS_MODEL = 'playground-model'
const LS_SYSTEM = 'playground-system-prompt'
const LS_SAMPLING = 'playground-sampling'
const LS_PRESETS = 'playground-presets'
const LS_RUNS = 'playground-saved-runs'

export const DEFAULT_SAMPLING: SamplingParams = {
  temperature: 0.7,
  topP: 0.95,
  topK: 40,
  maxTokens: 2048,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stopSequences: [],
  seed: null,
  n: 1,
  stream: true,
  responseFormat: 'text',
  logprobs: false,
}

export type Preset = {
  id: string
  name: string
  createdAt: number
  model: string
  systemPrompt: string
  sampling: SamplingParams
}

export type SavedRun = {
  id: string
  name: string
  createdAt: number
  model: string
  systemPrompt: string
  sampling: SamplingParams
  messages: Array<ChatMessage>
}

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function loadString(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  return localStorage.getItem(key) ?? fallback
}

function presetId() {
  return `pst_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function usePlaygroundStorage() {
  const [messages, setMessages] = useState<Array<ChatMessage>>(() => loadJson(LS_MESSAGES, []))
  const [model, setModelState] = useState(() => loadString(LS_MODEL, ''))
  const [systemPrompt, setSystemPromptState] = useState(() => loadString(LS_SYSTEM, ''))
  const [sampling, setSamplingState] = useState<SamplingParams>(() => ({
    ...DEFAULT_SAMPLING,
    ...loadJson<Partial<SamplingParams>>(LS_SAMPLING, {}),
  }))
  const [presets, setPresets] = useState<Array<Preset>>(() => loadJson(LS_PRESETS, []))
  const [savedRuns, setSavedRuns] = useState<Array<SavedRun>>(() => loadJson(LS_RUNS, []))

  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const persistMessages = useCallback((nextMessages: Array<ChatMessage>) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      localStorage.setItem(LS_MESSAGES, JSON.stringify(nextMessages))
    }, 500)
  }, [])

  useEffect(() => {
    persistMessages(messages)
  }, [messages, persistMessages])

  const setModel = useCallback((value: string) => {
    setModelState(value)
    localStorage.setItem(LS_MODEL, value)
  }, [])

  const setSystemPrompt = useCallback((value: string) => {
    setSystemPromptState(value)
    localStorage.setItem(LS_SYSTEM, value)
  }, [])

  const setSampling = useCallback((updater: Partial<SamplingParams> | ((s: SamplingParams) => SamplingParams)) => {
    setSamplingState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
      localStorage.setItem(LS_SAMPLING, JSON.stringify(next))
      return next
    })
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    localStorage.removeItem(LS_MESSAGES)
  }, [])

  const savePreset = useCallback(
    (name: string) => {
      const preset: Preset = {
        id: presetId(),
        name,
        createdAt: Date.now(),
        model,
        systemPrompt,
        sampling,
      }
      const next = [preset, ...presets]
      setPresets(next)
      localStorage.setItem(LS_PRESETS, JSON.stringify(next))
    },
    [model, presets, sampling, systemPrompt],
  )

  const applyPreset = useCallback(
    (id: string) => {
      const preset = presets.find((item) => item.id === id)
      if (!preset) return
      setModel(preset.model)
      setSystemPrompt(preset.systemPrompt)
      setSampling(preset.sampling)
    },
    [presets, setModel, setSampling, setSystemPrompt],
  )

  const deletePreset = useCallback(
    (id: string) => {
      const next = presets.filter((item) => item.id !== id)
      setPresets(next)
      localStorage.setItem(LS_PRESETS, JSON.stringify(next))
    },
    [presets],
  )

  const saveRun = useCallback(
    (name: string) => {
      const run: SavedRun = {
        id: presetId(),
        name,
        createdAt: Date.now(),
        model,
        systemPrompt,
        sampling,
        messages,
      }
      const next = [run, ...savedRuns]
      setSavedRuns(next)
      localStorage.setItem(LS_RUNS, JSON.stringify(next))
    },
    [messages, model, sampling, savedRuns, systemPrompt],
  )

  const loadRun = useCallback(
    (id: string) => {
      const run = savedRuns.find((item) => item.id === id)
      if (!run) return
      setModel(run.model)
      setSystemPrompt(run.systemPrompt)
      setSampling(run.sampling)
      setMessages(run.messages)
    },
    [savedRuns, setModel, setSampling, setSystemPrompt],
  )

  const deleteRun = useCallback(
    (id: string) => {
      const next = savedRuns.filter((item) => item.id !== id)
      setSavedRuns(next)
      localStorage.setItem(LS_RUNS, JSON.stringify(next))
    },
    [savedRuns],
  )

  return {
    messages,
    setMessages,
    clearMessages,
    model,
    setModel,
    systemPrompt,
    setSystemPrompt,
    sampling,
    setSampling,
    presets,
    savePreset,
    applyPreset,
    deletePreset,
    savedRuns,
    saveRun,
    loadRun,
    deleteRun,
  }
}
