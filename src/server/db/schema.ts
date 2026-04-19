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
  keyId: text('key_id'),
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

export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull(),
  keyPrefix: text('key_prefix').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  disabledAt: integer('disabled_at', { mode: 'timestamp_ms' }),
  allowedModels: text('allowed_models').notNull().default('[]'),
  rateLimitRpm: integer('rate_limit_rpm'),
  rateLimitTpm: integer('rate_limit_tpm'),
  monthlyTokenQuota: integer('monthly_token_quota'),
  system: integer('system', { mode: 'boolean' }).notNull().default(false),
})

export type ApiKey = typeof apiKeys.$inferSelect
export type NewApiKey = typeof apiKeys.$inferInsert
