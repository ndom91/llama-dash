// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

const viewport = vi.hoisted(() => ({ mobile: false, show: undefined as string | undefined, navigate: vi.fn() }))
vi.mock('../../lib/use-media-query', () => ({ useMediaQuery: () => viewport.mobile }))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/request">{children}</a>,
  useNavigate: () => viewport.navigate,
  useSearch: () => ({ show: viewport.show }),
}))
vi.mock('../../lib/api', () => ({
  api: {
    getRequestSession: vi.fn(async () => ({
      sessionId: 'session-1',
      nextCursor: null,
      requests: [
        {
          id: 'req_1',
          startedAt: '2026-01-01T00:00:00Z',
          model: 'codex',
          endpoint: '/v1/responses',
          statusCode: 200,
          durationMs: 10,
          totalTokens: 1,
          streamed: true,
          error: null,
          payloads: {
            requestBody: '{"instructions":"captured prefix\n...[truncated 3 bytes]',
            responseBody: 'data: {"type":"unknown","value":"captured event"}\n\n',
          },
        },
      ],
    })),
  },
}))

import { cleanup } from '@testing-library/react'
import { api } from '../../lib/api'
import { SessionPage } from './SessionPage'
import { SessionPagePending } from './SessionPagePending'
import { validateSessionSearch } from './sessionSearch'

afterEach(() => {
  cleanup()
  viewport.mobile = false
  viewport.show = undefined
  viewport.navigate.mockClear()
})

it('links to raw request details for unreadable and truncated captures', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <SessionPage id="req_1" />
    </QueryClientProvider>,
  )
  expect(await screen.findByText(/no readable content/i)).toBeTruthy()
  expect(screen.getAllByRole('link', { name: /open raw/i }).length).toBeGreaterThan(0)
  client.clear()
})

it('groups request and response capture warnings into one footer', async () => {
  const first = await api.getRequestSession('req_1')
  vi.mocked(api.getRequestSession).mockResolvedValueOnce({
    ...first,
    requests: [
      {
        ...first.requests[0],
        payloads: {
          requestBody: 'request\n...[truncated 100 bytes]',
          responseBody: 'response\n...[truncated 200 bytes]',
        },
      },
    ],
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={client}>
      <SessionPage id="req_1" />
    </QueryClientProvider>,
  )
  const response = await view.findByText(/response cut off at/)
  expect(response.parentElement?.textContent).toContain('request 7 B of 107 B')
  expect(response.parentElement?.querySelectorAll('a')).toHaveLength(1)
  view.unmount()
  client.clear()
})

it('shows the same accessible responsive skeleton during navigation and initial loading', async () => {
  const pending = render(<SessionPagePending />)
  const status = pending.getByRole('status', { name: 'Loading session history' })
  expect(status.querySelectorAll('.rounded.border.border-border')).toHaveLength(2)
  expect(status.querySelector('[aria-hidden="true"]')?.className).toContain('min-w-0')
  expect(status.querySelector('.grid')?.className).toContain('max-lg:grid-cols-1')
  pending.unmount()

  vi.mocked(api.getRequestSession).mockImplementationOnce(() => new Promise(() => {}))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const loading = render(
    <QueryClientProvider client={client}>
      <SessionPage id="req_1" />
    </QueryClientProvider>,
  )
  expect(loading.getByRole('status', { name: 'Loading session history' })).toBeTruthy()
  expect(loading.queryByText('No session ID was captured for this request.')).toBeNull()
  loading.unmount()
  client.clear()
})

it('keeps existing requests visible while loading the next page', async () => {
  const first = await api.getRequestSession('req_1')
  vi.mocked(api.getRequestSession)
    .mockResolvedValueOnce({ ...first, nextCursor: 'cursor' })
    .mockImplementationOnce(() => new Promise(() => {}))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={client}>
      <SessionPage id="req_1" />
    </QueryClientProvider>,
  )
  fireEvent.click(await view.findByRole('button', { name: 'Load more requests' }))
  expect(await view.findByRole('status', { name: 'Loading more session requests' })).toBeTruthy()
  expect(view.getByRole('region', { name: 'Request 1' }).textContent).toContain('req_1')
  view.unmount()
  client.clear()
})

