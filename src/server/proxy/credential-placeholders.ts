import type { CredentialBinding } from '../../lib/schemas/routing-rule.ts'
import {
  getCredentialInjectionSecret,
  markCredentialUsed,
  type CredentialInjectionSecret,
} from '../admin/upstream-credentials.ts'
import type { RoutingOutcome } from './transforms.ts'

const PLACEHOLDER_RE = /\{\{llama-dash:credential:([a-z0-9][a-z0-9_-]{1,80})\}\}/g
export const REDACTED_INJECTED_CREDENTIAL = '[redacted injected credential]'

export type CredentialInjectionLocation = {
  type: 'header'
  name: string
  mode: 'replace_placeholder' | 'set_header'
}

export type CredentialInjectionAudit = {
  count: number
  credentials: string[]
  locations: CredentialInjectionLocation[]
  error?: string
}

export type CredentialInjectionResult =
  | { ok: true; audit: CredentialInjectionAudit | null; redactedHeaderNames: Set<string> }
  | {
      ok: false
      status: number
      message: string
      type: string
      audit: CredentialInjectionAudit | null
      redactedHeaderNames: Set<string>
    }

export function placeholderForSlug(slug: string): string {
  return `{{llama-dash:credential:${slug}}}`
}

export function applyCredentialInjection(input: {
  headers: Record<string, string>
  routing: RoutingOutcome
  encryptionKey: string
}): CredentialInjectionResult {
  const redactedHeaderNames = new Set<string>()
  const audit: CredentialInjectionAudit = { count: 0, credentials: [], locations: [] }
  const bindings = credentialBindingsForRouting(input.routing)

  for (const binding of bindings) {
    const secret = getCredentialInjectionSecret(binding.credentialId, input.encryptionKey)
    if (!secret) {
      return injectionError(
        'credential_injection_failed',
        `Credential ${binding.credentialId} not found`,
        audit,
        redactedHeaderNames,
      )
    }

    const result = applyBinding(input.headers, binding, secret, audit, redactedHeaderNames)
    if (!result.ok) return result
  }

  const unresolved = findNamespacedPlaceholders(input.headers)
  if (unresolved.length > 0) {
    return injectionError(
      'credential_placeholder_unresolved',
      `Credential placeholder ${unresolved[0]} is not allowed by the matched routing rule`,
      audit,
      redactedHeaderNames,
    )
  }

  return { ok: true, audit: audit.count > 0 ? audit : null, redactedHeaderNames }
}

export function auditToJson(audit: CredentialInjectionAudit | null): string | null {
  return audit ? JSON.stringify(audit) : null
}

function credentialBindingsForRouting(routing: RoutingOutcome): CredentialBinding[] {
  const bindings = [...routing.credentialBindings]
  if (routing.targetCredentialId) {
    bindings.push({
      credentialId: routing.targetCredentialId,
      mode: 'set_header',
      headerName: 'authorization',
      required: true,
    })
  }
  return bindings
}

function applyBinding(
  headers: Record<string, string>,
  binding: CredentialBinding,
  secret: CredentialInjectionSecret,
  audit: CredentialInjectionAudit,
  redactedHeaderNames: Set<string>,
): CredentialInjectionResult {
  const headerKey = findHeaderKey(headers, binding.headerName) ?? binding.headerName.toLowerCase()
  const headerName = headerKey.toLowerCase()
  const placeholder = placeholderForSlug(secret.slug)

  if (binding.mode === 'replace_placeholder') {
    const current = headers[headerKey]
    if (!current?.includes(placeholder)) {
      if (binding.required) {
        return injectionError(
          'credential_placeholder_required',
          `Required credential placeholder for ${secret.slug} is missing from header ${binding.headerName}`,
          audit,
          redactedHeaderNames,
        )
      }
      return { ok: true, audit: audit.count > 0 ? audit : null, redactedHeaderNames }
    }
    headers[headerKey] = current.split(placeholder).join(secret.value)
    markCredentialUsed(secret.id)
    recordInjection(audit, secret.id, { type: 'header', name: headerName, mode: binding.mode })
    redactedHeaderNames.add(headerName)
    return { ok: true, audit, redactedHeaderNames }
  }

  const template = binding.headerValueTemplate ?? defaultHeaderTemplate(secret)
  const placeholders = [...template.matchAll(PLACEHOLDER_RE)]
  if (placeholders.length !== 1 || placeholders[0][1] !== secret.slug) {
    return injectionError(
      'credential_injection_failed',
      `Header template for ${secret.slug} must contain exactly one matching credential placeholder`,
      audit,
      redactedHeaderNames,
    )
  }
  headers[headerKey] = template.replace(placeholder, secret.value)
  markCredentialUsed(secret.id)
  recordInjection(audit, secret.id, { type: 'header', name: headerName, mode: binding.mode })
  redactedHeaderNames.add(headerName)
  return { ok: true, audit, redactedHeaderNames }
}

function defaultHeaderTemplate(secret: CredentialInjectionSecret): string {
  if (secret.type === 'bearer') return `Bearer ${placeholderForSlug(secret.slug)}`
  return placeholderForSlug(secret.slug)
}

function recordInjection(audit: CredentialInjectionAudit, credentialId: string, location: CredentialInjectionLocation) {
  audit.count += 1
  if (!audit.credentials.includes(credentialId)) audit.credentials.push(credentialId)
  audit.locations.push(location)
}

function injectionError(
  type: string,
  message: string,
  audit: CredentialInjectionAudit,
  redactedHeaderNames: Set<string>,
): Extract<CredentialInjectionResult, { ok: false }> {
  return {
    ok: false,
    status: 422,
    message,
    type,
    audit: audit.count > 0 ? { ...audit, error: message } : { ...audit, error: message },
    redactedHeaderNames,
  }
}

function findHeaderKey(headers: Record<string, string>, name: string): string | null {
  const lower = name.toLowerCase()
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) return key
  }
  return null
}

function findNamespacedPlaceholders(headers: Record<string, string>): string[] {
  const found: string[] = []
  for (const value of Object.values(headers)) {
    for (const match of value.matchAll(PLACEHOLDER_RE)) found.push(match[0])
  }
  return found
}
