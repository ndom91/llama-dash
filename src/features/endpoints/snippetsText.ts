import type { SnippetMap } from './snippets'

export const TEXT_SNIPPETS: SnippetMap = {
  curl: ({ baseUrl, apiKey, model }) => ({
    filename: 'terminal',
    lang: 'bash',
    code: `curl ${baseUrl}/v1/chat/completions \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model}",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`,
  }),
  python: ({ baseUrl, apiKey, model }) => ({
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
  }),
  typescript: ({ baseUrl, apiKey, model }) => ({
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
  }),
  homeassistant: ({ baseUrl, apiKey, model }) => ({
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
  }),
  claudecode: ({ baseUrl, apiKey, model }) => ({
    filename: '~/.claude/settings.json',
    lang: 'json',
    code: `{
  "env": {
    "ANTHROPIC_BASE_URL": "${baseUrl}",
    "ANTHROPIC_AUTH_TOKEN": "${apiKey}",
    "ANTHROPIC_MODEL": "${model}"
  }
}`,
  }),
  opencode: ({ baseUrl, apiKey, model }) => ({
    filename: 'opencode.json',
    lang: 'json',
    code: `{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "llama-dash": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "llama-dash",
      "options": {
        "baseURL": "${baseUrl}/v1",
        "headers": {
          "Authorization": "Bearer ${apiKey}"
        }
      },
      "models": {
        "${model}": {
          "name": "${model}"
        }
      }
    }
  },
  "model": "llama-dash/${model}"
}`,
  }),
}
