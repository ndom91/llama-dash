import type { SnippetMap } from './snippets'

// llama.cpp TTS returns wav or pcm only and ignores `speed`. Voice ids differ
// per model, so every example points at where to list them.
export const SPEECH_SNIPPETS: SnippetMap = {
  curl: ({ baseUrl, apiKey, model }) => ({
    filename: 'terminal',
    lang: 'bash',
    code: `# List voices: llama.cpp models report them in /props?model=…,
# other backends in /v1/audio/voices?model=…
curl ${baseUrl}/v1/audio/speech \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model}",
    "input": "Hello from llama-dash!",
    "voice": "your-voice",
    "response_format": "wav"
  }' \\
  --output speech.wav`,
  }),
  python: ({ baseUrl, apiKey, model }) => ({
    filename: 'speech.py',
    lang: 'python',
    code: `from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}/v1",
    api_key="${apiKey}",
)

# Voice ids depend on the model: see /props?model=… or /v1/audio/voices?model=…
with client.audio.speech.with_streaming_response.create(
    model="${model}",
    input="Hello from llama-dash!",
    voice="your-voice",
    response_format="wav",
) as response:
    response.stream_to_file("speech.wav")`,
  }),
  typescript: ({ baseUrl, apiKey, model }) => ({
    filename: 'speech.ts',
    lang: 'typescript',
    code: `import { writeFile } from "node:fs/promises";
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${baseUrl}/v1",
  apiKey: "${apiKey}",
});

// Voice ids depend on the model: see /props?model=… or /v1/audio/voices?model=…
const response = await client.audio.speech.create({
  model: "${model}",
  input: "Hello from llama-dash!",
  voice: "your-voice",
  response_format: "wav",
});
await writeFile("speech.wav", Buffer.from(await response.arrayBuffer()));`,
  }),
  homeassistant: ({ baseUrl, apiKey, model }) => ({
    filename: 'Home Assistant',
    lang: 'yaml',
    code: `# Text-to-speech through an OpenAI-compatible TTS integration,
# for example "OpenAI TTS" from HACS:
#
# Settings → Devices & services → Add integration → OpenAI TTS
#   API endpoint: ${baseUrl}/v1/audio/speech
#   API key:      ${apiKey}
#   Model:        ${model}
#   Voice:        a voice your model lists
#
# Then choose it as the text-to-speech engine under
# Settings → Voice assistants → <your assistant>.`,
  }),
}
