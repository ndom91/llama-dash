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
    <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)_360px] items-stretch gap-0 max-[1200px]:grid-cols-[260px_minmax(0,1fr)] max-[1200px]:[&>.pg-inspector-shell]:hidden max-[900px]:grid-cols-1 max-[900px]:[&>.pg-session-shell]:hidden">
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

      <section className="panel !rounded-none !border-t-0 !bg-transparent flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-r border-[color:color-mix(in_srgb,var(--border)_86%,transparent)]">
        <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-2 text-[11px] font-mono text-fg-dim">
          <div className="flex min-w-0 items-center gap-1.5">
            <StatusDot tone={activeModel?.running ? 'ok' : 'idle'} live={activeModel?.running ?? false} />
            <span className="truncate text-fg" translate="no">
              {activeModel?.id ?? chat.model ?? '—'}
            </span>
            {activeModel ? (
              <>
                <span>·</span>
                <span className="uppercase tracking-[0.06em]">{activeModel.kind}</span>
              </>
            ) : null}
            <span>·</span>
            <span>ctx 32K</span>
          </div>
          <div className="flex items-center gap-1.5">
            {lastAssistant?.metrics ? (
              <>
                {lastAssistant.metrics.ttftMs != null ? (
                  <span>ttft {Math.round(lastAssistant.metrics.ttftMs)}ms</span>
                ) : null}
                {lastAssistant.metrics.tokPerSec != null ? (
                  <>
                    <span>·</span>
                    <span>{lastAssistant.metrics.tokPerSec.toFixed(1)} tok/s</span>
                  </>
                ) : null}
                {lastAssistant.metrics.tokOut != null ? (
                  <>
                    <span>·</span>
                    <span>{lastAssistant.metrics.tokOut} tok</span>
                  </>
                ) : null}
              </>
            ) : (
              <span className="dim">idle</span>
            )}
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex flex-1 flex-col gap-3 overflow-y-auto bg-[color-mix(in_srgb,var(--bg-1)_22%,transparent)] px-3 pt-2 pb-3"
          onScroll={onScroll}
        >
          {chat.messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[13px] text-fg-faint">
              <MessageSquare className="h-10 w-10 opacity-30" strokeWidth={1.25} />
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

        <div>
          <form className="flex items-end gap-2 border-b border-border px-4 py-3" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              className="max-h-[200px] flex-1 resize-none overflow-hidden rounded border border-border bg-surface-1 px-3 py-2 text-[13px] leading-6 text-fg transition-[border-color,box-shadow] duration-100 ease-out focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
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
              <button
                type="submit"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-accent text-white transition-[opacity,transform] duration-150 ease-out hover:opacity-85 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!chat.model || chat.isStreaming || !draft.trim()}
              >
                <Send className="icon-14" strokeWidth={2} />
              </button>
            </Tooltip>
          </form>
          <div className="flex gap-4 px-4 py-2 font-mono text-[10px] text-fg-faint">
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
