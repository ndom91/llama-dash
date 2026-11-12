export type SessionSheetTab = 'session' | 'requests' | 'show'

export function validateSessionSearch(search: Record<string, unknown>): {
  show?: string
  sheet?: SessionSheetTab
  detail?: string
} {
  return {
    show: typeof search.show === 'string' ? search.show : undefined,
    sheet:
      search.sheet === 'session' || search.sheet === 'requests' || search.sheet === 'show' ? search.sheet : undefined,
    detail:
      typeof search.detail === 'string' &&
      /^[a-zA-Z0-9_-]+~(?:tool|context|request|response)~\d+(?:~\d+)?$/.test(search.detail)
        ? search.detail
        : undefined,
  }
}