it('loads the newest requests first on mobile and appends older pages without repeating context', async () => {
  viewport.mobile = true
  const first = await api.getRequestSession('req_1')
  const base = first.requests[0]
  const olderBody = JSON.stringify({ input: [{ role: 'user', content: 'earlier question' }] })
  const newerBody = JSON.stringify({
    input: [
      { role: 'user', content: 'earlier question' },
      { role: 'assistant', content: 'earlier answer' },
      { role: 'user', content: 'latest question' },
    ],
  })
  const older = {
    ...base,
    id: 'req_old',
    streamed: false,
    payloads: {
      requestBody: olderBody,
      responseBody: JSON.stringify({ output_text: 'earlier answer' }),
    },
  }
  const newer = {
    ...base,
    id: 'req_new',
    streamed: false,
    payloads: {
      requestBody: newerBody,
      responseBody: JSON.stringify({ output_text: 'latest answer' }),
    },
  }
  vi.mocked(api.getRequestSession)
    .mockResolvedValueOnce({ ...first, requests: [newer], nextCursor: 'req_new', olderContext: older })
    .mockResolvedValueOnce({ ...first, requests: [older], nextCursor: null, olderContext: null })
    .mockResolvedValueOnce({ ...first, requests: [older], nextCursor: null, olderContext: null })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={client}>
      <SessionPage id="req_1" />
    </QueryClientProvider>,
  )
  expect(await view.findByText('latest answer')).toBeTruthy()
  expect(view.queryByText('earlier question')).toBeNull()
  const card = view.getByRole('region', { name: 'Request 1' })
  expect(card.textContent!.indexOf('latest answer')).toBeLessThan(card.textContent!.indexOf('latest question'))
  const button = view.getByRole('button', { name: 'Load older requests' })
  expect(vi.mocked(api.getRequestSession)).toHaveBeenCalledWith('req_1', undefined, expect.anything(), 'desc')
  fireEvent.click(button)
  expect(await view.findByText('earlier question')).toBeTruthy()
  const cards = view.getAllByRole('region', { name: /Request [12]/ })
  expect(cards[0].id).toBe('session-req_new')
  expect(cards[1].id).toBe('session-req_old')
  expect(vi.mocked(api.getRequestSession)).toHaveBeenLastCalledWith('req_1', 'req_new', expect.anything(), 'desc')
  expect(view.getAllByText('earlier question')).toHaveLength(1)
  view.unmount()
  client.clear()
})

it('reads and writes transcript filters in the session URL', async () => {
  viewport.show = 'messages,thinking'
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={client}>
      <SessionPage id="req_1" />
    </QueryClientProvider>,
  )
  const thinking = await view.findAllByRole('checkbox', { name: 'thinking' })
  expect((thinking[0] as HTMLInputElement).checked).toBe(true)
  const tools = view.getAllByRole('checkbox', { name: 'tool calls' })
  expect((tools[0] as HTMLInputElement).checked).toBe(false)
  fireEvent.click(tools[0])
  expect(viewport.navigate).toHaveBeenCalledWith(
    expect.objectContaining({
      to: '/sessions/$id',
      params: { id: 'req_1' },
      search: { show: 'messages,tools,thinking' },
      replace: true,
    }),
  )
  view.unmount()
  client.clear()
})

it('opens mobile overlays without losing URL filters', async () => {
  viewport.mobile = true
  viewport.show = 'messages,thinking'
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={client}>
      <SessionPage id="req_1" />
    </QueryClientProvider>,
  )
  fireEvent.click(await view.findByRole('button', { name: 'filter·2' }))
  expect(viewport.navigate).toHaveBeenLastCalledWith(
    expect.objectContaining({ search: { show: 'messages,thinking', sheet: 'show' }, replace: false }),
  )
  fireEvent.click(view.getAllByRole('button', { name: /open raw/i })[0])
  expect(viewport.navigate).toHaveBeenLastCalledWith(
    expect.objectContaining({ search: { show: 'messages,thinking', sheet: undefined, detail: 'req_1~request~0~1' } }),
  )
  view.unmount()
  client.clear()
})

