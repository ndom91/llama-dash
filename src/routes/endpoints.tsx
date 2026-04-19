import { createFileRoute } from '@tanstack/react-router'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import python from 'highlight.js/lib/languages/python'
import typescript from 'highlight.js/lib/languages/typescript'
import yaml from 'highlight.js/lib/languages/yaml'
import { Check, Copy, FileCode2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { TopBar } from '../components/TopBar'
import { useApiKeys, useModels } from '../lib/queries'

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('python', python)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('yaml', yaml)

export const Route = createFileRoute('/endpoints')({ component: EndpointsPage })

type Tab = 'curl' | 'python' | 'typescript' | 'homeassistant' | 'claudecode' | 'opencode' | 'continue' | 'openwebui'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'curl', label: 'curl' },
  { id: 'python', label: 'Python' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'homeassistant', label: 'Home Assistant' },
  { id: 'claudecode', label: 'Claude Code' },
  { id: 'opencode', label: 'opencode' },
  { id: 'continue', label: 'Continue' },
  { id: 'openwebui', label: 'Open WebUI' },
]

function EndpointsPage() {
  const { data: keys } = useApiKeys()
  const { data: models } = useModels()
  const [tab, setTab] = useState<Tab>('curl')
  const [selectedKeyIdx, setSelectedKeyIdx] = useState(0)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
  const activeKeys = useMemo(() => (keys ?? []).filter((k) => !k.disabledAt), [keys])
  const hasKeys = activeKeys.length > 0
  const keyDisplay = hasKeys ? `${activeKeys[selectedKeyIdx]?.keyPrefix}…` : 'sk-your-key-here'
  const firstModel = models?.[0]?.id ?? 'your-model'

  return (
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page">
          <PageHeader kicker="§08 · integrate" title="Endpoints" subtitle="connect clients to llama-dash" />

          <div className={`grid gap-4 ${hasKeys ? 'grid-cols-1 md:grid-cols-2' : ''}`}>
            <section className="panel">
              <div className="panel-head">
                <span className="panel-title">Base URL</span>
              </div>
              <div className="p-4 flex flex-col gap-3">
                <CopyBlock text={`${baseUrl}/v1`} inline />
                <p className="text-xs text-fg-dim font-mono m-0">
                  All OpenAI-compatible endpoints live under <code className="text-fg-muted">/v1</code>. Point any
                  client that speaks the OpenAI API at this URL.
                </p>
              </div>
            </section>

            {hasKeys ? (
              <section className="panel">
                <div className="panel-head">
                  <span className="panel-title">API Key</span>
                  <span className="panel-sub">· used in examples below</span>
                </div>
                <div className="p-4 flex flex-col gap-3">
                  <select
                    className="bg-surface-3 border border-border rounded px-2 py-1.5 font-mono text-xs text-fg cursor-pointer"
                    value={selectedKeyIdx}
                    onChange={(e) => setSelectedKeyIdx(Number(e.target.value))}
                  >
                    {activeKeys.map((k, i) => (
                      <option key={k.id} value={i}>
                        {k.name} ({k.keyPrefix}…)
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-fg-dim font-mono m-0">
                    Key prefixes shown for reference. Use your full key value in the Authorization header.
                  </p>
                </div>
              </section>
            ) : null}
          </div>

          <section className="panel">
            <div className="panel-head">
              <span className="panel-title">Code examples</span>
              <span className="panel-sub">· {TABS.find((t) => t.id === tab)?.label}</span>
            </div>
            <div className="flex border-b border-border overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`px-4 py-2 text-xs font-mono cursor-pointer border-b-2 transition-colors ${
                    tab === t.id
                      ? 'border-accent text-fg bg-transparent'
                      : 'border-transparent text-fg-muted bg-transparent hover:text-fg hover:bg-surface-2'
                  }`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="p-4">
              <CodeExample tab={tab} baseUrl={baseUrl} apiKey={keyDisplay} model={firstModel} />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

type Snippet = { code: string; filename: string; lang: string }

function useSnippet(tab: Tab, baseUrl: string, apiKey: string, model: string): Snippet {
  return useMemo(() => {
    switch (tab) {
      case 'curl':
        return {
          filename: 'terminal',
          lang: 'bash',
          code: `curl ${baseUrl}/v1/chat/completions \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model}",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`,
        }

      case 'python':
        return {
          filename: 'chat.py',
          lang: 'python',
          code: `from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}/v1",
    api_key="${apiKey}",
)

response = client.chat.completions.create(
    model="${model}",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)`,
        }

      case 'typescript':
        return {
          filename: 'chat.ts',
          lang: 'typescript',
          code: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${baseUrl}/v1",
  apiKey: "${apiKey}",
});

const response = await client.chat.completions.create({
  model: "${model}",
  messages: [{ role: "user", content: "Hello!" }],
});
console.log(response.choices[0].message.content);`,
        }

      case 'homeassistant':
        return {
          filename: 'configuration.yaml',
          lang: 'yaml',
          code: `# Settings → Voice assistants → Add LLM conversation agent
#
# Or in configuration.yaml:
rest_command:
  llm_query:
    url: "${baseUrl}/v1/chat/completions"
    method: POST
    headers:
      Authorization: "Bearer ${apiKey}"
      Content-Type: "application/json"
    payload: >
      {"model": "${model}", "messages": [{"role": "user", "content": "{{ prompt }}"}]}

# For the OpenAI-compatible conversation agent,
# install the "Extended OpenAI Conversation" integration:
#   Base URL: ${baseUrl}/v1
#   API Key:  ${apiKey}
#   Model:    ${model}`,
        }

      case 'claudecode':
        return {
          filename: '~/.claude/settings.json',
          lang: 'json',
          code: `{
  "modelProvider": {
    "type": "openai-compatible",
    "baseUrl": "${baseUrl}/v1",
    "apiKey": "${apiKey}",
    "model": "${model}"
  }
}`,
        }

      case 'opencode':
        return {
          filename: '.opencode/config.json',
          lang: 'json',
          code: `{
  "provider": {
    "llama-dash": {
      "apiKey": "${apiKey}",
      "models": {
        "${model}": {
          "name": "${model}",
          "apiUrl": "${baseUrl}/v1/chat/completions"
        }
      }
    }
  }
}`,
        }

      case 'continue':
        return {
          filename: '~/.continue/config.json',
          lang: 'json',
          code: `{
  "models": [
    {
      "provider": "openai",
      "title": "${model}",
      "model": "${model}",
      "apiBase": "${baseUrl}/v1",
      "apiKey": "${apiKey}"
    }
  ]
}`,
        }

      case 'openwebui':
        return {
          filename: 'Open WebUI',
          lang: 'bash',
          code: `# Open WebUI → Admin → Settings → Connections
#
# 1. Add a new OpenAI-compatible connection:
#    URL:     ${baseUrl}/v1
#    API Key: ${apiKey}
#
# 2. Save and refresh — models from llama-dash
#    will appear in the model selector.`,
        }
    }
  }, [tab, baseUrl, apiKey, model])
}

