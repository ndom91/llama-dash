// @vitest-environment jsdom
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { NavigationOutlet } from './NavigationOutlet'
import { RequestDetailPending } from '../features/requests/RequestDetailPending'
import { NavigationPending } from './NavigationPending'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('uses a full-page skeleton when a destination has no custom pending component', () => {
  const view = render(createElement(NavigationPending))
  expect(view.getByRole('status', { name: 'Loading page' })).toBeDefined()
  expect(view.container.querySelector('.page-header')).not.toBeNull()
  expect(view.container.querySelectorAll('.skel-block')).toHaveLength(4)
  expect(view.queryByText('Opening page…')).toBeNull()
})

it('leaves the list while root beforeLoad is still waiting for the session', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  let hold = false
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const root = createRootRoute({
    component: NavigationOutlet,
    beforeLoad: async () => {
      if (hold) await pending
    },
  })
  const list = createRoute({ getParentRoute: () => root, path: '/requests', component: () => 'Request list' })
  const detail = createRoute({
    getParentRoute: () => root,
    path: '/requests/$id',
    component: () => 'Detail page',
    pendingComponent: RequestDetailPending,
  })
  const router = createRouter({
    routeTree: root.addChildren([list, detail]),
    history: createMemoryHistory({ initialEntries: ['/requests'] }),
  })
  await router.load()
  const view = render(createElement(RouterProvider, { router }))
  await waitFor(() => expect(view.queryByText('Request list')).not.toBeNull())
  hold = true
  let navigation!: Promise<void>
  await act(async () => {
    navigation = router.navigate({ to: '/requests/$id', params: { id: 'req_pending' } })
  })
  await waitFor(() => expect(view.queryByRole('status', { name: 'Loading request detail' })).not.toBeNull())
  expect(view.container.querySelector('.request-detail-grid')).not.toBeNull()
  expect(view.container.querySelectorAll('.skel-body-lines')).toHaveLength(2)
  expect(view.queryByText('Opening page…')).toBeNull()
  expect(view.queryByText('POST /v1/chat/completions')).toBeNull()
  expect(view.queryByText('Request list')).toBeNull()
  expect(router.history.location.pathname).toBe('/requests/req_pending')
  await act(async () => {
    release()
    await navigation
  })
  await waitFor(() => expect(view.queryByText('Detail page')).not.toBeNull())
})

it('holds the previous request briefly during a slow request navigation', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  let hold = false
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const root = createRootRoute({
    component: NavigationOutlet,
    beforeLoad: async () => {
      if (hold) await pending
    },
  })
  const detail = createRoute({
    getParentRoute: () => root,
    path: '/requests/$id',
    component: () => createElement('div', null, 'Request detail'),
    pendingComponent: RequestDetailPending,
  })
  const router = createRouter({
    routeTree: root.addChildren([detail]),
    history: createMemoryHistory({ initialEntries: ['/requests/req_first'] }),
  })
  await router.load()
  const view = render(createElement(RouterProvider, { router }))
  await waitFor(() => expect(view.queryByText('Request detail')).not.toBeNull())
  await waitFor(() => expect(router.state.resolvedLocation?.pathname).toBe('/requests/req_first'))
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  hold = true
  let navigation!: Promise<void>
  await act(async () => {
    navigation = router.navigate({ to: '/requests/$id', params: { id: 'req_second' } })
  })
  expect(view.queryByText('Request detail')).not.toBeNull()
  expect(view.queryByText('Request detail')?.closest('[inert]')).not.toBeNull()
  expect(view.queryByRole('status', { name: 'Loading request detail' })).toBeNull()
  act(() => vi.advanceTimersByTime(179))
  expect(view.queryByText('Request detail')?.closest('[inert]')).not.toBeNull()
  act(() => vi.advanceTimersByTime(1))
  expect(view.queryByRole('status', { name: 'Loading request detail' })).not.toBeNull()
  await act(async () => {
    release()
    await navigation
  })
  vi.useRealTimers()
  await waitFor(() => expect(view.queryByText('Request detail')).not.toBeNull())
})
