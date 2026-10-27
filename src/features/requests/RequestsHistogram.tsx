import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Tooltip } from '../../components/Tooltip'
import type { ApiHistogramBucket } from '../../lib/api'
import { cn } from '../../lib/cn'
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
        const time = new Date(b.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        const label = `${time} · ${b.total} requests${b.errors ? ` (${b.errors} err)` : ''}`
        return (
          <Tooltip key={b.timestamp} label={label} side="top">
            <button
              type="button"
              data-minute={b.timestamp}
              aria-label={label}
              aria-describedby={instructionsId}
              aria-pressed={active.includes(b.timestamp)}
              className="histogram-bar cursor-pointer rounded-sm border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-accent"
              onClick={(e) => {
                if (e.detail === 0) select(b.timestamp, e.shiftKey, e.ctrlKey || e.metaKey)
              }}
            >
              <div
                className={cn(
                  'histogram-bar-inner',
                  active.includes(b.timestamp) && 'outline-1 outline-fg/70',
                  active.length > 0 && !active.includes(b.timestamp) && 'opacity-40',
                )}
                aria-hidden="true"
              >
                {errH > 0 ? <div className="histogram-bar-err" style={{ height: errH }} /> : null}
                <div
                  className="histogram-bar-ok"
                  style={{ height: okH, opacity: empty ? (active.includes(b.timestamp) ? 0.65 : 0.15) : undefined }}
                />
              </div>
            </button>
          </Tooltip>
        )
      })}
    </div>
  )
}
