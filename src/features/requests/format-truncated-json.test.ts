import { expect, it } from 'vitest'
import { formatTruncatedJson } from './format-truncated-json'

it('formats structural punctuation without changing quoted or escaped text', () => {
  const input = '{"nested":{"message":"text, {\\"quoted\\"}: still text","partial":"unfinished'
  const output = formatTruncatedJson(input)
  expect(output).toContain('"nested": {\n')
  expect(output).toContain('"message": "text, {\\"quoted\\"}: still text"')
  expect(output.endsWith('"partial": "unfinished')).toBe(true)
})
