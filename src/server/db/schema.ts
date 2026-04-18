import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const requests = sqliteTable('requests', {
  id: text('id').primaryKey(),
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
  requestHeaders: text('request_headers'),
  requestBody: text('request_body'),
  responseHeaders: text('response_headers'),
  responseBody: text('response_body'),
})

export type Request = typeof requests.$inferSelect
export type NewRequest = typeof requests.$inferInsert

export const modelEvents = sqliteTable('model_events', {
  id: text('id').primaryKey(),
  modelId: text('model_id').notNull(),
  event: text('event', { enum: ['load', 'unload'] }).notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp_ms' }).notNull(),
})

export type ModelEvent = typeof modelEvents.$inferSelect
export type NewModelEvent = typeof modelEvents.$inferInsert
