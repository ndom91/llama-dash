import { Check, ChevronRight, Copy, Pencil, RefreshCw } from 'lucide-react'
import { type FormEvent, useCallback, useState } from 'react'
import Markdown from 'react-markdown'
import { cn } from '../lib/cn'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '../lib/stream-chat'
import { Tooltip } from './Tooltip'

export function PlaygroundMessage({
  message,
  index,
  isLast,
  isStreaming,
  isReasoning,
  onRegenerate,
  onEdit,
}: {
  message: ChatMessage
  index: number
  isLast: boolean
  isStreaming: boolean
  isReasoning: boolean
  onRegenerate: (index: number) => void
  onEdit: (index: number, content: string) => void
}) {
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

  return (
    <div className={`pg-msg pg-msg-${message.role}`}>
      <div className="pg-msg-role">{isAssistant ? 'assistant' : 'you'}</div>

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
        <div className={`pg-msg-content${isAssistant ? ' pg-msg-markdown' : ''}`}>
          {isAssistant ? (
            <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {message.content || (isStreaming && isLast ? '...' : '')}
            </Markdown>
          ) : (
            <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{message.content}</p>
          )}
        </div>
      )}

      {showActions ? (
        <div className="pg-msg-actions">
          {message.role === 'user' ? (
            <Tooltip label="Edit">
              <button type="button" className="pg-action-btn" onClick={startEdit}>
                <Pencil className="icon-12" strokeWidth={2} />
              </button>
            </Tooltip>
          ) : null}
          {isAssistant ? (
            <Tooltip label="Regenerate">
              <button type="button" className="pg-action-btn" onClick={() => onRegenerate(index)}>
                <RefreshCw className="icon-12" strokeWidth={2} />
              </button>
            </Tooltip>
          ) : null}
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
