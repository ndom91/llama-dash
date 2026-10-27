import { expect, it } from 'vitest'
import { Route } from '../../routes/usage'
import { UsagePagePending } from './UsagePagePending'

it('uses the usage skeleton as its navigation pending component', () => {
  expect(Route.options.pendingComponent).toBe(UsagePagePending)
})
