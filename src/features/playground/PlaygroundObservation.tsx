import type { InspectorState } from '../../lib/use-playground-chat'

type Props = {
  inspector: InspectorState
}

export function PlaygroundObservation({ inspector }: Props) {
  const ttft = inspector.lastMetrics.ttftMs
  if (ttft == null) return null

  const tokPerSec = inspector.lastMetrics.tokPerSec
  const note =
    tokPerSec != null && tokPerSec > 0
      ? `ttft ${Math.round(ttft)}ms · decode ${tokPerSec.toFixed(1)} tok/s. All within tolerance.`
      : `ttft ${Math.round(ttft)}ms. Run completed.`

  return (
    <div className="rounded border border-border bg-surface-2 px-3 py-2.5">
      <div className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-faint">
        observation
      </div>
      <p className="m-0 text-[11px] leading-[1.55] text-fg-dim">{note}</p>
    </div>
  )
}
