import { resolveAlias } from '../admin/model-aliases.ts'
import { getRequestLimits } from '../admin/settings.ts'
import type { ApiKey } from '../db/schema.ts'

export type TransformContext = {
  keyRow: ApiKey | null
  endpoint: string
  method: string
}

type TransformOk = { ok: true; body: Record<string, unknown> | null; mutated: boolean }
type TransformErr = { ok: false; status: number; body: { error: { message: string; type: string } } }
export type TransformResult = TransformOk | TransformErr

export function applyTransforms(parsedBody: Record<string, unknown> | null, ctx: TransformContext): TransformResult {
  if (!parsedBody) {
    return { ok: true, body: parsedBody, mutated: false }
  }

  let mutated = false

  // Step 3: Model pinning
  if (ctx.keyRow?.defaultModel) {
    parsedBody.model = ctx.keyRow.defaultModel
    mutated = true
  }

  // Step 4: Model allow-list check (post-pin, pre-alias)
  const allowErr = checkModelAllowed(ctx.keyRow, parsedBody)
  if (allowErr) return allowErr

  // Step 5: Alias resolution
  if (typeof parsedBody.model === 'string') {
    const resolved = resolveAlias(parsedBody.model)
    if (resolved !== parsedBody.model) {
      parsedBody.model = resolved
      mutated = true
    }
  }

  // Step 6: System prompt injection
  if (ctx.keyRow?.systemPrompt && ctx.endpoint === '/v1/chat/completions' && Array.isArray(parsedBody.messages)) {
    parsedBody.messages = [{ role: 'system', content: ctx.keyRow.systemPrompt }, ...parsedBody.messages]
    mutated = true
  }

  // Step 7: Request size limits (checks run after system prompt injection)
  const limitsErr = checkRequestLimits(parsedBody)
  if (limitsErr) return limitsErr

  return { ok: true, body: parsedBody, mutated }
}

function checkRequestLimits(body: Record<string, unknown>): TransformErr | null {
  const limits = getRequestLimits()
  if (!limits.maxMessages && !limits.maxEstimatedTokens) return null

  if (limits.maxMessages && Array.isArray(body.messages)) {
    if (body.messages.length > limits.maxMessages) {
      return {
        ok: false,
        status: 422,
        body: {
          error: {
            message: `Request has ${body.messages.length} messages, exceeding the limit of ${limits.maxMessages}`,
            type: 'request_too_large',
          },
        },
      }
    }
  }

  if (limits.maxEstimatedTokens && Array.isArray(body.messages)) {
    const estimated = Math.ceil(JSON.stringify(body.messages).length / 4)
    if (estimated > limits.maxEstimatedTokens) {
      return {
        ok: false,
        status: 422,
        body: {
          error: {
            message: `Estimated prompt tokens (~${estimated}) exceeds the limit of ${limits.maxEstimatedTokens}`,
            type: 'request_too_large',
          },
        },
      }
    }
  }

  return null
}

export function checkModelAllowed(keyRow: ApiKey | null, body: Record<string, unknown>): TransformErr | null {
  if (!keyRow) return null

  const allowedModels: Array<string> = JSON.parse(keyRow.allowedModels)
  if (allowedModels.length === 0) return null

  const model = typeof body.model === 'string' ? body.model : null
  if (!model) return null
  if (allowedModels.includes(model)) return null

  return {
    ok: false,
    status: 403,
    body: {
      error: {
        message: `Model '${model}' is not allowed for this API key`,
        type: 'model_not_allowed',
      },
    },
  }
}
