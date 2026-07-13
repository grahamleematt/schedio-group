/**
 * Admin-only server functions behind the Users & access page: invite a
 * teammate (Postgres grants + WorkOS invitation via the shared onboarding
 * core), list pending invitations, and revoke one. Every entry point
 * requires the caller's `canManageUsers` flag — for everyone else the page
 * itself is unreachable and these return 403.
 */

import { createServerFn } from '@tanstack/react-start'

import { AuthzError, resolvePortalUser } from '#/server/authz'
import { onboardTeammate } from '#/server/team'
import type { OnboardResult } from '#/server/team'
import { getWorkOsEnv, isWorkOsConfigured } from '#/server/env'

async function requireAdmin() {
  const user = await resolvePortalUser()
  if (!user.canManageUsers) {
    throw new AuthzError(403, 'user management requires admin access')
  }
  return user
}

export type PendingInvite = {
  id: string
  email: string
  invitedAtISO: string
  expiresAtISO: string
}

async function listPendingInvites(): Promise<ReadonlyArray<PendingInvite>> {
  const organizationId = process.env.WORKOS_ORGANIZATION_ID
  if (!isWorkOsConfigured() || !organizationId) return []
  const { WorkOS } = await import('@workos-inc/node')
  const workos = new WorkOS(getWorkOsEnv().WORKOS_API_KEY)
  const invitations = await workos.userManagement.listInvitations({
    organizationId,
    limit: 100,
  })
  return invitations.data
    .filter((inv) => inv.state === 'pending')
    .map((inv) => ({
      id: inv.id,
      email: inv.email,
      invitedAtISO: inv.createdAt,
      expiresAtISO: inv.expiresAt,
    }))
    .sort((a, b) => b.invitedAtISO.localeCompare(a.invitedAtISO))
}

export const getPendingInvites = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ReadonlyArray<PendingInvite>> => {
    await requireAdmin()
    try {
      return await listPendingInvites()
    } catch (err) {
      console.warn('[manage users] pending invitation lookup failed', err)
      return []
    }
  },
)

export type AddPortalUserResult =
  | { ok: true; result: OnboardResult }
  | { ok: false; error: string }

export const addPortalUser = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: { email: string; name: string; entities: Array<string> }) => data,
  )
  .handler(async ({ data }): Promise<AddPortalUserResult> => {
    const admin = await requireAdmin()
    try {
      const result = await onboardTeammate({
        email: data.email,
        name: data.name,
        entities: data.entities,
        grantedBy: `admin:${admin.id}`,
      })
      return { ok: true, result }
    } catch (err) {
      console.warn('[manage users] add user failed', err)
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Could not add the user.',
      }
    }
  })

export const revokePendingInvite = createServerFn({ method: 'POST' })
  .inputValidator((data: { invitationId: string }) => data)
  .handler(
    async ({ data }): Promise<{ ok: boolean }> => {
      await requireAdmin()
      const { WorkOS } = await import('@workos-inc/node')
      const workos = new WorkOS(getWorkOsEnv().WORKOS_API_KEY)
      await workos.userManagement.revokeInvitation(data.invitationId)
      return { ok: true }
    },
  )
