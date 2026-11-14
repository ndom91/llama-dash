import * as v from 'valibot'

// Server events from llama-server's OpenAI-style /v1/realtime socket. Only the
// fields the playground reads are described; unknown fields pass through.

const AudioFormatSchema = v.looseObject({
  rate: v.optional(v.number()),
})

export const RealtimeSessionSchema = v.looseObject({
  id: v.optional(v.string()),
  model: v.optional(v.string()),
  instructions: v.optional(v.string()),
  output_modalities: v.optional(v.nullable(v.array(v.string()))),
  audio: v.optional(
    v.looseObject({
      input: v.optional(v.looseObject({ format: v.optional(AudioFormatSchema) })),
      output: v.optional(v.looseObject({ format: v.optional(AudioFormatSchema) })),
    }),
  ),
})

export type RealtimeSession = v.InferOutput<typeof RealtimeSessionSchema>

const RealtimeUsageSchema = v.looseObject({
  input_tokens: v.optional(v.number()),
  output_tokens: v.optional(v.number()),
  total_tokens: v.optional(v.number()),
})

export const RealtimeServerEventSchema = v.looseObject({
  type: v.string(),
  response_id: v.optional(v.string()),
  item_id: v.optional(v.string()),
  delta: v.optional(v.string()),
  transcript: v.optional(v.string()),
  session: v.optional(RealtimeSessionSchema),
  response: v.optional(
    v.looseObject({
      id: v.optional(v.string()),
      status: v.optional(v.string()),
      usage: v.optional(v.nullable(RealtimeUsageSchema)),
    }),
  ),
  error: v.optional(
    v.looseObject({
      message: v.optional(v.string()),
      type: v.optional(v.nullable(v.string())),
      code: v.optional(v.nullable(v.string())),
    }),
  ),
})

export type RealtimeServerEvent = v.InferOutput<typeof RealtimeServerEventSchema>
