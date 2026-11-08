import { Monitor, Moon, Sun } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { applyThemeMode, getStoredThemeMode, persistThemeMode, type ThemeMode } from '../lib/use-color-theme'
import { SegmentedControl } from './SegmentedControl'

const modeOptions: Array<{ value: ThemeMode; label: ReactNode }> = [
  {
    value: 'light',
    label: (
      <>
        <Sun className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
        Light
      </>
    ),
  },
  {
    value: 'dark',
    label: (
      <>
        <Moon className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
        Dark
      </>
    ),
  },
  {
    value: 'auto',
    label: (
      <>
        <Monitor className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
        System
      </>
    ),
  },
]

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>('auto')

  useEffect(() => {
    const initialMode = getStoredThemeMode()
    setMode(initialMode)
    applyThemeMode(initialMode)
    persistThemeMode(initialMode)
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
    persistThemeMode(next)
  }

  return (
    <SegmentedControl legend="Theme mode" options={modeOptions} value={mode} onChange={selectMode} variant="theme" />
  )
}
