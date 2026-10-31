import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const requests = sqliteTable(
  'requests',
  {
    id: text('id').primaryKey(),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
    durationMs: integer('duration_ms').notNull(),
    requestClass: text('request_class', { enum: ['inference', 'mcp_relay'] })
      .notNull()
      .default('inference'),
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
    prefillMs: real('prefill_ms'),
    decodeMs: real('decode_ms'),
    firstOutputMs: integer('first_output_ms'),
    outputSpanMs: integer('output_span_ms'),
    keyId: text('key_id'),
    clientHost: text('client_host'),
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
    routingTargetCredentialId: text('routing_target_credential_id'),
    routingRequestedModel: text('routing_requested_model'),
    routingRoutedModel: text('routing_routed_model'),
    routingRejectReason: text('routing_reject_reason'),
    credentialInjectionJson: text('credential_injection_json'),
  },
  (table) => [
    index('idx_requests_started_at').on(table.startedAt),
    index('idx_requests_payload_started_at')
      .on(table.startedAt)
      .where(
        sql`${table.requestHeaders} is not null or ${table.requestBody} is not null or ${table.responseHeaders} is not null or ${table.responseBody} is not null`,
      ),
    index('idx_requests_class_started_at').on(table.requestClass, table.startedAt),
    index('idx_requests_class_id').on(table.requestClass, table.id),
    index('idx_requests_key_id_id').on(table.keyId, table.id),
    index('idx_requests_key_started_at').on(table.keyId, table.startedAt),
    index('idx_requests_model_id').on(table.model, table.id),
  ],
)

export type Request = typeof requests.$inferSelect
export type NewRequest = typeof requests.$inferInsert

/**
 * Per-day usage rollup of inference requests, grouped by (UTC day, model, client,
 * key, status class, routing action, client host, end user). Rebuilt from
 * `requests` by the maintenance job before retention pruning so token/usage
 * history outlives the raw request log. Session ids are deliberately not a
 * dimension: they are near-unique per conversation.
 */
export const requestDailyStats = sqliteTable(
  'request_daily_stats',
  {
    /** UTC calendar day, `YYYY-MM-DD`. */
    day: text('day').notNull(),
    /** Routed model when a routing rule rewrote it, otherwise the requested model. */
    model: text('model'),
    clientName: text('client_name'),
    keyId: text('key_id'),
    /**
     * `2xx` / `3xx` / `4xx` / `5xx`, or `error` for a failure logged without an
     * HTTP error status. Null on rows rolled up before this dimension existed.
     */
    statusClass: text('status_class'),
    /** Routing rule action type; null when no rule matched. */
    routingAction: text('routing_action'),
    clientHost: text('client_host'),
    endUserId: text('end_user_id'),
    requests: integer('requests').notNull(),
    errors: integer('errors').notNull(),
    promptTokens: integer('prompt_tokens').notNull(),
    completionTokens: integer('completion_tokens').notNull(),
    totalTokens: integer('total_tokens').notNull(),
    durationMsSum: integer('duration_ms_sum').notNull(),
    costUsdSum: real('cost_usd_sum'),
    /** Completion tokens and wall time of successful streamed requests, for avg generation speed. */
    genCompletionTokens: integer('gen_completion_tokens').notNull(),
    genDurationMs: integer('gen_duration_ms').notNull(),
  },
  (table) => [index('idx_request_daily_stats_day').on(table.day)],
)

export type RequestDailyStat = typeof requestDailyStats.$inferSelect

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
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
  modelAccessMode: text('model_access_mode', { enum: ['all', 'restricted'] })
    .notNull()
    .default('all'),
  allowedModels: text('allowed_models').notNull().default('[]'),
  allowedMcpRelays: text('allowed_mcp_relays').notNull().default('[]'),
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
  twoFactorEnabled: integer('two_factor_enabled', { mode: 'boolean' }).notNull().default(false),
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

export const passkey = sqliteTable(
  'passkey',
  {
    id: text('id').primaryKey(),
    name: text('name'),
    publicKey: text('public_key').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    credentialID: text('credential_id').notNull(),
    counter: integer('counter').notNull(),
    deviceType: text('device_type').notNull(),
    backedUp: integer('backed_up', { mode: 'boolean' }).notNull(),
    transports: text('transports'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }),
    aaguid: text('aaguid'),
  },
  (table) => [index('idx_passkey_user_id').on(table.userId)],
)

export type Passkey = typeof passkey.$inferSelect
export type NewPasskey = typeof passkey.$inferInsert

export const twoFactor = sqliteTable(
  'two_factor',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    secret: text('secret').notNull(),
    backupCodes: text('backup_codes').notNull(),
    verified: integer('verified', { mode: 'boolean' }).default(true),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }),
  },
  (table) => [index('idx_two_factor_user_id').on(table.userId)],
)

export type TwoFactor = typeof twoFactor.$inferSelect
export type NewTwoFactor = typeof twoFactor.$inferInsert

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
  credentialBindingsJson: text('credential_bindings_json').notNull().default('[]'),
  authMode: text('auth_mode', { enum: ['require_key', 'passthrough'] })
    .notNull()
    .default('require_key'),
  preserveAuthorization: integer('preserve_authorization', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export type RoutingRule = typeof routingRules.$inferSelect
export type NewRoutingRule = typeof routingRules.$inferInsert

export const upstreamCredentials = sqliteTable('upstream_credentials', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  type: text('type', { enum: ['bearer', 'api_key'] }).notNull(),
  encryptedValue: text('encrypted_value').notNull(),
  placeholderEnabled: integer('placeholder_enabled', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
})

export type UpstreamCredential = typeof upstreamCredentials.$inferSelect
export type NewUpstreamCredential = typeof upstreamCredentials.$inferInsert

/**
 * A provider target the operator connected. One row per subscription entry
 * point (`src/lib/providers.ts` targets), pointing at the encrypted credential
 * that holds the provider API key, the routing rules that send traffic to each
 * surface, and the auto-discovered model list.
 */
export const providerConnections = sqliteTable('provider_connections', {
  id: text('id').primaryKey(),
  targetId: text('target_id').notNull().unique(),
  credentialId: text('credential_id').notNull(),
  routingRuleIdsJson: text('routing_rule_ids_json').notNull().default('[]'),
  modelsJson: text('models_json').notNull().default('[]'),
  modelsDiscoveredAt: integer('models_discovered_at', { mode: 'timestamp_ms' }),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export type ProviderConnection = typeof providerConnections.$inferSelect
export type NewProviderConnection = typeof providerConnections.$inferInsert

export const mcpRelays = sqliteTable('mcp_relays', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  targetUrl: text('target_url').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  credentialBindingsJson: text('credential_bindings_json').notNull().default('[]'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export type McpRelay = typeof mcpRelays.$inferSelect
export type NewMcpRelay = typeof mcpRelays.$inferInsert

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export type Setting = typeof settings.$inferSelect
