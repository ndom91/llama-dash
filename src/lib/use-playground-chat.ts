import { useCallback, useEffect, useRef, useState } from 'react'
import { type ChatMessage, streamChatCompletion } from './stream-chat'

const LS_MESSAGES = 'playground-messages'
const LS_MODEL = 'playground-model'
const LS_SYSTEM = 'playground-system-prompt'
const LS_TEMP = 'playground-temperature'

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

let nextId = 0
function msgId() {
  return `msg_${Date.now()}_${nextId++}`
}

export function usePlaygroundChat() {
  const [messages, setMessages] = useState<Array<ChatMessage>>(() => loadJson(LS_MESSAGES, []))
  const [model, setModelState] = useState(() => localStorage.getItem(LS_MODEL) ?? '')
  const [systemPrompt, setSystemPromptState] = useState(() => localStorage.getItem(LS_SYSTEM) ?? '')
  const [temperature, setTemperatureState] = useState(() => loadJson(LS_TEMP, 0.7))
  const [isStreaming, setIsStreaming] = useState(false)
  const [isReasoning, setIsReasoning] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

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

  const setTemperature = useCallback((v: number) => {
    setTemperatureState(v)
    localStorage.setItem(LS_TEMP, JSON.stringify(v))
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
      const reasoningStart = { current: 0 }

      try {
        const apiMsgs = buildApiMessages(msgs)
        const stream = streamChatCompletion(apiMsgs, model, temperature, abort.signal)

        for await (const chunk of stream) {
          if (chunk.done) break

          if (chunk.reasoningContent) {
            if (!reasoningStart.current) {
              reasoningStart.current = Date.now()
              setIsReasoning(true)
            }
            assistantMsg.reasoningContent = (assistantMsg.reasoningContent ?? '') + chunk.reasoningContent
          }

          if (chunk.content) {
            if (reasoningStart.current && !assistantMsg.reasoningTimeMs) {
              assistantMsg.reasoningTimeMs = Date.now() - reasoningStart.current
              setIsReasoning(false)
            }
            assistantMsg.content += chunk.content
          }

          setMessages([...msgs, { ...assistantMsg }])
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
        setIsStreaming(false)
        setIsReasoning(false)
        abortRef.current = null
      }
    },
    [model, temperature, buildApiMessages],
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

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clearChat = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    localStorage.removeItem(LS_MESSAGES)
  }, [])

  return {
    messages,
    model,
    setModel,
    systemPrompt,
    setSystemPrompt,
    temperature,
    setTemperature,
    isStreaming,
    isReasoning,
    sendMessage,
    regenerate,
    editMessage,
    stopStreaming,
    clearChat,
  }
}
