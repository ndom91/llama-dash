import { useNavigate } from '@tanstack/react-router'
import { Play, Power } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CopyButton } from '../../components/CopyButton'
import { StatusDot, stateTone } from '../../components/StatusDot'
import { Tooltip } from '../../components/Tooltip'
import type { ApiModel } from '../../lib/api'
import { clickableRowFocusClass, clickableRowProps } from '../../lib/clickable-row-props'
import { cn } from '../../lib/cn'
import { formatCapabilityLabel, getModelCapabilityBadges } from './modelUtils'

type Props = {
  model: ApiModel
  loading: boolean
  unloading: boolean
  onLoad: () => void
  onUnload: () => void
}

export function ModelRow({ model, loading, unloading, onLoad, onUnload }: Props) {
  const navigate = useNavigate()
  const tone = loading
    ? ('warn' as const)
    : unloading
      ? ('idle' as const)
      : model.kind === 'peer'
        ? ('warn' as const)
        : stateTone(model.state, model.running)
  const capabilityBadges = getModelCapabilityBadges(model)
  const pending = loading || unloading
  const actionLabel = loading ? 'loading…' : unloading ? 'unloading…' : model.running ? 'unload' : 'load'
  const actionDescription = loading ? 'Loading' : unloading ? 'Unloading' : model.running ? 'Unload' : 'Load'
  const ActionIcon = unloading || (!loading && model.running) ? Power : Play

  return (
    <tr
      className={cn('clickable-row h-10 last:border-b last:border-border', clickableRowFocusClass)}
      {...clickableRowProps(() => navigate({ to: '/models/$id', params: { id: model.id } }))}
    >
      <td className="model-row-dot">
        <StatusDot tone={tone} live={loading || model.running} />
      </td>
      <td className="model-row-id">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="mono max-md:break-all" translate="no">
            {model.id}
          </span>
          <Tooltip label="Copy model slug" side="top">
            <span className="inline-flex shrink-0">
              <CopyButton text={model.id} variant="icon" ariaLabel={`Copy model slug ${model.id}`} stopPropagation />
            </span>
          </Tooltip>
          {capabilityBadges.length > 0 ? (
            <span className="contents max-[768px]:hidden">
              <span className="sr-only">Capabilities: </span>
              {capabilityBadges.map((capability) => (
                <span
                  key={capability}
                  className="inline-flex rounded-sm border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[9px] leading-none tracking-[0.08em] text-fg-dim [text-box:trim-both_cap_alphabetic]"
                >
                  {formatCapabilityLabel(capability)}
                </span>
              ))}
            </span>
          ) : null}
        </div>
      </td>
      <td className={cn('model-row-name', model.name === model.id && 'max-[768px]:hidden')}>{model.name}</td>
      <td className="hide-mobile">
        <span className="mono" style={{ fontSize: 11, color: 'var(--fg-dim)' }}>
          {model.kind}
        </span>
      </td>
      <td className="hide-mobile model-row-state">
        <span className={`state-label state-label-${tone}`}>
          {loading ? 'loading' : unloading ? 'stopping' : model.kind === 'peer' ? 'peer' : model.state}
        </span>
      </td>
      <td className="num hide-mobile model-row-action">
        {model.kind === 'local' ? (
          <Tooltip label={`${actionDescription} ${model.id}`} side="left">
            <button
              type="button"
              className="btn btn-xs"
              disabled={pending}
              aria-label={`${actionDescription} ${model.id}`}
              onClick={(event) => {
                event.stopPropagation()
                if (model.running) onUnload()
                else onLoad()
              }}
            >
              <ActionIcon className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
              <AnimatedActionLabel label={actionLabel} />
            </button>
          </Tooltip>
        ) : (
          <span className="mono dim max-[768px]:hidden" style={{ fontSize: 11 }}>
            —
          </span>
        )}
      </td>
    </tr>
  )
}

function AnimatedActionLabel({ label }: { label: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [displayed, setDisplayed] = useState(label)
  const displayedRef = useRef(label)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (displayedRef.current === label) {
      el.classList.remove('is-exit', 'is-enter-start')
      return
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      displayedRef.current = label
      setDisplayed(label)
      return
    }
    const duration =
      Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--text-swap-dur')) || 150
    el.classList.remove('is-enter-start')
    el.classList.add('is-exit')
    let frame = 0
    const timer = window.setTimeout(() => {
      displayedRef.current = label
      setDisplayed(label)
      el.classList.remove('is-exit')
      el.classList.add('is-enter-start')
      frame = requestAnimationFrame(() => {
        void el.offsetHeight
        el.classList.remove('is-enter-start')
      })
    }, duration)
    return () => {
      window.clearTimeout(timer)
      cancelAnimationFrame(frame)
    }
  }, [label])
  return (
    <span ref={ref} className="t-text-swap" aria-hidden="true">
      {displayed}
    </span>
  )
}
