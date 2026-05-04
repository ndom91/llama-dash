import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import {
  DEFAULT_THEME_ID,
  DEFAULT_THEME_MODE,
  findTheme,
  isThemeId,
  isThemeMode,
  resolveThemeMode,
  themeVarsCssText,
} from './theme'
import { auth } from '../server/auth'
import { inferenceBackend } from '../server/inference/backend'

export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
  const headers = getRequestHeaders()
  return auth.api.getSession({ headers })
})

export const ensureSession = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  return session
})

export const getShellContext = createServerFn({ method: 'GET' }).handler(async () => {
  const headers = getRequestHeaders()
  const session = await auth.api.getSession({ headers })
  const theme = getRequestTheme(headers)
  return {
    session,
    theme,
    inference: {
      capabilities: inferenceBackend.info.capabilities,
    },
  }
})

function getRequestTheme(headers: Headers) {
  const cookies = parseCookieHeader(headers.get('cookie') ?? '')
  const themeId = isThemeId(cookies['llama-color-theme']) ? cookies['llama-color-theme'] : DEFAULT_THEME_ID
  const mode = isThemeMode(cookies['llama-theme-mode']) ? cookies['llama-theme-mode'] : DEFAULT_THEME_MODE
  const resolvedMode = resolveThemeMode(mode, false)

  return {
    id: themeId,
    mode,
    resolvedMode,
    cssText: themeVarsCssText(findTheme(themeId)),
  }
}

function parseCookieHeader(header: string): Record<string, string> {
  const cookies: Record<string, string> = {}
  for (const part of header.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=')
    if (!rawName) continue
    cookies[rawName] = decodeURIComponent(rawValue.join('='))
  }
  return cookies
}
