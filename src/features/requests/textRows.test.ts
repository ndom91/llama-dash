import { expect, it } from 'vitest'
import { MAX_TEXT_ROW_CHARS, splitTextRows } from './textRows'

it('keeps short and empty logical lines intact, including trailing newlines', () => {
  const text = '{\r\n  "value": 1,\n\n  "empty": ""\n}\n'
  const { rows, hasChunks } = splitTextRows(text)
  expect(hasChunks).toBe(false)
  expect(rows.map((row) => text.slice(row.start, row.end))).toEqual(text.split('\n'))
  expect(splitTextRows('').rows).toEqual([{ start: 0, end: 0, chunked: false }])
})

it('bounds rows even when a multi-megabyte JSON value occupies one logical line', () => {
  const text = JSON.stringify({ response: 'x'.repeat(2_800_000) }, null, 2)
  const { rows, hasChunks } = splitTextRows(text)
  expect(hasChunks).toBe(true)
  expect(rows.length).toBeGreaterThan(2000)
  let end = 0
  let reconstructed = ''
  for (const row of rows) {
    expect(row.end - row.start).toBeLessThanOrEqual(MAX_TEXT_ROW_CHARS)
    const gap = text.slice(end, row.start)
    expect(gap === '' || gap === '\n').toBe(true)
    reconstructed += gap + text.slice(row.start, row.end)
    end = row.end
  }
  expect(reconstructed).toBe(text)
  expect(end).toBe(text.length)
})

it('does not split Unicode surrogate pairs at chunk boundaries', () => {
  const text = `${'a'.repeat(MAX_TEXT_ROW_CHARS - 1)}🦙${'z'.repeat(MAX_TEXT_ROW_CHARS)}`
  const { rows } = splitTextRows(text)
  expect(rows[0].end).toBe(MAX_TEXT_ROW_CHARS - 1)
  expect(rows.map((row) => text.slice(row.start, row.end)).join('')).toBe(text)
  expect(text.slice(rows[1].start, rows[1].end).startsWith('🦙')).toBe(true)
})

it('treats an exact-size line as a normal highlighted row', () => {
  const { rows, hasChunks } = splitTextRows('x'.repeat(MAX_TEXT_ROW_CHARS))
  expect(hasChunks).toBe(false)
  expect(rows).toHaveLength(1)
  expect(rows[0].chunked).toBe(false)
})
