import * as v from 'valibot'
import { CredentialBindingSchema, HeaderNameSchema } from './routing-rule.ts'
import { UpstreamCredentialSlugSchema } from './upstream-credential.ts'

export const McpRelayTargetUrlSchema = v.pipe(
  v.string(),
  v.url(),
  v.maxLength(500),
  v.check((value) => {
    try {
      const url = new URL(value)
      return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
    } catch {
      return false
    }
  }, 'MCP relay target URL must use HTTPS and include no username, password, query, or hash'),
)

export const McpRelaySchema = v.object({
  id: v.string(),
  name: v.string(),
  slug: UpstreamCredentialSlugSchema,
  targetUrl: McpRelayTargetUrlSchema,
  enabled: v.boolean(),
  credentialBindings: v.array(CredentialBindingSchema),
  createdAt: v.string(),
  updatedAt: v.string(),
})
export type McpRelay = v.InferOutput<typeof McpRelaySchema>

export const McpRelayListResponseSchema = v.object({
  relays: v.array(McpRelaySchema),
})

export const CreateMcpRelayBodySchema = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  slug: v.optional(UpstreamCredentialSlugSchema),
  targetUrl: McpRelayTargetUrlSchema,
  credentialId: v.pipe(v.string(), v.minLength(1), v.maxLength(120)),
  headerName: v.optional(HeaderNameSchema),
  headerValueTemplate: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(1000))),
})
export type CreateMcpRelayBody = v.InferOutput<typeof CreateMcpRelayBodySchema>