it('accepts addressable details for hyphenated request IDs', () => {
  expect(validateSessionSearch({ detail: 'req-a~tool~3~12', sheet: 'show' })).toEqual({
    show: undefined,
    sheet: 'show',
    detail: 'req-a~tool~3~12',
  })
})

it('reconstructs side requests, a single reminder, and paired tool activity', async () => {
  const first = await api.getRequestSession('req_1')
  const base = first.requests[0]
  const body = (messages: unknown[], extra = {}) => JSON.stringify({ messages, ...extra })
  const user = {
    role: 'user',
    content: 'Build a calendar\n<system-reminder>Read ~/.claude/CLAUDE.md</system-reminder>',
  }
  const call = { type: 'tool_use', id: 'call-1', name: 'Bash', input: { command: 'ls' } }
  const main = {
    ...base,
    id: 'main',
    streamed: false,
    payloads: {
      requestBody: body([user], { system: 'system instructions', tools: [{ name: 'Bash' }] }),
      responseBody: JSON.stringify({ content: [call] }),
    },
  }
  const next = {
    ...base,
    id: 'next',
    streamed: false,
    payloads: {
      requestBody: body(
        [
          user,
          { role: 'assistant', content: [call] },
          { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call-1', content: '+new file' }] },
        ],
        { system: 'system instructions', tools: [{ name: 'Bash' }] },
      ),
      responseBody: JSON.stringify({ content: [{ type: 'text', text: 'Finished **successfully**' }] }),
    },
  }
  const probe = {
    ...base,
    id: 'probe',
    statusCode: 429,
    streamed: false,
    payloads: { requestBody: body([]), responseBody: null },
  }
  const title = {
    ...base,
    id: 'title',
    streamed: false,
    payloads: {
      requestBody: body([{ role: 'user', content: 'Generate a title for this conversation' }]),
      responseBody: JSON.stringify({ content: [{ type: 'text', text: 'Calendar work' }] }),
    },
  }
  vi.mocked(api.getRequestSession).mockResolvedValueOnce({
    ...first,
    requests: [probe, title, main, next],
    nextCursor: null,
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={client}>
      <SessionPage id="main" />
    </QueryClientProvider>,
  )
  expect(await view.findByRole('heading', { name: 'Calendar work' })).toBeTruthy()
  expect(view.getByText(/quota probe/)).toBeTruthy()
  expect(view.getByText(/title generation/)).toBeTruthy()
  expect(view.getAllByText('Build a calendar')).toHaveLength(1)
  expect(view.getAllByRole('button', { name: /reminder · ~\/\.claude\/CLAUDE.md/ })).toHaveLength(1)
  expect(view.getAllByText('+new file')).toHaveLength(1)
  expect(view.getByText('successfully').tagName).toBe('STRONG')
  view.unmount()
  client.clear()
})

it('finds an early generated title while retaining newest-first mobile paging', async () => {
  viewport.mobile = true
  const first = await api.getRequestSession('req_1')
  const base = first.requests[0]
  const newest = {
    ...base,
    id: 'newest',
    payloads: { requestBody: JSON.stringify({ input: [{ role: 'user', content: 'Latest' }] }), responseBody: null },
  }
  const title = {
    ...base,
    id: 'title',
    streamed: false,
    payloads: {
      requestBody: JSON.stringify({ messages: [{ role: 'user', content: 'Generate a title for this conversation' }] }),
      responseBody: JSON.stringify({ content: [{ type: 'text', text: 'A generated title' }] }),
    },
  }
  vi.mocked(api.getRequestSession)
    .mockResolvedValueOnce({ ...first, requests: [newest], nextCursor: 'newest' })
    .mockResolvedValueOnce({ ...first, requests: [title], nextCursor: null })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={client}>
      <SessionPage id="req_1" />
    </QueryClientProvider>,
  )
  expect(await view.findByRole('heading', { name: 'A generated title' })).toBeTruthy()
  expect(view.getByText('Latest')).toBeTruthy()
  expect(vi.mocked(api.getRequestSession)).toHaveBeenCalledWith('req_1', undefined, expect.anything(), 'desc')
  expect(vi.mocked(api.getRequestSession)).toHaveBeenCalledWith(
    'req_1',
    undefined,
    expect.objectContaining({ priority: 'low' }),
    'asc',
  )
  view.unmount()
  client.clear()
})

it('exports every page as JSONL rather than only the visible page', async () => {
  const first = await api.getRequestSession('req_1')
  const next = { ...first.requests[0], id: 'req_older' }
  vi.mocked(api.getRequestSession)
    .mockResolvedValueOnce({ ...first, nextCursor: 'req_1' })
    .mockResolvedValueOnce({ ...first, nextCursor: 'req_1' })
    .mockResolvedValueOnce({ ...first, requests: [next], nextCursor: null })
  const originalCreate = URL.createObjectURL
  const originalRevoke = URL.revokeObjectURL
  URL.createObjectURL = vi.fn(() => 'blob:test')
  URL.revokeObjectURL = vi.fn()
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={client}>
      <SessionPage id="req_1" />
    </QueryClientProvider>,
  )
  fireEvent.click(await view.findByRole('button', { name: 'raw JSONL' }))
  await waitFor(() => expect(click).toHaveBeenCalled())
  expect(vi.mocked(api.getRequestSession)).toHaveBeenCalledWith('req_1', 'req_1', {}, 'asc')
  expect(URL.createObjectURL).toHaveBeenCalledWith(expect.objectContaining({ type: 'application/x-ndjson' }))
  view.unmount()
  client.clear()
  click.mockRestore()
  URL.createObjectURL = originalCreate
  URL.revokeObjectURL = originalRevoke
})

