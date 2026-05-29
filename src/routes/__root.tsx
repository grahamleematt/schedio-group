import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
  useRouterState,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import Footer from '../components/Footer'
import Header from '../components/Header'

import { sessionUserQuery } from '#/lib/queries'

import appCss from '../styles.css?url'

/**
 * Routes that render WITHOUT the AppShell (no sidebar, no topbar) but WITH
 * the marketing Header + Footer. These are unauthenticated landing surfaces
 * that still want the public site chrome.
 */
const HEADER_PATHS = new Set(['/'])

/**
 * Routes that render edge-to-edge with no chrome at all (no AppShell, no
 * Header/Footer). Used for the v2 center-stage layouts (login, entity
 * picker, blocked).
 */
const STAGE_PATHS = new Set(['/login', '/clients', '/blocked'])

function chromeFor(pathname: string): 'header' | 'stage' | 'shell' {
  if (HEADER_PATHS.has(pathname)) return 'header'
  if (STAGE_PATHS.has(pathname)) return 'stage'
  return 'shell'
}

export interface RouterAppContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Schedio Group | SG DREAM',
      },
    ],
    links: [
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/schedio-logo.svg',
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(sessionUserQuery()),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const { queryClient } = Route.useRouteContext()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const chrome = chromeFor(pathname)
  // - 'shell' routes own their entire chrome (AppShell)
  // - 'stage' routes render full-bleed (login, blocked)
  // - 'header' routes get the marketing header + footer
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased [overflow-wrap:anywhere] selection:bg-[rgba(0,61,166,0.18)]">
        <QueryClientProvider client={queryClient}>
          {chrome === 'header' ? (
            <>
              <Header />
              {children}
              <Footer />
            </>
          ) : (
            children
          )}
          <TanStackDevtools
            config={{
              position: 'bottom-right',
            }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
