import * as v from 'valibot'
import { useCallback, useEffect, useRef, useState } from 'react'
import { type ChatMessage, ChatMessageSchema, type SamplingParams, SamplingParamsSchema } from './schemas/playground'

const LS_MESSAGES = 'playground-messages'
const LS_MODEL = 'playground-model'
const LS_SYSTEM = 'playground-system-prompt'
const LS_SAMPLING = 'playground-sampling'

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
  reasoningEffort: null,
}

const PartialSamplingParamsSchema = v.partial(SamplingParamsSchema)

function loadJson<T>(key: string, schema: v.GenericSchema<T>, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return v.parse(schema, JSON.parse(raw))
  } catch {
    return fallback
  }
}

export function loadString(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  return localStorage.getItem(key) ?? fallback
}

export function usePlaygroundStorage() {
  const [messages, setMessages] = useState<Array<ChatMessage>>(() =>
    loadJson(LS_MESSAGES, v.array(ChatMessageSchema), []),
  )
  const [model, setModelState] = useState(() => loadString(LS_MODEL, ''))
  const [systemPrompt, setSystemPromptState] = useState(() => loadString(LS_SYSTEM, ''))
  const [sampling, setSamplingState] = useState<SamplingParams>(() => ({
    ...DEFAULT_SAMPLING,
    ...loadJson(LS_SAMPLING, PartialSamplingParamsSchema, {}),
    stopSequences: [],
  }))

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
  }
}
