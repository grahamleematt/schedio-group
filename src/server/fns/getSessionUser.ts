/**
 * Resolves the signed-in portal user for the client UI. WorkOS owns identity;
 * `resolvePortalUser` maps the authenticated WorkOS user to their Postgres
 * entity-access row. Returns `null` (instead of throwing) when no session is
 * present so unauthenticated surfaces (e.g. /login) can render without an
 * error boundary.
 */

import { createServerFn } from '@tanstack/react-start'

import type { User } from '#/lib/sg-dream'
import { AuthzError, resolvePortalUser } from '#/server/authz'

export type SessionUser = User & { workosUserId?: string }

export const getSessionUser = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionUser | null> => {
    try {
      return await resolvePortalUser()
    } catch (err) {
      if (err instanceof AuthzError) return null
      throw err
    }
  },
)
