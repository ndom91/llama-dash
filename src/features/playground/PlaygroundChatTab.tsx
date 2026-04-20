import { MessageSquare, Send } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'
import { PlaygroundInspector } from './PlaygroundInspector'
import { PlaygroundMessage } from './PlaygroundMessage'
import { PlaygroundSession } from './PlaygroundSession'
import { StatusDot } from '../../components/StatusDot'
import { Tooltip } from '../../components/Tooltip'
import { useModels } from '../../lib/queries'
import type { usePlaygroundChat } from '../../lib/use-playground-chat'

type Props = {
  chat: ReturnType<typeof usePlaygroundChat>
}

export function PlaygroundChatTab({ chat }: Props) {
  const { data: models } = useModels()
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const userScrolledUp = useRef(false)
  const apiKeyRef = useRef<string | null>(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    fetch('/api/playground-key')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.key) apiKeyRef.current = d.key
      })
      .catch(() => {})
  }, [])

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
    (e?: FormEvent) => {
      e?.preventDefault()
      const value = draft.trim()
      if (!value || chat.isStreaming) return
      chat.sendMessage(value)
      setDraft('')
      if (inputRef.current) inputRef.current.style.height = 'auto'
      userScrolledUp.current = false
    },
    [draft, chat.sendMessage, chat.isStreaming],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  const autoResize = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [])

  const activeModel = models?.find((m) => m.id === chat.model)
  const lastAssistant = [...chat.messages].reverse().find((m) => m.role === 'assistant')

  return (
    <div className="pg-grid">
      <PlaygroundSession
        model={chat.model}
        setModel={chat.setModel}
        models={models ?? []}
        systemPrompt={chat.systemPrompt}
        setSystemPrompt={chat.setSystemPrompt}
        sampling={chat.sampling}
        setSampling={chat.setSampling}
        isStreaming={chat.isStreaming}
        hasMessages={chat.messages.length > 0}
        onStop={chat.stopStreaming}
        onClear={chat.clearChat}
        onSaveRun={chat.saveRun}
      />

      <section className="panel pg-chat-panel">
        <div className="pg-model-strip">
          <div className="pg-model-strip-l">
            <StatusDot tone={activeModel?.running ? 'ok' : 'idle'} live={activeModel?.running ?? false} />
            <span className="pg-model-id" translate="no">
              {activeModel?.id ?? chat.model ?? '—'}
            </span>
            {activeModel ? (
              <>
                <span className="pg-sep">·</span>
                <span className="pg-model-kind">{activeModel.kind}</span>
              </>
            ) : null}
            <span className="pg-sep">·</span>
            <span className="pg-model-ctx">ctx 32K</span>
          </div>
          <div className="pg-model-strip-r">
            {lastAssistant?.metrics ? (
              <>
                {lastAssistant.metrics.ttftMs != null ? (
                  <span>ttft {Math.round(lastAssistant.metrics.ttftMs)}ms</span>
                ) : null}
                {lastAssistant.metrics.tokPerSec != null ? (
                  <>
                    <span className="pg-sep">·</span>
                    <span>{lastAssistant.metrics.tokPerSec.toFixed(1)} tok/s</span>
                  </>
                ) : null}
                {lastAssistant.metrics.tokOut != null ? (
                  <>
                    <span className="pg-sep">·</span>
                    <span>{lastAssistant.metrics.tokOut} tok</span>
                  </>
                ) : null}
              </>
            ) : (
              <span className="dim">idle</span>
            )}
          </div>
        </div>

        <div ref={scrollRef} className="pg-chat-scroll" onScroll={onScroll}>
          {chat.messages.length === 0 ? (
            <div className="pg-empty">
              <MessageSquare className="pg-empty-icon" strokeWidth={1.25} />
              <span>Select a model and start chatting</span>
            </div>
          ) : (
            chat.messages.map((msg, index) => (
              <PlaygroundMessage
                key={msg.id}
                message={msg}
                index={index}
                isLast={index === chat.messages.length - 1}
                isStreaming={chat.isStreaming}
                isReasoning={chat.isReasoning}
                onRegenerate={chat.regenerate}
                onEdit={chat.editMessage}
                onFork={chat.forkMessage}
              />
            ))
          )}
        </div>

        <div className="pg-input-wrap">
          <form className="pg-input-bar border-t-0!" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              className="pg-input"
              placeholder={chat.model ? 'Type a message…' : 'Select a model first…'}
              disabled={!chat.model}
              rows={1}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                autoResize(e.currentTarget)
              }}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoComplete="off"
            />
            <Tooltip label="Send message">
              <button type="submit" className="pg-send-btn" disabled={!chat.model || chat.isStreaming || !draft.trim()}>
                <Send className="icon-14" strokeWidth={2} />
              </button>
            </Tooltip>
          </form>
          <div className="pg-input-hints">
            <span>
              <kbd>⏎</kbd> send
            </span>
            <span>
              <kbd>⇧⏎</kbd> newline
            </span>
            <span>
              <kbd>r</kbd> send & re-run
            </span>
          </div>
        </div>
      </section>

      <PlaygroundInspector model={chat.model} inspector={chat.inspector} apiKey={apiKeyRef.current} />
    </div>
  )
}
