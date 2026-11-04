import * as v from 'valibot'
import { json } from '../conditional-json.ts'
export { json } from '../conditional-json.ts'

export type Handler = (request: Request, match: RegExpMatchArray) => Promise<Response>

export type Route = {
  method: string
  pattern: RegExp
  handler: Handler
}

export const error = (status: number, message: string) => json(status, { error: { message } })

export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

export async function readJsonBody(request: Request): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return { ok: true, value: await request.json() }
  } catch {
    return { ok: false }
  }
}

// Reads a JSON body and validates it, mapping failures to the route's 400 responses.
export async function parseBody<TSchema extends v.GenericSchema>(
  request: Request,
  schema: TSchema,
  invalidMessage: string,
): Promise<{ ok: true; value: v.InferOutput<TSchema> } | { ok: false; response: Response }> {
  const parsed = await readJsonBody(request)
  if (!parsed.ok) return { ok: false, response: error(400, 'Invalid JSON body') }
  const result = v.safeParse(schema, parsed.value)
  if (!result.success) return { ok: false, response: error(400, invalidMessage) }
  return { ok: true, value: result.output }
}
