import { useCallback, useRef, useState } from 'react'
import { countTokens } from 'gpt-tokenizer'
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

let nextId = 0
function msgId() {
  return `msg_${Date.now()}_${nextId++}`
}

function estimatePromptTokens(messages: Array<{ role: string; content: string }>) {
  // `gpt-tokenizer` needs an OpenAI chat model to count structured chat
  // messages. Our playground models are arbitrary llama.cpp / peer IDs, so
  // fall back to counting the flattened prompt text as a stable estimate.
  return countTokens(messages.map((message) => message.content).join('\n\n'))
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

      const abort = new AbortController()
      abortRef.current = abort

      const timings = {
        requestAt: 0,
        firstByteAt: 0,
        firstContentAt: 0,
        doneAt: 0,
        closeAt: 0,
        promptMs: 0,
        predictedMs: 0,
      }
      const events: Array<InspectorEvent> = []
      const usage: { prompt?: number; completion?: number } = {}

      let evSeq = 0
      let finalized = false
      const isCurrentRun = () => runSeqRef.current === runId
      const pushEvent = (tag: string, text: string) => {
        if (!isCurrentRun()) return
        const ev = { id: `ev_${Date.now()}_${evSeq++}`, at: Date.now(), tag, text }
        events.push(ev)
        setInspector((prev) => ({ ...prev, events: [...events] }))
      }

      try {
        const apiMsgs = buildApiMessages(msgs)
        const estimatedPromptTokens = estimatePromptTokens(apiMsgs)
        const activeModel = models?.find((item) => item.id === model)
        const includeTimings = activeModel?.kind !== 'peer'
        const apiKey = await loadApiKey()
        const applyFinalMetrics = (closeAt?: number) => {
          const ttftMs = timings.firstContentAt ? timings.firstContentAt - timings.requestAt : undefined
          const totalMs = timings.doneAt ? timings.doneAt - timings.requestAt : undefined
          const decodeMs =
            timings.predictedMs ||
            (timings.doneAt && timings.firstContentAt ? timings.doneAt - timings.firstContentAt : undefined)
          const streamCloseMs = closeAt && timings.doneAt ? Math.max(0, closeAt - timings.doneAt) : undefined
          const tokOut = usage.completion
          const tokPerSec = tokOut != null && decodeMs ? (tokOut / decodeMs) * 1000 : undefined
          const metrics: MessageMetrics = {
            ttftMs,
            totalMs,
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
              queueMs: null,
              swapMs: null,
              prefillMs: timings.promptMs || ttftMs || null,
              decodeMs: decodeMs ?? null,
              streamCloseMs: streamCloseMs ?? prev.timing.streamCloseMs,
            },
          }))
        }

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
              case 'timings':
                if (ev.promptMs != null) timings.promptMs = ev.promptMs
                if (ev.predictedMs != null) timings.predictedMs = ev.predictedMs
                break
              case 'done':
                timings.doneAt = ev.at
                pushEvent('STOP', `finish_reason=${ev.finishReason ?? 'stop'}`)
                if (!finalized) {
                  finalized = true
                  pushEvent(
                    'RES',
                    `200 OK · ${usage.completion ?? '?'} tok · ${timings.doneAt && timings.requestAt ? `${((timings.doneAt - timings.requestAt) / 1000).toFixed(2)}s` : '—'}`,
                  )
                  applyFinalMetrics()
                  if (isCurrentRun()) setIsStreaming(false)
                }
                break
              case 'closed':
                timings.closeAt = ev.at
                if (finalized) applyFinalMetrics(ev.at)
                break
              case 'error':
                pushEvent('ERR', ev.message)
                break
            }
          },
        })

        let reasoningStart = 0

        for await (const chunk of stream) {
          if (chunk.done) continue

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

        if (!finalized) {
          finalized = true
          applyFinalMetrics(timings.closeAt || undefined)
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // keep partial response
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
