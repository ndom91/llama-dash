import * as v from 'valibot'

export const MessageMetricsSchema = v.object({
  ttftMs: v.optional(v.number()),
  totalMs: v.optional(v.number()),
  tokIn: v.optional(v.number()),
  tokOut: v.optional(v.number()),
  tokPerSec: v.optional(v.number()),
})

export type MessageMetrics = v.InferOutput<typeof MessageMetricsSchema>

export const ChatMessageSchema = v.object({
  id: v.string(),
  role: v.picklist(['system', 'user', 'assistant']),
  content: v.string(),
  reasoningContent: v.optional(v.string()),
  reasoningTimeMs: v.optional(v.number()),
  metrics: v.optional(MessageMetricsSchema),
})

export type ChatMessage = v.InferOutput<typeof ChatMessageSchema>

export const SamplingParamsSchema = v.object({
  temperature: v.number(),
  topP: v.number(),
  topK: v.number(),
  maxTokens: v.number(),
  frequencyPenalty: v.number(),
  presencePenalty: v.number(),
  stopSequences: v.array(v.string()),
  seed: v.nullable(v.number()),
  n: v.number(),
  stream: v.boolean(),
  responseFormat: v.picklist(['text', 'json']),
  logprobs: v.boolean(),
})

export type SamplingParams = v.InferOutput<typeof SamplingParamsSchema>
