import { createHash } from 'node:crypto'
import type { ApiKey } from '../../server/db/schema.ts'

/** Raw DB row shape used by auth/handler unit tests. */
export function makeApiKeyRow(rawKey: string, overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: 'key_test',
    name: 'Test key',
    keyHash: createHash('sha256').update(rawKey).digest('hex'),
    keyPrefix: rawKey.slice(0, 8),
    createdAt: new Date(0),
    disabledAt: null,
    expiresAt: null,
    allowedModels: '[]',
    allowedMcpRelays: '[]',
    rateLimitRpm: null,
    rateLimitTpm: null,
    monthlyTokenQuota: null,
    defaultModel: null,
    systemPrompt: null,
    system: false,
    ...overrides,
  }
}

export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex')
}
