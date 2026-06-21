import { useCallback, useEffect, useRef, useState } from 'react'

const LS_MODEL = 'playground-transcribe-model'
const DEFAULT_LANGUAGE = 'auto-detect'
const DEFAULT_RESPONSE_FORMAT = 'json'
const MAX_FILE_SIZE = 20 * 1024 * 1024
const LLAMA_CPP_AUDIO_TYPES = new Set(['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3', 'audio/flac'])
const LLAMA_CPP_AUDIO_EXTENSIONS = new Set(['wav', 'mp3', 'flac'])
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
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE)
  const [responseFormat, setResponseFormat] = useState(DEFAULT_RESPONSE_FORMAT)
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
    const uploadFile = await prepareTranscriptionFile(file)
    const requestedLanguage = language.trim()
    const requestedResponseFormat = responseFormat.trim() || DEFAULT_RESPONSE_FORMAT

    formData.append('file', uploadFile, uploadFile.name)
    formData.append('model', model)
    formData.append('response_format', requestedResponseFormat)
    if (requestedLanguage && requestedLanguage.toLowerCase() !== DEFAULT_LANGUAGE) {
      formData.append('language', requestedLanguage)
    }

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

      const format = requestedResponseFormat.toLowerCase()
      if (format === 'json' || format === 'verbose_json') {
        const data = await res.json()
        setTranscript(data.text ?? JSON.stringify(data))
        setTranscriptData(data as TranscriptionVerbose)
      } else {
        const text = await res.text()
        setTranscript(text)
        setTranscriptData(null)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }, [model, file, language, responseFormat])

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
    language,
    setLanguage,
    responseFormat,
    setResponseFormat,
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

async function prepareTranscriptionFile(file: File): Promise<File> {
  if (isLlamaCppAudioFile(file)) return file

  let audioBuffer: AudioBuffer
  try {
    const context = new AudioContext()
    try {
      audioBuffer = await context.decodeAudioData(await file.arrayBuffer())
    } finally {
      await context.close().catch(() => {})
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new Error(`Unable to convert ${file.name} to WAV for llama.cpp audio input: ${detail}`)
  }

  const wav = audioBufferToWav(audioBuffer)
  if (wav.size > MAX_FILE_SIZE) {
    throw new Error(`Converted WAV is too large (${(wav.size / 1024 / 1024).toFixed(1)} MB). Maximum is 20 MB.`)
  }

  return new File([wav], `${stripExtension(file.name) || 'audio'}.wav`, { type: 'audio/wav' })
}

function isLlamaCppAudioFile(file: File): boolean {
  if (LLAMA_CPP_AUDIO_TYPES.has(file.type)) return true
  const extension = file.name.split('.').pop()?.toLowerCase()
  return extension ? LLAMA_CPP_AUDIO_EXTENSIONS.has(extension) : false
}

function stripExtension(name: string): string {
  const index = name.lastIndexOf('.')
  return index > 0 ? name.slice(0, index) : name
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index))
  const sampleRate = buffer.sampleRate
  const sampleCount = buffer.length
  const bytesPerSample = 2
  const dataBytes = sampleCount * bytesPerSample
  const wav = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(wav)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * bytesPerSample, true)
  view.setUint16(32, bytesPerSample, true)
  view.setUint16(34, 8 * bytesPerSample, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataBytes, true)

  let offset = 44
  for (let i = 0; i < sampleCount; i++) {
    let sample = 0
    for (const channel of channels) sample += channel[i] ?? 0
    sample = Math.max(-1, Math.min(1, sample / channels.length))
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
    offset += bytesPerSample
  }

  return new Blob([wav], { type: 'audio/wav' })
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i))
  }
}
