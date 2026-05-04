import themesData from './themes.json'

export type ThemeDef = (typeof themesData.themes)[number]
export type ThemeMode = 'light' | 'dark' | 'auto'

export const COLOR_THEME_STORAGE_KEY = 'color-theme'
export const THEME_MODE_STORAGE_KEY = 'theme'
export const COLOR_THEME_COOKIE = 'llama-color-theme'
export const THEME_MODE_COOKIE = 'llama-theme-mode'
export const DEFAULT_THEME_ID = 'ultraviolet'
export const DEFAULT_THEME_MODE: ThemeMode = 'auto'

export const themes: ReadonlyArray<ThemeDef> = themesData.themes

export function isThemeId(id: unknown): id is string {
  return typeof id === 'string' && themes.some((theme) => theme.id === id)
}

export function isThemeMode(mode: unknown): mode is ThemeMode {
  return mode === 'light' || mode === 'dark' || mode === 'auto'
}

export function findTheme(id: string): ThemeDef {
  return themes.find((t) => t.id === id) ?? themes.find((t) => t.id === DEFAULT_THEME_ID)!
}

export function themeStyleVars(theme: ThemeDef): Record<string, string> {
  const [l, c, h] = theme.accent.oklch.split(' ').map(parseFloat)
  return {
    '--ld-phosphor-300': theme.accent['300'],
    '--ld-phosphor-500': theme.accent['500'],
    '--ld-phosphor-700': theme.accent['700'],
    '--ld-ok': theme.status.ok,
    '--ld-warn': theme.status.warn,
    '--ld-error': theme.status.error,
    '--info': theme.status.info,
    '--ok-bg': hexToAlpha(theme.status.ok, 0.12),
    '--warn-bg': hexToAlpha(theme.status.warn, 0.12),
    '--err-bg': hexToAlpha(theme.status.error, 0.12),
    '--info-bg': hexToAlpha(theme.status.info, 0.12),
    '--shadow-focus': '0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent)',
    '--accent-shifted': `oklch(${Math.min(l + 12, 95)}% ${(c * 0.4).toFixed(3)} ${h})`,
  }
}

export function resolveThemeMode(mode: ThemeMode, prefersDark: boolean): 'light' | 'dark' {
  return mode === 'auto' ? (prefersDark ? 'dark' : 'light') : mode
}

export function themeVarsCssText(theme: ThemeDef): string {
  return Object.entries(themeStyleVars(theme))
    .map(([key, value]) => `${key}:${value}`)
    .join(';')
}

function hexToAlpha(hex: string, alpha: number): string {
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
