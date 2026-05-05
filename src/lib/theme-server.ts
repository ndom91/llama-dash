import { parseCookieHeader } from './cookies'
import {
  COLOR_THEME_COOKIE,
  DEFAULT_THEME_ID,
  DEFAULT_THEME_MODE,
  findTheme,
  isThemeId,
  isThemeMode,
  resolveThemeMode,
  THEME_MODE_COOKIE,
  themeVarsCssText,
} from './theme'

export function getRequestTheme(headers: Headers) {
  const cookies = parseCookieHeader(headers.get('cookie') ?? '')
  const themeId = isThemeId(cookies[COLOR_THEME_COOKIE]) ? cookies[COLOR_THEME_COOKIE] : DEFAULT_THEME_ID
  const mode = isThemeMode(cookies[THEME_MODE_COOKIE]) ? cookies[THEME_MODE_COOKIE] : DEFAULT_THEME_MODE
  const resolvedMode = resolveThemeMode(mode, false)

  return {
    id: themeId,
    mode,
    resolvedMode,
    cssText: themeVarsCssText(findTheme(themeId)),
  }
}
