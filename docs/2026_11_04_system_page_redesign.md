# System page redesign

The System page (`/system`) was rebuilt from a designer mock-up. Status cards became resource tiles. The page also gained time-series charts, a unified-memory breakdown, an events feed, a CPU-cores block, and editable thresholds.

## Data sources

| Data | Source | Notes |
| --- | --- | --- |
| GPU util, temp, power, GTT/VRAM | local `gpu-poller.ts` | Correct only when llama-dash runs on the inference host (bundled compose). In a remote dev setup it reads the dev machine. |
| CPU per core, RAM, swap, load avg | llama-swap `GET /api/performance` via `inferenceBackend.hostPerformance()` | llama-swap keeps 1 h of 5 s samples. llama-dash backfills from it at startup. Local `/proc/stat` and `os.freemem()` are the fallback. |
| Page cache | local `/proc/meminfo` | Linux only. Shown only when available. |
| Model-load bands, model events | `model_events` table | A band covers the 15 s watcher window before a load was seen. The exact load time is unknown. |
| Per-model memory | `model_footprints` table | GPU memory growth around a load, written only when that load was the only model event in the window. Not split into weights vs KV. |
| Threshold / queue / startup events | in-memory `system-events.ts` | Last 200 events. Lost on restart. |

llama-swap's `gpu_stats` is `null` on AMD hosts, so GPU data stays on the local poller.

## History

`system-telemetry.ts` ticks every 10 s. It writes one slot into a 24 h columnar ring (`telemetry-ring.ts`, `Float32Array` per field, 8,640 slots, about 0.5 MB). Reads above 360 points are bucketed: the max for temperature and power, the mean for everything else. History resets on restart. The ring was kept in memory on purpose because deep history is not critical.

The live cadence stays at 10 s on purpose. The mock-up showed 2 s, but faster `amdgpu_top` polling was not worth the load.

## Live updates

Each tick publishes `system.telemetry` on `/api/events`. For ranges up to 1 h, the client appends the point to the cached series (`src/lib/system-telemetry-cache.ts`). The 6 h and 24 h ranges are downsampled, so they refetch every 60 s instead.

## Thresholds

The thresholds are stored as one JSON setting, `system_thresholds`. Defaults: GPU temp 90 °C, GPU memory 90 %, RAM 85 %, CPU 5 m mean 80 %, and dropped log rows > 0. `breachedThresholds()` in `src/lib/schemas/system-thresholds.ts` is shared by the tiles, the components rail, and the server-side event log. The GPU tile tone follows temperature, not utilization.

## Not implemented

- The llama-swap child-process CPU/RSS line. llama-swap runs in a separate container and has no API for it.
- Peer health events.
- The weights vs KV split per model.
