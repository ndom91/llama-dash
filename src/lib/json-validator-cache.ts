import type { BaseIssue, BaseSchema, InferOutput } from 'valibot'

type AnySchema = BaseSchema<unknown, unknown, BaseIssue<unknown>>
type Entry = { schema: AnySchema; data: unknown; etag: string; bytes: number; expiresAt: number }

export class JsonValidatorCache {
  private entries = new Map<string, Entry>()
  private bytes = 0

  constructor(private readonly limits = { entries: 128, bytes: 4 * 1024 * 1024, maxAgeMs: 5 * 60_000 }) {}

  get<T extends AnySchema>(key: string, schema: T): { etag: string; data: InferOutput<T> } | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (entry.expiresAt <= Date.now() || entry.schema !== schema) {
      this.delete(key)
      return undefined
    }
    this.entries.delete(key)
    this.entries.set(key, entry)
    // Only set() accepts validated outputs, and the schema identity matches.
    return { etag: entry.etag, data: entry.data as InferOutput<T> }
  }

  set<T extends AnySchema>(key: string, schema: T, data: InferOutput<T>, etag: string, bytes: number) {
    this.delete(key)
    if (bytes > this.limits.bytes) return
    this.entries.set(key, { schema, data, etag, bytes, expiresAt: Date.now() + this.limits.maxAgeMs })
    this.bytes += bytes
    while (this.entries.size > this.limits.entries || this.bytes > this.limits.bytes) {
      const oldest = this.entries.keys().next().value
      if (oldest === undefined) break
      this.delete(oldest)
    }
  }

  delete(key: string) {
    const entry = this.entries.get(key)
    if (entry) this.bytes -= entry.bytes
    this.entries.delete(key)
  }

  clear() {
    this.entries.clear()
    this.bytes = 0
  }
}
