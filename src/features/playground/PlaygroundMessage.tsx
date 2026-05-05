import { ChevronRight, GitBranch, Pencil, RefreshCw } from 'lucide-react'
import { type FormEvent, useCallback, useState } from 'react'
import Markdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { CopyButton } from '../../components/CopyButton'
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

  const isAssistant = message.role === 'assistant'
  const showActions = !isStreaming || !isLast
  const metrics = message.metrics
  const metricItems = metrics
    ? [
        `ttft ${metrics.ttftMs != null ? `${Math.round(metrics.ttftMs)} ms` : '—'}`,
        `total ${metrics.totalMs != null ? `${(metrics.totalMs / 1000).toFixed(2)} s` : '—'}`,
        `tok/s ${metrics.tokPerSec != null ? metrics.tokPerSec.toFixed(1) : '—'}`,
        `tokens ${metrics.tokIn != null ? `${metrics.tokIn} in` : '—'}`,
        metrics.tokOut != null ? `${metrics.tokOut} out` : '—',
      ]
    : []

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
            'min-w-0 overflow-hidden rounded border px-3.5 py-2.5 text-[13px] leading-[1.55] text-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] [overflow-wrap:anywhere]',
            isAssistant && 'border-border bg-surface-1',
            !isAssistant && 'border-border-strong bg-surface-2',
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
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 font-mono text-[11px] text-fg-dim">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {metricItems.map((item, itemIndex) => (
              <span key={item} className="inline-flex items-center gap-1.5">
                {itemIndex > 0 ? <span className="text-fg-faint">·</span> : null}
                <span>{item}</span>
              </span>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Tooltip label="Copy">
              <CopyButton
                text={message.content}
                className="btn btn-ghost btn-xs font-mono text-[11px] font-normal text-fg-dim"
              />
            </Tooltip>
            <Tooltip label="Regenerate">
              <button
                type="button"
                className="btn btn-ghost btn-xs font-mono text-[11px] font-normal text-fg-dim"
                onClick={() => onRegenerate(index)}
              >
                <RefreshCw className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
                re-run
              </button>
            </Tooltip>
            <Tooltip label="Fork from here">
              <button
                type="button"
                className="btn btn-ghost btn-xs font-mono text-[11px] font-normal text-fg-dim"
                onClick={() => onFork(index)}
              >
                <GitBranch className="icon-btn-12" strokeWidth={2} aria-hidden="true" />
                fork
              </button>
            </Tooltip>
          </div>
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
            <CopyButton text={message.content} variant="icon" ariaLabel="Copy message" />
          </Tooltip>
        </div>
      ) : null}
    </div>
  )
}
