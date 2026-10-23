/**
 * Desktop sidebar collapse state. Kept in a cookie (not localStorage) so the
 * server renders the shell at the right width and there is no flash of the
 * expanded sidebar on load, the same way the color theme is applied.
 */
export const SIDEBAR_COOKIE = 'llama-sidebar-collapsed'

export function parseSidebarCollapsed(value: string | undefined): boolean {
  return value === '1'
}

export function sidebarCookieValue(collapsed: boolean): string {
  return collapsed ? '1' : '0'
}
