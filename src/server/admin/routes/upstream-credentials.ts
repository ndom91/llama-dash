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
import { error, json, parseBody, type Route } from './types.ts'
import { errorMessage } from '../../error-message.ts'

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
      const result = await parseBody(request, CreateUpstreamCredentialBodySchema, 'Invalid upstream credential body')
      if (!result.ok) return result.response
      try {
        return json(201, createUpstreamCredential(result.value))
      } catch (err) {
        return error(400, errorMessage(err))
      }
    },
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/upstream-credentials\/([a-zA-Z0-9_]+)$/,
    handler: async (request, match) => {
      const result = await parseBody(request, UpdateUpstreamCredentialBodySchema, 'Invalid upstream credential body')
      if (!result.ok) return result.response
      if (result.value.name === undefined && result.value.slug === undefined && result.value.value === undefined) {
        return error(400, 'At least one field to update is required')
      }
      try {
        const updated = updateUpstreamCredential(match[1], result.value)
        if (!updated) return error(404, `Upstream credential ${match[1]} not found`)
        return json(200, updated)
      } catch (err) {
        return error(400, errorMessage(err))
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
