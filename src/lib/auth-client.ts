import { createAuthClient } from 'better-auth/react'
import { passkeyClient } from '@better-auth/passkey/client'
import { usernameClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  baseURL: typeof window === 'undefined' ? undefined : window.location.origin,
  basePath: '/api/auth',
  plugins: [usernameClient(), passkeyClient()],
})
