// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SessionMobileSheet } from './SessionMobile'

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
})

it('opens and closes with URL state while retaining tab keyboard behavior', () => {
  const showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  })
  const close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: showModal })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: close })
  const onTab = vi.fn()
  const onClose = vi.fn()
  const sheet = (open: boolean) => (
    <SessionMobileSheet open={open} tab="session" onTab={onTab} onClose={onClose} actions={null}>
      Content
    </SessionMobileSheet>
  )
  const view = render(sheet(false))
  expect(showModal).not.toHaveBeenCalled()
  view.rerender(sheet(true))
  expect(showModal).toHaveBeenCalledOnce()
  fireEvent.keyDown(screen.getByRole('tab', { name: 'session' }), { key: 'ArrowRight' })
  expect(onTab).toHaveBeenCalledWith('requests')
  fireEvent(screen.getByRole('dialog', { name: 'Session' }), new Event('cancel', { cancelable: true }))
  expect(onClose).toHaveBeenCalledOnce()
  view.rerender(sheet(false))
  expect(close).toHaveBeenCalledOnce()
})
