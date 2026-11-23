import {
  AudioWaveform,
  Binary,
  Captions,
  Image as ImageIcon,
  type LucideIcon,
  MessageSquareText,
  Volume2,
} from 'lucide-react'
import type { ApiModel } from '../../lib/schemas/model'
import { isRealtimeAudioModel } from '../playground/playgroundRealtimeUtils'

export type EndpointType = 'text' | 'image' | 'speech' | 'transcribe' | 'realtime' | 'embeddings'

export type EndpointTypeInfo = {
  id: EndpointType
  label: string
  icon: LucideIcon
  method: 'POST' | 'WS'
  path: string
  /** llama-swap `capabilities` entry that makes a model show up for this type. */
  configHint: string
  matches: (model: ApiModel) => boolean
}

const hasInput = (model: ApiModel, modality: string) => model.capabilities.inputModalities.includes(modality)
const hasOutput = (model: ApiModel, modality: string) => model.capabilities.outputModalities.includes(modality)
const hasFlag = (model: ApiModel, flag: string) => model.capabilities.flags.includes(flag)

// llama-swap never auto-discovers the `embeddings` flag, so an embedding model
// without it reports plain text->text. The name check keeps those out of Text.
function isEmbeddingModel(model: ApiModel): boolean {
  return hasFlag(model, 'embeddings') || /embed/i.test(model.id)
}

export const ENDPOINT_TYPES: ReadonlyArray<EndpointTypeInfo> = [
  {
    id: 'text',
    label: 'Text',
    icon: MessageSquareText,
    method: 'POST',
    path: '/v1/chat/completions',
    configHint: 'capabilities: { in: [text], out: [text] }',
    matches: (m) => hasInput(m, 'text') && hasOutput(m, 'text') && !isEmbeddingModel(m),
  },
  {
    id: 'image',
    label: 'Image',
    icon: ImageIcon,
    method: 'POST',
    path: '/v1/images/generations',
    configHint: 'capabilities: { out: [image] }',
    matches: (m) => hasFlag(m, 'image_generation') || hasOutput(m, 'image'),
  },
  {
    id: 'speech',
    label: 'Speech',
    icon: Volume2,
    method: 'POST',
    path: '/v1/audio/speech',
    configHint: 'capabilities: { out: [audio] }',
    matches: (m) => hasFlag(m, 'audio_speech') || hasOutput(m, 'audio'),
  },
  {
    id: 'transcribe',
    label: 'Transcribe',
    icon: Captions,
    method: 'POST',
    path: '/v1/audio/transcriptions',
    configHint: 'capabilities: { in: [audio], out: [text] }',
    matches: (m) => hasFlag(m, 'audio_transcriptions') || (hasInput(m, 'audio') && hasOutput(m, 'text')),
  },
  {
    id: 'realtime',
    label: 'Realtime',
    icon: AudioWaveform,
    method: 'WS',
    path: '/v1/realtime',
    configHint: 'capabilities: { in: [audio], out: [audio] }',
    matches: isRealtimeAudioModel,
  },
  {
    id: 'embeddings',
    label: 'Embeddings',
    icon: Binary,
    method: 'POST',
    path: '/v1/embeddings',
    configHint: 'capabilities: { embeddings: true }',
    matches: isEmbeddingModel,
  },
]

export const ENDPOINT_TYPE_IDS = ENDPOINT_TYPES.map((t) => t.id)

export function endpointTypeInfo(type: EndpointType): EndpointTypeInfo {
  return ENDPOINT_TYPES.find((t) => t.id === type) ?? ENDPOINT_TYPES[0]
}

/** Models that report support for the type, loaded ones first. */
export function modelsForType(models: ReadonlyArray<ApiModel> | undefined, type: EndpointType): Array<ApiModel> {
  const { matches } = endpointTypeInfo(type)
  return (models ?? []).filter(matches).sort((a, b) => Number(b.running) - Number(a.running))
}

export function placeholderModel(type: EndpointType): string {
  return `your-${type}-model`
}
