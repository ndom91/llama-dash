import { useEffect, useState } from 'react'
import themesData from './themes.json'

type ThemeDef = (typeof themesData.themes)[number]

const STORAGE_KEY = 'color-theme'
const THEME_CHANGE_EVENT = 'llama-dash:color-theme-change'
const DEFAULT_THEME_ID = 'ultraviolet'

export const themes: ReadonlyArray<ThemeDef> = themesData.themes

function getStoredId(): string {
  if (typeof window === 'undefined') return DEFAULT_THEME_ID
  return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME_ID
}

function findTheme(id: string): ThemeDef {
  return themes.find((t) => t.id === id) ?? themes.find((t) => t.id === DEFAULT_THEME_ID)!
}

function applyTheme(theme: ThemeDef) {
  const s = document.documentElement.style
  s.setProperty('--ld-phosphor-300', theme.accent['300'])
  s.setProperty('--ld-phosphor-500', theme.accent['500'])
  s.setProperty('--ld-phosphor-700', theme.accent['700'])
  s.setProperty('--ld-ok', theme.status.ok)
  s.setProperty('--ld-warn', theme.status.warn)
  s.setProperty('--ld-error', theme.status.error)
  s.setProperty('--info', theme.status.info)
  s.setProperty('--ok-bg', hexToAlpha(theme.status.ok, 0.12))
  s.setProperty('--warn-bg', hexToAlpha(theme.status.warn, 0.12))
  s.setProperty('--err-bg', hexToAlpha(theme.status.error, 0.12))
  s.setProperty('--info-bg', hexToAlpha(theme.status.info, 0.12))
  s.setProperty('--shadow-focus', '0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent)')

  const [l, c, h] = theme.accent.oklch.split(' ').map(parseFloat)
  s.setProperty('--accent-shifted', `oklch(${Math.min(l + 12, 95)}% ${(c * 0.4).toFixed(3)} ${h})`)
}

function hexToAlpha(hex: string, alpha: number): string {
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function useColorTheme() {
  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID)

  useEffect(() => {
    const id = getStoredId()
    setThemeId(id)
    applyTheme(findTheme(id))

    function onThemeChange() {
      setThemeId(getStoredId())
    }

    window.addEventListener(THEME_CHANGE_EVENT, onThemeChange)
    return () => window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange)
  }, [])

  const select = (id: string) => {
    const theme = findTheme(id)
    setThemeId(theme.id)
    applyTheme(theme)
    window.localStorage.setItem(STORAGE_KEY, theme.id)
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
  }

  return { themeId, themes, select }
}
