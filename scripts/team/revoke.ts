/**
 * Off-boarding counterpart to onboard.ts: removes a teammate's Postgres
 * identity and entity grants, revokes any pending WorkOS invitation, and
 * removes their WorkOS organization membership so they can no longer sign
 * in to SG DREAM. Their WorkOS user account itself is left intact.
 *
 * Usage:
 *   yarn team:revoke <email>
 */

import { WorkOS } from '@workos-inc/node'

import { getDatabasePool } from '../../src/server/database'

async function main() {
  const email = (process.argv[2] ?? '').trim().toLowerCase()
  if (!email.includes('@')) {
    console.error('Usage: yarn team:revoke <email>')
    process.exit(1)
  }

  const pool = await getDatabasePool()
  try {
    // Deleting the user cascades to intelligence_user_client_access.
    const deleted = await pool.query<{ id: string }>(
      `delete from intelligence_users where lower(email) = $1 returning id`,
      [email],
    )
    if (deleted.rows.length > 0) {
      console.log(`removed  Postgres user ${deleted.rows[0].id} and all grants`)
    } else {
      console.log('absent   no Postgres user with that email')
    }

    const apiKey = process.env.WORKOS_API_KEY
    const workosOrgId = process.env.WORKOS_ORGANIZATION_ID
    if (!apiKey || !workosOrgId) {
      console.warn(
        'WORKOS_API_KEY / WORKOS_ORGANIZATION_ID not set — skipped WorkOS cleanup.',
      )
      return
    }
    const workos = new WorkOS(apiKey)

    const invitations = await workos.userManagement.listInvitations({
      organizationId: workosOrgId,
      limit: 100,
    })
    for (const inv of invitations.data) {
      if (inv.state === 'pending' && inv.email.toLowerCase() === email) {
        await workos.userManagement.revokeInvitation(inv.id)
        console.log(`revoked  pending invitation ${inv.id}`)
      }
    }

    const users = await workos.userManagement.listUsers({ email, limit: 1 })
    const workosUser = users.data.at(0)
    if (!workosUser) {
      console.log('absent   no WorkOS account with that email')
      return
    }
    const memberships = await workos.userManagement.listOrganizationMemberships(
      { userId: workosUser.id, organizationId: workosOrgId },
    )
    for (const membership of memberships.data) {
      await workos.userManagement.deleteOrganizationMembership(membership.id)
      console.log(`removed  WorkOS organization membership ${membership.id}`)
    }
    if (memberships.data.length === 0) {
      console.log('absent   no WorkOS organization membership')
    }
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
