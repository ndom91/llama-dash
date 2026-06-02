import { useCallback, useEffect, useRef, useState } from 'react'
import { splitSpeechIntoSegments } from './playground-speech-segments'

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
  const [entries, setEntries] = useState<Array<SpeechEntry>>(() => normalizeSpeechEntries(loadJson(LS_ENTRIES, [])))
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
      localStorage.setItem(LS_ENTRIES, JSON.stringify(toPersistedSpeechEntries(entries)))
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

  const generate = useCallback(
    async (options: GenerateSpeechOptions = {}) => {
      const input = (options.input ?? text).trim()
      if (!model || !input) return

      setLoading(true)
      setError(null)

      const abort = new AbortController()
      abortRef.current = abort

      const headers: Record<string, string> = { 'content-type': 'application/json' }
      if (apiKeyRef.current) headers.authorization = `Bearer ${apiKeyRef.current}`

      try {
        const result = await requestSpeech({ model, voice, input, headers, signal: abort.signal })
        const createdAt = Date.now()
        setEntries((prev) => [
          {
            id: `speech_${createdAt}_${Math.random().toString(36).slice(2, 8)}`,
            audioUrl: result.audioUrl,
            input,
            voice: voice.trim() || 'default',
            source: options.source,
            renderMs: result.renderMs,
            audioDurationSec: result.audioDurationSec,
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
    },
    [model, text, voice],
  )

  const generateSegments = useCallback(
    async (options: GenerateSpeechOptions = {}) => {
      const input = (options.input ?? text).trim()
      if (!model || !input) return

      const chunks = splitSpeechIntoSegments(input)
      if (chunks.length <= 1) {
        await generate(options)
        return
      }

      setLoading(true)
      setError(null)

      const abort = new AbortController()
      abortRef.current = abort

      const headers: Record<string, string> = { 'content-type': 'application/json' }
      if (apiKeyRef.current) headers.authorization = `Bearer ${apiKeyRef.current}`

      const createdAt = Date.now()
      const id = `speech_${createdAt}_${Math.random().toString(36).slice(2, 8)}`
      const baseEntry: SpeechEntry = {
        id,
        input,
        voice: voice.trim() || 'default',
        source: options.source,
        renderMs: null,
        audioDurationSec: null,
        createdAt,
        status: 'generating',
        totalSegments: chunks.length,
        segments: [],
      }
      setEntries((prev) => [baseEntry, ...prev])

      try {
        for (let index = 0; index < chunks.length; index += 1) {
          const chunk = chunks[index]
          const result = await requestSpeech({ model, voice, input: chunk, headers, signal: abort.signal })
          const segment: SpeechSegment = {
            id: `${id}_seg_${index}`,
            index,
            input: chunk,
            audioUrl: result.audioUrl,
            renderMs: result.renderMs,
            audioDurationSec: result.audioDurationSec,
          }

          setEntries((prev) =>
            prev.map((entry) => {
              if (entry.id !== id) return entry
              const segments = [...(entry.segments ?? []), segment]
              return {
                ...entry,
                segments,
                renderMs: sumSegmentRenderMs(segments),
                audioDurationSec: sumSegmentDuration(segments),
                status: segments.length === chunks.length ? 'complete' : 'generating',
              }
            }),
          )
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, status: 'cancelled' } : entry)))
          return
        }
        setEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, status: 'error' } : entry)))
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
        abortRef.current = null
      }
    },
    [generate, model, text, voice],
  )

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
    generateSegments,
    stop,
    removeEntry,
  }
}

export type SpeechEntry = {
  id: string
  audioUrl?: string
  input: string
  voice: string
  source?: SpeechEntrySource
  renderMs: number | null
  audioDurationSec: number | null
  createdAt?: number
  status?: SpeechEntryStatus
  totalSegments?: number
  segments?: SpeechSegment[]
}

type GenerateSpeechOptions = {
  input?: string
  source?: SpeechEntrySource
}

export type SpeechEntrySource = {
  type: 'article'
  url: string
  finalUrl: string
  title: string | null
  siteName: string | null
  wordCount: number
  truncated: boolean
}

export type SpeechSegment = {
  id: string
  index: number
  input: string
  audioUrl: string
  renderMs: number
  audioDurationSec: number | null
}

type SpeechEntryStatus = 'generating' | 'complete' | 'cancelled' | 'error'

async function requestSpeech(input: {
  model: string
  voice: string
  input: string
  headers: Record<string, string>
  signal: AbortSignal
}) {
  const startedAt = performance.now()
  const body: Record<string, unknown> = { model: input.model, input: input.input }
  if (input.voice.trim()) body.voice = input.voice.trim()

  const res = await fetch('/v1/audio/speech', {
    method: 'POST',
    headers: input.headers,
    body: JSON.stringify(body),
    signal: input.signal,
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`${res.status}: ${errBody.slice(0, 300)}`)
  }

  const blob = await res.blob()
  const audioUrl = await readBlobAsDataUrl(blob)
  return {
    audioUrl,
    renderMs: performance.now() - startedAt,
    audioDurationSec: await readAudioDuration(audioUrl),
  }
}

function normalizeSpeechEntries(entries: SpeechEntry[]): SpeechEntry[] {
  if (!Array.isArray(entries)) return []
  return entries.map((entry) => (entry.status === 'generating' ? { ...entry, status: 'cancelled' } : entry))
}

function toPersistedSpeechEntries(entries: SpeechEntry[]): SpeechEntry[] {
  // Segmented article playback stores many base64 audio data URLs. Keep those
  // session-local to avoid exhausting localStorage on long articles.
  return entries.filter((entry) => entry.totalSegments == null)
}

function sumSegmentRenderMs(segments: SpeechSegment[]) {
  return segments.reduce((total, segment) => total + segment.renderMs, 0)
}

function sumSegmentDuration(segments: SpeechSegment[]) {
  let total = 0
  for (const segment of segments) {
    if (segment.audioDurationSec == null) return null
    total += segment.audioDurationSec
  }
  return total
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
