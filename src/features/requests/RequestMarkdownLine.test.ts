import { expect, it } from 'vitest'
import { markdownFenceRows } from './RequestMarkdownLine'
import { MAX_TEXT_ROW_CHARS, splitTextRows } from './textRows'

it('marks rows between code fences', () => {
  const text = 'intro\n```bash\npnpm lint\n```\noutro'
  const { rows } = splitTextRows(text)
  expect([...markdownFenceRows(text, rows)]).toEqual([0, 0, 1, 0, 0])
})

it('ignores backticks at the start of a continuation chunk', () => {
  const text = `${'a'.repeat(MAX_TEXT_ROW_CHARS)}\`\`\`not a fence\nafter`
  const { rows } = splitTextRows(text)
  expect([...markdownFenceRows(text, rows)]).toEqual([0, 0, 0])
})
