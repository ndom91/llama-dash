import * as v from 'valibot'
import { ConfigSaveBodySchema, ConfigValidateBodySchema } from '../../../lib/schemas/config'
import { config } from '../../config.ts'
import { inferenceBackend } from '../../inference/backend.ts'
import { readConfig, validateAgainstSchema, writeConfig } from '../config.ts'
import { error, json, readJsonBody, type Route } from './types.ts'

function ensureConfigSupported() {
  if (!inferenceBackend.info.capabilities.config) return error(501, 'Inference backend does not support config editing')
  if (!config.inferenceConfigFile) return error(404, 'INFERENCE_CONFIG_FILE is not set')
  return null
}

export const configRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/api\/config$/,
    handler: async () => {
      const unsupported = ensureConfigSupported()
      if (unsupported) return unsupported
      try {
        return json(200, readConfig())
      } catch (err) {
        return error(500, err instanceof Error ? err.message : String(err))
      }
    },
  },
  {
    method: 'PUT',
    pattern: /^\/api\/config$/,
    handler: async (request) => {
      const unsupported = ensureConfigSupported()
      if (unsupported) return unsupported
      const parsed = await readJsonBody(request)
      if (!parsed.ok) return error(400, 'Invalid JSON body')
      const result = v.safeParse(ConfigSaveBodySchema, parsed.value)
      if (!result.success) return error(400, 'Body must have "content" (string) and "modifiedAt" (number)')
      const writeResult = await writeConfig(result.output.content, result.output.modifiedAt)
      if ('errors' in writeResult) return json(200, { saved: false, errors: writeResult.errors })
      if (writeResult.conflict) {
        return json(409, { saved: false, conflict: true, message: 'File was modified externally' })
      }
      return json(200, { saved: true, modifiedAt: writeResult.modifiedAt })
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/config\/validate$/,
    handler: async (request) => {
      const unsupported = ensureConfigSupported()
      if (unsupported) return unsupported
      const parsed = await readJsonBody(request)
      if (!parsed.ok) return error(400, 'Invalid JSON body')
      const result = v.safeParse(ConfigValidateBodySchema, parsed.value)
      if (!result.success) return error(400, 'Body must have "content" (string)')
      return json(200, await validateAgainstSchema(result.output.content))
    },
  },
]
