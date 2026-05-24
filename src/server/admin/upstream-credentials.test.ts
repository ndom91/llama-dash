import { describe, expect, it, vi } from 'vitest'

const dbMock = vi.hoisted(() => ({
  credential: null as null | {
    id: string
    name: string
    slug: string
    type: 'bearer'
    encryptedValue: string
    createdAt: Date
    updatedAt: Date
    lastUsedAt: Date | null
    placeholderEnabled: boolean
  },
}))

vi.mock('../config.ts', () => ({
  config: { credentialEncryptionKey: 'x'.repeat(32) },
}))

vi.mock('../db/index.ts', () => {
  const chain = {
    from: () => chain,
    where: () => chain,
    get: () => dbMock.credential,
    set: () => chain,
    run: () => ({ changes: 1 }),
  }
  return {
    db: {
      select: () => chain,
      update: () => chain,
    },
    schema: {
      upstreamCredentials: {
        id: 'id',
        slug: 'slug',
      },
    },
  }
})

import { getCredentialInjectionSecret } from './upstream-credentials'

describe('upstream credential payload validation', () => {
  it('returns a stable error for malformed encrypted payloads', () => {
    dbMock.credential = {
      id: 'ucr_test',
      name: 'Test',
      slug: 'test',
      type: 'bearer',
      encryptedValue: JSON.stringify({ v: 1, alg: 'aes-256-gcm', iv: '', tag: '', data: '' }),
      createdAt: new Date(0),
      updatedAt: new Date(0),
      lastUsedAt: null,
      placeholderEnabled: false,
    }

    expect(() => getCredentialInjectionSecret('ucr_test')).toThrow('Invalid credential payload')
  })
})
