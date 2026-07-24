import { vi } from 'vitest'

/** Shared undici fetch mock for the integration project (installed in setupFiles). */
export const undiciFetchMock = vi.fn()
