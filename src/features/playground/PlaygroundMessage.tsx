import { Check, ChevronRight, Copy, GitBranch, Pencil, RefreshCw } from 'lucide-react'
import { type FormEvent, useCallback, useState } from 'react'
import Markdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { Tooltip } from '../../components/Tooltip'
import { cn } from '../../lib/cn'
import type { ChatMessage } from '../../lib/stream-chat'

type Props = {
  message: ChatMessage
  index: number
  isLast: boolean
  isStreaming: boolean
  isReasoning: boolean
  onRegenerate: (index: number) => void
  onEdit: (index: number, content: string) => void
  onFork: (index: number) => void
}

export function PlaygroundMessage({
  message,
  index,
  isLast,
  isStreaming,
  isReasoning,
  onRegenerate,
  onEdit,
  onFork,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [copied, setCopied] = useState(false)
  const [reasoningOpen, setReasoningOpen] = useState(false)

  const startEdit = useCallback(() => {
    setEditValue(message.content)
    setEditing(true)
  }, [message.content])

  const submitEdit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      if (!editValue.trim()) return
      setEditing(false)
      onEdit(index, editValue.trim())
    },
    [editValue, index, onEdit],
  )

  const copyContent = useCallback(async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [message.content])

  const isAssistant = message.role === 'assistant'
  const showActions = !isStreaming || !isLast
  const metrics = message.metrics

  return (
    <div
      className={cn(
        'group flex max-w-[min(100%,920px)] min-w-0 flex-col gap-1 animate-[msg-in_var(--duration-slow)_var(--ease-out)]',
        isAssistant ? 'w-[min(100%,920px)] self-start' : 'w-fit self-end',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-fg-dim">
          {isAssistant ? 'assistant' : 'you'}
        </span>
        {isAssistant && metrics?.ttftMs != null ? (
          <span className="font-mono text-[11px] text-fg-dim">
            <span>{Math.round(metrics.ttftMs)}ms ttft</span>
            {metrics.totalMs != null ? <span>→ {(metrics.totalMs / 1000).toFixed(2)}s total</span> : null}
          </span>
        ) : null}
      </div>

      {isAssistant && message.reasoningContent ? (
        <div className="overflow-hidden rounded-sm border border-border text-xs">
          <button
            type="button"
            className="flex w-full items-center gap-1.5 bg-surface-0 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-fg-dim hover:bg-surface-1"
            onClick={() => setReasoningOpen(!reasoningOpen)}
          >
            <ChevronRight
              className={cn('icon-12 transition-transform duration-150', reasoningOpen && 'rotate-90')}
              strokeWidth={2}
            />
            <span>reasoning</span>
            {isReasoning && isLast ? <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pg-pulse" /> : null}
            {message.reasoningTimeMs ? (
              <span className="dim">{(message.reasoningTimeMs / 1000).toFixed(1)}s</span>
            ) : null}
          </button>
          <pre
            className={cn(
              'm-0 max-h-0 overflow-hidden px-3 font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-words text-fg-dim opacity-0 transition-[max-height,opacity,padding] duration-150 ease-out',
              reasoningOpen && 'max-h-[300px] overflow-y-auto px-3 py-2.5 opacity-100',
            )}
          >
            {message.reasoningContent}
          </pre>
        </div>
      ) : null}

      {editing ? (
        <form onSubmit={submitEdit} className="flex flex-col gap-1.5">
          <textarea
            className="w-full resize-y rounded border border-accent bg-surface-1 px-3.5 py-2.5 text-[13px] leading-[1.55] text-fg"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            rows={Math.min(editValue.split('\n').length + 1, 12)}
          />
          <div className="flex gap-1.5">
            <button type="submit" className="btn btn-ghost btn-xs">
              save & send
            </button>
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => setEditing(false)}>
              cancel
            </button>
          </div>
        </form>
      ) : (
        <div
          className={cn(
            'min-w-0 overflow-hidden rounded border border-border bg-surface-1 px-3.5 py-2.5 text-[13px] leading-[1.55] text-fg [overflow-wrap:anywhere]',
            !isAssistant &&
              'border-[color:color-mix(in_srgb,var(--accent)_20%,var(--border))] bg-[color:color-mix(in_srgb,var(--accent)_8%,var(--bg-1))]',
            isAssistant && 'pg-msg-markdown',
          )}
        >
          {isAssistant ? (
            <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {message.content || (isStreaming && isLast ? '…' : '')}
            </Markdown>
          ) : (
            <p className="m-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.content}</p>
          )}
        </div>
      )}

      {isAssistant && metrics && showActions ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-fg-dim">
          <span>ttft {metrics.ttftMs != null ? `${Math.round(metrics.ttftMs)} ms` : '—'}</span>
          <span>total {metrics.totalMs != null ? `${(metrics.totalMs / 1000).toFixed(2)} s` : '—'}</span>
          <span>tok/s {metrics.tokPerSec != null ? metrics.tokPerSec.toFixed(1) : '—'}</span>
          <span>tokens {metrics.tokIn != null ? `${metrics.tokIn} in` : '—'}</span>
          <span>{metrics.tokOut != null ? `${metrics.tokOut} out` : '—'}</span>
          <span className="min-w-2" />
          <Tooltip label="Copy">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-[3px] border border-transparent px-1.5 py-1 text-[11px] text-fg-dim transition-colors hover:border-border hover:bg-surface-2 hover:text-fg"
              onClick={copyContent}
            >
              <span className={cn('copy-icon-swap', copied && 'copy-icon-swap-done')}>
                <Copy className="copy-icon-swap-from icon-12" strokeWidth={2} />
                <Check className="copy-icon-swap-to icon-12 text-ok" strokeWidth={2} />
              </span>
              copy
            </button>
          </Tooltip>
          <Tooltip label="Regenerate">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-[3px] border border-transparent px-1.5 py-1 text-[11px] text-fg-dim transition-colors hover:border-border hover:bg-surface-2 hover:text-fg"
              onClick={() => onRegenerate(index)}
            >
              <RefreshCw className="icon-12" strokeWidth={2} />
              re-run
            </button>
          </Tooltip>
          <Tooltip label="Fork from here">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-[3px] border border-transparent px-1.5 py-1 text-[11px] text-fg-dim transition-colors hover:border-border hover:bg-surface-2 hover:text-fg"
              onClick={() => onFork(index)}
            >
              <GitBranch className="icon-12" strokeWidth={2} />
              fork
            </button>
          </Tooltip>
        </div>
      ) : null}

      {!isAssistant && showActions ? (
        <div className="flex gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <Tooltip label="Edit">
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-sm bg-transparent text-fg-dim transition-[background-color,color,transform] duration-100 hover:bg-surface-1 hover:text-fg active:scale-90"
              onClick={startEdit}
            >
              <Pencil className="icon-12" strokeWidth={2} />
            </button>
          </Tooltip>
          <Tooltip label="Copy">
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-sm bg-transparent text-fg-dim transition-[background-color,color,transform] duration-100 hover:bg-surface-1 hover:text-fg active:scale-90"
              onClick={copyContent}
            >
              <span className={cn('copy-icon-swap', copied && 'copy-icon-swap-done')}>
                <Copy className="copy-icon-swap-from icon-12" strokeWidth={2} />
                <Check className="copy-icon-swap-to icon-12 text-ok" strokeWidth={2} />
              </span>
            </button>
          </Tooltip>
        </div>
      ) : null}
    </div>
  )
}
