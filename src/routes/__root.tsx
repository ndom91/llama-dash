import { HotkeysProvider } from '@tanstack/react-hotkeys'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { useCallback, useState } from 'react'
import { Toaster } from 'sonner'
import { Sidebar } from '../components/Sidebar'
import { TooltipProvider } from '../components/Tooltip'
import { MobileMenuContext } from '../lib/use-mobile-menu'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 2_000, retry: 1 } },
})

import appCss from '../styles.css?url'

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`

export const Route = createRootRoute({
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
  return (
    <html lang="en" suppressHydrationWarning>
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
        <Sidebar />
        <Outlet />
      </div>
    </MobileMenuContext>
  )
}
