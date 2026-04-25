import { eq } from 'drizzle-orm'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { username } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { db, schema } from './db/index.ts'
import { config } from './config.ts'

export const auth = betterAuth({
  basePath: '/api/auth',
  baseURL: config.authUrl || undefined,
  secret: config.authSecret || undefined,
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  disabledPaths: ['/sign-up/email', '/is-username-available'],
  plugins: [username(), tanstackStartCookies()],
})

export async function getDashboardSession(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!isDashboardAuthEnabled()) return session
  if (session?.user.username !== config.authUsername) return null
  return session
}

export async function ensureDashboardUser() {
  if (!config.authUsername && !config.authPassword) return
  if (!config.authUsername || !config.authPassword) {
    throw new Error('DASHBOARD_AUTH_USERNAME and DASHBOARD_AUTH_PASSWORD must be set together')
  }
  if (!config.authSecret) {
    throw new Error('BETTER_AUTH_SECRET must be set when dashboard auth is enabled')
  }

  const email = config.authEmail || `${config.authUsername}@llama-dash.local`
  const existingUser = db.select().from(schema.user).where(eq(schema.user.username, config.authUsername)).get()

  if (!existingUser) {
    await auth.api.signUpEmail({
      body: {
        email,
        name: config.authUsername,
        password: config.authPassword,
        username: config.authUsername,
        displayUsername: config.authUsername,
      },
    })
    return
  }

  await db
    .update(schema.user)
    .set({ email, name: config.authUsername, displayUsername: config.authUsername })
    .where(eq(schema.user.id, existingUser.id))

  if (await canSignInWithConfiguredPassword()) return

  const rotationUsername = `${config.authUsername}-password-rotation`
  await db.delete(schema.account).where(eq(schema.account.userId, existingUser.id))
  await db.delete(schema.user).where(eq(schema.user.username, rotationUsername))
  await auth.api.signUpEmail({
    body: {
      email: `${rotationUsername}@llama-dash.local`,
      name: config.authUsername,
      password: config.authPassword,
      username: rotationUsername,
    },
  })
  const rotatedUser = db.select().from(schema.user).where(eq(schema.user.username, rotationUsername)).get()
  if (!rotatedUser) throw new Error('Failed to rotate dashboard auth password')
  const credentialAccount = db.select().from(schema.account).where(eq(schema.account.userId, rotatedUser.id)).get()
  if (!credentialAccount) throw new Error('Failed to create dashboard auth credential')
  await db
    .update(schema.account)
    .set({ userId: existingUser.id, accountId: existingUser.id })
    .where(eq(schema.account.id, credentialAccount.id))
  await db.delete(schema.session).where(eq(schema.session.userId, existingUser.id))
  await db.delete(schema.user).where(eq(schema.user.id, rotatedUser.id))
}

async function canSignInWithConfiguredPassword() {
  try {
    const response = await auth.api.signInUsername({
      body: {
        username: config.authUsername,
        password: config.authPassword,
      },
    })
    await db.delete(schema.session).where(eq(schema.session.token, response.token))
    return true
  } catch {
    return false
  }
}

export function isDashboardAuthEnabled() {
  return Boolean(config.authUsername || config.authPassword)
}
