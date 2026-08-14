import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { ModelsListResponseSchema } from './schemas.ts'

describe('ModelsListResponseSchema', () => {
  it('accepts llama-swap selector metadata', () => {
    const result = v.parse(ModelsListResponseSchema, {
      object: 'list',
      data: [
        {
          id: 'fastest-available',
          object: 'model',
          created: 0,
          owned_by: 'llama-swap',
          status: { value: 'loaded' },
          meta: {
            llamaswap: {
              type: 'selector',
              strategy: 'spillover',
              targets: ['primary', 'backup'],
              spillover: 2,
            },
          },
        },
      ],
    })

    expect(result.data[0].status?.value).toBe('loaded')
    expect(result.data[0].meta?.llamaswap).toMatchObject({
      type: 'selector',
      strategy: 'spillover',
      targets: ['primary', 'backup'],
      spillover: 2,
    })
  })
})
