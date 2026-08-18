import {
  accessRoleLabels,
  currentUser,
  initialsFromName,
  isInternalUser,
} from '#/lib/sg-dream'
import type { AccessRole, User } from '#/lib/sg-dream'
import { dbQuery } from '#/server/database'
import {
  isDatabaseConfigured,
  isStrictMode,
  isWorkOsConfigured,
} from '#/server/env'

type PortalUser = User & {
  workosUserId?: string
}

export class AuthzError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'AuthzError'
    this.status = status
  }
}

type DbUserAccessRow = {
  id: string
  workos_user_id: string | null
  email: string
  name: string
  role: User['role']
  is_admin: boolean
  client_id: string
}

async function workOsAuthUser(): Promise<{
  id?: string
  email?: string
  name?: string
} | null> {
  if (!isWorkOsConfigured()) return null
  const { getAuth } = await import('@workos/authkit-tanstack-react-start')
  const auth = await getAuth()
  if (!auth.user) return null
  const user = auth.user as {
    id?: string
    email?: string
    firstName?: string | null
    lastName?: string | null
  }
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ')
  return {
    id: user.id,
    email: user.email,
    name: name.length > 0 ? name : user.email,
  }
}

async function accessFromDatabase(input: {
  workosUserId?: string
  email?: string
}): Promise<PortalUser | null> {
  if (!isDatabaseConfigured()) return null
  if (!input.workosUserId && !input.email) return null
  try {
    const rows = await dbQuery<DbUserAccessRow>(
      `
        select
          u.id,
          u.workos_user_id,
          u.email,
          u.name,
          u.role,
          u.is_admin,
          a.client_id
        from intelligence_users u
        join intelligence_user_client_access a on a.user_id = u.id
        where
          ($1::text is not null and u.workos_user_id = $1)
          or ($2::text is not null and lower(u.email) = lower($2))
        order by a.client_id
      `,
      [input.workosUserId ?? null, input.email ?? null],
    )
    if (rows.rows.length === 0) return null
    const first = rows.rows[0]
    // Self-healing identity binding: a freshly onboarded user matches by
    // email with workos_user_id still null. Bind the stable WorkOS ID on
    // this first sign-in so later logins (and future email changes) match
    // on the ID instead. Best-effort — a failure just means we bind next
    // time.
    if (!first.workos_user_id && input.workosUserId) {
      dbQuery(
        `update intelligence_users
            set workos_user_id = $1, updated_at = now()
          where id = $2 and workos_user_id is null`,
        [input.workosUserId, first.id],
      ).catch((err: unknown) => {
        console.warn('[authz] workos_user_id bind failed', err)
      })
      first.workos_user_id = input.workosUserId
    }
    return {
      id: first.id,
      workosUserId: first.workos_user_id ?? undefined,
      initials: initialsFromName(first.name),
      name: first.name,
      email: first.email,
      role: first.role,
      permittedClientIds: rows.rows.map((row) => row.client_id),
      canManageUsers: first.is_admin,
    }
  } catch (err) {
    console.warn('[authz] database access lookup failed', err)
    return null
  }
}

function isAuthBypassEnabled(): boolean {
  return process.env.SG_DREAM_AUTH_BYPASS === 'true'
}

export async function resolvePortalUser(): Promise<PortalUser> {
  // Demo/dev bypass: skip WorkOS entirely and resolve to the seeded Tim portal
  // user. Never enable in strict mode. SG_DREAM_AUTH_BYPASS_ROLE optionally
  // overrides the persona's role (e.g. `client_viewer`) so the client-facing
  // views can be exercised locally without a second WorkOS account.
  if (isAuthBypassEnabled() && !isStrictMode()) {
    const roleOverride = process.env.SG_DREAM_AUTH_BYPASS_ROLE
    if (roleOverride && roleOverride in accessRoleLabels) {
      const role = roleOverride as AccessRole
      return { ...currentUser, role, canManageUsers: role === 'sg_admin' }
    }
    return { ...currentUser }
  }

  const authUser = await workOsAuthUser()
  if (!authUser) {
    throw new AuthzError(401, 'sign-in required')
  }

  // Identity and entity access are fully data-driven: the authenticated WorkOS
  // user must map to a Postgres entity-access grant (by workos_user_id or
  // email). There is no static fallback in any mode — an ungranted user is
  // denied rather than silently inheriting the seeded reviewer's entities.
  const dbUser = await accessFromDatabase({
    workosUserId: authUser.id,
    email: authUser.email,
  })
  if (dbUser) return dbUser

  throw new AuthzError(
    403,
    'no Schedio workspace access for this user; grant access in Postgres',
  )
}

export async function assertClientAccess(
  clientId: string,
): Promise<PortalUser> {
  const user = await resolvePortalUser()
  if (!user.permittedClientIds.includes(clientId)) {
    throw new AuthzError(403, 'client access denied')
  }
  return user
}

/**
 * Entity access AND Schedio-internal standing. Guards the extraction
 * correction surfaces (value/box edits, applied %, re-runs) — Tim's rule:
 * corrections are their own permission, not something clients do.
 */
export async function assertInternalClientAccess(
  clientId: string,
): Promise<PortalUser> {
  const user = await assertClientAccess(clientId)
  if (!isInternalUser(user)) {
    throw new AuthzError(403, 'extraction corrections require Schedio access')
  }
  return user
}

export function authzJsonError(err: unknown): Response | null {
  if (!(err instanceof AuthzError)) return null
  return new Response(JSON.stringify({ error: err.message }), {
    status: err.status,
    headers: { 'content-type': 'application/json' },
  })
}
