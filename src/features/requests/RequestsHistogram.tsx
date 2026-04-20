import { useMemo } from 'react'
import { Tooltip } from '../../components/Tooltip'
import type { ApiHistogramBucket } from '../../lib/api'

type Props = {
  buckets: Array<ApiHistogramBucket>
}

export function RequestsHistogram({ buckets }: Props) {
  const maxTotal = useMemo(() => {
    const peak = Math.max(...buckets.map((b) => b.total))
    return Math.max(Math.ceil(peak * 1.1), 5)
  }, [buckets])

  return (
    <div className="histogram">
      {buckets.map((b) => {
        const ok = b.total - b.errors
        const barPx = 72
        const okH = ok > 0 ? Math.max(Math.sqrt(ok / maxTotal) * barPx, 3) : 2
        const errH = b.errors > 0 ? Math.max(Math.sqrt(b.errors / maxTotal) * barPx, 3) : 0
        const empty = b.total === 0
        const time = new Date(b.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        const errSuffix = b.errors ? ` (${b.errors} err)` : ''
        const label = empty ? time : `${time} · ${b.total}${errSuffix}`
        return (
          <div key={b.timestamp} className="histogram-bar">
            <Tooltip label={label} side="top">
              <div className="histogram-bar-inner">
                {errH > 0 ? <div className="histogram-bar-err" style={{ height: errH }} /> : null}
                {okH > 0 ? (
                  <div className="histogram-bar-ok" style={{ height: okH, opacity: empty ? 0.15 : undefined }} />
                ) : null}
              </div>
            </Tooltip>
          </div>
        )
      })}
    </div>
  )
}