function CodeExample({ tab, baseUrl, apiKey, model }: { tab: Tab; baseUrl: string; apiKey: string; model: string }) {
  const snippet = useSnippet(tab, baseUrl, apiKey, model)
  return <CopyBlock text={snippet.code} filename={snippet.filename} lang={snippet.lang} />
}

function CopyBlock({
  text,
  inline,
  filename,
  lang,
}: {
  text: string
  inline?: boolean
  filename?: string
  lang?: string
}) {
  const [copied, setCopied] = useState(false)
  const highlighted = useMemo(() => {
    if (!lang || inline) return null
    try {
      return hljs.highlight(text, { language: lang }).value
    } catch {
      return null
    }
  }, [text, lang, inline])

  const copy = () => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => {},
    )
  }

  if (inline) {
    return (
      <button
        type="button"
        className="group inline-flex items-center gap-2 px-3 py-1.5 rounded bg-surface-3 border border-border font-mono text-sm text-fg cursor-pointer transition-colors hover:bg-surface-4 hover:border-border-strong"
        onClick={copy}
      >
        <code className="[font:inherit]" translate="no">
          {text}
        </code>
        <CopyIcon copied={copied} />
      </button>
    )
  }

  return (
    <div className="relative group rounded border border-border overflow-hidden">
      {filename ? (
        <div className="flex items-center gap-1.5 px-4 py-2 bg-surface-3 border-b border-border">
          <FileCode2 size={13} strokeWidth={2} className="text-fg-dim shrink-0" />
          <span className="font-mono text-xs text-fg-muted">{filename}</span>
          <button
            type="button"
            className="ml-auto p-1 rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity hover:bg-surface-4"
            onClick={copy}
            title="Copy to clipboard"
          >
            <CopyIcon copied={copied} />
          </button>
        </div>
      ) : null}
      <pre className="bg-surface-2 p-4 font-mono text-xs text-fg overflow-x-auto m-0 leading-relaxed">
        {highlighted ? (
          <code
            className={`language-${lang}`}
            translate="no"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: highlight.js output from our own templates
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        ) : (
          <code translate="no">{text}</code>
        )}
      </pre>
      {!filename ? (
        <button
          type="button"
          className="absolute top-2.5 right-2.5 p-1.5 rounded bg-surface-3 border border-border cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity hover:bg-surface-4"
          onClick={copy}
          title="Copy to clipboard"
        >
          <CopyIcon copied={copied} />
        </button>
      ) : null}
    </div>
  )
}

function CopyIcon({ copied }: { copied: boolean }) {
  return copied ? (
    <Check size={13} strokeWidth={2} className="text-ok" />
  ) : (
    <Copy size={13} strokeWidth={2} className="text-fg-muted" />
  )
}
