import * as v from 'valibot'
import { config } from '../config.ts'

const CompressResponseSchema = v.object({ messages: v.array(v.unknown()) })

export async function compressHeadroomMessages(messages: unknown[], model: string): Promise<unknown[] | null> {
  if (!config.headroomBaseUrl) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 1_000)
  try {
    const response = await fetch(`${config.headroomBaseUrl}/v1/compress`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages, model }),
      signal: controller.signal,
    })
    if (!response.ok) return null
    const parsed = v.safeParse(CompressResponseSchema, await response.json())
    return parsed.success ? parsed.output.messages : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
