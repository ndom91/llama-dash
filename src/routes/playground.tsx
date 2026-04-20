import { createFileRoute } from '@tanstack/react-router'
import { BookOpen, ChevronDown, ImageIcon, MessageSquare, Mic, Play, Save, Send, Volume2, X } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { PlaygroundImage } from '../components/PlaygroundImage'
import { PlaygroundInspector } from '../components/PlaygroundInspector'
import { PlaygroundMessage } from '../components/PlaygroundMessage'
import { PlaygroundSession } from '../components/PlaygroundSession'
import { PlaygroundSpeech } from '../components/PlaygroundSpeech'
import { PlaygroundTranscribe } from '../components/PlaygroundTranscribe'
import { StatusDot } from '../components/StatusDot'
import { Tooltip } from '../components/Tooltip'
import { TopBar } from '../components/TopBar'
import { cn } from '../lib/cn'
import { useModels } from '../lib/queries'
import { usePlaygroundChat } from '../lib/use-playground-chat'

const LS_TAB = 'playground-tab'

type PlaygroundTab = 'chat' | 'image' | 'speech' | 'transcribe'

const TABS: Array<{ id: PlaygroundTab; label: string; Icon: typeof MessageSquare }> = [
  { id: 'chat', label: 'Chat', Icon: MessageSquare },
  { id: 'image', label: 'Image', Icon: ImageIcon },
  { id: 'speech', label: 'Speech', Icon: Volume2 },
  { id: 'transcribe', label: 'Transcribe', Icon: Mic },
]

export const Route = createFileRoute('/playground')({ component: Playground })

function Playground() {
  const [tab, setTabState] = useState<PlaygroundTab>(() => {
    if (typeof window === 'undefined') return 'chat'
    return (localStorage.getItem(LS_TAB) as PlaygroundTab) ?? 'chat'
  })

  const setTab = useCallback((t: PlaygroundTab) => {
    setTabState(t)
    localStorage.setItem(LS_TAB, t)
  }, [])

  const chat = usePlaygroundChat()

  return (
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page pg-page">
          <PageHeader
            kicker="dsh · playground · compare"
            title="Playground"
            subtitle="Test prompts against loaded models · inspector visible · multi-model"
            variant="integrated"
            action={
              tab === 'chat' ? (
                <HeaderActions
                  presets={chat.presets}
                  savedRuns={chat.savedRuns}
                  onSavePreset={chat.savePreset}
                  onApplyPreset={chat.applyPreset}
                  onDeletePreset={chat.deletePreset}
                  onSaveRun={chat.saveRun}
                  onLoadRun={chat.loadRun}
                  onDeleteRun={chat.deleteRun}
                />
              ) : undefined
            }
          />

          <div className="pg-tab-bar pg-tab-bar-integrated">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={cn('pg-tab', tab === t.id && 'pg-tab-active')}
                onClick={() => setTab(t.id)}
              >
                <t.Icon className="icon-12" strokeWidth={2} />
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'chat' ? <ChatTab chat={chat} /> : null}
          {tab === 'image' ? <PlaygroundImage /> : null}
          {tab === 'speech' ? <PlaygroundSpeech /> : null}
          {tab === 'transcribe' ? <PlaygroundTranscribe /> : null}
        </div>
      </div>
    </div>
  )
}

function ChatTab({ chat }: { chat: ReturnType<typeof usePlaygroundChat> }) {
  const { data: models } = useModels()
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const userScrolledUp = useRef(false)
  const [draft, setDraft] = useState('')
  const apiKeyRef = useRef<string | null>(null)

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
      const val = draft.trim()
      if (!val || chat.isStreaming) return
      chat.sendMessage(val)
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

function HeaderActions({
  presets,
  savedRuns,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
  onSaveRun,
  onLoadRun,
  onDeleteRun,
}: {
  presets: ReturnType<typeof usePlaygroundChat>['presets']
  savedRuns: ReturnType<typeof usePlaygroundChat>['savedRuns']
  onSavePreset: (name: string) => void
  onApplyPreset: (id: string) => void
  onDeletePreset: (id: string) => void
  onSaveRun: (name: string) => void
  onLoadRun: (id: string) => void
  onDeleteRun: (id: string) => void
}) {
  return (
    <>
      <DropMenu
        label="Presets"
        icon={<BookOpen className="icon-12" strokeWidth={2} />}
        items={presets.map((p) => ({
          id: p.id,
          label: p.name,
          sub: `${p.model || '—'} · t=${p.sampling.temperature.toFixed(2)}`,
        }))}
        onSelect={onApplyPreset}
        onDelete={onDeletePreset}
        onAdd={() => {
          const name = window.prompt('Preset name:')
          if (name?.trim()) onSavePreset(name.trim())
        }}
        addLabel="Save current as preset"
        emptyLabel="No presets yet."
      />
      <DropMenu
        label="Saved runs"
        icon={<Save className="icon-12" strokeWidth={2} />}
        items={savedRuns.map((r) => ({
          id: r.id,
          label: r.name,
          sub: `${r.messages.length} msgs · ${r.model || '—'}`,
        }))}
        onSelect={onLoadRun}
        onDelete={onDeleteRun}
        onAdd={() => {
          const name = window.prompt('Save run as:', `run-${new Date().toISOString().slice(11, 19)}`)
          if (name?.trim()) onSaveRun(name.trim())
        }}
        addLabel="Save current chat"
        emptyLabel="No saved runs."
      />
      <Tooltip label="Compare mode coming soon">
        <button type="button" className="btn btn-ghost btn-xs pg-run-all" disabled>
          <Play className="icon-12" strokeWidth={2} />
          Run all
        </button>
      </Tooltip>
    </>
  )
}

function DropMenu({
  label,
  icon,
  items,
  onSelect,
  onDelete,
  onAdd,
  addLabel,
  emptyLabel,
}: {
  label: string
  icon: React.ReactNode
  items: Array<{ id: string; label: string; sub?: string }>
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onAdd: () => void
  addLabel: string
  emptyLabel: string
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div className="pg-dropmenu" ref={wrapRef}>
      <button type="button" className="btn btn-ghost btn-xs" onClick={() => setOpen(!open)}>
        {icon}
        {label}
        <ChevronDown className="icon-10" strokeWidth={2} />
      </button>
      {open ? (
        <div className="pg-dropmenu-panel">
          <button
            type="button"
            className="pg-dropmenu-add"
            onClick={() => {
              setOpen(false)
              onAdd()
            }}
          >
            + {addLabel}
          </button>
          <div className="pg-dropmenu-list">
            {items.length === 0 ? (
              <p className="pg-dropmenu-empty">{emptyLabel}</p>
            ) : (
              items.map((it) => (
                <div key={it.id} className="pg-dropmenu-item">
                  <button
                    type="button"
                    className="pg-dropmenu-item-main"
                    onClick={() => {
                      setOpen(false)
                      onSelect(it.id)
                    }}
                  >
                    <span className="pg-dropmenu-item-label">{it.label}</span>
                    {it.sub ? <span className="pg-dropmenu-item-sub">{it.sub}</span> : null}
                  </button>
                  <button
                    type="button"
                    className="pg-dropmenu-item-del"
                    onClick={() => onDelete(it.id)}
                    aria-label={`Delete ${it.label}`}
                  >
                    <X className="icon-10" strokeWidth={2.5} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
