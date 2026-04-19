import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
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

export function ThemeToggle() {
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

  function cycle() {
    const next = order[(order.indexOf(mode) + 1) % order.length]
    setMode(next)
    applyThemeMode(next)
    window.localStorage.setItem('theme', next)
  }

  const Icon = mode === 'auto' ? Monitor : mode === 'dark' ? Moon : Sun
  const ariaLabel = `Toggle theme (current: ${mode})`

  return (
    <Tooltip label="Toggle Theme">
      <button type="button" onClick={cycle} aria-label={ariaLabel} className="btn btn-ghost btn-icon">
        <Icon className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
      </button>
    </Tooltip>
  )
}
