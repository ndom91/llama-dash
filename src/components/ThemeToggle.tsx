import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '../lib/cn'
import { Tooltip } from './Tooltip'

type ThemeMode = 'light' | 'dark' | 'auto'

function getInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'auto'
  const stored = window.localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored
  return 'auto'
}

function applyThemeMode(mode: ThemeMode) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const resolved = mode === 'auto' ? (prefersDark ? 'dark' : 'light') : mode

  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(resolved)

  if (mode === 'auto') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', mode)
  }

  document.documentElement.style.colorScheme = resolved
}

const order: Array<ThemeMode> = ['auto', 'light', 'dark']
const modeOptions: Array<{ mode: ThemeMode; label: string; Icon: typeof Monitor }> = [
  { mode: 'light', label: 'Light', Icon: Sun },
  { mode: 'dark', label: 'Dark', Icon: Moon },
  { mode: 'auto', label: 'System', Icon: Monitor },
]

export function ThemeToggle({ variant = 'icon' }: { variant?: 'icon' | 'segmented' }) {
  const [mode, setMode] = useState<ThemeMode>('auto')

  useEffect(() => {
    const initialMode = getInitialMode()
    setMode(initialMode)
    applyThemeMode(initialMode)
  }, [])

  useEffect(() => {
    if (mode !== 'auto') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyThemeMode('auto')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [mode])

  function selectMode(next: ThemeMode) {
    setMode(next)
    applyThemeMode(next)
    window.localStorage.setItem('theme', next)
  }

  function cycle() {
    selectMode(order[(order.indexOf(mode) + 1) % order.length])
  }

  const Icon = mode === 'auto' ? Monitor : mode === 'dark' ? Moon : Sun
  const ariaLabel = `Toggle theme (current: ${mode})`

  if (variant === 'segmented') {
    return (
      <fieldset className="inline-flex justify-around rounded border border-border bg-bg-0 p-0.5">
        <legend className="sr-only">Theme mode</legend>
        {modeOptions.map(({ mode: optionMode, label, Icon: OptionIcon }) => {
          const selected = mode === optionMode
          return (
            <button
              key={optionMode}
              type="button"
              onClick={() => selectMode(optionMode)}
              aria-pressed={selected}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-[background-color,color,border-color] duration-150',
                selected ? 'bg-surface-3 text-fg' : 'text-fg-faint hover:bg-surface-2 hover:text-fg-dim',
              )}
            >
              <OptionIcon className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              {label}
            </button>
          )
        })}
      </fieldset>
    )
  }

  return (
    <Tooltip label="Toggle Theme">
      <button type="button" onClick={cycle} aria-label={ariaLabel} className="btn btn-ghost btn-icon">
        <Icon className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
      </button>
    </Tooltip>
  )
}
