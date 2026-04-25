import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { config } from '../config.ts'
import * as schema from './schema.ts'

export function resolveDatabasePath(path: string): { filename: string; needsDirectory: boolean } {
  if (path === ':memory:' || path.startsWith('file:')) return { filename: path, needsDirectory: false }
  return { filename: resolve(process.cwd(), path), needsDirectory: true }
}

const dbPath = resolveDatabasePath(config.databasePath)
if (dbPath.needsDirectory) mkdirSync(dirname(dbPath.filename), { recursive: true })

const sqlite = new Database(dbPath.filename)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
export const databasePathInfo = dbPath
export { schema }
