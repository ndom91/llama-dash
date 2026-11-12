// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { closeTruncatedMarkdown, SessionAssistantMessage } from './SessionAssistantMessage'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('renders markdown structure and switches to the original source', () => {
  const text = 'Intro\n\n1. **First**\n   - Nested\n\n```js\nconst value = 1\n```'
  const view = render(<SessionAssistantMessage text={text} time="2026-01-01T00:00:00Z" truncated={false} />)
  expect(view.container.querySelector('ol li ul li')?.textContent).toBe('Nested')
  expect(screen.getByText('First').tagName).toBe('STRONG')
  expect(screen.getByText('js')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Copy code block' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'raw' }))
  expect(view.container.querySelector('.session-message-source')?.textContent).toBe(text)
  fireEvent.click(screen.getByRole('button', { name: 'markdown' }))
  expect(view.container.querySelector('ol li ul li')).toBeTruthy()
})

it('closes unfinished fences without changing the captured source', () => {
  expect(closeTruncatedMarkdown('```js\nconst x = 1')).toBe('```js\nconst x = 1\n```')
  expect(closeTruncatedMarkdown('~~~\ncode\n~~~')).toBe('~~~\ncode\n~~~')
  render(<SessionAssistantMessage text={'```js\nconst x = 1'} time="2026-01-01T00:00:00Z" truncated />)
  expect(screen.getByText('Response truncated')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'raw' }))
  expect(document.querySelector('.session-message-source')?.textContent).toBe('```js\nconst x = 1')
})

it('allows a long message to be expanded and collapsed', () => {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1000)
  const view = render(<SessionAssistantMessage text="Long message" time="2026-01-01T00:00:00Z" truncated={false} />)
  const button = screen.getByRole('button', { name: /show full message/ })
  expect(view.container.querySelector('.is-clamped')).toBeTruthy()
  fireEvent.click(button)
  expect(view.container.querySelector('.is-clamped')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'show less' }))
  expect(view.container.querySelector('.is-clamped')).toBeTruthy()
})
