import { useMemo } from 'react'
import { CodeBlock } from '../../components/CodeBlock'
import { type EndpointClient, type EndpointModality, endpointSnippet } from './snippets'

type Props = {
  modality: EndpointModality
  client: EndpointClient
  baseUrl: string
  apiKey: string
  model: string
}

export function CodeExample({ modality, client, baseUrl, apiKey, model }: Props) {
  const snippet = useMemo(
    () => endpointSnippet(modality, client, { baseUrl, apiKey, model }),
    [modality, client, baseUrl, apiKey, model],
  )
  if (!snippet) return null
  return <CodeBlock text={snippet.code} filename={snippet.filename} lang={snippet.lang} />
}
