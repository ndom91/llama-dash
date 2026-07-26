import { useCallback, useRef, useState } from 'react'
import { computePlaygroundEventTiming } from './playground-timing.ts'
import { type ChatMessage, type MessageMetrics, type StreamEvent, streamChatCompletion } from './stream-chat'
import { usePlaygroundStorage } from './playground-storage'
import { useModels } from './queries'
import { usePlaygroundApiKey } from './use-playground-api-key'

export { DEFAULT_SAMPLING } from './playground-storage'

export type InspectorState = {
  lastRequestBody: Record<string, unknown> | null
  lastRequestUrl: string | null
  lastResponseText: string
  lastMetrics: MessageMetrics
  events: Array<InspectorEvent>
  timing: InspectorTiming
}

export type InspectorEvent = { id: string; at: number; tag: string; text: string; inferred?: boolean }

export type InspectorTiming = {
  queueMs: number | null
  modelLoadingMs: number | null
  prefillMs: number | null
  reasoningMs: number | null
  responseMs: number | null
}

const EMPTY_TIMING: InspectorTiming = {
  queueMs: null,
  modelLoadingMs: null,
  prefillMs: null,
  reasoningMs: null,
  responseMs: null,
}

const EMPTY_INSPECTOR: InspectorState = {
  lastRequestBody: null,
  lastRequestUrl: null,
  lastResponseText: '',
  lastMetrics: {},
  events: [],
  timing: { ...EMPTY_TIMING },
}

let nextId = 0
function msgId() {
  return `msg_${Date.now()}_${nextId++}`
}

async function estimatePromptTokens(messages: Array<{ role: string; content: string }>) {
  const res = await fetch('/api/playground/count-tokens', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: messages.map((message) => message.content).join('\n\n') }),
  })
  if (!res.ok) return 0
  const body = (await res.json().catch(() => null)) as { tokens?: unknown } | null
  return typeof body?.tokens === 'number' ? body.tokens : 0
}

