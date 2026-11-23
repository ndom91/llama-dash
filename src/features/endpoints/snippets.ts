import type { ApiModel } from '../../lib/schemas/model'
import { isRealtimeAudioModel } from '../playground/playgroundRealtimeUtils'
import { IMAGE_SNIPPETS } from './snippetsImage'
import { REALTIME_SNIPPETS } from './snippetsRealtime'
import { SPEECH_SNIPPETS } from './snippetsSpeech'
import { TEXT_SNIPPETS } from './snippetsText'
import { TRANSCRIBE_SNIPPETS } from './snippetsTranscribe'

export type EndpointModality = 'text' | 'image' | 'speech' | 'transcribe' | 'realtime'

export type EndpointClient = 'curl' | 'python' | 'typescript' | 'homeassistant' | 'claudecode' | 'opencode'

export const ENDPOINT_MODALITIES: Array<{ id: EndpointModality; label: string }> = [
  { id: 'text', label: 'Text' },
  { id: 'image', label: 'Image' },
  { id: 'speech', label: 'Speech' },
  { id: 'transcribe', label: 'Transcribe' },
  { id: 'realtime', label: 'Realtime' },
]

const CLIENT_LABELS: Record<EndpointClient, string> = {
  curl: 'curl',
  python: 'Python',
  typescript: 'TypeScript',
  homeassistant: 'Home Assistant',
  claudecode: 'Claude Code',
  opencode: 'opencode',
}

export type EndpointSnippet = { code: string; filename: string; lang: string }

export type SnippetContext = { baseUrl: string; apiKey: string; model: string }

export type SnippetMap = Partial<Record<EndpointClient, (ctx: SnippetContext) => EndpointSnippet>>

const SNIPPETS: Record<EndpointModality, SnippetMap> = {
  text: TEXT_SNIPPETS,
  image: IMAGE_SNIPPETS,
  speech: SPEECH_SNIPPETS,
  transcribe: TRANSCRIBE_SNIPPETS,
  realtime: REALTIME_SNIPPETS,
}

/** Clients that have an example for the modality, in the map's order. */
export function clientsForModality(modality: EndpointModality): Array<{ id: EndpointClient; label: string }> {
  return (Object.keys(SNIPPETS[modality]) as Array<EndpointClient>).map((id) => ({ id, label: CLIENT_LABELS[id] }))
}

export function endpointSnippet(modality: EndpointModality, client: EndpointClient, ctx: SnippetContext) {
  return SNIPPETS[modality][client]?.(ctx) ?? null
}

type ModelPredicate = (model: ApiModel) => boolean

const hasInput = (model: ApiModel, modality: string) => model.capabilities.inputModalities.includes(modality)
const hasOutput = (model: ApiModel, modality: string) => model.capabilities.outputModalities.includes(modality)

const MODEL_MATCHERS: Record<EndpointModality, { matches: ModelPredicate; placeholder: string }> = {
  text: { matches: () => true, placeholder: 'your-model' },
  image: { matches: (m) => hasOutput(m, 'image'), placeholder: 'your-image-model' },
  speech: { matches: (m) => hasOutput(m, 'audio') && !hasInput(m, 'audio'), placeholder: 'your-tts-model' },
  transcribe: { matches: (m) => hasInput(m, 'audio') && !hasOutput(m, 'audio'), placeholder: 'your-stt-model' },
  realtime: { matches: isRealtimeAudioModel, placeholder: 'your-realtime-model' },
}

/**
 * Picks a local model that reports the modality, preferring a running one.
 * Text keeps the old behaviour: only a running model, else a placeholder.
 */
export function exampleModelFor(models: ReadonlyArray<ApiModel> | undefined, modality: EndpointModality): string {
  const { matches, placeholder } = MODEL_MATCHERS[modality]
  const candidates = (models ?? []).filter((model) => model.kind === 'local' && matches(model))
  const running = candidates.find((model) => model.running)
  if (modality === 'text') return running?.id ?? placeholder
  return (running ?? candidates[0])?.id ?? placeholder
}