it('skips side requests at a mobile page boundary when finding the previous conversation snapshot', async () => {
  viewport.mobile = true
  const first = await api.getRequestSession('req_1')
  const base = first.requests[0]
  const oldBody = JSON.stringify({ input: [{ role: 'user', content: 'earlier question' }] })
  const recentBody = JSON.stringify({
    input: [
      { role: 'user', content: 'earlier question' },
      { role: 'user', content: 'new question' },
    ],
  })
  const older = { ...base, id: 'older', streamed: false, payloads: { requestBody: oldBody, responseBody: null } }
  const recent = { ...base, id: 'recent', streamed: false, payloads: { requestBody: recentBody, responseBody: null } }
  const side = {
    ...base,
    id: 'side',
    statusCode: 429,
    streamed: false,
    payloads: { requestBody: JSON.stringify({ input: [] }), responseBody: null },
  }
  const firstPage = { ...first, requests: [recent], nextCursor: '100:recent', olderContext: side }
  const laterPage = { ...first, requests: [side, older], nextCursor: null, olderContext: null }
  vi.mocked(api.getRequestSession)
    .mockImplementationOnce(async () => firstPage)
    .mockImplementation(async (_id, cursor, _options, order) =>
      cursor === '100:recent' && order === 'desc' ? laterPage : { ...first, requests: [older], nextCursor: null },
    )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={client}>
      <SessionPage id="req_1" />
    </QueryClientProvider>,
  )
  expect(await view.findByText('new question')).toBeTruthy()
  await waitFor(() => expect(view.queryByText('earlier question')).toBeNull())
  expect(view.queryByText(/context reset/)).toBeNull()
  fireEvent.click(view.getByRole('button', { name: 'Load older requests' }))
  expect(await view.findByText('earlier question')).toBeTruthy()
  expect(view.queryByText(/context reset/)).toBeNull()
  view.unmount()
  client.clear()
  vi.mocked(api.getRequestSession).mockReset().mockResolvedValue(first)
})
