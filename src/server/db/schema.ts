import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

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
  cacheCreationTokens: integer('cache_creation_tokens'),
  cacheReadTokens: integer('cache_read_tokens'),
  costUsd: real('cost_usd'),
  streamed: integer('streamed', { mode: 'boolean' }).notNull().default(false),
  error: text('error'),
  requestHeaders: text('request_headers'),
  requestBody: text('request_body'),
  responseHeaders: text('response_headers'),
  responseBody: text('response_body'),
  streamCloseMs: integer('stream_close_ms'),
  keyId: text('key_id'),
  clientName: text('client_name'),
  endUserId: text('end_user_id'),
  sessionId: text('session_id'),
  routingRuleId: text('routing_rule_id'),
  routingRuleName: text('routing_rule_name'),
  routingActionType: text('routing_action_type'),
  routingAuthMode: text('routing_auth_mode'),
  routingPreserveAuthorization: integer('routing_preserve_authorization', { mode: 'boolean' }).notNull().default(false),
  routingTargetType: text('routing_target_type'),
  routingTargetBaseUrl: text('routing_target_base_url'),
  routingRequestedModel: text('routing_requested_model'),
  routingRoutedModel: text('routing_routed_model'),
  routingRejectReason: text('routing_reject_reason'),
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
  defaultModel: text('default_model'),
  systemPrompt: text('system_prompt'),
  system: integer('system', { mode: 'boolean' }).notNull().default(false),
})

export type ApiKey = typeof apiKeys.$inferSelect
export type NewApiKey = typeof apiKeys.$inferInsert

export const modelAliases = sqliteTable('model_aliases', {
  id: text('id').primaryKey(),
  alias: text('alias').notNull().unique(),
  model: text('model').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

export type ModelAlias = typeof modelAliases.$inferSelect
export type NewModelAlias = typeof modelAliases.$inferInsert

export const routingRules = sqliteTable('routing_rules', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  order: integer('order').notNull(),
  matchJson: text('match_json').notNull(),
  actionJson: text('action_json').notNull(),
  targetJson: text('target_json').notNull().default('{"type":"llama_swap"}'),
  authMode: text('auth_mode', { enum: ['require_key', 'passthrough'] })
    .notNull()
    .default('require_key'),
  preserveAuthorization: integer('preserve_authorization', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export type RoutingRule = typeof routingRules.$inferSelect
export type NewRoutingRule = typeof routingRules.$inferInsert

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export type Setting = typeof settings.$inferSelect
