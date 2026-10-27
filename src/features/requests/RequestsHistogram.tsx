import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Tooltip } from '../../components/Tooltip'
import type { ApiHistogramBucket } from '../../lib/api'
import { isTypingTarget } from '../../lib/is-typing-target'

type Props = {
  buckets: Array<ApiHistogramBucket>
  selected: number[]
  onSelect: (minutes: number[]) => void
}

function range(buckets: ApiHistogramBucket[], start: number, end: number): number[] {
  const low = Math.min(start, end)
  const high = Math.max(start, end)
  return buckets.filter((b) => b.timestamp >= low && b.timestamp <= high).map((b) => b.timestamp)
}

export function RequestsHistogram({ buckets, selected, onSelect }: Props) {
  const instructionsId = useId()
  const chartRef = useRef<HTMLDivElement>(null)
  const anchor = useRef<number | null>(null)
  const drag = useRef<{
    start: number
    end: number
    x: number
    moved: boolean
    additive: boolean
    original: number[]
  } | null>(null)
  const [preview, setPreview] = useState<number[] | null>(null)
  useEffect(() => {
    if (selected.length === 0) anchor.current = null
  }, [selected])
  useEffect(() => {
    if (selected.length === 0) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || isTypingTarget(event)) return
      if (document.activeElement instanceof HTMLElement && chartRef.current?.contains(document.activeElement)) {
        document.activeElement.blur()
      }
      onSelect([])
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selected.length, onSelect])
  const active = preview ?? selected
  const maxTotal = useMemo(() => Math.max(Math.ceil(Math.max(...buckets.map((b) => b.total)) * 1.1), 5), [buckets])

  const select = (timestamp: number, shift: boolean, additive: boolean) => {
    let next: number[]
    if (shift && anchor.current != null) next = range(buckets, anchor.current, timestamp)
    else if (additive)
      next = selected.includes(timestamp) ? selected.filter((n) => n !== timestamp) : [...selected, timestamp]
    else next = [timestamp]
    if (!shift) anchor.current = timestamp
    onSelect(next.sort((a, b) => a - b))
  }

  return (
    <div
      ref={chartRef}
      className="histogram select-none touch-none"
      data-request-histogram
      onPointerDown={(e) => {
        if (e.button !== 0) return
        const target = (e.target as HTMLElement).closest<HTMLElement>('[data-minute]')
        if (!target) return
        const timestamp = Number(target.dataset.minute)
        if (e.shiftKey) {
          select(timestamp, true, false)
          return
        }
        drag.current = {
          start: timestamp,
          end: timestamp,
          x: e.clientX,
          moved: false,
          additive: e.ctrlKey || e.metaKey,
          original: selected,
        }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        const state = drag.current
        if (!state) return
        if (Math.abs(e.clientX - state.x) >= 4) state.moved = true
        if (!state.moved) return
        const bars = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-minute]'))
        const target = bars.find((bar) => e.clientX <= bar.getBoundingClientRect().right) ?? bars.at(-1)
        if (!target) return
        state.end = Number(target.dataset.minute)
        const span = range(buckets, state.start, state.end)
        setPreview(state.additive ? [...new Set([...state.original, ...span])].sort((a, b) => a - b) : span)
      }}
      onPointerUp={(e) => {
        const state = drag.current
        if (!state) return
        if (state.moved) {
          const span = range(buckets, state.start, state.end)
          onSelect((state.additive ? [...new Set([...state.original, ...span])] : span).sort((a, b) => a - b))
          anchor.current = state.start
        } else select(state.start, false, state.additive)
        drag.current = null
        setPreview(null)
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
      }}
      onPointerCancel={() => {
        drag.current = null
        setPreview(null)
      }}
      onLostPointerCapture={() => {
        drag.current = null
        setPreview(null)
      }}
    >
      <span id={instructionsId} className="sr-only">
        Select a minute. Shift selects a range; Control or Command toggles individual minutes.
      </span>
      {buckets.map((b) => {
        const ok = b.total - b.errors
        const okH = ok > 0 ? Math.max(Math.sqrt(ok / maxTotal) * 72, 3) : 2
        const errH = b.errors > 0 ? Math.max(Math.sqrt(b.errors / maxTotal) * 72, 3) : 0
        const empty = b.total === 0
        const isSelected = active.includes(b.timestamp)
        const time = new Date(b.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        const label = `${time} · ${b.total} requests${b.errors ? ` (${b.errors} err)` : ''}`
        return (
          <div key={b.timestamp} className="histogram-bar">
            <Tooltip label={label} side="top">
              <button
                type="button"
                data-minute={b.timestamp}
                aria-label={label}
                aria-describedby={instructionsId}
                aria-pressed={isSelected}
                className="relative w-full shrink-0 cursor-pointer border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-accent before:absolute before:bottom-0 before:left-0 before:h-[90px] before:w-full before:content-['']"
                onClick={(e) => {
                  if (e.detail === 0) select(b.timestamp, e.shiftKey, e.ctrlKey || e.metaKey)
                }}
              >
                <div className="histogram-bar-inner" aria-hidden="true">
                  {errH > 0 ? <div className="histogram-bar-err" style={{ height: errH }} /> : null}
                  <div
                    className="histogram-bar-ok"
                    style={{
                      height: okH,
                      background: isSelected ? 'var(--accent)' : undefined,
                      opacity: empty ? (isSelected ? 1 : 0.15) : undefined,
                    }}
                  />
                </div>
              </button>
            </Tooltip>
          </div>
        )
      })}
    </div>
  )
}
