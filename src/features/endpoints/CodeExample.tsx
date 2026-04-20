import { CopyBlock } from './CopyBlock'
import type { EndpointTab } from './snippets'
import { useEndpointSnippet } from './snippets'

type Props = {
  tab: EndpointTab
  baseUrl: string
  apiKey: string
  model: string
}

export function CodeExample({ tab, baseUrl, apiKey, model }: Props) {
  const snippet = useEndpointSnippet(tab, baseUrl, apiKey, model)
  return <CopyBlock text={snippet.code} filename={snippet.filename} lang={snippet.lang} />
}
