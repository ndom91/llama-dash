import { useCallback, useEffect, useRef } from 'react'

export function usePlaygroundApiKey() {
  const apiKeyRef = useRef<string | null>(null)
  const apiKeyRequestRef = useRef<Promise<string | null> | null>(null)

  const loadApiKey = useCallback(() => {
    if (apiKeyRef.current) return Promise.resolve(apiKeyRef.current)
    if (apiKeyRequestRef.current) return apiKeyRequestRef.current

    const request = fetch('/api/playground-key')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const key = typeof d?.key === 'string' ? d.key : null
        if (key) apiKeyRef.current = key
        return key
      })
      .catch(() => null)
      .finally(() => {
        apiKeyRequestRef.current = null
      })

    apiKeyRequestRef.current = request
    return request
  }, [])

  useEffect(() => {
    void loadApiKey()
  }, [loadApiKey])

  return { loadApiKey }
}
