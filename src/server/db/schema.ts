import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const requests = sqliteTable(
  'requests',
  {
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
    routingPreserveAuthorization: integer('routing_preserve_authorization', { mode: 'boolean' })
      .notNull()
      .default(false),
    routingTargetType: text('routing_target_type'),
    routingTargetBaseUrl: text('routing_target_base_url'),
    routingRequestedModel: text('routing_requested_model'),
    routingRoutedModel: text('routing_routed_model'),
    routingRejectReason: text('routing_reject_reason'),
  },
  (table) => [
    index('idx_requests_started_at').on(table.startedAt),
    index('idx_requests_key_id_id').on(table.keyId, table.id),
    index('idx_requests_model_id').on(table.model, table.id),
  ],
)

export type Request = typeof requests.$inferSelect
export type NewRequest = typeof requests.$inferInsert

export const modelEvents = sqliteTable(
  'model_events',
  {
    id: text('id').primaryKey(),
    modelId: text('model_id').notNull(),
    event: text('event', { enum: ['load', 'unload'] }).notNull(),
    timestamp: integer('timestamp', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('idx_model_events_timestamp').on(table.timestamp)],
)

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

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  username: text('username').unique(),
  displayUsername: text('display_username'),
})

export type User = typeof user.$inferSelect

export type NewUser = typeof user.$inferInsert

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    loginMethod: text('login_method'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('idx_session_user_id').on(table.userId)],
)

export type Session = typeof session.$inferSelect
export type NewSession = typeof session.$inferInsert

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('idx_account_user_id').on(table.userId)],
)

export type Account = typeof account.$inferSelect
export type NewAccount = typeof account.$inferInsert

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('idx_verification_identifier').on(table.identifier)],
)

export type Verification = typeof verification.$inferSelect
export type NewVerification = typeof verification.$inferInsert

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
