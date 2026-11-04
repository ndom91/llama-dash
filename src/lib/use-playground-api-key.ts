import { useCallback, useEffect, useRef, useState } from 'react'

async function fetchPlaygroundApiKey(): Promise<string | null> {
  try {
    const r = await fetch('/api/playground-key', { cache: 'no-store' })
    if (!r.ok) return null
    const d = await r.json()
    return typeof d?.key === 'string' ? d.key : null
  } catch {
    return null
  }
}

export function usePlaygroundApiKey() {
  const [apiKey, setApiKey] = useState<string | null>(null)
  const apiKeyRef = useRef<string | null>(null)
  const apiKeyRequestRef = useRef<Promise<string | null> | null>(null)

  const requestApiKey = useCallback((force: boolean) => {
    if (!force && apiKeyRef.current) return Promise.resolve(apiKeyRef.current)
    if (apiKeyRequestRef.current) return apiKeyRequestRef.current

    const request = fetchPlaygroundApiKey()
      .then((key) => {
        if (key) {
          apiKeyRef.current = key
          setApiKey(key)
        }
        return key
      })
      .finally(() => {
        apiKeyRequestRef.current = null
      })

    apiKeyRequestRef.current = request
    return request
  }, [])

  const loadApiKey = useCallback(() => requestApiKey(false), [requestApiKey])

  // The system key rotates on every server restart, so a cached key goes stale
  // if the page sits idle across one. Callers retry once through refreshApiKey
  // on a 401 to self-heal instead of erroring.
  const refreshApiKey = useCallback(() => requestApiKey(true), [requestApiKey])

  useEffect(() => {
    void loadApiKey()
  }, [loadApiKey])

  return { apiKey, loadApiKey, refreshApiKey }
}
