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
