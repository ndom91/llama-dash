import { useMemo } from 'react'

export type EndpointTab =
  | 'curl'
  | 'python'
  | 'typescript'
  | 'homeassistant'
  | 'claudecode'
  | 'opencode'
  | 'continue'
  | 'openwebui'

export const ENDPOINT_TABS: Array<{ id: EndpointTab; label: string }> = [
  { id: 'curl', label: 'curl' },
  { id: 'python', label: 'Python' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'homeassistant', label: 'Home Assistant' },
  { id: 'claudecode', label: 'Claude Code' },
  { id: 'opencode', label: 'opencode' },
  { id: 'continue', label: 'Continue' },
  { id: 'openwebui', label: 'Open WebUI' },
]

export type EndpointSnippet = { code: string; filename: string; lang: string }

export function useEndpointSnippet(tab: EndpointTab, baseUrl: string, apiKey: string, model: string): EndpointSnippet {
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
  "env": {
    "ANTHROPIC_BASE_URL": "${baseUrl}",
    "ANTHROPIC_AUTH_TOKEN": "${apiKey}",
    "ANTHROPIC_MODEL": "${model}"
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
