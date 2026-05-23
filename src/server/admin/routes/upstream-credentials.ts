import * as v from 'valibot'
import {
  CreateUpstreamCredentialBodySchema,
  UpdateUpstreamCredentialBodySchema,
} from '../../../lib/schemas/upstream-credential.ts'
import {
  createUpstreamCredential,
  deleteUpstreamCredential,
  getCredentialVaultStatus,
  isCredentialVaultKeyEnabled,
  listUpstreamCredentials,
  updateUpstreamCredential,
} from '../upstream-credentials.ts'
import { config } from '../../config.ts'
import { error, json, readJsonBody, type Route } from './types.ts'

export const upstreamCredentialRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/upstream-credentials$/,
    handler: async () => {
      const encryptionKey = config.credentialEncryptionKey
      return json(200, {
        credentials: listUpstreamCredentials(),
        vaultEnabled: isCredentialVaultKeyEnabled(encryptionKey),
        vaultStatus: getCredentialVaultStatus(encryptionKey),
      })
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/upstream-credentials$/,
    handler: async (request) => {
      const parsed = await readJsonBody(request)
      if (!parsed.ok) return error(400, 'Invalid JSON body')
      const result = v.safeParse(CreateUpstreamCredentialBodySchema, parsed.value)
      if (!result.success) return error(400, 'Invalid upstream credential body')
      try {
        return json(201, createUpstreamCredential(result.output, config.credentialEncryptionKey))
      } catch (err) {
        return error(400, err instanceof Error ? err.message : String(err))
      }
    },
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/upstream-credentials\/([a-zA-Z0-9_]+)$/,
    handler: async (request, match) => {
      const parsed = await readJsonBody(request)
      if (!parsed.ok) return error(400, 'Invalid JSON body')
      const result = v.safeParse(UpdateUpstreamCredentialBodySchema, parsed.value)
      if (!result.success) return error(400, 'Invalid upstream credential body')
      if (
        result.output.name === undefined &&
        result.output.slug === undefined &&
        result.output.value === undefined &&
        result.output.placeholderEnabled === undefined
      ) {
        return error(400, 'At least one field to update is required')
      }
      try {
        const updated = updateUpstreamCredential(match[1], result.output, config.credentialEncryptionKey)
        if (!updated) return error(404, `Upstream credential ${match[1]} not found`)
        return json(200, updated)
      } catch (err) {
        return error(400, err instanceof Error ? err.message : String(err))
      }
    },
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/upstream-credentials\/([a-zA-Z0-9_]+)$/,
    handler: async (_request, match) => {
      const ok = deleteUpstreamCredential(match[1])
      if (!ok) return error(404, `Upstream credential ${match[1]} not found`)
      return json(200, { ok: true })
    },
  },
]
