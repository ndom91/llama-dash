import { drizzle } from 'drizzle-orm/better-sqlite3'
import { expect, it, vi } from 'vitest'
import * as v from 'valibot'
import { UpdatePrivacySettingsBodySchema } from '../../lib/schemas/settings'
import * as schema from '../db/schema'
import { createMigratedTestDb } from '../db/test-db'

it('enforces two days of inference retention for existing and new settings', async () => {
  const sqlite = createMigratedTestDb()
  const db = drizzle(sqlite, { schema })
  sqlite
    .prepare('insert into settings (key, value, updated_at) values (?, ?, ?)')
    .run('request_log_retention_days', '1', Date.now())
  vi.doMock('../db/index.ts', () => ({ db, schema }))
  const { getPrivacySettings } = await import('./settings')
  expect(getPrivacySettings().requestLogRetentionDays).toBe(2)
  expect(v.safeParse(UpdatePrivacySettingsBodySchema, { requestLogRetentionDays: 1 }).success).toBe(false)
  expect(v.safeParse(UpdatePrivacySettingsBodySchema, { requestLogRetentionDays: 2 }).success).toBe(true)
  sqlite.close()
  vi.doUnmock('../db/index.ts')
})
