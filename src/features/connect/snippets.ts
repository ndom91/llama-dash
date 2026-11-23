import type { ComponentType } from 'react'
import { ClaudeCodeIcon, HomeAssistantIcon, OpencodeIcon } from './ClientIcons'
import { ENDPOINT_TYPES, type EndpointType, endpointTypeInfo } from './endpointTypes'
import { EMBEDDINGS_SNIPPETS } from './snippetsEmbeddings'
import { IMAGE_SNIPPETS } from './snippetsImage'
import { REALTIME_SNIPPETS } from './snippetsRealtime'
import { SPEECH_SNIPPETS } from './snippetsSpeech'
import { TEXT_SNIPPETS } from './snippetsText'
import { TRANSCRIBE_SNIPPETS } from './snippetsTranscribe'

export type EndpointClient = 'curl' | 'python' | 'typescript' | 'claudecode' | 'opencode' | 'homeassistant'

/** A short mono tag, or an svg icon where the client has a recognisable mark. */
export type ClientIcon = string | ComponentType<{ className?: string }>

export const ENDPOINT_CLIENTS: ReadonlyArray<{ id: EndpointClient; label: string; icon: ClientIcon }> = [
  { id: 'curl', label: 'curl', icon: '$_' },
  { id: 'python', label: 'Python', icon: 'py' },
  { id: 'typescript', label: 'TypeScript', icon: 'ts' },
  { id: 'claudecode', label: 'Claude Code', icon: ClaudeCodeIcon },
  { id: 'opencode', label: 'opencode', icon: OpencodeIcon },
  { id: 'homeassistant', label: 'Home Assistant', icon: HomeAssistantIcon },
]

export const ENDPOINT_CLIENT_IDS = ENDPOINT_CLIENTS.map((c) => c.id)

export type SnippetContext = { baseUrl: string; apiKey: string; model: string }

export type EndpointSnippet = {
  code: string
  filename: string
  lang: string
  /** Overrides the type's default path, e.g. Claude Code speaks /v1/messages. */
  path?: string
}

export type SnippetMap = Partial<Record<EndpointClient, (ctx: SnippetContext) => EndpointSnippet>>

// Single source of truth for client availability: a client supports a type
// exactly when that type's map has an example for it.
const SNIPPETS: Record<EndpointType, SnippetMap> = {
  text: TEXT_SNIPPETS,
  image: IMAGE_SNIPPETS,
  speech: SPEECH_SNIPPETS,
  transcribe: TRANSCRIBE_SNIPPETS,
  realtime: REALTIME_SNIPPETS,
  embeddings: EMBEDDINGS_SNIPPETS,
}

export function clientSupports(client: EndpointClient, type: EndpointType): boolean {
  return SNIPPETS[type][client] != null
}

export function typesForClient(client: EndpointClient): Array<string> {
  return ENDPOINT_TYPES.filter((t) => clientSupports(client, t.id)).map((t) => t.label)
}

export function firstClientFor(type: EndpointType): EndpointClient {
  return ENDPOINT_CLIENTS.find((c) => clientSupports(c.id, type))?.id ?? 'curl'
}

export function endpointSnippet(type: EndpointType, client: EndpointClient, ctx: SnippetContext) {
  const snippet = SNIPPETS[type][client]?.(ctx)
  if (!snippet) return null
  const info = endpointTypeInfo(type)
  return { ...snippet, method: info.method, path: snippet.path ?? info.path }
}
