import * as v from 'valibot'

export const CredentialInjectionLocationSchema = v.object({
  type: v.literal('header'),
  name: v.string(),
  mode: v.union([v.literal('replace_placeholder'), v.literal('set_header')]),
})

export const CredentialInjectionAuditSchema = v.object({
  count: v.number(),
  credentials: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      slug: v.string(),
    }),
  ),
  locations: v.array(CredentialInjectionLocationSchema),
  error: v.optional(v.string()),
})

export const StoredCredentialInjectionAuditSchema = v.object({
  count: v.number(),
  credentials: v.optional(
    v.array(
      v.union([
        v.string(),
        v.object({
          id: v.optional(v.string()),
          name: v.optional(v.string()),
          slug: v.optional(v.string()),
        }),
      ]),
    ),
  ),
  locations: v.optional(
    v.array(
      v.object({
        type: v.optional(v.string()),
        name: v.optional(v.string()),
        mode: v.optional(v.string()),
      }),
    ),
  ),
  error: v.optional(v.string()),
})

export type CredentialInjectionLocation = v.InferOutput<typeof CredentialInjectionLocationSchema>
export type CredentialInjectionAudit = v.InferOutput<typeof CredentialInjectionAuditSchema>
export type StoredCredentialInjectionAudit = v.InferOutput<typeof StoredCredentialInjectionAuditSchema>
