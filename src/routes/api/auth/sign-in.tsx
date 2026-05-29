import { createFileRoute } from '@tanstack/react-router'
import { getSignInUrl } from '@workos/authkit-tanstack-react-start'

import { isWorkOsConfigured } from '#/server/env'

function safeReturnPathname(value: string | null): string | undefined {
  if (!value) return undefined
  if (!value.startsWith('/')) return undefined
  if (value.startsWith('//')) return undefined
  return value
}

function redirectToLogin(request: Request, error: string): Response {
  const url = new URL('/login', request.url)
  url.searchParams.set('error', error)
  return Response.redirect(url, 302)
}

export const Route = createFileRoute('/api/auth/sign-in')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const returnPathname = safeReturnPathname(
          new URL(request.url).searchParams.get('returnPathname'),
        )
        // Demo/dev bypass: skip the WorkOS round-trip and drop straight into the
        // app (resolvePortalUser resolves to the seeded Tim user).
        if (
          process.env.SG_DREAM_AUTH_BYPASS === 'true' &&
          process.env.SG_DREAM_STRICT_MODE !== 'true'
        ) {
          return Response.redirect(
            new URL(returnPathname ?? '/clients', request.url),
            307,
          )
        }
        if (!isWorkOsConfigured()) {
          return redirectToLogin(request, 'workos_missing')
        }
        const url = await getSignInUrl(
          returnPathname ? { data: { returnPathname } } : undefined,
        )
        return Response.redirect(url, 307)
      },
    },
  },
})
