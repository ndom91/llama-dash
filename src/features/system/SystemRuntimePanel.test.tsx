// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { ApiSystemStatus } from '../../lib/schemas/system'

const compact = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }))
vi.mock('../../lib/queries', () => ({ useCompactDatabase: () => compact }))

import { SystemRuntimePanel } from './SystemRuntimePanel'

afterEach(() => {
  cleanup()
  compact.mutate.mockClear()
  compact.isPending = false
})

it('starts compaction once and indicates when it is running', () => {
  const status = {
    runtime: {
      uptimeSec: 20,
      nodeVersion: 'v24',
      gitCommit: '1234567',
      update: { status: 'current' },
      pricing: { status: 'ready', count: 1 },
    },
    database: { path: '/data/dash.db', sizeBytes: 1024, requestRows: 3 },
  } as ApiSystemStatus
  const view = render(<SystemRuntimePanel status={status} />)
  fireEvent.click(screen.getByRole('button', { name: 'compact' }))
  expect(compact.mutate).toHaveBeenCalledTimes(1)
  compact.isPending = true
  view.rerender(<SystemRuntimePanel status={status} />)
  expect((screen.getByRole('button', { name: 'compacting…' }) as HTMLButtonElement).disabled).toBe(true)
})
