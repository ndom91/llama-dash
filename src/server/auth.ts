import { count } from 'drizzle-orm'
import { passkey } from '@better-auth/passkey'
import { betterAuth, type BetterAuthPlugin } from 'better-auth'
import { createAuthMiddleware, APIError } from 'better-auth/api'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { username } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { authAuditLogger } from './auth-audit.ts'
import { db, schema } from './db/index.ts'
import { config } from './config.ts'

const passkeyOrigin = config.authUrl ? new URL(config.authUrl).origin : undefined
const passkeyRpId = config.authUrl ? new URL(config.authUrl).hostname : undefined

const trustedOrigins = [config.authUrl, config.internalOrigin].filter((v): v is string => Boolean(v))

export const auth = betterAuth({
  basePath: '/api/auth',
  baseURL: config.authUrl || undefined,
  secret: config.authSecret || undefined,
  trustedOrigins: trustedOrigins.length > 0 ? trustedOrigins : undefined,
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  rateLimit: {
    window: 10,
    max: 10,
    customRules: {
      '/v1/*': false,
    },
  },
  disabledPaths: ['/is-username-available'],
  plugins: [
    firstUserOnlySignup(),
    username(),
    passkey({ rpName: 'llama-dash', rpID: passkeyRpId, origin: passkeyOrigin }),
    authAuditLogger(),
    tanstackStartCookies(),
  ],
})

export async function getDashboardSession(request: Request) {
  return auth.api.getSession({ headers: request.headers })
}

export function hasDashboardUsers() {
  return (db.select({ value: count() }).from(schema.user).get()?.value ?? 0) > 0
}

function firstUserOnlySignup(): BetterAuthPlugin {
  return {
    id: 'llama-dash-first-user-only-signup',
    hooks: {
      before: [
        {
          matcher(context: { path?: string }) {
            return context.path === '/sign-up/email'
          },
          handler: createAuthMiddleware(async () => {
            if (hasDashboardUsers()) {
              throw new APIError('FORBIDDEN', { message: 'Dashboard signup is disabled after the first user' })
            }
          }),
        },
      ],
    },
  }
}
