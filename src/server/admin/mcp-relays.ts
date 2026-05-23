import { desc, eq } from 'drizzle-orm'
import { ulid } from 'ulidx'
import * as v from 'valibot'
import type { CredentialBinding } from '../../lib/schemas/routing-rule.ts'
import { CredentialBindingSchema } from '../../lib/schemas/routing-rule.ts'
import type { CreateMcpRelayBody, McpRelay } from '../../lib/schemas/mcp-relay.ts'
import { placeholderForSlug } from '../proxy/credential-placeholders.ts'
import { db, schema } from '../db/index.ts'

export function listMcpRelays(): McpRelay[] {
  return db.select().from(schema.mcpRelays).orderBy(desc(schema.mcpRelays.createdAt)).all().map(toApiShape)
}

export function getMcpRelayBySlug(slug: string): McpRelay | null {
  const row = db.select().from(schema.mcpRelays).where(eq(schema.mcpRelays.slug, slug)).get()
  return row ? toApiShape(row) : null
}

export function createMcpRelay(input: CreateMcpRelayBody): McpRelay {
  const now = new Date()
  const slug = ensureUniqueSlug(input.slug ?? input.name)
  const binding = makeDefaultBinding(input)
  const row: schema.NewMcpRelay = {
    id: `mrl_${ulid()}`,
    name: input.name,
    slug,
    targetUrl: input.targetUrl,
    enabled: true,
    credentialBindingsJson: JSON.stringify([binding]),
    createdAt: now,
    updatedAt: now,
  }
  db.insert(schema.mcpRelays).values(row).run()
  return toApiShape(row)
}

export function deleteMcpRelay(id: string): boolean {
  return db.delete(schema.mcpRelays).where(eq(schema.mcpRelays.id, id)).run().changes > 0
}

function makeDefaultBinding(input: CreateMcpRelayBody): CredentialBinding {
  const credential = db
    .select({ slug: schema.upstreamCredentials.slug })
    .from(schema.upstreamCredentials)
    .where(eq(schema.upstreamCredentials.id, input.credentialId))
    .get()
  if (!credential) throw new Error(`Credential ${input.credentialId} not found`)
  return {
    credentialId: input.credentialId,
    mode: 'set_header',
    headerName: input.headerName?.trim() || 'authorization',
    headerValueTemplate: input.headerValueTemplate?.trim() || `Bearer ${placeholderForSlug(credential.slug)}`,
    required: true,
  }
}

function toApiShape(row: schema.McpRelay | schema.NewMcpRelay): McpRelay {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    targetUrl: row.targetUrl,
    enabled: row.enabled ?? true,
    credentialBindings: parseCredentialBindings(row.id, row.credentialBindingsJson ?? '[]'),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function parseCredentialBindings(relayId: string, value: string): CredentialBinding[] {
  try {
    const result = v.safeParse(v.array(CredentialBindingSchema), JSON.parse(value))
    if (result.success) return result.output
  } catch {
    // Fall through to the fail-closed error below.
  }
  throw new Error(`Invalid credential bindings for MCP relay ${relayId}`)
}

function ensureUniqueSlug(input: string): string {
  const base = slugify(input) || 'mcp-relay'
  let slug = base
  let suffix = 2
  while (db.select({ id: schema.mcpRelays.id }).from(schema.mcpRelays).where(eq(schema.mcpRelays.slug, slug)).get()) {
    slug = `${base}-${suffix}`
    suffix += 1
  }
  return slug
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}
