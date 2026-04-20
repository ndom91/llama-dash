import { useCallback, useEffect, useRef, useState } from 'react'

const LS_MODEL = 'playground-speech-model'
const LS_VOICE = 'playground-speech-voice'
const LS_ENTRIES = 'playground-speech-entries'

function loadString(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  return localStorage.getItem(key) ?? fallback
}

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function usePlaygroundSpeech() {
  const [model, setModelState] = useState(() => loadString(LS_MODEL, ''))
  const [voice, setVoiceState] = useState(() => loadString(LS_VOICE, ''))
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [entries, setEntries] = useState<Array<SpeechEntry>>(() => loadJson(LS_ENTRIES, []))
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

  useEffect(() => {
    try {
      localStorage.setItem(LS_ENTRIES, JSON.stringify(entries))
    } catch {
      // Ignore storage quota or serialization failures; history remains in memory.
    }
  }, [entries])

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

    const abort = new AbortController()
    abortRef.current = abort

    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (apiKeyRef.current) headers.authorization = `Bearer ${apiKeyRef.current}`

    try {
      const startedAt = performance.now()
      const input = text.trim()
      const body: Record<string, unknown> = { model, input }
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
      const dataUrl = await readBlobAsDataUrl(blob)
      const renderMs = performance.now() - startedAt
      const audioDurationSec = await readAudioDuration(dataUrl)
      const createdAt = Date.now()
      setEntries((prev) => [
        {
          id: `speech_${createdAt}_${Math.random().toString(36).slice(2, 8)}`,
          audioUrl: dataUrl,
          input,
          voice: voice.trim() || 'default',
          renderMs,
          audioDurationSec,
          createdAt,
        },
        ...prev,
      ])
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }, [model, text, voice])

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((entry) => entry.id !== id))
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
    entries,
    error,
    generate,
    stop,
    removeEntry,
  }
}

type SpeechEntry = {
  id: string
  audioUrl: string
  input: string
  voice: string
  renderMs: number
  audioDurationSec: number | null
  createdAt?: number
}

function readAudioDuration(url: string) {
  return new Promise<number | null>((resolve) => {
    const audio = document.createElement('audio')
    const cleanup = () => {
      audio.removeAttribute('src')
      audio.load()
    }

    audio.preload = 'metadata'
    audio.src = url
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : null
      cleanup()
      resolve(duration)
    }
    audio.onerror = () => {
      cleanup()
      resolve(null)
    }
  })
}

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read audio blob'))
    reader.readAsDataURL(blob)
  })
}
