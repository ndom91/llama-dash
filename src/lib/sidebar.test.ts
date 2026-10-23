import { describe, expect, it } from 'vitest'
import { parseSidebarCollapsed, SIDEBAR_COOKIE, sidebarCookieValue } from './sidebar'

describe('sidebar collapsed cookie', () => {
  it('reads only an explicit 1 as collapsed', () => {
    expect(parseSidebarCollapsed('1')).toBe(true)
    expect(parseSidebarCollapsed('0')).toBe(false)
    expect(parseSidebarCollapsed(undefined)).toBe(false)
    expect(parseSidebarCollapsed('true')).toBe(false)
  })

  it('round-trips through the cookie value', () => {
    expect(parseSidebarCollapsed(sidebarCookieValue(true))).toBe(true)
    expect(parseSidebarCollapsed(sidebarCookieValue(false))).toBe(false)
    expect(SIDEBAR_COOKIE).toBe('llama-sidebar-collapsed')
  })
})
