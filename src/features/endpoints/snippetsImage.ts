import type { SnippetMap } from './snippets'

export const IMAGE_SNIPPETS: SnippetMap = {
  curl: ({ baseUrl, apiKey, model }) => ({
    filename: 'image.sh',
    lang: 'bash',
    code: `curl ${baseUrl}/v1/images/generations \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model}",
    "prompt": "A lighthouse at dusk, oil painting",
    "size": "512x512",
    "response_format": "b64_json"
  }' | jq -r '.data[0].b64_json' | base64 --decode > image.png`,
  }),
  python: ({ baseUrl, apiKey, model }) => ({
    filename: 'image.py',
    lang: 'python',
    code: `import base64
from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}/v1",
    api_key="${apiKey}",
)

response = client.images.generate(
    model="${model}",
    prompt="A lighthouse at dusk, oil painting",
    size="512x512",
    response_format="b64_json",
)
with open("image.png", "wb") as f:
    f.write(base64.b64decode(response.data[0].b64_json))`,
  }),
  typescript: ({ baseUrl, apiKey, model }) => ({
    filename: 'image.ts',
    lang: 'typescript',
    code: `import { writeFile } from "node:fs/promises";
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${baseUrl}/v1",
  apiKey: "${apiKey}",
});

const response = await client.images.generate({
  model: "${model}",
  prompt: "A lighthouse at dusk, oil painting",
  size: "512x512",
  response_format: "b64_json",
});
await writeFile("image.png", Buffer.from(response.data![0].b64_json!, "base64"));`,
  }),
}
