import { useMemo } from 'react'
import { CodeBlock } from '../../components/CodeBlock'
import type { EndpointType } from './endpointTypes'
import { type EndpointClient, endpointSnippet } from './snippets'

type Props = {
  type: EndpointType
  client: EndpointClient
  baseUrl: string
  apiKey: string
  model: string
}

export function CodeExample({ type, client, baseUrl, apiKey, model }: Props) {
  const snippet = useMemo(
    () => endpointSnippet(type, client, { baseUrl, apiKey, model }),
    [type, client, baseUrl, apiKey, model],
  )
  if (!snippet) return null
  return (
    <CodeBlock
      text={snippet.code}
      filename={snippet.filename}
      lang={snippet.lang}
      meta={
        <>
          <span className="rounded-sm bg-accent/15 px-1.5 py-px text-[10px] font-semibold text-accent">
            {snippet.method}
          </span>
          <span className="truncate text-fg-dim">{snippet.path}</span>
        </>
      }
    />
  )
}
