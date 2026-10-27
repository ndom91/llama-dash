import * as v from 'valibot'
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
import { error, json, readJsonBody, type Route } from './types.ts'

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
      const parsed = await readJsonBody(request)
      if (!parsed.ok) return error(400, 'Invalid JSON body')
      const result = v.safeParse(UpdateAttributionSettingsBodySchema, parsed.value)
      if (!result.success) return error(400, 'Invalid attribution settings body')
      for (const value of [
        result.output.clientNameHeader,
        result.output.endUserIdHeader,
        result.output.sessionIdHeader,
      ]) {
        if (value == null) continue
        if (!normalizeAttributionHeaderName(value)) return error(400, `Invalid attribution header name: ${value}`)
        if (isSensitiveAttributionHeaderName(value)) {
          return error(400, `Sensitive headers cannot be used for attribution: ${value}`)
        }
      }
      setAttributionSettings(result.output)
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
      const parsed = await readJsonBody(request)
      if (!parsed.ok) return error(400, 'Invalid JSON body')
      const result = v.safeParse(UpdateRequestLimitsBodySchema, parsed.value)
      if (!result.success) return error(400, 'Invalid request limits body')
      setRequestLimits(result.output)
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
      const parsed = await readJsonBody(request)
      if (!parsed.ok) return error(400, 'Invalid JSON body')
      const result = v.safeParse(UpdatePrivacySettingsBodySchema, parsed.value)
      if (!result.success) return error(400, 'Invalid privacy settings body')
      setPrivacySettings(result.output)
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
      const parsed = await readJsonBody(request)
      if (!parsed.ok) return error(400, 'Invalid JSON body')
      const result = v.safeParse(UpdateUsagePanelSettingsBodySchema, parsed.value)
      if (!result.success) return error(400, 'Invalid usage panel settings body')
      setUsagePanelSettings(result.output)
      return json(200, getUsagePanelSettings())
    },
  },
]
