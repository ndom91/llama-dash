import type { RoutingRule } from '../../lib/api'
import { Chip } from './routing-ui'
import { formatRuleSummary } from './routing-summary'

export function RoutingRulePreview({ draft, keyMap }: { draft: RoutingRule; keyMap: Map<string, string> }) {
  const preview = formatRuleSummary(draft, keyMap)

  return (
    <div className="rounded border border-border bg-surface-2 px-4 py-4 font-mono text-xs leading-6 text-fg-dim">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-accent">WHEN</span>
        {preview.when.map((item) => (
          <div key={`preview-when-${item}`} className="contents">
            <Chip tone="info">{item}</Chip>
            {item !== preview.when[preview.when.length - 1] ? <span>and</span> : null}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-accent">THEN</span>
        <Chip tone={draft.action.type === 'reject' ? 'err' : draft.action.type === 'continue' ? 'info' : 'ok'}>
          {preview.then}
        </Chip>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-accent">AUTH</span>
        <Chip tone={draft.authMode === 'passthrough' ? 'info' : 'default'}>{preview.auth}</Chip>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-accent">TARGET</span>
        <Chip tone={draft.target.type === 'direct' ? 'info' : 'default'}>{preview.target}</Chip>
      </div>
    </div>
  )
}
