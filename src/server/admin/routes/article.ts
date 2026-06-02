import * as v from 'valibot'
import { ArticleExtractBodySchema } from '../../../lib/schemas/article.ts'
import { ArticleExtractError, extractArticleFromUrl } from '../../article-extract.ts'
import { error, json, readJsonBody, type Route } from './types.ts'

export const articleRoutes: Route[] = [
  {
    method: 'POST',
    pattern: /^\/api\/playground\/article-extract$/,
    handler: async (request) => {
      const parsed = await readJsonBody(request)
      if (!parsed.ok) return error(400, 'Invalid JSON body')
      const result = v.safeParse(ArticleExtractBodySchema, parsed.value)
      if (!result.success) return error(400, 'Body must have "url" (http or https URL)')

      try {
        return json(200, await extractArticleFromUrl(result.output.url))
      } catch (err) {
        if (err instanceof ArticleExtractError) return error(err.status, err.message)
        throw err
      }
    },
  },
]
