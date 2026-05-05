import { useEffect, useState } from 'react'
import {
  COLOR_THEME_COOKIE,
  COLOR_THEME_STORAGE_KEY,
  DEFAULT_THEME_ID,
  DEFAULT_THEME_MODE,
  findTheme,
  isThemeId,
  isThemeMode,
  resolveThemeMode,
  THEME_MODE_COOKIE,
  THEME_MODE_STORAGE_KEY,
  type ThemeMode,
  type ThemeDef,
  themes,
  themeStyleVars,
} from './theme'

export type { ThemeMode } from './theme'
export { themes } from './theme'

const THEME_CHANGE_EVENT = 'llama-dash:color-theme-change'

function getStoredId(): string {
  if (typeof window === 'undefined') return DEFAULT_THEME_ID
  const stored = window.localStorage.getItem(COLOR_THEME_STORAGE_KEY)
  return isThemeId(stored) ? stored : DEFAULT_THEME_ID
}

function applyTheme(theme: ThemeDef) {
  const s = document.documentElement.style
  for (const [key, value] of Object.entries(themeStyleVars(theme))) s.setProperty(key, value)
}

export function getStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return DEFAULT_THEME_MODE
  const stored = window.localStorage.getItem(THEME_MODE_STORAGE_KEY)
  return isThemeMode(stored) ? stored : DEFAULT_THEME_MODE
}

export function applyThemeMode(mode: ThemeMode) {
  const resolved = resolveThemeMode(mode, window.matchMedia('(prefers-color-scheme: dark)').matches)
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(resolved)

  if (mode === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', mode)

  root.style.colorScheme = resolved
}

export function persistThemeMode(mode: ThemeMode) {
  window.localStorage.setItem(THEME_MODE_STORAGE_KEY, mode)
  writeCookie(THEME_MODE_COOKIE, mode)
}

function persistThemeId(id: string) {
  window.localStorage.setItem(COLOR_THEME_STORAGE_KEY, id)
  writeCookie(COLOR_THEME_COOKIE, id)
}

function writeCookie(name: string, value: string) {
  // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API lacks Safari support
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`
}

export function useColorTheme() {
  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID)

  useEffect(() => {
    const id = getStoredId()
    setThemeId(id)
    applyTheme(findTheme(id))
    persistThemeId(id)

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
    persistThemeId(theme.id)
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
  }

  return { themeId, themes, select }
}
