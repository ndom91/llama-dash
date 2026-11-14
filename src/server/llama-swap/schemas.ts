import * as v from 'valibot'

export const OpenAiModelSchema = v.object({
  id: v.string(),
  object: v.literal('model'),
  created: v.number(),
  owned_by: v.string(),
  name: v.optional(v.string()),
  description: v.optional(v.string()),
  architecture: v.optional(
    v.object({
      input_modalities: v.optional(v.array(v.string())),
      output_modalities: v.optional(v.array(v.string())),
      modality: v.optional(v.string()),
    }),
  ),
  capabilities: v.optional(v.record(v.string(), v.unknown())),
  supported_parameters: v.optional(v.array(v.string())),
  context_length: v.optional(v.number()),
  contextLength: v.optional(v.number()),
  n_ctx: v.optional(v.number()),
  status: v.optional(
    v.object({
      value: v.string(),
    }),
  ),
  meta: v.optional(
    v.object({
      context_length: v.optional(v.number()),
      contextLength: v.optional(v.number()),
      n_ctx: v.optional(v.number()),
      llamaswap: v.optional(
        v.object({
          type: v.optional(v.string()),
          peerID: v.optional(v.string()),
          strategy: v.optional(v.string()),
          targets: v.optional(v.array(v.string())),
          spillover: v.optional(v.number()),
          context_length: v.optional(v.number()),
          contextLength: v.optional(v.number()),
          n_ctx: v.optional(v.number()),
        }),
      ),
    }),
  ),
})

export type OpenAiModel = v.InferOutput<typeof OpenAiModelSchema>

export const RunningModelSchema = v.object({
  model: v.string(),
  name: v.string(),
  description: v.string(),
  state: v.string(),
  proxy: v.string(),
  ttl: v.number(),
  cmd: v.string(),
})

export type RunningModel = v.InferOutput<typeof RunningModelSchema>

export const ModelsListResponseSchema = v.object({
  data: v.array(OpenAiModelSchema),
  object: v.literal('list'),
})

export const RunningResponseSchema = v.object({
  running: v.array(RunningModelSchema),
})

export const VersionResponseSchema = v.object({
  version: v.string(),
  commit: v.string(),
  build_date: v.string(),
})

export const PerformanceSysStatSchema = v.object({
  timestamp: v.string(),
  cpu_util_per_core: v.array(v.number()),
  mem_total_mb: v.number(),
  mem_used_mb: v.number(),
  mem_free_mb: v.number(),
  swap_total_mb: v.number(),
  swap_used_mb: v.number(),
  load_avg_1: v.number(),
  load_avg_5: v.number(),
  load_avg_15: v.number(),
})

export type PerformanceSysStat = v.InferOutput<typeof PerformanceSysStatSchema>

export const PerformanceResponseSchema = v.object({
  enabled: v.boolean(),
  sys_stats: v.optional(v.nullable(v.array(PerformanceSysStatSchema))),
})

// Subset of llama-server's /props. reasoning_effort_levels arrived in b12017.
/** llama-server's own `/v1/models`. `meta` describes the loaded GGUF; peers and older builds may omit it. */
export const LlamaServerModelsSchema = v.object({
  data: v.array(
    v.object({
      meta: v.optional(
        v.nullable(
          v.object({
            size: v.optional(v.number()),
            n_params: v.optional(v.number()),
            ftype: v.optional(v.string()),
          }),
        ),
      ),
    }),
  ),
})

export const LlamaServerPropsSchema = v.object({
  chat_template_caps: v.optional(
    v.object({
      reasoning_effort_levels: v.optional(v.array(v.string())),
    }),
  ),
})
