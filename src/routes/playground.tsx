import { createFileRoute } from '@tanstack/react-router'
import { MessageSquare, Send } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useRef } from 'react'
import { PageHeader } from '../components/PageHeader'
import { PlaygroundMessage } from '../components/PlaygroundMessage'
import { PlaygroundSettings } from '../components/PlaygroundSettings'
import { TopBar } from '../components/TopBar'
import { usePlaygroundChat } from '../lib/use-playground-chat'

export const Route = createFileRoute('/playground')({ component: Playground })

function Playground() {
  const chat = usePlaygroundChat()
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const userScrolledUp = useRef(false)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'instant') => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior })
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new messages/tokens
  useEffect(() => {
    if (!userScrolledUp.current) scrollToBottom()
  }, [chat.messages, scrollToBottom])

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    userScrolledUp.current = el.scrollHeight - el.scrollTop - el.clientHeight > 40
  }, [])

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      const input = inputRef.current
      if (!input) return
      const val = input.value.trim()
      if (!val || chat.isStreaming) return
      chat.sendMessage(val)
      input.value = ''
      input.style.height = 'auto'
      userScrolledUp.current = false
    },
    [chat.sendMessage, chat.isStreaming],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit(e as unknown as FormEvent)
      }
    },
    [handleSubmit],
  )

  const autoResize = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [])

  return (
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page pg-page">
          <PageHeader kicker="§05 · playground" title="Playground" subtitle="chat with loaded models" />

          <PlaygroundSettings
            model={chat.model}
            setModel={chat.setModel}
            systemPrompt={chat.systemPrompt}
            setSystemPrompt={chat.setSystemPrompt}
            temperature={chat.temperature}
            setTemperature={chat.setTemperature}
            isStreaming={chat.isStreaming}
            hasMessages={chat.messages.length > 0}
            onStop={chat.stopStreaming}
            onClear={chat.clearChat}
          />

          <section className="panel pg-chat-panel">
            <div ref={scrollRef} className="pg-chat-scroll" onScroll={onScroll}>
              {chat.messages.length === 0 ? (
                <div className="pg-empty">
                  <MessageSquare className="pg-empty-icon" strokeWidth={1.25} />
                  <span>Select a model and start chatting</span>
                </div>
              ) : (
                chat.messages.map((msg, i) => (
                  <PlaygroundMessage
                    key={msg.id}
                    message={msg}
                    index={i}
                    isLast={i === chat.messages.length - 1}
                    isStreaming={chat.isStreaming}
                    isReasoning={chat.isReasoning}
                    onRegenerate={chat.regenerate}
                    onEdit={chat.editMessage}
                  />
                ))
              )}
            </div>

            <form className="pg-input-bar" onSubmit={handleSubmit}>
              <textarea
                ref={inputRef}
                className="pg-input"
                placeholder={
                  chat.model ? 'Type a message… (Enter to send, Shift+Enter for newline)' : 'Select a model first…'
                }
                disabled={!chat.model}
                rows={1}
                onKeyDown={handleKeyDown}
                onInput={(e) => autoResize(e.currentTarget)}
                spellCheck={false}
                autoComplete="off"
              />
              <button
                type="submit"
                className="pg-send-btn"
                disabled={!chat.model || chat.isStreaming}
                title="Send message"
              >
                <Send className="icon-14" strokeWidth={2} />
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}
