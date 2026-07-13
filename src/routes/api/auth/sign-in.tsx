import { createFileRoute } from '@tanstack/react-router'

import { isWorkOsConfigured } from '#/server/env'

function safeReturnPathname(value: string | null): string | undefined {
  if (!value) return undefined
  if (!value.startsWith('/')) return undefined
  if (value.startsWith('//')) return undefined
  return value
}

/**
 * Loose email shape check for the `loginHint` passthrough. The hint only
 * prefills AuthKit's email field — WorkOS re-validates on its side — so this
 * just filters junk that would render a confusing prefill.
 */
function safeLoginHint(value: string | null): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed || trimmed.length > 254) return undefined
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : undefined
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
        const params = new URL(request.url).searchParams
        const returnPathname = safeReturnPathname(params.get('returnPathname'))
        const loginHint = safeLoginHint(params.get('email'))
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
        const { getSignInUrl } = await import(
          '@workos/authkit-tanstack-react-start'
        )
        // `loginHint` prefills AuthKit's email field so the user goes straight
        // to their password / one-time-code step instead of retyping the email
        // they just gave us on /login.
        const data = {
          ...(returnPathname ? { returnPathname } : {}),
          ...(loginHint ? { loginHint } : {}),
        }
        const url = await getSignInUrl(
          Object.keys(data).length > 0 ? { data } : undefined,
        )
        return Response.redirect(url, 307)
      },
    },
  },
})
