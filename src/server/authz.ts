import { currentUser } from '#/lib/sg-dream'
import type { User } from '#/lib/sg-dream'
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

function initialsFor(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
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
    return {
      id: first.id,
      workosUserId: first.workos_user_id ?? undefined,
      initials: initialsFor(first.name),
      name: first.name,
      email: first.email,
      role: first.role,
      permittedClientIds: rows.rows.map((row) => row.client_id),
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
  // user. Never enable in strict mode.
  if (isAuthBypassEnabled() && !isStrictMode()) {
    return { ...currentUser }
  }

  const authUser = await workOsAuthUser()
  if (isWorkOsConfigured() && !authUser) {
    throw new AuthzError(401, 'sign-in required')
  }

  const dbUser = await accessFromDatabase({
    workosUserId: authUser?.id,
    email: authUser?.email,
  })
  if (dbUser) return dbUser

  // Strict mode fails closed: a real WorkOS user must map to a Postgres access
  // row. No static Tim fallback, so staging/production can't authorize anyone
  // who hasn't been explicitly granted entity access.
  if (isStrictMode()) {
    throw new AuthzError(
      403,
      'no Schedio workspace access for this user; grant access in Postgres',
    )
  }

  const timEmail =
    process.env.WORKOS_TIM_EMAIL ?? 'tim.mccarley@schedio.example'
  if (
    authUser &&
    authUser.email &&
    authUser.email.toLowerCase() !== timEmail.toLowerCase()
  ) {
    throw new AuthzError(403, 'user is not attached to this Schedio workspace')
  }

  return {
    ...currentUser,
    workosUserId: authUser?.id,
    email: authUser?.email ?? currentUser.email,
    name: authUser?.name ?? currentUser.name,
  }
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

export function authzJsonError(err: unknown): Response | null {
  if (!(err instanceof AuthzError)) return null
  return new Response(JSON.stringify({ error: err.message }), {
    status: err.status,
    headers: { 'content-type': 'application/json' },
  })
}
