import { sqliteDb } from '../../db/index.ts'
import { getApiKeyNameMap } from '../api-keys.ts'
import { getPrivacySettings } from '../settings.ts'
import { getUsageReport, getUsageSummary, parseUsageDays } from '../usage.ts'
import { json, type Route } from './types.ts'

export const usageRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/usage$/,
    handler: async (request) => {
      const days = parseUsageDays(new URL(request.url).searchParams.get('days'))
      return json(
        200,
        getUsageReport(sqliteDb, {
          days,
          retentionDays: getPrivacySettings().requestLogRetentionDays,
          keyNames: getApiKeyNameMap(),
        }),
      )
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/usage\/summary$/,
    handler: async () =>
      json(200, getUsageSummary(sqliteDb, { retentionDays: getPrivacySettings().requestLogRetentionDays })),
  },
]
