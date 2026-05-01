import { ArrowDown, ArrowUp, PenLine, X } from 'lucide-react'
import type { RoutingRule } from '../../lib/api'
import { cn } from '../../lib/cn'
import { Chip, IconButton } from './routing-ui'
import { formatRuleSummary } from './routing-summary'

export function RoutingRuleRow({
  rule,
  index,
  totalRules,
  keyMap,
  editingRuleId,
  reorderPending,
  updatePending,
  deletePending,
  onToggle,
  onMove,
  onEdit,
  onDelete,
}: {
  rule: RoutingRule
  index: number
  totalRules: number
  keyMap: Map<string, string>
  editingRuleId: string | null
  reorderPending: boolean
  updatePending: boolean
  deletePending: boolean
  onToggle: (id: string) => void
  onMove: (id: string, direction: -1 | 1) => void
  onEdit: (rule: RoutingRule) => void
  onDelete: (id: string) => void
}) {
  const summary = formatRuleSummary(rule, keyMap)

  return (
    <article
      className={cn(
        'rounded-lg border border-border bg-surface-0 px-5 py-4 transition-colors',
        rule.enabled ? 'opacity-100' : 'opacity-65',
        editingRuleId === rule.id && 'border-accent/60 bg-surface-2/60',
      )}
    >
      <div className="flex items-start gap-4 max-md:flex-col">
        <div className="flex min-w-[70px] items-center gap-3 font-mono text-xs text-fg-dim">
          <span className="rounded border border-border bg-surface-1 px-2 py-1 text-[11px] text-fg-muted">
            {String(rule.order).padStart(2, '0')}
          </span>
          <button
            type="button"
            onClick={() => onToggle(rule.id)}
            className={cn(
              'relative inline-flex h-5 w-8 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:shadow-focus',
              rule.enabled ? 'border-accent bg-accent/30' : 'border-border bg-surface-3',
            )}
            aria-pressed={rule.enabled}
          >
            <span
              className={cn(
                'inline-block h-3.5 w-3.5 rounded-full bg-fg transition-transform',
                rule.enabled ? 'translate-x-[14px]' : 'translate-x-[2px]',
              )}
            />
          </button>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="m-0 text-base font-semibold text-fg">{rule.name}</h3>
            <span className="font-mono text-[11px] text-fg-dim">
              {rule.enabled ? 'enabled' : 'disabled'} · updated{' '}
              {new Date(rule.updatedAt).toLocaleDateString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>

          <div className="space-y-2 font-mono text-xs leading-6 text-fg-dim">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-accent">WHEN</span>
              {summary.when.map((item) => (
                <div key={`${rule.id}-when-${item}`} className="contents">
                  <Chip tone="info">{item}</Chip>
                  {item !== summary.when[summary.when.length - 1] ? <span>and</span> : null}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-accent">THEN</span>
              <Chip tone={rule.action.type === 'reject' ? 'err' : rule.action.type === 'noop' ? 'info' : 'ok'}>
                {summary.then}
              </Chip>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-accent">AUTH</span>
              <Chip tone={rule.authMode === 'passthrough' ? 'info' : 'default'}>{summary.auth}</Chip>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-accent">TRGT</span>
              <Chip tone={rule.target.type === 'direct' ? 'info' : 'default'}>{summary.target}</Chip>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 self-start">
          <IconButton
            icon={<ArrowUp className="icon-btn-12" strokeWidth={2} />}
            disabled={index === 0}
            busy={reorderPending}
            onClick={() => onMove(rule.id, -1)}
          />
          <IconButton
            icon={<ArrowDown className="icon-btn-12" strokeWidth={2} />}
            disabled={index === totalRules - 1}
            busy={reorderPending}
            onClick={() => onMove(rule.id, 1)}
          />
          <IconButton
            icon={<PenLine className="icon-btn-12" strokeWidth={2} />}
            busy={updatePending && editingRuleId === rule.id}
            onClick={() => onEdit(rule)}
          />
          <IconButton
            icon={<X className="icon-btn-12" strokeWidth={2} />}
            busy={deletePending}
            onClick={() => onDelete(rule.id)}
          />
        </div>
      </div>
    </article>
  )
}
