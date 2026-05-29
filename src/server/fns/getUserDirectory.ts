/**
 * Org-wide user directory for the Users & access admin page. Joins the WorkOS
 * organization roster (membership, MFA enrollment, last sign-in) with each
 * user's Postgres entity-access grant (app role + permitted entities).
 *
 * Falls back to a single row built from the signed-in user when WorkOS is not
 * configured (local dev) or the admin API call fails, so the page always
 * renders something truthful rather than erroring.
 */

import { createServerFn } from '@tanstack/react-start'
import { WorkOS } from '@workos-inc/node'

import { clients } from '#/lib/sg-dream'
import type { AccessRole, ActiveUser, MfaState } from '#/lib/sg-dream'
import { AuthzError, resolvePortalUser } from '#/server/authz'
import { dbQuery } from '#/server/database'
import { getWorkOsEnv, isWorkOsConfigured } from '#/server/env'

type PortalUser = Awaited<ReturnType<typeof resolvePortalUser>>

function initialsFrom(
  firstName: string | null,
  lastName: string | null,
  email: string,
): string {
  const combined = `${(firstName?.[0] ?? '').toUpperCase()}${(
    lastName?.[0] ?? ''
  ).toUpperCase()}`
  return combined || email.slice(0, 2).toUpperCase()
}

function lastSignInLabel(iso: string | null): string {
  if (!iso) return 'Never'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const minutes = Math.floor((Date.now() - then) / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function entityCodesFor(clientIds: ReadonlyArray<string>): Array<string> {
  return clientIds
    .map((id) => clients.find((c) => c.id === id)?.code)
    .filter((code): code is string => Boolean(code))
}

function mapWorkOsRole(slug: string | undefined): AccessRole {
  if (slug === 'admin') return 'sg_admin'
  return 'client_viewer'
}

function rowFromSessionUser(user: PortalUser): ActiveUser {
  return {
    id: user.id,
    initials: user.initials,
    name: user.name,
    email: user.email,
    role: user.role,
    entityCodes: entityCodesFor(user.permittedClientIds),
    mfa: 'not_set',
    lastSignInLabel: 'This session',
    isYou: true,
  }
}

type AccessRow = {
  workos_user_id: string | null
  email: string
  role: AccessRole
  client_id: string
}

export const getUserDirectory = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ReadonlyArray<ActiveUser>> => {
    let sessionUser: PortalUser
    try {
      sessionUser = await resolvePortalUser()
    } catch (err) {
      if (err instanceof AuthzError) return []
      throw err
    }

    const organizationId = process.env.WORKOS_ORGANIZATION_ID
    if (!isWorkOsConfigured() || !organizationId) {
      return [rowFromSessionUser(sessionUser)]
    }

    try {
      const workos = new WorkOS(getWorkOsEnv().WORKOS_API_KEY)
      const memberships =
        await workos.userManagement.listOrganizationMemberships({
          organizationId,
          limit: 100,
        })
      const active = memberships.data.filter((m) => m.status === 'active')

      // Postgres entity-access rows, keyed by WorkOS id and lowercased email.
      const access = await dbQuery<AccessRow>(
        `
          select u.workos_user_id, lower(u.email) as email, u.role, a.client_id
          from intelligence_users u
          join intelligence_user_client_access a on a.user_id = u.id
        `,
      )
      const clientIdsByWorkosId = new Map<string, Array<string>>()
      const clientIdsByEmail = new Map<string, Array<string>>()
      const roleByWorkosId = new Map<string, AccessRole>()
      const roleByEmail = new Map<string, AccessRole>()
      for (const row of access.rows) {
        if (row.workos_user_id) {
          const list = clientIdsByWorkosId.get(row.workos_user_id) ?? []
          list.push(row.client_id)
          clientIdsByWorkosId.set(row.workos_user_id, list)
          roleByWorkosId.set(row.workos_user_id, row.role)
        }
        const list = clientIdsByEmail.get(row.email) ?? []
        list.push(row.client_id)
        clientIdsByEmail.set(row.email, list)
        roleByEmail.set(row.email, row.role)
      }

      const rows = await Promise.all(
        active.map(async (membership) => {
          const user = await workos.userManagement.getUser(membership.userId)
          let mfaEnabled = false
          try {
            const factors = await workos.multiFactorAuth.listUserAuthFactors({
              userId: membership.userId,
            })
            mfaEnabled = factors.data.length > 0
          } catch {
            mfaEnabled = false
          }

          const email = user.email
          const emailKey = email.toLowerCase()
          const grantedClientIds =
            clientIdsByWorkosId.get(membership.userId) ??
            clientIdsByEmail.get(emailKey) ??
            []
          const appRole =
            roleByWorkosId.get(membership.userId) ??
            roleByEmail.get(emailKey) ??
            mapWorkOsRole(membership.role.slug)

          const isYou =
            membership.userId === sessionUser.workosUserId ||
            emailKey === sessionUser.email.toLowerCase()

          const row: ActiveUser = {
            id: membership.userId,
            initials: initialsFrom(user.firstName, user.lastName, email),
            name:
              [user.firstName, user.lastName].filter(Boolean).join(' ') ||
              email,
            email,
            role: appRole,
            entityCodes: entityCodesFor(grantedClientIds),
            mfa: (mfaEnabled ? 'enabled' : 'not_set') satisfies MfaState,
            lastSignInLabel: lastSignInLabel(user.lastSignInAt),
            isYou,
          }
          return row
        }),
      )

      // Signed-in user first, then alphabetical.
      return rows.sort((a, b) => {
        if (a.isYou && !b.isYou) return -1
        if (b.isYou && !a.isYou) return 1
        return a.name.localeCompare(b.name)
      })
    } catch (err) {
      console.warn('[user directory] WorkOS roster lookup failed', err)
      return [rowFromSessionUser(sessionUser)]
    }
  },
)
