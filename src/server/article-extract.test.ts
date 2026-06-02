import { describe, expect, it } from 'vitest'
import { ArticleExtractError, assertSafeArticleUrl, extractArticleFromHtml, isHtmlContentType } from './article-extract'

describe('assertSafeArticleUrl', () => {
  it('rejects non-http URLs', async () => {
    await expect(assertSafeArticleUrl('file:///etc/passwd')).rejects.toMatchObject({
      message: 'Article URL must use http or https',
      status: 400,
    })
  })

  it('rejects localhost and private IP hosts', async () => {
    await expect(assertSafeArticleUrl('http://localhost/post')).rejects.toBeInstanceOf(ArticleExtractError)
    await expect(assertSafeArticleUrl('http://127.0.0.1/post')).rejects.toBeInstanceOf(ArticleExtractError)
    await expect(assertSafeArticleUrl('http://192.168.1.2/post')).rejects.toBeInstanceOf(ArticleExtractError)
    await expect(assertSafeArticleUrl('http://[::1]/post')).rejects.toBeInstanceOf(ArticleExtractError)
  })

  it('rejects special-use IPv4 ranges that are not publicly routable', async () => {
    await expect(assertSafeArticleUrl('http://100.64.0.1/post')).rejects.toBeInstanceOf(ArticleExtractError)
    await expect(assertSafeArticleUrl('http://198.18.0.1/post')).rejects.toBeInstanceOf(ArticleExtractError)
    await expect(assertSafeArticleUrl('http://192.0.0.1/post')).rejects.toBeInstanceOf(ArticleExtractError)
    await expect(assertSafeArticleUrl('http://198.51.100.1/post')).rejects.toBeInstanceOf(ArticleExtractError)
    await expect(assertSafeArticleUrl('http://203.0.113.1/post')).rejects.toBeInstanceOf(ArticleExtractError)
  })

  it('rejects special-use IPv6 ranges that are not publicly routable', async () => {
    await expect(assertSafeArticleUrl('http://[fc00::1]/post')).rejects.toBeInstanceOf(ArticleExtractError)
    await expect(assertSafeArticleUrl('http://[fe80::1]/post')).rejects.toBeInstanceOf(ArticleExtractError)
    await expect(assertSafeArticleUrl('http://[fe90::1]/post')).rejects.toBeInstanceOf(ArticleExtractError)
    await expect(assertSafeArticleUrl('http://[febf::1]/post')).rejects.toBeInstanceOf(ArticleExtractError)
    await expect(assertSafeArticleUrl('http://[ff02::1]/post')).rejects.toBeInstanceOf(ArticleExtractError)
    await expect(assertSafeArticleUrl('http://[2001:db8::1]/post')).rejects.toBeInstanceOf(ArticleExtractError)
  })
})

describe('isHtmlContentType', () => {
  it('accepts explicit HTML content types only', () => {
    expect(isHtmlContentType('text/html; charset=utf-8')).toBe(true)
    expect(isHtmlContentType('application/xhtml+xml')).toBe(true)
    expect(isHtmlContentType('')).toBe(false)
    expect(isHtmlContentType('text/plain')).toBe(false)
    expect(isHtmlContentType('application/json')).toBe(false)
  })
})

describe('extractArticleFromHtml', () => {
  it('extracts readable article text and metadata', () => {
    const result = extractArticleFromHtml(
      `<!doctype html>
      <html>
        <head><title>Ignored browser title</title></head>
        <body>
          <nav>Home Pricing Sign in</nav>
          <article>
            <h1>The local model stack</h1>
            <p class="byline">By Ada</p>
            <p>Local inference dashboards need clear request logs, model state, and simple controls.</p>
            <p>Those article paragraphs should survive extraction while menus and navigation chrome are ignored.</p>
          </article>
          <footer>Subscribe now</footer>
        </body>
      </html>`,
      'https://example.com/posts/local-model-stack',
    )

    expect(result.title).toBe('Ignored browser title')
    expect(result.text).toContain('Local inference dashboards need clear request logs')
    expect(result.text).toContain('Those article paragraphs should survive extraction')
    expect(result.text).not.toContain('Home Pricing')
    expect(result.wordCount).toBeGreaterThan(10)
    expect(result.truncated).toBe(false)
  })

  it('rejects pages without enough readable article content', () => {
    expect(() =>
      extractArticleFromHtml(
        `<!doctype html><html><body><nav>Home Pricing Docs</nav><main><button>Sign in</button></main></body></html>`,
        'https://example.com',
      ),
    ).toThrow('Could not find a readable article')
  })

  it('truncates long articles before returning text', () => {
    const paragraph = 'This is a long paragraph about local speech synthesis and article extraction. '.repeat(40)
    const html = `<!doctype html><html><body><article><h1>Long read</h1>${Array.from({ length: 20 }, () => `<p>${paragraph}</p>`).join('')}</article></body></html>`

    const result = extractArticleFromHtml(html, 'https://example.com/long-read')

    expect(result.truncated).toBe(true)
    expect(result.originalCharCount).toBeGreaterThan(result.text.length)
    expect(result.text.length).toBeLessThanOrEqual(12_000)
  })
})
