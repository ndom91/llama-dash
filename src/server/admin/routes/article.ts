import { ArticleExtractBodySchema } from '../../../lib/schemas/article.ts'
import { ArticleExtractError, extractArticleFromUrl } from '../../article-extract.ts'
import { error, json, parseBody, type Route } from './types.ts'

export const articleRoutes: Route[] = [
  {
    method: 'POST',
    pattern: /^\/api\/playground\/article-extract$/,
    handler: async (request) => {
      const result = await parseBody(request, ArticleExtractBodySchema, 'Body must have "url" (http or https URL)')
      if (!result.ok) return result.response

      try {
        return json(200, await extractArticleFromUrl(result.value.url))
      } catch (err) {
        if (err instanceof ArticleExtractError) return error(err.status, err.message)
        throw err
      }
    },
  },
]
