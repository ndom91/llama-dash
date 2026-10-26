// @vitest-environment jsdom
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { NavigationOutlet } from './NavigationOutlet'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
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
  const detail = createRoute({ getParentRoute: () => root, path: '/requests/$id', component: () => 'Detail page' })
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
  await waitFor(() => expect(view.queryByText('Opening page…')).not.toBeNull())
  expect(view.queryByText('Request list')).toBeNull()
  expect(router.history.location.pathname).toBe('/requests/req_pending')
  await act(async () => {
    release()
    await navigation
  })
  await waitFor(() => expect(view.queryByText('Detail page')).not.toBeNull())
})
