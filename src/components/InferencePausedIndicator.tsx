import { Play } from 'lucide-react'
import { useHealth, useSetInferencePaused } from '../lib/queries'
import { StatusDot } from './StatusDot'
import { Tooltip } from './Tooltip'

// Shown on every page while llama-swap rejects inference, so failed requests are explained.
export function InferencePausedIndicator() {
  const { data: health } = useHealth()
  const setPaused = useSetInferencePaused()
  if (health?.paused !== true) return null

  return (
    <span className="inline-flex items-center gap-2 rounded-sm border border-warn/40 bg-warn-bg py-0.5 pl-2 pr-0.5 font-mono text-[11px] text-warn">
      <StatusDot tone="warn" />
      <span>inference paused</span>
      <Tooltip label="Accept inference requests again" side="bottom">
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={() => setPaused.mutate(false)}
          disabled={setPaused.isPending}
        >
          <Play className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
          resume
        </button>
      </Tooltip>
    </span>
  )
}
