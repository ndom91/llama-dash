import * as v from 'valibot'

const NullableString = v.nullable(v.string())

export const InferenceHardwareAcceleratorSchema = v.object({
  index: v.number(),
  kind: v.picklist(['gpu', 'npu', 'other']),
  raw_kind: v.optional(NullableString),
  vendor: NullableString,
  model: NullableString,
  architecture: NullableString,
  memory: v.object({
    kind: v.picklist(['dedicated', 'unified', 'shared_system', 'unknown']),
    capacity_bytes: v.nullable(v.number()),
  }),
  driver: v.nullable(
    v.object({
      name: NullableString,
      version: NullableString,
    }),
  ),
  power_limit_watts: v.nullable(v.number()),
})

export const InferenceHardwareSchema = v.object({
  schema_version: v.number(),
  captured_at: v.string(),
  capture: v.object({
    scope: v.string(),
    method: v.string(),
    detector: v.nullable(
      v.object({
        name: v.string(),
        version: v.string(),
      }),
    ),
  }),
  architecture: v.object({
    name: v.string(),
    raw_name: NullableString,
  }),
  operating_system: v.object({
    family: v.string(),
    name: NullableString,
    version: NullableString,
    kernel: NullableString,
    raw_family: v.optional(NullableString),
  }),
  environment: v.object({
    kind: v.string(),
    name: NullableString,
    version: NullableString,
    raw_kind: v.optional(NullableString),
  }),
  cpu: v.object({
    vendor: NullableString,
    model: NullableString,
    socket_count: v.nullable(v.number()),
    physical_core_count: v.nullable(v.number()),
    logical_thread_count: v.nullable(v.number()),
  }),
  memory: v.object({
    capacity_bytes: v.number(),
  }),
  accelerators: v.array(InferenceHardwareAcceleratorSchema),
})

export type InferenceHardware = v.InferOutput<typeof InferenceHardwareSchema>
