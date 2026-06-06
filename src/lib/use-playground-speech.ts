import { useCallback, useEffect, useRef, useState } from 'react'
import { splitSpeechIntoSegments } from './playground-speech-segments'

const LS_MODEL = 'playground-speech-model'
const LS_VOICE = 'playground-speech-voice'
const LS_ENTRIES = 'playground-speech-entries'
const SPEECH_REQUEST_TIMEOUT_MS = 180_000
const AUDIO_METADATA_TIMEOUT_MS = 3_000
const ESTIMATED_SPEECH_WORDS_PER_MINUTE = 165
const SPEECH_WORD_PATTERN = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu

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
        estimatedAudioDurationSec: estimateSpeechDuration(chunks),
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
  estimatedAudioDurationSec?: number | null
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
  const signal = withTimeout(input.signal, SPEECH_REQUEST_TIMEOUT_MS, 'Speech request timed out')

  let res: Response
  let blob: Blob
  try {
    res = await fetch('/v1/audio/speech', {
      method: 'POST',
      headers: input.headers,
      body: JSON.stringify(body),
      signal: signal.signal,
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      throw new Error(`${res.status}: ${errBody.slice(0, 300)}`)
    }

    blob = await res.blob()
  } finally {
    signal.cleanup()
  }

  const audioUrl = await readBlobAsDataUrl(blob)
  return {
    audioUrl,
    renderMs: performance.now() - startedAt,
    audioDurationSec: await readAudioDuration(audioUrl),
  }
}

function withTimeout(signal: AbortSignal, timeoutMs: number, timeoutMessage: string) {
  const abort = new AbortController()
  const abortFromInput = () => abort.abort(signal.reason)
  const timer = window.setTimeout(() => abort.abort(new Error(timeoutMessage)), timeoutMs)

  if (signal.aborted) abortFromInput()
  else signal.addEventListener('abort', abortFromInput, { once: true })

  return {
    signal: abort.signal,
    cleanup: () => {
      window.clearTimeout(timer)
      signal.removeEventListener('abort', abortFromInput)
    },
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

function estimateSpeechDuration(chunks: string[]) {
  let total = 0
  for (const chunk of chunks) {
    const words = chunk.match(SPEECH_WORD_PATTERN)?.length ?? 0
    total += Math.max(1, (words / ESTIMATED_SPEECH_WORDS_PER_MINUTE) * 60)
  }
  return total
}

function readAudioDuration(url: string) {
  return new Promise<number | null>((resolve) => {
    const audio = document.createElement('audio')
    const cleanup = (timer: number) => {
      window.clearTimeout(timer)
      audio.onloadedmetadata = null
      audio.onerror = null
      audio.removeAttribute('src')
      audio.load()
    }
    const finish = (timer: number, duration: number | null) => {
      cleanup(timer)
      resolve(duration)
    }

    audio.preload = 'metadata'
    const timer = window.setTimeout(() => finish(timer, null), AUDIO_METADATA_TIMEOUT_MS)
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : null
      finish(timer, duration)
    }
    audio.onerror = () => {
      finish(timer, null)
    }
    audio.src = url
    audio.load()
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
