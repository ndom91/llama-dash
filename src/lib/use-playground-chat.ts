import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type ChatMessage,
  type MessageMetrics,
  type SamplingParams,
  type StreamEvent,
  streamChatCompletion,
} from './stream-chat'

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

export type InspectorState = {
  lastRequestBody: Record<string, unknown> | null
  lastRequestUrl: string | null
  lastResponseText: string
  lastMetrics: MessageMetrics
  events: Array<InspectorEvent>
  timing: InspectorTiming
}

export type InspectorEvent = { id: string; at: number; tag: string; text: string }

export type InspectorTiming = {
  queueMs: number | null
  swapMs: number | null
  prefillMs: number | null
  decodeMs: number | null
  streamCloseMs: number | null
}

const EMPTY_INSPECTOR: InspectorState = {
  lastRequestBody: null,
  lastRequestUrl: null,
  lastResponseText: '',
  lastMetrics: {},
  events: [],
  timing: { queueMs: null, swapMs: null, prefillMs: null, decodeMs: null, streamCloseMs: null },
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

let nextId = 0
function msgId() {
  return `msg_${Date.now()}_${nextId++}`
}

function presetId() {
  return `pst_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function usePlaygroundChat() {
  const [messages, setMessages] = useState<Array<ChatMessage>>(() => loadJson(LS_MESSAGES, []))
  const [model, setModelState] = useState(() => loadString(LS_MODEL, ''))
  const [systemPrompt, setSystemPromptState] = useState(() => loadString(LS_SYSTEM, ''))
  const [sampling, setSamplingState] = useState<SamplingParams>(() => ({
    ...DEFAULT_SAMPLING,
    ...loadJson<Partial<SamplingParams>>(LS_SAMPLING, {}),
  }))
  const [isStreaming, setIsStreaming] = useState(false)
  const [isReasoning, setIsReasoning] = useState(false)
  const [inspector, setInspector] = useState<InspectorState>(EMPTY_INSPECTOR)
  const [presets, setPresets] = useState<Array<Preset>>(() => loadJson(LS_PRESETS, []))
  const [savedRuns, setSavedRuns] = useState<Array<SavedRun>>(() => loadJson(LS_RUNS, []))

  const abortRef = useRef<AbortController | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const apiKeyRef = useRef<string | null>(null)

  useEffect(() => {
    fetch('/api/playground-key')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.key) apiKeyRef.current = d.key
      })
      .catch(() => {})
  }, [])

  const persistMessages = useCallback((msgs: Array<ChatMessage>) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      localStorage.setItem(LS_MESSAGES, JSON.stringify(msgs))
    }, 500)
  }, [])

  useEffect(() => {
    persistMessages(messages)
  }, [messages, persistMessages])

  const setModel = useCallback((v: string) => {
    setModelState(v)
    localStorage.setItem(LS_MODEL, v)
  }, [])

  const setSystemPrompt = useCallback((v: string) => {
    setSystemPromptState(v)
    localStorage.setItem(LS_SYSTEM, v)
  }, [])

  const setSampling = useCallback((updater: Partial<SamplingParams> | ((s: SamplingParams) => SamplingParams)) => {
    setSamplingState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
      localStorage.setItem(LS_SAMPLING, JSON.stringify(next))
      return next
    })
  }, [])

  const buildApiMessages = useCallback(
    (msgs: Array<ChatMessage>) => {
      const api: Array<{ role: string; content: string }> = []
      if (systemPrompt) api.push({ role: 'system', content: systemPrompt })
      for (const m of msgs) {
        if (m.role !== 'system') api.push({ role: m.role, content: m.content })
      }
      return api
    },
    [systemPrompt],
  )

  const runStream = useCallback(
    async (msgs: Array<ChatMessage>) => {
      if (!model) return

      const assistantMsg: ChatMessage = { id: msgId(), role: 'assistant', content: '', reasoningContent: '' }
      const withAssistant = [...msgs, assistantMsg]
      setMessages(withAssistant)
      setIsStreaming(true)
      setIsReasoning(false)

      const abort = new AbortController()
      abortRef.current = abort

      const timings = {
        requestAt: 0,
        firstByteAt: 0,
        firstContentAt: 0,
        doneAt: 0,
        reasoningStart: 0,
      }
      const events: Array<InspectorEvent> = []
      const usage: { prompt?: number; completion?: number } = {}

      let evSeq = 0
      const pushEvent = (tag: string, text: string) => {
        const ev = { id: `ev_${Date.now()}_${evSeq++}`, at: Date.now(), tag, text }
        events.push(ev)
        setInspector((prev) => ({ ...prev, events: [...events] }))
      }

      try {
        const apiMsgs = buildApiMessages(msgs)
        const stream = streamChatCompletion({
          messages: apiMsgs,
          model,
          sampling,
          signal: abort.signal,
          apiKey: apiKeyRef.current ?? undefined,
          onEvent: (ev: StreamEvent) => {
            switch (ev.kind) {
              case 'request-sent':
                timings.requestAt = ev.at
                setInspector((prev) => ({
                  ...prev,
                  lastRequestBody: ev.body,
                  lastRequestUrl: ev.url,
                  lastResponseText: '',
                  lastMetrics: {},
                  events: [],
                  timing: { queueMs: null, swapMs: null, prefillMs: null, decodeMs: null, streamCloseMs: null },
                }))
                pushEvent('REQ', `POST ${ev.url} seed=${sampling.seed ?? 'auto'}`)
                break
              case 'first-byte':
                timings.firstByteAt = ev.at
                pushEvent('MDL', `${model} resident`)
                break
              case 'content-start':
                timings.firstContentAt = ev.at
                pushEvent('PFL', `prefilled in ${ev.at - timings.requestAt}ms`)
                pushEvent('DEC', `streaming started`)
                break
              case 'reasoning-start':
                pushEvent('RSN', `reasoning started`)
                break
              case 'usage':
                if (ev.promptTokens != null) usage.prompt = ev.promptTokens
                if (ev.completionTokens != null) usage.completion = ev.completionTokens
                break
              case 'done':
                timings.doneAt = ev.at
                pushEvent('STOP', `finish_reason=${ev.finishReason ?? 'stop'}`)
                pushEvent('RES', `200 OK · ${usage.completion ?? '?'} tok`)
                break
              case 'error':
                pushEvent('ERR', ev.message)
                break
            }
          },
        })

        let reasoningStart = 0

        for await (const chunk of stream) {
          if (chunk.done) break

          if (chunk.reasoningContent) {
            if (!reasoningStart) {
              reasoningStart = Date.now()
              setIsReasoning(true)
            }
            assistantMsg.reasoningContent = (assistantMsg.reasoningContent ?? '') + chunk.reasoningContent
          }

          if (chunk.content) {
            if (reasoningStart && !assistantMsg.reasoningTimeMs) {
              assistantMsg.reasoningTimeMs = Date.now() - reasoningStart
              setIsReasoning(false)
            }
            assistantMsg.content += chunk.content
          }

          setMessages([...msgs, { ...assistantMsg }])
        }

        // Build final metrics
        const ttftMs = timings.firstContentAt ? timings.firstContentAt - timings.requestAt : undefined
        const totalMs = timings.doneAt ? timings.doneAt - timings.requestAt : undefined
        const decodeMs = timings.doneAt && timings.firstContentAt ? timings.doneAt - timings.firstContentAt : undefined
        const tokOut = usage.completion
        const tokPerSec = tokOut != null && decodeMs ? (tokOut / decodeMs) * 1000 : undefined
        const metrics: MessageMetrics = {
          ttftMs,
          totalMs,
          tokIn: usage.prompt,
          tokOut,
          tokPerSec,
        }
        assistantMsg.metrics = metrics
        setMessages([...msgs, { ...assistantMsg }])

        setInspector((prev) => ({
          ...prev,
          lastResponseText: assistantMsg.content,
          lastMetrics: metrics,
          timing: {
            queueMs: null,
            swapMs: null,
            prefillMs: ttftMs ?? null,
            decodeMs: decodeMs ?? null,
            streamCloseMs: null,
          },
        }))
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // keep partial response
        } else {
          const errMsg = err instanceof Error ? err.message : String(err)
          assistantMsg.content += assistantMsg.content ? `\n\n---\n**Error:** ${errMsg}` : `**Error:** ${errMsg}`
          setMessages([...msgs, { ...assistantMsg }])
        }
      } finally {
        setIsStreaming(false)
        setIsReasoning(false)
        abortRef.current = null
      }
    },
    [model, sampling, buildApiMessages],
  )

  const sendMessage = useCallback(
    (content: string) => {
      const userMsg: ChatMessage = { id: msgId(), role: 'user', content }
      const updated = [...messages, userMsg]
      setMessages(updated)
      runStream(updated)
    },
    [messages, runStream],
  )

  const regenerate = useCallback(
    (index: number) => {
      const preceding = messages.slice(0, index)
      setMessages(preceding)
      runStream(preceding)
    },
    [messages, runStream],
  )

  const editMessage = useCallback(
    (index: number, content: string) => {
      const updated = messages.slice(0, index)
      const editedMsg: ChatMessage = { id: msgId(), role: 'user', content }
      updated.push(editedMsg)
      setMessages(updated)
      runStream(updated)
    },
    [messages, runStream],
  )

  const forkMessage = useCallback(
    (index: number) => {
      // Fork = take messages up to and including index as a fresh chat
      const forked = messages.slice(0, index + 1).map((m) => ({ ...m, id: msgId() }))
      setMessages(forked)
    },
    [messages],
  )

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clearChat = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    localStorage.removeItem(LS_MESSAGES)
    setInspector(EMPTY_INSPECTOR)
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
    [model, systemPrompt, sampling, presets],
  )

  const applyPreset = useCallback(
    (id: string) => {
      const p = presets.find((x) => x.id === id)
      if (!p) return
      setModel(p.model)
      setSystemPrompt(p.systemPrompt)
      setSampling(p.sampling)
    },
    [presets, setModel, setSystemPrompt, setSampling],
  )

  const deletePreset = useCallback(
    (id: string) => {
      const next = presets.filter((x) => x.id !== id)
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
    [model, systemPrompt, sampling, messages, savedRuns],
  )

  const loadRun = useCallback(
    (id: string) => {
      const r = savedRuns.find((x) => x.id === id)
      if (!r) return
      setModel(r.model)
      setSystemPrompt(r.systemPrompt)
      setSampling(r.sampling)
      setMessages(r.messages)
    },
    [savedRuns, setModel, setSystemPrompt, setSampling],
  )

  const deleteRun = useCallback(
    (id: string) => {
      const next = savedRuns.filter((x) => x.id !== id)
      setSavedRuns(next)
      localStorage.setItem(LS_RUNS, JSON.stringify(next))
    },
    [savedRuns],
  )

  return {
    messages,
    model,
    setModel,
    systemPrompt,
    setSystemPrompt,
    sampling,
    setSampling,
    isStreaming,
    isReasoning,
    inspector,
    presets,
    savedRuns,
    sendMessage,
    regenerate,
    editMessage,
    forkMessage,
    stopStreaming,
    clearChat,
    savePreset,
    applyPreset,
    deletePreset,
    saveRun,
    loadRun,
    deleteRun,
  }
}
