import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { getDashboardSessionForHeaders } from '../server/auth'
import { inferenceBackend } from '../server/inference/backend'
import { parseCookieHeader } from './cookies'
import { parseSidebarCollapsed, SIDEBAR_COOKIE } from './sidebar'
import { getRequestTheme } from './theme-server'

export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
  const headers = getRequestHeaders()
  return getDashboardSessionForHeaders(headers)
})

export const getShellContext = createServerFn({ method: 'GET' }).handler(async () => {
  const headers = getRequestHeaders()
  const session = await getDashboardSessionForHeaders(headers)
  const theme = getRequestTheme(headers)
  const sidebarCollapsed = parseSidebarCollapsed(parseCookieHeader(headers.get('cookie') ?? '')[SIDEBAR_COOKIE])
  return {
    session,
    theme,
    sidebarCollapsed,
    // Only expose backend info to authenticated sessions — this context is
    // serialized into the login page's dehydrated router payload too.
    inference: session ? { capabilities: inferenceBackend.info.capabilities } : null,
  }
})
