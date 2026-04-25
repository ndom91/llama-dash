import { describe, expect, it } from 'vitest'
import { resolveDatabasePath } from './index'

describe('resolveDatabasePath', () => {
  it('preserves SQLite in-memory special path', () => {
    expect(resolveDatabasePath(':memory:')).toEqual({ filename: ':memory:', needsDirectory: false })
  })

  it('preserves SQLite file URI paths', () => {
    expect(resolveDatabasePath('file:test?mode=memory&cache=shared')).toEqual({
      filename: 'file:test?mode=memory&cache=shared',
      needsDirectory: false,
    })
  })

  it('resolves filesystem database paths', () => {
    const resolved = resolveDatabasePath('data/test.db')

    expect(resolved.filename).toContain('/data/test.db')
    expect(resolved.needsDirectory).toBe(true)
  })
})
