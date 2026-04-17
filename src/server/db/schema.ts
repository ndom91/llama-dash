import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const requests = sqliteTable('requests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
  durationMs: integer('duration_ms').notNull(),
  method: text('method').notNull(),
  endpoint: text('endpoint').notNull(),
  model: text('model'),
  statusCode: integer('status_code').notNull(),
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  totalTokens: integer('total_tokens'),
  streamed: integer('streamed', { mode: 'boolean' }).notNull().default(false),
  error: text('error'),
})

export type Request = typeof requests.$inferSelect
export type NewRequest = typeof requests.$inferInsert
