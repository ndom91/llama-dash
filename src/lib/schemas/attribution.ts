import * as v from 'valibot'

const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/
const SENSITIVE_ATTRIBUTION_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
  'x-api-key',
])

const HeaderNameSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100), v.regex(HEADER_NAME_PATTERN))

export const AttributionSettingsSchema = v.object({
  clientNameHeader: v.nullable(v.string()),
  endUserIdHeader: v.nullable(v.string()),
  sessionIdHeader: v.nullable(v.string()),
})
export type AttributionSettings = v.InferOutput<typeof AttributionSettingsSchema>

export const UpdateAttributionSettingsBodySchema = v.object({
  clientNameHeader: v.optional(v.nullable(HeaderNameSchema)),
  endUserIdHeader: v.optional(v.nullable(HeaderNameSchema)),
  sessionIdHeader: v.optional(v.nullable(HeaderNameSchema)),
})
export type UpdateAttributionSettingsBody = v.InferOutput<typeof UpdateAttributionSettingsBodySchema>

export function normalizeAttributionHeaderName(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return null
  const lowered = trimmed.toLowerCase()
  if (!HEADER_NAME_PATTERN.test(trimmed)) return null
  if (SENSITIVE_ATTRIBUTION_HEADERS.has(lowered)) return null
  return lowered
}

export function isSensitiveAttributionHeaderName(value: string): boolean {
  return SENSITIVE_ATTRIBUTION_HEADERS.has(value.trim().toLowerCase())
}
