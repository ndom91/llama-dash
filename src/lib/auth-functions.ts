import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { getRequestTheme } from './theme-server'
import { auth } from '../server/auth'
import { inferenceBackend } from '../server/inference/backend'

export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
  const headers = getRequestHeaders()
  return auth.api.getSession({ headers })
})

export const getShellContext = createServerFn({ method: 'GET' }).handler(async () => {
  const headers = getRequestHeaders()
  const session = await auth.api.getSession({ headers })
  const theme = getRequestTheme(headers)
  return {
    session,
    theme,
    // Only expose backend info to authenticated sessions — this context is
    // serialized into the login page's dehydrated router payload too.
    inference: session ? { capabilities: inferenceBackend.info.capabilities } : null,
  }
})
