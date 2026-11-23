import type { SnippetMap } from './snippets'

export const TRANSCRIBE_SNIPPETS: SnippetMap = {
  curl: ({ baseUrl, apiKey, model }) => ({
    filename: 'terminal',
    lang: 'bash',
    code: `curl ${baseUrl}/v1/audio/transcriptions \\
  -H "Authorization: Bearer ${apiKey}" \\
  -F model="${model}" \\
  -F file=@recording.wav`,
  }),
  python: ({ baseUrl, apiKey, model }) => ({
    filename: 'transcribe.py',
    lang: 'python',
    code: `from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}/v1",
    api_key="${apiKey}",
)

with open("recording.wav", "rb") as audio:
    transcript = client.audio.transcriptions.create(
        model="${model}",
        file=audio,
    )
print(transcript.text)`,
  }),
  typescript: ({ baseUrl, apiKey, model }) => ({
    filename: 'transcribe.ts',
    lang: 'typescript',
    code: `import { createReadStream } from "node:fs";
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${baseUrl}/v1",
  apiKey: "${apiKey}",
});

const transcript = await client.audio.transcriptions.create({
  model: "${model}",
  file: createReadStream("recording.wav"),
});
console.log(transcript.text);`,
  }),
  homeassistant: ({ baseUrl, apiKey, model }) => ({
    filename: 'Home Assistant',
    lang: 'yaml',
    code: `# Speech-to-text through an OpenAI-compatible STT integration,
# for example "OpenAI Whisper API" from HACS:
#
# Settings → Devices & services → Add integration → OpenAI Whisper API
#   API URL:  ${baseUrl}/v1
#   API key:  ${apiKey}
#   Model:    ${model}
#
# Then choose it as the speech-to-text engine under
# Settings → Voice assistants → <your assistant>.`,
  }),
}
