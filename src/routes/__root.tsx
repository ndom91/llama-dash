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
import {
  COLOR_THEME_COOKIE,
  COLOR_THEME_STORAGE_KEY,
  DEFAULT_THEME_ID,
  DEFAULT_THEME_MODE,
  THEME_MODE_COOKIE,
  THEME_MODE_STORAGE_KEY,
  themes,
  themeStyleVars,
} from '../lib/theme'
import { MobileMenuContext } from '../lib/use-mobile-menu'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 2_000, retry: 1 } },
})

import appCss from '../styles.css?url'

const THEME_INIT_SCRIPT = buildThemeInitScript()

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

function buildThemeInitScript() {
  const validThemeIds = JSON.stringify(themes.map((theme) => theme.id))
  const themeBranches = themes
    .map((theme) => `if(color===${JSON.stringify(theme.id)}){${themeVarsInitScript(theme)}}`)
    .join('else ')

  return `(function(){try{var root=document.documentElement;var s=root.style;var themeCookie=document.cookie.match(/(?:^|; )${COLOR_THEME_COOKIE}=([^;]*)/);var modeCookie=document.cookie.match(/(?:^|; )${THEME_MODE_COOKIE}=([^;]*)/);var color=window.localStorage.getItem('${COLOR_THEME_STORAGE_KEY}')||(themeCookie?decodeURIComponent(themeCookie[1]):'${DEFAULT_THEME_ID}');var valid=${validThemeIds};if(valid.indexOf(color)===-1){color='${DEFAULT_THEME_ID}'}var mode=window.localStorage.getItem('${THEME_MODE_STORAGE_KEY}')||(modeCookie?decodeURIComponent(modeCookie[1]):'${DEFAULT_THEME_MODE}');if(mode!=='light'&&mode!=='dark'&&mode!=='auto'){mode='${DEFAULT_THEME_MODE}'}var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;${themeBranches};window.localStorage.setItem('${COLOR_THEME_STORAGE_KEY}',color);window.localStorage.setItem('${THEME_MODE_STORAGE_KEY}',mode);document.cookie='${COLOR_THEME_COOKIE}='+encodeURIComponent(color)+'; Path=/; Max-Age=31536000; SameSite=Lax';document.cookie='${THEME_MODE_COOKIE}='+encodeURIComponent(mode)+'; Path=/; Max-Age=31536000; SameSite=Lax';}catch(e){}})();`
}

function themeVarsInitScript(theme: (typeof themes)[number]) {
  return Object.entries(themeStyleVars(theme))
    .map(([key, value]) => `s.setProperty(${JSON.stringify(key)},${JSON.stringify(value)});`)
    .join('')
}
