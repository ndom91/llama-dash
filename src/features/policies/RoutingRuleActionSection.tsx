import type { RoutingRule } from '../../lib/api'
import { setActionType, setRejectReason, setRewriteModel } from './routing-draft'
import { SegmentedControl, type RoutingActionType } from './routing-ui'

export function RoutingRuleActionSection({
  draft,
  modelOptions,
  onChange,
}: {
  draft: RoutingRule
  modelOptions: string[]
  onChange: (draft: RoutingRule) => void
}) {
  return (
    <>
      <div>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-accent">Then</span>
          <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">· one action</span>
        </div>
        <SegmentedControl
          options={[
            { value: 'rewrite_model', label: 'rewrite model' },
            { value: 'reject', label: 'reject' },
            { value: 'continue', label: 'continue' },
          ]}
          value={draft.action.type}
          onChange={(value) => onChange(setActionType(draft, value as RoutingActionType))}
        />
      </div>

      {draft.action.type === 'rewrite_model' ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">
            Rewrite requested model to
          </span>
          <select
            className="select-native h-9 rounded border border-border bg-surface-3 px-3 font-mono text-xs text-fg focus-visible:outline-none focus-visible:shadow-focus"
            value={draft.action.model}
            onChange={(event) => onChange(setRewriteModel(draft, event.target.value))}
          >
            <option value="">select model…</option>
            {modelOptions.map((modelId) => (
              <option key={modelId} value={modelId}>
                {modelId}
              </option>
            ))}
          </select>
          <span className="text-[11px] font-mono text-fg-dim">applied before upstream selection</span>
        </label>
      ) : null}

      {draft.action.type === 'reject' ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-fg-faint">Reject with reason</span>
          <textarea
            className="min-h-[120px] rounded border border-border bg-surface-3 px-3 py-2.5 font-mono text-xs text-fg focus-visible:outline-none focus-visible:shadow-focus"
            value={draft.action.reason}
            onChange={(event) => onChange(setRejectReason(draft, event.target.value))}
          />
        </label>
      ) : null}
    </>
  )
}
