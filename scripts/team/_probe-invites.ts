/**
 * Read-only probe: what does WorkOS actually have for this organization?
 * Lists invitations (all states, org-scoped and unscoped) and organization
 * memberships so we can see why the portal's pending list is empty.
 *
 * Run: yarn tsx scripts/team/_probe-invites.ts
 */

import { WorkOS } from '@workos-inc/node'

async function main() {
  const apiKey = process.env.WORKOS_API_KEY
  const orgId = process.env.WORKOS_ORGANIZATION_ID
  if (!apiKey) throw new Error('WORKOS_API_KEY missing')
  console.log('org id configured:', orgId ?? '(none)')
  const workos = new WorkOS(apiKey)

  console.log('\n== invitations scoped to org ==')
  if (orgId) {
    const scoped = await workos.userManagement.listInvitations({
      organizationId: orgId,
      limit: 100,
    })
    for (const inv of scoped.data) {
      console.log(
        `${inv.email} state=${inv.state} org=${inv.organizationId ?? 'NONE'} created=${inv.createdAt} expires=${inv.expiresAt}`,
      )
    }
    if (scoped.data.length === 0) console.log('(empty)')
  }

  console.log('\n== all invitations in environment ==')
  const all = await workos.userManagement.listInvitations({ limit: 100 })
  for (const inv of all.data) {
    console.log(
      `${inv.email} state=${inv.state} org=${inv.organizationId ?? 'NONE'} created=${inv.createdAt} expires=${inv.expiresAt}`,
    )
  }
  if (all.data.length === 0) console.log('(empty)')

  if (orgId) {
    console.log('\n== org memberships ==')
    const memberships = await workos.userManagement.listOrganizationMemberships(
      {
        organizationId: orgId,
        statuses: ['active', 'pending', 'inactive'],
        limit: 100,
      },
    )
    for (const m of memberships.data) {
      const user = await workos.userManagement.getUser(m.userId)
      console.log(
        `${user.email} membership=${m.status} user=${m.userId} emailVerified=${user.emailVerified}`,
      )
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
