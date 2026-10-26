import { Outlet, useRouterState } from '@tanstack/react-router'
import { NavigationPending } from './NavigationPending'

export function NavigationOutlet() {
  // beforeLoad can block before route-level pending boundaries are activated.
  // Observe the navigation itself from the already-mounted authenticated shell.
  const isNavigating = useRouterState({
    select: (state) => state.isLoading && state.location.pathname !== state.resolvedLocation?.pathname,
  })
  return isNavigating ? <NavigationPending /> : <Outlet />
}
