import type { SnippetContext, SnippetMap } from './snippets'

// Text in, text out keeps the examples short. Audio uses the same socket with
// input_audio_buffer.append (base64 PCM16) and response.output_audio.delta.
const realtimeUrl = ({ baseUrl, model }: SnippetContext) =>
  `${baseUrl.replace(/^http/, 'ws')}/v1/realtime?model=${encodeURIComponent(model)}`

export const REALTIME_SNIPPETS: SnippetMap = {
  python: (ctx) => ({
    filename: 'realtime.py',
    lang: 'python',
    code: `import asyncio
import json

import websockets  # pip install websockets

URL = "${realtimeUrl(ctx)}"


async def main():
    headers = {"Authorization": "Bearer ${ctx.apiKey}"}
    async with websockets.connect(URL, additional_headers=headers) as ws:
        for event in (
            {"type": "session.update", "session": {"type": "realtime", "output_modalities": ["text"]}},
            {"type": "conversation.item.create", "item": {
                "type": "message", "role": "user",
                "content": [{"type": "input_text", "text": "Hello!"}],
            }},
            {"type": "response.create"},
        ):
            await ws.send(json.dumps(event))

        async for message in ws:
            event = json.loads(message)
            if event["type"] == "response.output_text.delta":
                print(event["delta"], end="", flush=True)
            elif event["type"] in ("response.done", "error"):
                print()
                break


asyncio.run(main())`,
  }),
  typescript: (ctx) => ({
    filename: 'realtime.ts',
    lang: 'typescript',
    code: `// Node 22+ (like browsers) has a global WebSocket. It can't set headers,
// so the key travels in a subprotocol instead.
const ws = new WebSocket("${realtimeUrl(ctx)}", [
  "realtime",
  "openai-insecure-api-key.${ctx.apiKey}",
]);

ws.addEventListener("open", () => {
  ws.send(JSON.stringify({
    type: "session.update",
    session: { type: "realtime", output_modalities: ["text"] },
  }));
  ws.send(JSON.stringify({
    type: "conversation.item.create",
    item: { type: "message", role: "user", content: [{ type: "input_text", text: "Hello!" }] },
  }));
  ws.send(JSON.stringify({ type: "response.create" }));
});

ws.addEventListener("message", (message) => {
  const event = JSON.parse(message.data);
  if (event.type === "response.output_text.delta") process.stdout.write(event.delta);
  if (event.type === "response.done" || event.type === "error") ws.close();
});`,
  }),
}
