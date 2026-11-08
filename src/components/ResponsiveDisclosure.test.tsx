// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'
import { ResponsiveDisclosure, ResponsiveDisclosurePanel, ResponsiveDisclosureTrigger } from './ResponsiveDisclosure'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function Example() {
  return (
    <ResponsiveDisclosure desktopMinWidth={768}>
      <ResponsiveDisclosureTrigger>Details</ResponsiveDisclosureTrigger>
      <ResponsiveDisclosurePanel>
        <a href="/example">Content</a>
      </ResponsiveDisclosurePanel>
    </ResponsiveDisclosure>
  )
}

it('keeps desktop content open and preserves the mobile state across viewport changes', () => {
  let desktop = false
  const listeners = new Set<() => void>()
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return desktop
    },
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }))
  const view = render(createElement(Example))
  const trigger = view.getByRole('button', { name: 'Details' })
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
  expect(view.queryByRole('link', { name: 'Content' })).toBeNull()
  fireEvent.click(trigger)
  expect(trigger.getAttribute('aria-expanded')).toBe('true')
  expect(view.getByRole('link', { name: 'Content' })).toBeTruthy()
  fireEvent.click(trigger)
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
  act(() => {
    desktop = true
    listeners.forEach((listener) => {
      listener()
    })
  })
  expect(trigger.getAttribute('aria-expanded')).toBe('true')
  expect(view.getByRole('link', { name: 'Content' })).toBeTruthy()
  act(() => {
    desktop = false
    listeners.forEach((listener) => {
      listener()
    })
  })
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
})

it('renders the desktop content on the server', () => {
  expect(renderToString(createElement(Example))).toContain('href="/example"')
})
