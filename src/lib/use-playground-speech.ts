import { useCallback, useEffect, useRef, useState } from 'react'

const LS_MODEL = 'playground-speech-model'
const LS_VOICE = 'playground-speech-voice'

function loadString(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  return localStorage.getItem(key) ?? fallback
}

export function usePlaygroundSpeech() {
  const [model, setModelState] = useState(() => loadString(LS_MODEL, ''))
  const [voice, setVoiceState] = useState(() => loadString(LS_VOICE, ''))
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [voices, setVoices] = useState<Array<string> | null>(null)
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

  useEffect(() => {
    const timer = setTimeout(() => {
      const headers: Record<string, string> = {}
      if (apiKeyRef.current) headers.authorization = `Bearer ${apiKeyRef.current}`
      fetch('/v1/audio/voices', { headers })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.voices && Array.isArray(data.voices)) {
            setVoices(
              data.voices.map((v: string | { name?: string; id?: string }) =>
                typeof v === 'string' ? v : (v.name ?? v.id ?? String(v)),
              ),
            )
          }
        })
        .catch(() => {})
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  const setModel = useCallback((v: string) => {
    setModelState(v)
    localStorage.setItem(LS_MODEL, v)
  }, [])

  const setVoice = useCallback((v: string) => {
    setVoiceState(v)
    localStorage.setItem(LS_VOICE, v)
  }, [])

  const generate = useCallback(async () => {
    if (!model || !text.trim()) return
    setLoading(true)
    setError(null)

    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null)

    const abort = new AbortController()
    abortRef.current = abort

    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (apiKeyRef.current) headers.authorization = `Bearer ${apiKeyRef.current}`

    try {
      const body: Record<string, unknown> = { model, input: text.trim() }
      if (voice.trim()) body.voice = voice.trim()

      const res = await fetch('/v1/audio/speech', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: abort.signal,
      })

      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        throw new Error(`${res.status}: ${errBody.slice(0, 300)}`)
      }

      const blob = await res.blob()
      setAudioUrl(URL.createObjectURL(blob))
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }, [model, text, voice, audioUrl])

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return {
    model,
    setModel,
    voice,
    setVoice,
    voices,
    text,
    setText,
    loading,
    audioUrl,
    error,
    generate,
    stop,
  }
}
