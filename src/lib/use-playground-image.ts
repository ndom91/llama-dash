import { useCallback, useEffect, useRef, useState } from 'react'

const LS_MODEL = 'playground-image-model'
const LS_SIZE = 'playground-image-size'

export type GeneratedImage = {
  id: string
  url: string
  revisedPrompt?: string
}

function loadString(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  return localStorage.getItem(key) ?? fallback
}

export function usePlaygroundImage() {
  const [model, setModelState] = useState(() => loadString(LS_MODEL, ''))
  const [size, setSizeState] = useState(() => loadString(LS_SIZE, '512x512'))
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState<Array<GeneratedImage>>([])
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const apiKeyRef = useRef<string | null>(null)

  useEffect(() => {
    fetch('/api/playground-key')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.key) apiKeyRef.current = d.key
      })
      .catch(() => {})
  }, [])

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
    setLoading(true)
    setError(null)

    const abort = new AbortController()
    abortRef.current = abort

    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (apiKeyRef.current) headers.authorization = `Bearer ${apiKeyRef.current}`

    try {
      const res = await fetch('/v1/images/generations', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          prompt: prompt.trim(),
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
      const newImages: Array<GeneratedImage> = (data.data ?? []).map(
        (item: { b64_json?: string; url?: string; revised_prompt?: string }, i: number) => ({
          id: `img_${Date.now()}_${i}`,
          url: item.url ?? (item.b64_json ? `data:image/png;base64,${item.b64_json}` : ''),
          revisedPrompt: item.revised_prompt,
        }),
      )
      setImages((prev) => [...newImages, ...prev])
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }, [model, prompt, size])

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clearImages = useCallback(() => {
    setImages([])
  }, [])

  return {
    model,
    setModel,
    size,
    setSize,
    prompt,
    setPrompt,
    loading,
    images,
    error,
    generate,
    stop,
    clearImages,
  }
}
