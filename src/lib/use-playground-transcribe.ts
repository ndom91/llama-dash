import { useCallback, useEffect, useRef, useState } from 'react'

const LS_MODEL = 'playground-transcribe-model'
const MAX_FILE_SIZE = 20 * 1024 * 1024
const ACCEPTED_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/mp4',
  'audio/m4a',
  'audio/webm',
])

function loadString(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  return localStorage.getItem(key) ?? fallback
}

export function usePlaygroundTranscribe() {
  const [model, setModelState] = useState(() => loadString(LS_MODEL, ''))
  const [file, setFileState] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [transcriptData, setTranscriptData] = useState<TranscriptionVerbose | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const apiKeyRef = useRef<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Array<Blob>>([])

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

  const setFile = useCallback((f: File | null) => {
    setError(null)
    if (f) {
      if (f.size > MAX_FILE_SIZE) {
        setError(`File too large (${(f.size / 1024 / 1024).toFixed(1)} MB). Maximum is 20 MB.`)
        return
      }
      if (!ACCEPTED_TYPES.has(f.type) && !f.type.startsWith('audio/')) {
        setError('Unsupported file type. Use MP3, OGG, WAV, FLAC, M4A, or WebM.')
        return
      }
    }
    setFileState(f)
  }, [])

  const transcribe = useCallback(async () => {
    if (!model || !file) return
    setLoading(true)
    setError(null)
    setTranscript(null)
    setTranscriptData(null)

    const abort = new AbortController()
    abortRef.current = abort

    const formData = new FormData()
    formData.append('file', file)
    formData.append('model', model)
    formData.append('response_format', 'verbose_json')
    formData.append('timestamp_granularities[]', 'segment')

    const headers: Record<string, string> = {}
    if (apiKeyRef.current) headers.authorization = `Bearer ${apiKeyRef.current}`

    try {
      const res = await fetch('/v1/audio/transcriptions', {
        method: 'POST',
        headers,
        body: formData,
        signal: abort.signal,
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`${res.status}: ${body.slice(0, 300)}`)
      }

      const data = await res.json()
      setTranscript(data.text ?? JSON.stringify(data))
      setTranscriptData(data as TranscriptionVerbose)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }, [model, file])

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : 'audio/webm'

      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        for (const t of stream.getTracks()) t.stop()
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const ext = mimeType.includes('ogg') ? 'ogg' : 'webm'
        const recorded = new File([blob], `recording.${ext}`, { type: mimeType })
        setFileState(recorded)
        setRecording(false)
      }

      recorder.start()
      recorderRef.current = recorder
      setRecording(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access denied')
    }
  }, [])

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop()
    recorderRef.current = null
  }, [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clear = useCallback(() => {
    setFileState(null)
    setTranscript(null)
    setTranscriptData(null)
    setError(null)
  }, [])

  return {
    model,
    setModel,
    file,
    setFile,
    loading,
    transcript,
    transcriptData,
    error,
    recording,
    transcribe,
    startRecording,
    stopRecording,
    stop,
    clear,
  }
}

export type TranscriptionVerbose = {
  text?: string
  duration?: number
  segments?: Array<{
    id?: number
    text?: string
    start?: number
    end?: number
    avg_logprob?: number
    words?: Array<{
      word?: string
      probability?: number
      start?: number
      end?: number
    }>
  }>
}
