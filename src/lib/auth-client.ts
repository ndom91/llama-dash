import { createAuthClient } from 'better-auth/react'
import { passkeyClient } from '@better-auth/passkey/client'
import { twoFactorClient, usernameClient } from 'better-auth/client/plugins'

/** Dispatched when a sign-in needs a second factor; the login page listens. */
export const TWO_FACTOR_REQUIRED_EVENT = 'llswap-dash:two-factor-required'

export const authClient = createAuthClient({
  baseURL: typeof window === 'undefined' ? undefined : window.location.origin,
  basePath: '/api/auth',
  plugins: [
    usernameClient(),
    passkeyClient(),
    twoFactorClient({
      onTwoFactorRedirect: () => {
        if (typeof window !== 'undefined') window.dispatchEvent(new Event(TWO_FACTOR_REQUIRED_EVENT))
      },
    }),
  ],
})
