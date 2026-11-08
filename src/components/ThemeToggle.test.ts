// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { ThemeToggle } from './ThemeToggle'

afterEach(() => {
  cleanup()
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.classList.remove('light', 'dark')
  vi.unstubAllGlobals()
})

it('restores the saved mode and persists a new selection', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
  localStorage.setItem('theme', 'dark')
  const view = render(createElement(ThemeToggle))
  expect(view.getByRole('button', { name: 'Dark' }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(view.getByRole('button', { name: 'Light' }))
  expect(localStorage.getItem('theme')).toBe('light')
  expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  expect(view.getByRole('button', { name: 'Light' }).getAttribute('aria-pressed')).toBe('true')
})