export function usePlaygroundChat() {
  const { data: models } = useModels()
  const {
    messages,
    setMessages,
    clearMessages,
    model,
    setModel,
    systemPrompt,
    setSystemPrompt,
    sampling,
    setSampling,
  } = usePlaygroundStorage()
  const [isStreaming, setIsStreaming] = useState(false)
  const [isReasoning, setIsReasoning] = useState(false)
  const [inspector, setInspector] = useState<InspectorState>(EMPTY_INSPECTOR)

  const abortRef = useRef<AbortController | null>(null)
  const runSeqRef = useRef(0)
  const { loadApiKey } = usePlaygroundApiKey()

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
      const runId = ++runSeqRef.current

      // One playground generation at a time — abort any prior in-flight stream
      // so message/inspector state does not race across overlapping runs.
      abortRef.current?.abort()
      const abort = new AbortController()
      abortRef.current = abort

      const timings = {
        requestAt: 0,
        startedAt: 0,
        relayedAt: 0,
        reasoningStartAt: 0,
        firstContentAt: 0,
        doneAt: 0,
        closeAt: 0,
        promptMs: null as number | null,
        predictedMs: null as number | null,
        queueMs: null as number | null,
        wasQueued: false,
      }
      const events: Array<InspectorEvent> = []
      const usage: { prompt?: number; completion?: number } = {}
      let lastUrl = '/v1/chat/completions'

      let evSeq = 0
      let finalized = false
      let estimatedPromptTokens = 0
      const isCurrentRun = () => runSeqRef.current === runId
      const pushEvent = (tag: string, text: string, at = Date.now(), inferred = false) => {
        if (!isCurrentRun()) return
        const ev: InspectorEvent = {
          id: `ev_${Date.now()}_${evSeq++}`,
          at,
          tag,
          text,
          ...(inferred ? { inferred: true } : {}),
        }
        events.push(ev)
        setInspector((prev) => ({ ...prev, events: [...events] }))
      }
      const applyFinalMetrics = (closeAt?: number) => {
        const computed = computePlaygroundEventTiming({
          startedAt: timings.startedAt,
          doneAt: timings.doneAt,
          closeAt: closeAt ?? timings.closeAt,
          relayedAt: timings.relayedAt,
          reasoningStartAt: timings.reasoningStartAt,
          firstContentAt: timings.firstContentAt,
          wasQueued: timings.wasQueued,
          queueMs: timings.queueMs,
          promptMs: timings.promptMs,
          predictedMs: timings.predictedMs,
        })
        timings.queueMs = computed.queueMs

        const tokOut = usage.completion
        const responseForRate = computed.responseMs ?? timings.predictedMs
        const tokPerSec =
          tokOut != null && responseForRate != null && responseForRate > 0
            ? (tokOut / responseForRate) * 1000
            : undefined
        const metrics: MessageMetrics = {
          totalMs: computed.totalMs,
          tokIn: usage.prompt ?? estimatedPromptTokens,
          tokOut,
          tokPerSec,
        }
        assistantMsg.metrics = metrics
        if (!isCurrentRun()) return
        setMessages([...msgs, { ...assistantMsg }])
        setInspector((prev) => ({
          ...prev,
          lastResponseText: assistantMsg.content,
          lastMetrics: metrics,
          timing: {
            queueMs: computed.queueMs,
            modelLoadingMs: computed.modelLoadingMs,
            prefillMs: computed.prefillMs,
            reasoningMs: computed.reasoningMs,
            responseMs: computed.responseMs,
          },
        }))
      }

      try {
        const apiMsgs = buildApiMessages(msgs)
        estimatedPromptTokens = await estimatePromptTokens(apiMsgs)
        const activeModel = models?.find((item) => item.id === model)
        const includeTimings = activeModel?.kind !== 'peer'
        const apiKey = await loadApiKey()

        const stream = streamChatCompletion({
          messages: apiMsgs,
          model,
          sampling,
          includeTimings,
          signal: abort.signal,
          apiKey: apiKey ?? undefined,
          onEvent: (ev: StreamEvent) => {
            switch (ev.kind) {
              case 'request-sent':
                timings.requestAt = ev.at
                lastUrl = ev.url
                setInspector((prev) => ({
                  ...prev,
                  lastRequestBody: ev.body,
                  lastRequestUrl: ev.url,
                  lastResponseText: '',
                  lastMetrics: {},
                  events: [],
                  timing: { ...EMPTY_TIMING },
                }))
                break
              case 'started':
                timings.startedAt = ev.at
                pushEvent('START', `server received · POST ${lastUrl}`, ev.at, ev.inferred === true)
                break
              case 'queued':
                timings.wasQueued = true
                if (ev.queueMs != null) timings.queueMs = ev.queueMs
                pushEvent(
                  'QUEUE',
                  ev.queueMs != null
                    ? `waited ${ev.queueMs}ms · model=${ev.model}`
                    : `position=${ev.position} eta=${ev.eta} model=${ev.model}`,
                  ev.at,
                  ev.inferred === true,
                )
                break
              case 'relayed':
                // Anchor RELAY on the client clock; wire atMs is always 0 (RELAY origin).
                timings.relayedAt = ev.at
                if (ev.queueMs != null) {
                  timings.queueMs = ev.queueMs
                  timings.wasQueued = ev.queueMs > 0 || timings.wasQueued
                } else if (timings.wasQueued && timings.startedAt) {
                  // Stream path: queue from client START→RELAY when server queue-ms isn't on RELAY.
                  timings.queueMs = Math.max(0, ev.at - timings.startedAt)
                } else {
                  timings.queueMs = 0
                }
                setInspector((prev) => ({
                  ...prev,
                  timing: { ...prev.timing, queueMs: timings.queueMs },
                }))
                pushEvent('RELAY', 'relayed', timings.relayedAt, ev.inferred === true)
                break
              case 'reasoning-start':
                timings.reasoningStartAt = ev.atMs != null && timings.relayedAt ? timings.relayedAt + ev.atMs : ev.at
                pushEvent('REASON', 'first reasoning', timings.reasoningStartAt, ev.inferred === true)
                break
              case 'content-start':
                timings.firstContentAt = ev.atMs != null && timings.relayedAt ? timings.relayedAt + ev.atMs : ev.at
                pushEvent('RESPOND', 'first content', timings.firstContentAt, ev.inferred === true)
                break
              case 'usage':
                if (ev.promptTokens != null) usage.prompt = ev.promptTokens
                if (ev.completionTokens != null) usage.completion = ev.completionTokens
                break
              case 'timings':
                if (ev.promptMs != null) timings.promptMs = ev.promptMs
                if (ev.predictedMs != null) timings.predictedMs = ev.predictedMs
                break
              case 'done':
                timings.doneAt = ev.at
                pushEvent('END', `finished · finish_reason=${ev.finishReason ?? 'stop'}`, ev.at)
                if (!finalized) {
                  finalized = true
                  applyFinalMetrics()
                  if (isCurrentRun()) setIsStreaming(false)
                }
                break
              case 'closed':
                timings.closeAt = ev.at
                if (finalized) applyFinalMetrics(ev.at)
                break
              case 'error':
                pushEvent('ERROR', ev.message, ev.at)
                break
            }
          },
        })

        for await (const chunk of stream) {
          if (!isCurrentRun()) break

          // Non-stream completions arrive as one chunk that may also be marked done.
          // Always apply text first; never skip the payload because done is set.
          if (chunk.reasoningContent) {
            if (!assistantMsg.reasoningContent) {
              setIsReasoning(true)
            }
            assistantMsg.reasoningContent = (assistantMsg.reasoningContent ?? '') + chunk.reasoningContent
          }

          if (chunk.content) {
            if (timings.reasoningStartAt && !assistantMsg.reasoningTimeMs) {
              assistantMsg.reasoningTimeMs = (timings.firstContentAt || Date.now()) - timings.reasoningStartAt
              setIsReasoning(false)
            }
            assistantMsg.content += chunk.content
          }

          if (isCurrentRun()) setMessages([...msgs, { ...assistantMsg }])
        }

        // If `done` finalized metrics before this loop applied content (legacy ordering),
        // refresh the chat bubble + inspector response snapshot.
        if (isCurrentRun() && finalized) {
          setMessages([...msgs, { ...assistantMsg }])
          setInspector((prev) => ({ ...prev, lastResponseText: assistantMsg.content }))
        }

        if (!finalized) {
          finalized = true
          applyFinalMetrics(timings.closeAt || undefined)
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          if (!finalized) {
            finalized = true
            timings.doneAt = Date.now()
            pushEvent('END', 'aborted by user')
            applyFinalMetrics(timings.closeAt || undefined)
          }
        } else {
          const errMsg = err instanceof Error ? err.message : String(err)
          assistantMsg.content += assistantMsg.content ? `\n\n---\n**Error:** ${errMsg}` : `**Error:** ${errMsg}`
          setMessages([...msgs, { ...assistantMsg }])
        }
      } finally {
        if (isCurrentRun()) {
          setIsStreaming(false)
          setIsReasoning(false)
        }
        if (abortRef.current === abort) abortRef.current = null
      }
    },
    [model, sampling, buildApiMessages, loadApiKey, models, setMessages],
  )

  const sendMessage = useCallback(
    (content: string) => {
      const userMsg: ChatMessage = { id: msgId(), role: 'user', content }
      const updated = [...messages, userMsg]
      setMessages(updated)
      runStream(updated)
    },
    [messages, runStream, setMessages],
  )

  const regenerate = useCallback(
    (index: number) => {
      const preceding = messages.slice(0, index)
      setMessages(preceding)
      runStream(preceding)
    },
    [messages, runStream, setMessages],
  )

  const editMessage = useCallback(
    (index: number, content: string) => {
      const updated = messages.slice(0, index)
      const editedMsg: ChatMessage = { id: msgId(), role: 'user', content }
      updated.push(editedMsg)
      setMessages(updated)
      runStream(updated)
    },
    [messages, runStream, setMessages],
  )

  const forkMessage = useCallback(
    (index: number) => {
      // Fork = take messages up to and including index as a fresh chat
      const forked = messages.slice(0, index + 1).map((m) => ({ ...m, id: msgId() }))
      setMessages(forked)
    },
    [messages, setMessages],
  )

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clearChat = useCallback(() => {
    runSeqRef.current++
    abortRef.current?.abort()
    clearMessages()
    setInspector(EMPTY_INSPECTOR)
  }, [clearMessages])

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
    sendMessage,
    regenerate,
    editMessage,
    forkMessage,
    stopStreaming,
    clearChat,
  }
}
