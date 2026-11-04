import { ConfigSaveBodySchema, ConfigValidateBodySchema } from '../../../lib/schemas/config'
import { config } from '../../config.ts'
import { inferenceBackend } from '../../inference/backend.ts'
import { readConfig, validateAgainstSchema, writeConfig } from '../config.ts'
import { error, json, parseBody, type Route } from './types.ts'
import { errorMessage } from '../../error-message.ts'

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
        return error(500, errorMessage(err))
      }
    },
  },
  {
    method: 'PUT',
    pattern: /^\/api\/config$/,
    handler: async (request) => {
      const unsupported = ensureConfigSupported()
      if (unsupported) return unsupported
      const result = await parseBody(
        request,
        ConfigSaveBodySchema,
        'Body must have "content" (string) and "modifiedAt" (number)',
      )
      if (!result.ok) return result.response
      const writeResult = await writeConfig(result.value.content, result.value.modifiedAt)
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
      const result = await parseBody(request, ConfigValidateBodySchema, 'Body must have "content" (string)')
      if (!result.ok) return result.response
      return json(200, await validateAgainstSchema(result.value.content))
    },
  },
]
