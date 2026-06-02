import * as v from 'valibot'

export const ArticleExtractBodySchema = v.object({
  url: v.pipe(v.string(), v.trim(), v.nonEmpty(), v.url()),
})

export type ArticleExtractBody = v.InferOutput<typeof ArticleExtractBodySchema>

export const ArticleExtractResponseSchema = v.object({
  url: v.string(),
  finalUrl: v.string(),
  title: v.nullable(v.string()),
  byline: v.nullable(v.string()),
  siteName: v.nullable(v.string()),
  excerpt: v.nullable(v.string()),
  text: v.string(),
  wordCount: v.number(),
  truncated: v.boolean(),
  originalCharCount: v.number(),
})

export type ArticleExtractResponse = v.InferOutput<typeof ArticleExtractResponseSchema>
