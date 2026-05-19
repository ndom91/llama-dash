import { beforeEach, describe, expect, it } from 'vitest'
import { buildModelPricingFromModelsDev, computeCostUsd, resetModelPricingForTest } from './pricing'

describe('model pricing', () => {
  beforeEach(() => {
    resetModelPricingForTest()
  })

  it('computes costs from models.dev pricing records', () => {
    const pricing = buildModelPricingFromModelsDev({
      anthropic: {
        models: {
          'claude-sonnet-4-5': {
            id: 'claude-sonnet-4-5',
            cost: { input: 3, output: 15, cache_read: 0.3, cache_write: 3.75 },
          },
        },
      },
    })
    resetModelPricingForTest(pricing)

    expect(
      computeCostUsd('claude-sonnet-4-5', {
        promptTokens: 1_000_000,
        completionTokens: 1_000_000,
        cacheCreationTokens: 1_000_000,
        cacheReadTokens: 1_000_000,
      }),
    ).toBe(22.05)
  })

  it('prefers priced records over subscription zero-cost duplicates', () => {
    const pricing = buildModelPricingFromModelsDev({
      'github-copilot': {
        models: {
          'gpt-4o': { id: 'gpt-4o', cost: { input: 0, output: 0 } },
        },
      },
      openai: {
        models: {
          'gpt-4o': { id: 'gpt-4o', cost: { input: 2.5, output: 10, cache_read: 1.25 } },
        },
      },
    })
    resetModelPricingForTest(pricing)

    expect(
      computeCostUsd('gpt-4o', {
        promptTokens: 1_000_000,
        completionTokens: 1_000_000,
        cacheCreationTokens: null,
        cacheReadTokens: null,
      }),
    ).toBe(12.5)
  })

  it('prefers canonical providers over higher-priced resellers', () => {
    const pricing = buildModelPricingFromModelsDev({
      requesty: {
        models: {
          'claude-sonnet-4-5': { id: 'claude-sonnet-4-5', cost: { input: 6, output: 30 } },
        },
      },
      anthropic: {
        models: {
          'claude-sonnet-4-5': { id: 'claude-sonnet-4-5', cost: { input: 3, output: 15 } },
        },
      },
    })
    resetModelPricingForTest(pricing)

    expect(
      computeCostUsd('claude-sonnet-4-5', {
        promptTokens: 1_000_000,
        completionTokens: 1_000_000,
        cacheCreationTokens: null,
        cacheReadTokens: null,
      }),
    ).toBe(18)
  })

  it('does not guess costs when cache pricing is unavailable', () => {
    const pricing = buildModelPricingFromModelsDev({
      openai: {
        models: {
          'gpt-4o': { id: 'gpt-4o', cost: { input: 2.5, output: 10 } },
        },
      },
    })
    resetModelPricingForTest(pricing)

    expect(
      computeCostUsd('gpt-4o', {
        promptTokens: 1_000_000,
        completionTokens: 0,
        cacheCreationTokens: null,
        cacheReadTokens: 1_000_000,
      }),
    ).toBeNull()
  })

  it('prefers duplicate records with cache pricing when provider priority ties', () => {
    const pricing = buildModelPricingFromModelsDev({
      openai: {
        models: {
          'gpt-4o-partial': { id: 'gpt-4o', cost: { input: 2.5, output: 10 } },
          'gpt-4o-complete': { id: 'gpt-4o', cost: { input: 2.5, output: 10, cache_read: 1.25 } },
        },
      },
    })
    resetModelPricingForTest(pricing)

    expect(
      computeCostUsd('gpt-4o', {
        promptTokens: 1_000_000,
        completionTokens: 0,
        cacheCreationTokens: null,
        cacheReadTokens: 1_000_000,
      }),
    ).toBe(3.75)
  })

  it('does not let zero-cost duplicate records replace priced records', () => {
    const pricing = buildModelPricingFromModelsDev({
      openai: {
        models: {
          'gpt-4o-priced': { id: 'gpt-4o', cost: { input: 2.5, output: 10 } },
          'gpt-4o-zero': { id: 'gpt-4o', cost: { input: 0, output: 0, cache_read: 0, cache_write: 0 } },
        },
      },
    })
    resetModelPricingForTest(pricing)

    expect(
      computeCostUsd('gpt-4o', {
        promptTokens: 1_000_000,
        completionTokens: 1_000_000,
        cacheCreationTokens: null,
        cacheReadTokens: null,
      }),
    ).toBe(12.5)
  })

  it('does not return partial costs when usage counters are missing', () => {
    const pricing = buildModelPricingFromModelsDev({
      openai: {
        models: {
          'gpt-4o': { id: 'gpt-4o', cost: { input: 2.5, output: 10 } },
        },
      },
    })
    resetModelPricingForTest(pricing)

    expect(
      computeCostUsd('gpt-4o', {
        promptTokens: 1_000_000,
        completionTokens: null,
        cacheCreationTokens: null,
        cacheReadTokens: null,
      }),
    ).toBeNull()
  })

  it('skips invalid records without discarding the whole catalog', () => {
    const pricing = buildModelPricingFromModelsDev({
      openai: {
        models: {
          broken: { id: 123, cost: { input: 2.5, output: 10 } },
          'gpt-4o': { id: 'gpt-4o', cost: { input: 2.5, output: 10 } },
        },
      },
    })
    resetModelPricingForTest(pricing)

    expect(
      computeCostUsd('gpt-4o', {
        promptTokens: 1_000_000,
        completionTokens: 1_000_000,
        cacheCreationTokens: null,
        cacheReadTokens: null,
      }),
    ).toBe(12.5)
  })

  it('matches versioned model names by longest known prefix', () => {
    const pricing = buildModelPricingFromModelsDev({
      anthropic: {
        models: {
          'claude-sonnet-4-5': { id: 'claude-sonnet-4-5', cost: { input: 3, output: 15 } },
        },
      },
    })
    resetModelPricingForTest(pricing)

    expect(
      computeCostUsd('claude-sonnet-4-5-20250929', {
        promptTokens: 1_000_000,
        completionTokens: 0,
        cacheCreationTokens: null,
        cacheReadTokens: null,
      }),
    ).toBe(3)
  })
})
