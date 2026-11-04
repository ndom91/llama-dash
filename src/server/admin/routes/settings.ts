import { isSensitiveAttributionHeaderName, normalizeAttributionHeaderName } from '../../../lib/schemas/attribution.ts'
import {
  UpdateAttributionSettingsBodySchema,
  UpdatePrivacySettingsBodySchema,
  UpdateRequestLimitsBodySchema,
} from '../../../lib/schemas/settings.ts'
import { UpdateUsagePanelSettingsBodySchema } from '../../../lib/schemas/usage.ts'
import {
  getAttributionSettings,
  getPrivacySettings,
  getRequestLimits,
  getUsagePanelSettings,
  setAttributionSettings,
  setPrivacySettings,
  setRequestLimits,
  setUsagePanelSettings,
} from '../settings.ts'
import { error, json, parseBody, type Route } from './types.ts'

export const settingRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/settings\/attribution$/,
    handler: async () => json(200, getAttributionSettings()),
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/settings\/attribution$/,
    handler: async (request) => {
      const result = await parseBody(request, UpdateAttributionSettingsBodySchema, 'Invalid attribution settings body')
      if (!result.ok) return result.response
      for (const value of [result.value.clientNameHeader, result.value.endUserIdHeader, result.value.sessionIdHeader]) {
        if (value == null) continue
        if (!normalizeAttributionHeaderName(value)) return error(400, `Invalid attribution header name: ${value}`)
        if (isSensitiveAttributionHeaderName(value)) {
          return error(400, `Sensitive headers cannot be used for attribution: ${value}`)
        }
      }
      setAttributionSettings(result.value)
      return json(200, getAttributionSettings())
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/settings\/request-limits$/,
    handler: async () => json(200, getRequestLimits()),
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/settings\/request-limits$/,
    handler: async (request) => {
      const result = await parseBody(request, UpdateRequestLimitsBodySchema, 'Invalid request limits body')
      if (!result.ok) return result.response
      setRequestLimits(result.value)
      return json(200, getRequestLimits())
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/settings\/privacy$/,
    handler: async () => json(200, getPrivacySettings()),
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/settings\/privacy$/,
    handler: async (request) => {
      const result = await parseBody(request, UpdatePrivacySettingsBodySchema, 'Invalid privacy settings body')
      if (!result.ok) return result.response
      setPrivacySettings(result.value)
      return json(200, getPrivacySettings())
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/settings\/usage$/,
    handler: async () => json(200, getUsagePanelSettings()),
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/settings\/usage$/,
    handler: async (request) => {
      const result = await parseBody(request, UpdateUsagePanelSettingsBodySchema, 'Invalid usage panel settings body')
      if (!result.ok) return result.response
      setUsagePanelSettings(result.value)
      return json(200, getUsagePanelSettings())
    },
  },
]
