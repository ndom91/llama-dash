import { Check, ChevronRight, Copy, GitBranch, Pencil, RefreshCw } from 'lucide-react'
import { type FormEvent, useCallback, useState } from 'react'
import Markdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { Tooltip } from '../../components/Tooltip'
import { cn } from '../../lib/cn'
import type { ChatMessage } from '../../lib/stream-chat'
import { PlaygroundMetricChip } from './PlaygroundMetricChip'

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
    <div className={cn('pg-msg', `pg-msg-${message.role}`)}>
      <div className="pg-msg-head">
        <span className="pg-msg-role">{isAssistant ? 'assistant' : 'you'}</span>
        {isAssistant && metrics?.ttftMs != null ? (
          <span className="pg-msg-head-meta">
            <span>{Math.round(metrics.ttftMs)}ms ttft</span>
            {metrics.totalMs != null ? <span>→ {(metrics.totalMs / 1000).toFixed(2)}s total</span> : null}
          </span>
        ) : null}
      </div>

      {isAssistant && message.reasoningContent ? (
        <div className="pg-reasoning">
          <button type="button" className="pg-reasoning-toggle" onClick={() => setReasoningOpen(!reasoningOpen)}>
            <ChevronRight
              className={cn('icon-12 transition-transform duration-150', reasoningOpen && 'rotate-90')}
              strokeWidth={2}
            />
            <span>reasoning</span>
            {isReasoning && isLast ? <span className="pg-reasoning-pulse" /> : null}
            {message.reasoningTimeMs ? (
              <span className="dim">{(message.reasoningTimeMs / 1000).toFixed(1)}s</span>
            ) : null}
          </button>
          <pre className={cn('pg-reasoning-text', reasoningOpen && 'pg-reasoning-open')}>
            {message.reasoningContent}
          </pre>
        </div>
      ) : null}

      {editing ? (
        <form onSubmit={submitEdit} className="pg-edit-form">
          <textarea
            className="pg-edit-textarea"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            rows={Math.min(editValue.split('\n').length + 1, 12)}
          />
          <div className="pg-edit-actions">
            <button type="submit" className="btn btn-ghost btn-xs">
              save & send
            </button>
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => setEditing(false)}>
              cancel
            </button>
          </div>
        </form>
      ) : (
        <div className={cn('pg-msg-content', isAssistant && 'pg-msg-markdown')}>
          {isAssistant ? (
            <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {message.content || (isStreaming && isLast ? '…' : '')}
            </Markdown>
          ) : (
            <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{message.content}</p>
          )}
        </div>
      )}

      {isAssistant && metrics && showActions ? (
        <div className="pg-msg-metrics">
          <PlaygroundMetricChip
            label="ttft"
            value={metrics.ttftMs != null ? `${Math.round(metrics.ttftMs)} ms` : '—'}
          />
          <PlaygroundMetricChip
            label="total"
            value={metrics.totalMs != null ? `${(metrics.totalMs / 1000).toFixed(2)} s` : '—'}
          />
          <PlaygroundMetricChip label="tok/s" value={metrics.tokPerSec != null ? metrics.tokPerSec.toFixed(1) : '—'} />
          <PlaygroundMetricChip label="tokens" value={metrics.tokIn != null ? `${metrics.tokIn} in` : '—'} />
          <PlaygroundMetricChip label="" value={metrics.tokOut != null ? `${metrics.tokOut} out` : '—'} />
          <PlaygroundMetricChip
            label="cost"
            value={metrics.costUsd != null ? `$${metrics.costUsd.toFixed(4)}` : '~$0.0000'}
          />
          <span className="pg-msg-metric-gap" />
          <Tooltip label="Copy">
            <button type="button" className="pg-metric-action" onClick={copyContent}>
              <span className={cn('copy-icon-swap', copied && 'copy-icon-swap-done')}>
                <Copy className="copy-icon-swap-from icon-12" strokeWidth={2} />
                <Check className="copy-icon-swap-to icon-12 text-ok" strokeWidth={2} />
              </span>
              copy
            </button>
          </Tooltip>
          <Tooltip label="Regenerate">
            <button type="button" className="pg-metric-action" onClick={() => onRegenerate(index)}>
              <RefreshCw className="icon-12" strokeWidth={2} />
              re-run
            </button>
          </Tooltip>
          <Tooltip label="Fork from here">
            <button type="button" className="pg-metric-action" onClick={() => onFork(index)}>
              <GitBranch className="icon-12" strokeWidth={2} />
              fork
            </button>
          </Tooltip>
        </div>
      ) : null}

      {!isAssistant && showActions ? (
        <div className="pg-msg-actions">
          <Tooltip label="Edit">
            <button type="button" className="pg-action-btn" onClick={startEdit}>
              <Pencil className="icon-12" strokeWidth={2} />
            </button>
          </Tooltip>
          <Tooltip label="Copy">
            <button type="button" className="pg-action-btn" onClick={copyContent}>
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
