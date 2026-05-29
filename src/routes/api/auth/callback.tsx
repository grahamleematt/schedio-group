import { createFileRoute } from '@tanstack/react-router'
import { handleCallbackRoute } from '@workos/authkit-tanstack-react-start'

import { isWorkOsConfigured } from '#/server/env'

function redirectToLogin(request: Request, error: string): Response {
  const url = new URL('/login', request.url)
  url.searchParams.set('error', error)
  return Response.redirect(url, 302)
}

export const Route = createFileRoute('/api/auth/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isWorkOsConfigured()) {
          return redirectToLogin(request, 'workos_missing')
        }
        const workOsCallback = handleCallbackRoute({
          errorRedirectUrl: '/login?error=auth_failed',
        })
        return workOsCallback({ request })
      },
    },
  },
})
