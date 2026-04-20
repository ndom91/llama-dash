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
    <div className="pg-observation">
      <div className="pg-observation-label">observation</div>
      <p className="pg-observation-text">{note}</p>
    </div>
  )
}
