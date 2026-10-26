import { Outlet, useRouter, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { NavigationPending } from './NavigationPending'

export function NavigationOutlet() {
  const router = useRouter()
  // beforeLoad can block before route-level pending boundaries are activated.
  // Observe the navigation itself from the already-mounted authenticated shell.
  const navigation = useRouterState({
    select: (state) =>
      state.isLoading && state.location.pathname !== state.resolvedLocation?.pathname
        ? { destination: state.location.pathname, previous: state.resolvedLocation?.pathname }
        : null,
  })
  const detailNavigation = Boolean(
    navigation?.previous?.startsWith('/requests/') && navigation.destination.startsWith('/requests/'),
  )
  const destination = navigation?.destination
  const [expiredDestination, setExpiredDestination] = useState<string | null>(null)
  useEffect(() => {
    if (!detailNavigation || !destination) {
      setExpiredDestination(null)
      return
    }
    const timer = window.setTimeout(() => setExpiredDestination(destination), 180)
    return () => window.clearTimeout(timer)
  }, [detailNavigation, destination])

  if (!navigation) return <Outlet />
  if (detailNavigation && expiredDestination !== navigation.destination) {
    return (
      <div inert className="contents">
        <Outlet />
      </div>
    )
  }
  const Pending = router.getMatchedRoutes(navigation.destination).foundRoute?.options.pendingComponent
  return Pending ? <Pending /> : <NavigationPending />
}
