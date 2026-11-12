import { expect, it } from 'vitest'
import { capturedInput } from './sessionMessages'

it('recovers complete messages from a truncated request without inventing partial content', () => {
  const captured =
    '{"instructions":"an escaped \\"input\\": [ decoy","input":[{"role":"user","content":[{"type":"input_text","text":"hello"}]},{"role":"assistant","content":[{"type":"output_text","text":"done"}]},{"role":"user","content":"incomplete'
  expect(capturedInput(`${captured}\n...[truncated 321 bytes]`)).toEqual([
    { role: 'user', content: [{ type: 'input_text', text: 'hello' }] },
    { role: 'assistant', content: [{ type: 'output_text', text: 'done' }] },
  ])
  expect(capturedInput('{"input":[{"role":"user","content":"hello"}]')).toEqual([])
  expect(capturedInput('{"input":[{"role":"user","content":"hello"}\n...[truncated 8 bytes]')).toEqual([
    { role: 'user', content: 'hello' },
  ])
})
