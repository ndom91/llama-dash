import { useCallback, useEffect, useRef, useState } from 'react'

const LS_MODEL = 'playground-image-model'
const LS_SIZE = 'playground-image-size'

export type ImageEntry = {
  id: string
  prompt: string
} & ({ kind: 'images'; images: Array<{ url: string; revisedPrompt?: string }> } | { kind: 'text'; text: string })

function loadString(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  return localStorage.getItem(key) ?? fallback
}

type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }

type ChatResponse = {
  choices?: Array<{ message?: { content?: string | Array<ContentPart> } }>
}

function extractFromChatResponse(data: ChatResponse): {
  images: Array<{ url: string }>
  text: string
} {
  const images: Array<{ url: string }> = []
  let text = ''

  for (const choice of data.choices ?? []) {
    const content = choice.message?.content
    if (!content) continue
    if (Array.isArray(content)) {
      for (const part of content) {
        if (part.type === 'image_url' && part.image_url?.url) {
          images.push({ url: part.image_url.url })
        } else if (part.type === 'text') {
          text += part.text
        }
      }
    } else if (typeof content === 'string') {
      const re = /data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/g
      for (const match of content.matchAll(re)) {
        images.push({ url: match[0] })
      }
      text += content.replace(re, '').trim()
    }
  }
  return { images, text }
}

export function usePlaygroundImage() {
  const [model, setModelState] = useState(() => loadString(LS_MODEL, ''))
  const [size, setSizeState] = useState(() => loadString(LS_SIZE, '512x512'))
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [entries, setEntries] = useState<Array<ImageEntry>>([])
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
    const savedPrompt = prompt.trim()
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
          prompt: savedPrompt,
          size,
          response_format: 'b64_json',
        }),
        signal: abort.signal,
      })

      if (res.status === 404) {
        const entry = await generateViaChatCompletions(model, savedPrompt, headers, abort.signal)
        setEntries((prev) => [entry, ...prev])
        return
      }

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
      setEntries((prev) => [{ id: `gen_${Date.now()}`, prompt: savedPrompt, kind: 'images', images }, ...prev])
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

async function generateViaChatCompletions(
  model: string,
  prompt: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<ImageEntry> {
  const res = await fetch('/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: `Generate an image: ${prompt}` }],
      stream: false,
    }),
    signal,
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${res.status}: ${body.slice(0, 300)}`)
  }

  const data = await res.json()
  const { images, text } = extractFromChatResponse(data)

  if (images.length > 0) {
    return { id: `gen_${Date.now()}`, prompt, kind: 'images', images }
  }
  return { id: `gen_${Date.now()}`, prompt, kind: 'text', text: text || 'Model did not return any images' }
}
