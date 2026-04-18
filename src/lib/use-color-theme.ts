import { useEffect, useState } from 'react'
import themesData from './themes.json'

type ThemeDef = (typeof themesData.themes)[number]

const STORAGE_KEY = 'color-theme'
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
  s.setProperty('--shadow-focus', `0 0 0 2px ${hexToAlpha(theme.accent['500'], 0.35)}`)
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
  }, [])

  const select = (id: string) => {
    const theme = findTheme(id)
    setThemeId(theme.id)
    applyTheme(theme)
    window.localStorage.setItem(STORAGE_KEY, theme.id)
  }

  return { themeId, themes, select }
}
