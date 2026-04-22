import { resolve } from 'node:path'
import { migrate as drizzleMigrate } from 'drizzle-orm/better-sqlite3/migrator'
import { db } from './index.ts'

let ran = false

export function runMigrations() {
  if (ran) return
  ran = true
  console.log('[db] applying migrations')
  drizzleMigrate(db, { migrationsFolder: resolve(process.cwd(), 'drizzle') })
  console.log('[db] migrations complete')
}
