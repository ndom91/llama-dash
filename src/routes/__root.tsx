import { HotkeysProvider } from '@tanstack/react-hotkeys'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { createRootRoute, HeadContent, Outlet, redirect, Scripts, useMatches } from '@tanstack/react-router'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { useCallback, useState } from 'react'
import { Toaster } from 'sonner'
import { Sidebar } from '../components/Sidebar'
import { TopBar } from '../components/TopBar'
import { TooltipProvider } from '../components/Tooltip'
import { getShellContext } from '../lib/auth-functions'
import { THEME_INIT_SCRIPT } from '../lib/theme-init-script'
import { useAdminEvents } from '../lib/use-admin-events'
import { MobileMenuContext } from '../lib/use-mobile-menu'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
})

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    const shell = await getShellContext().catch(() => null)
    if (location.pathname !== '/login' && !shell?.session) {
      throw redirect({
        to: '/login',
        search: { redirect: `${location.pathname}${location.searchStr}` },
      })
    }
    return shell
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: '#070809' },
      { title: 'llama-dash' },
    ],
    links: [
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument() {
  const matches = useMatches()
  const rootContext = matches[0]?.context as RootShellContext | undefined
  const theme = rootContext?.theme

  return (
    <html
      lang="en"
      className={theme?.resolvedMode}
      data-theme={theme?.mode === 'auto' ? undefined : theme?.mode}
      style={theme ? ({ colorScheme: theme.resolvedMode, cssText: theme.cssText } as React.CSSProperties) : undefined}
      suppressHydrationWarning
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: inline theme-init script runs before hydration to avoid FOUC */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <HotkeysProvider>
            <TooltipProvider>
              <AppShell />
            </TooltipProvider>
          </HotkeysProvider>
          <Toaster
            position="bottom-center"
            theme="system"
            toastOptions={{
              classNames: {
                toast: 'llama-toast',
                title: 'llama-toast-title',
                description: 'llama-toast-desc',
              },
            }}
          />
          <TanStackDevtools
            config={{ position: 'bottom-right' }}
            plugins={[
              { name: 'Tanstack Router', render: <TanStackRouterDevtoolsPanel /> },
              { name: 'Tanstack Query', render: <ReactQueryDevtoolsPanel /> },
            ]}
          />
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}

function AppShell() {
  const [open, setOpen] = useState(false)
  const toggle = useCallback(() => setOpen((v) => !v), [])
  const close = useCallback(() => setOpen(false), [])
  const matches = useMatches()
  const leaf = matches[matches.length - 1]?.pathname ?? '/'
  const rootContext = matches[0]?.context as RootShellContext | undefined

  if (leaf === '/login') return <Outlet />

  return <AuthenticatedShell open={open} toggle={toggle} close={close} rootContext={rootContext} />
}

function AuthenticatedShell({
  open,
  toggle,
  close,
  rootContext,
}: {
  open: boolean
  toggle: () => void
  close: () => void
  rootContext: RootShellContext | undefined
}) {
  useAdminEvents()

  return (
    <MobileMenuContext value={{ open, toggle, close }}>
      <div className="app-shell">
        <button
          type="button"
          className={`sidebar-backdrop${open ? ' sidebar-backdrop-visible' : ''}`}
          aria-label="Close menu"
          onClick={close}
          tabIndex={-1}
          aria-hidden={!open}
        />
        <Sidebar
          initialSession={rootContext?.session ?? null}
          initialCapabilities={rootContext?.inference.capabilities ?? null}
        />
        <div className="main-col">
          <TopBar />
          <Outlet />
        </div>
      </div>
    </MobileMenuContext>
  )
}

type RootShellContext = Awaited<ReturnType<typeof getShellContext>>
