import { useCallback, useRef, useState } from 'react'
import { loadString } from './playground-storage'
import { usePlaygroundApiKey } from './use-playground-api-key'

const LS_MODEL = 'playground-image-model'
const LS_SIZE = 'playground-image-size'

export type ImageEntry = {
  id: string
  prompt: string
  images: Array<{ url: string; revisedPrompt?: string }>
}

export function usePlaygroundImage() {
  const [model, setModelState] = useState(() => loadString(LS_MODEL, ''))
  const [size, setSizeState] = useState(() => loadString(LS_SIZE, '512x512'))
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [entries, setEntries] = useState<Array<ImageEntry>>([])
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const { loadApiKey } = usePlaygroundApiKey()

  const setModel = useCallback((v: string) => {
    setModelState(v)
    localStorage.setItem(LS_MODEL, v)
  }, [])

  const setSize = useCallback((v: string) => {
    setSizeState(v)
    localStorage.setItem(LS_SIZE, v)
  }, [])

  const generate = useCallback(async () => {
    if (!model || !prompt.trim()) return
    const savedPrompt = prompt.trim()
    setLoading(true)
    setError(null)

    const abort = new AbortController()
    abortRef.current = abort

    const apiKey = await loadApiKey()
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (apiKey) headers.authorization = `Bearer ${apiKey}`

    try {
      const res = await fetch('/v1/images/generations', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          prompt: savedPrompt,
          size,
          response_format: 'b64_json',
        }),
        signal: abort.signal,
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`${res.status}: ${body.slice(0, 300)}`)
      }

      const data = await res.json()
      const images: Array<{ url: string; revisedPrompt?: string }> = (data.data ?? []).map(
        (item: { b64_json?: string; url?: string; revised_prompt?: string }) => ({
          url: item.url ?? (item.b64_json ? `data:image/png;base64,${item.b64_json}` : ''),
          revisedPrompt: item.revised_prompt,
        }),
      )
      setEntries((prev) => [{ id: `gen_${Date.now()}`, prompt: savedPrompt, images }, ...prev])
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }, [loadApiKey, model, prompt, size])

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clearEntries = useCallback(() => {
    setEntries([])
  }, [])

  return {
    model,
    setModel,
    size,
    setSize,
    prompt,
    setPrompt,
    loading,
    entries,
    error,
    generate,
    stop,
    clearEntries,
  }
}
