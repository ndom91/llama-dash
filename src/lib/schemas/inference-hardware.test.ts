import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { InferenceHardwareSchema } from './inference-hardware.ts'

describe('InferenceHardwareSchema', () => {
  it('accepts llama-swap startup hardware snapshots', () => {
    const result = v.parse(InferenceHardwareSchema, {
      schema_version: 1,
      captured_at: '2026-08-14T18:24:00Z',
      capture: {
        scope: 'inference_host',
        method: 'detected',
        detector: { name: 'llama-swap', version: '250' },
      },
      architecture: { name: 'x86_64', raw_name: 'amd64' },
      operating_system: {
        family: 'linux',
        name: 'Ubuntu',
        version: '24.04',
        kernel: '6.8.0',
      },
      environment: { kind: 'container', name: 'docker', version: null },
      cpu: {
        vendor: 'GenuineIntel',
        model: 'Intel Xeon',
        socket_count: 1,
        physical_core_count: 8,
        logical_thread_count: 16,
      },
      memory: { capacity_bytes: 34_359_738_368 },
      accelerators: [
        {
          index: 0,
          kind: 'gpu',
          vendor: 'NVIDIA',
          model: 'RTX 4090',
          architecture: 'Ada',
          memory: { kind: 'dedicated', capacity_bytes: 25_769_803_776 },
          driver: { name: 'nvidia', version: '570.0' },
          power_limit_watts: 450,
        },
      ],
    })

    expect(result.accelerators[0]).toMatchObject({
      model: 'RTX 4090',
      memory: { kind: 'dedicated', capacity_bytes: 25_769_803_776 },
    })
  })
})
