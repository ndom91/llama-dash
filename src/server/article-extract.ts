import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import { Agent, fetch, type Response } from 'undici'
import type { ArticleExtractResponse } from '../lib/schemas/article.ts'

const MAX_HTML_BYTES = 2 * 1024 * 1024
const MAX_ARTICLE_CHARS = 12_000
const MIN_ARTICLE_CHARS = 80
const FETCH_TIMEOUT_MS = 8_000
const MAX_REDIRECTS = 5

export class ArticleExtractError extends Error {
  constructor(
    message: string,
    public readonly status = 502,
  ) {
    super(message)
  }
}

export async function extractArticleFromUrl(url: string): Promise<ArticleExtractResponse> {
  const startUrl = await assertSafeArticleUrl(url)
  const { html, finalUrl } = await fetchArticleHtml(startUrl)
  return extractArticleFromHtml(html, startUrl.url.href, finalUrl.url.href)
}

export function extractArticleFromHtml(html: string, url: string, finalUrl = url): ArticleExtractResponse {
  const dom = new JSDOM(html, { url: finalUrl })
  const reader = new Readability(dom.window.document)
  const article = reader.parse()
  const text = normalizeArticleText(article?.textContent ?? '')

  if (!article || text.length < MIN_ARTICLE_CHARS) {
    throw new ArticleExtractError('Could not find a readable article in that page', 422)
  }

  const truncated = text.length > MAX_ARTICLE_CHARS
  const outputText = truncated ? text.slice(0, MAX_ARTICLE_CHARS).trimEnd() : text

  return {
    url,
    finalUrl,
    title: normalizeOptionalText(article.title),
    byline: normalizeOptionalText(article.byline),
    siteName: normalizeOptionalText(article.siteName),
    excerpt: normalizeOptionalText(article.excerpt),
    text: outputText,
    wordCount: countWords(outputText),
    truncated,
    originalCharCount: text.length,
  }
}

export async function assertSafeArticleUrl(value: string): Promise<SafeArticleUrl> {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new ArticleExtractError('Invalid article URL', 400)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ArticleExtractError('Article URL must use http or https', 400)
  }

  const host = url.hostname.toLowerCase().replace(/^\[(.*)]$/, '$1')
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw new ArticleExtractError('Article URL host is not allowed', 400)
  }

  const directIp = isIP(host)
  if (directIp) {
    if (isPrivateIp(host)) throw new ArticleExtractError('Article URL host is not allowed', 400)
    return { url, addresses: [{ address: host, family: directIp === 4 ? 4 : 6 }] }
  }

  let resolved: Array<{ address: string; family: number }>
  try {
    resolved = await lookup(host, { all: true, verbatim: true })
  } catch {
    throw new ArticleExtractError('Could not resolve article URL host', 400)
  }

  const addresses: SafeArticleUrl['addresses'] = []
  for (const entry of resolved) {
    if (entry.family !== 4 && entry.family !== 6) continue
    addresses.push({ address: entry.address, family: entry.family })
  }

  if (addresses.length === 0 || addresses.some((entry) => isPrivateIp(entry.address))) {
    throw new ArticleExtractError('Article URL host is not allowed', 400)
  }

  return { url, addresses }
}

async function fetchArticleHtml(startUrl: SafeArticleUrl) {
  let currentUrl = startUrl

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const dispatcher = createPinnedDispatcher(currentUrl)
    const res = await fetch(currentUrl.url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      dispatcher,
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'llama-dash article extractor',
      },
    }).catch(async (err) => {
      await dispatcher.close()
      throw new ArticleExtractError(err instanceof Error ? err.message : 'Could not fetch article URL')
    })

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      await res.body?.cancel()
      await dispatcher.close()
      if (!location) throw new ArticleExtractError('Article URL redirected without a location header')
      currentUrl = await assertSafeArticleUrl(new URL(location, currentUrl.url).href)
      continue
    }

    if (!res.ok) {
      await res.body?.cancel()
      await dispatcher.close()
      throw new ArticleExtractError(`Article URL returned HTTP ${res.status}`)
    }

    const contentType = res.headers.get('content-type') ?? ''
    if (!isHtmlContentType(contentType)) {
      await res.body?.cancel()
      await dispatcher.close()
      throw new ArticleExtractError('Article URL did not return HTML', 422)
    }

    const html = await readLimitedText(res, MAX_HTML_BYTES).finally(() => dispatcher.close())
    return { html, finalUrl: currentUrl }
  }

  throw new ArticleExtractError('Article URL redirected too many times')
}

function createPinnedDispatcher(safeUrl: SafeArticleUrl) {
  const addresses = safeUrl.addresses
  return new Agent({
    connect: {
      lookup: (_hostname, options, callback) => {
        const first = addresses[0]
        if (options.all) callback(null, addresses)
        else callback(null, first.address, first.family)
      },
    },
  })
}

async function readLimitedText(res: Response, maxBytes: number) {
  if (!res.body) return await res.text()

  const reader = res.body.getReader()
  const chunks: Array<Uint8Array> = []
  let bytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    bytes += value.byteLength
    if (bytes > maxBytes) {
      await reader.cancel()
      throw new ArticleExtractError('Article HTML is too large', 413)
    }
    chunks.push(value)
  }

  const merged = new Uint8Array(bytes)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }

  return new TextDecoder().decode(merged)
}

export function isHtmlContentType(contentType: string) {
  const type = contentType.toLowerCase().split(';', 1)[0]?.trim()
  return type === 'text/html' || type === 'application/xhtml+xml'
}

function normalizeArticleText(value: string) {
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.replace(/\s+/g, ' ').trim()
  return normalized ? normalized : null
}

function countWords(value: string) {
  const matches = value.trim().match(/\S+/g)
  return matches?.length ?? 0
}

function isPrivateIp(value: string) {
  const ipType = isIP(value)
  if (ipType === 4) return isPrivateIpv4(value)
  if (ipType === 6) return isPrivateIpv6(value)
  return true
}

function isPrivateIpv4(value: string) {
  const parts = value.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true
  const [a, b, c] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  )
}

function isPrivateIpv6(value: string) {
  const normalized = value.toLowerCase()
  if (normalized === '::1' || normalized === '::') return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd') || isIpv6LinkLocal(normalized)) return true
  if (normalized.startsWith('ff')) return true
  if (normalized.startsWith('::ffff:')) return true
  if (normalized.startsWith('64:ff9b:')) return true
  if (normalized.startsWith('2002:') || normalized === '2002::') return true
  if (normalized.startsWith('2001:db8:') || normalized === '2001:db8::') return true
  if (normalized.startsWith('2001:2:') || normalized === '2001:2::') return true
  if (normalized.startsWith('2001:0:') || normalized.startsWith('2001:0000:') || normalized === '2001::') {
    return true
  }
  return false
}

function isIpv6LinkLocal(value: string) {
  const firstHextet = Number.parseInt(value.split(':', 1)[0] ?? '', 16)
  return Number.isFinite(firstHextet) && (firstHextet & 0xffc0) === 0xfe80
}

type SafeArticleUrl = {
  url: URL
  addresses: Array<{ address: string; family: 4 | 6 }>
}
