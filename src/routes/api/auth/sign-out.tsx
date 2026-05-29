import { createFileRoute } from '@tanstack/react-router'
import { getAuth, signOut } from '@workos/authkit-tanstack-react-start'

import { isWorkOsConfigured } from '#/server/env'

function redirectTo(request: Request, path: string): Response {
  return Response.redirect(new URL(path, request.url).toString(), 302)
}

export const Route = createFileRoute('/api/auth/sign-out')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isWorkOsConfigured()) {
          return redirectTo(request, '/login')
        }
        // No active session → nothing to revoke at WorkOS; bounce to /login
        // ourselves. Calling signOut() without a session fails to build a
        // logout URL and 500s.
        const auth = await getAuth()
        if (!auth.user) {
          return redirectTo(request, '/login')
        }
        // WorkOS validates the post-logout `return_to` against the env's
        // allowed redirects and rejects relative paths (falling back to the
        // unset App Homepage URL → `app-homepage-url-not-found`). Send the
        // absolute origin URL so the logout lands back on /login.
        const returnTo = new URL('/login', request.url).toString()
        return signOut({ data: { returnTo } })
      },
    },
  },
})
