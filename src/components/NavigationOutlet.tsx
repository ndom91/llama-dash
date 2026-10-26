import { Outlet, useRouter, useRouterState } from '@tanstack/react-router'
import { NavigationPending } from './NavigationPending'

export function NavigationOutlet() {
  const router = useRouter()
  // beforeLoad can block before route-level pending boundaries are activated.
  // Observe the navigation itself from the already-mounted authenticated shell.
  const pendingPathname = useRouterState({
    select: (state) =>
      state.isLoading && state.location.pathname !== state.resolvedLocation?.pathname ? state.location.pathname : null,
  })
  if (!pendingPathname) return <Outlet />
  const Pending = router.getMatchedRoutes(pendingPathname).foundRoute?.options.pendingComponent
  return Pending ? <Pending /> : <NavigationPending />
}
