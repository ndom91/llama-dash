# Realtime proxy, pause/resume, reasoning effort (llama.cpp b12383, llama-swap v272)

## Why

llama.cpp b12383 added an OpenAI Realtime-style WebSocket at `/v1/realtime`
(voice chat and live transcription, LFM3 audio models). llama-swap v270+
proxies it, and v268 added pause/resume. llama-dash could not carry
WebSockets: its proxy is a fetch handler and strips `upgrade`.

## Realtime WebSocket passthrough

- **Upgrade routing.** srvx (prod) and Vite (dev) only pass fetch requests to
  `src/server.ts`. That entry registers `globalThis.__llamaDashUpgrade`.
  `prod-server.mjs` and the `llama-dash-realtime-upgrade` Vite plugin call it
  from the Node `upgrade` event. Only `/v1/realtime` is claimed, so Vite HMR
  keeps working. In dev, the first upgrade warms the server entry with a
  request to `/api/login-meta` if the hook isn't registered yet.
- **Auth.** Same `enforceAuth` as HTTP. Browsers can't set headers on a
  WebSocket, so keys are also read from the `openai-insecure-api-key.<key>`
  subprotocol (OpenAI SDK convention) and `?api_key=`. Both are stripped
  before forwarding and never logged.
- **Model checks.** Routing rules, the key's model allow-list, and aliases
  run through `applyTransforms({ model })`. With `?model=`, failures are HTTP
  errors before the upgrade. Without it, llama-dash accepts the socket,
  buffers frames until a `session.update` names a model (same lookup order
  as llama-swap), then connects upstream with `model=` added and replays the
  frames. Failures become an OpenAI-style `error` event plus a close frame.
  The buffer is capped at 8 MiB and the wait at 30 s.
- **Gotcha: no upstream subprotocols.** llama-server selects none, and the
  `ws` client rejects a handshake that offered some but got none back.
- **Only llama-swap targets.** Direct targets and credential bindings are
  rejected with 422.
- **Logging.** One `requests` row per session, written on close. Success is
  status 200 (not 101), so the existing ok/error filters work. Tokens are
  summed from `response.done` and transcription `completed` usage. The
  request/response body columns hold per-type event counts, never audio.

## Pause / resume

llama-swap only publishes the pause state on its dashboard SSE stream
(`/api/events`, envelope type `pauseChanged`). `src/server/llama-swap/pause-watcher.ts`
follows it with reconnect backoff and reports `null` while disconnected.
The state lives in `src/server/inference/pause-state.ts`, which has no imports
so the proxy can read it. Proxied 503s while paused are logged with an
`inference_paused` error.

## Reasoning effort levels

llama-server reports `chat_template_caps.reasoning_effort_levels` in `/props`.
llama-swap v272 does not forward them in `/v1/models`, so llama-dash reads
`/upstream/<id>/props`. That path starts a stopped model, so the route only
asks running models and otherwise returns `null`.

## Native speech replaces /v1/audio/llama-tts

llama-server's `/v1/audio/speech` (llama.cpp #31763) runs the same TTS code as
its native `/tts`, so the custom `/v1/audio/llama-tts` → `/upstream/<id>/tts`
route was removed. Verified against `lfm3-audio-2b`: WAV out, `voice` works
(`male`/`female` from `/props`), unknown voices and `mp3` get clear 400s.
Gotchas: only `wav`/`pcm` response formats, and any `speed` other than 1.0 is
rejected. `/v1/audio/voices` 404s for llama.cpp models.

## Not verified live

No LFM3 or llama.cpp-native TTS model was configured on the reference host
at the time, so the Realtime tab and native `/v1/audio/speech` were tested
against fakes only.
