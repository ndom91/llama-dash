import type { SnippetMap } from './snippets'

export const EMBEDDINGS_SNIPPETS: SnippetMap = {
  curl: ({ baseUrl, apiKey, model }) => ({
    filename: 'embeddings.sh',
    lang: 'bash',
    code: `curl ${baseUrl}/v1/embeddings \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model}",
    "input": "The quick brown fox"
  }'`,
  }),
  python: ({ baseUrl, apiKey, model }) => ({
    filename: 'embeddings.py',
    lang: 'python',
    code: `from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}/v1",
    api_key="${apiKey}",
)

response = client.embeddings.create(
    model="${model}",
    input="The quick brown fox",
)
print(len(response.data[0].embedding))`,
  }),
  typescript: ({ baseUrl, apiKey, model }) => ({
    filename: 'embeddings.ts',
    lang: 'typescript',
    code: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${baseUrl}/v1",
  apiKey: "${apiKey}",
});

const response = await client.embeddings.create({
  model: "${model}",
  input: "The quick brown fox",
});
console.log(response.data[0].embedding.length);`,
  }),
}
