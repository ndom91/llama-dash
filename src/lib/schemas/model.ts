import * as v from 'valibot'

export const ApiModelSchema = v.object({
  id: v.string(),
  name: v.string(),
  kind: v.union([v.literal('local'), v.literal('peer')]),
  peerId: v.nullable(v.string()),
  state: v.string(),
  running: v.boolean(),
  ttl: v.nullable(v.number()),
})

export type ApiModel = v.InferOutput<typeof ApiModelSchema>

export const ApiModelEventSchema = v.object({
  id: v.string(),
  modelId: v.string(),
  event: v.union([v.literal('load'), v.literal('unload')]),
  timestamp: v.string(),
})

export type ApiModelEvent = v.InferOutput<typeof ApiModelEventSchema>

export const ModelsResponseSchema = v.object({
  models: v.array(ApiModelSchema),
})

export const ModelTimelineResponseSchema = v.object({
  events: v.array(ApiModelEventSchema),
})
