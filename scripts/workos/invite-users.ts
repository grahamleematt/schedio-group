/**
 * Send WorkOS AuthKit invitations so new teammates can sign in to SG DREAM.
 *
 * Access is invitation-only: this covers the WorkOS half of onboarding. The
 * other half — Postgres entity grants in intelligence_users /
 * intelligence_user_client_access — ships as a db/intelligence migration
 * (see 007_schedio_team_access.sql).
 *
 * Skips anyone who already has a pending invitation or an existing user in
 * the organization, so it's safe to re-run.
 *
 * Run: tsx --env-file=.env.local scripts/workos/invite-users.ts email1 [email2 ...]
 */

import { WorkOS } from '@workos-inc/node'

async function main() {
  const emails = process.argv.slice(2).map((e) => e.trim().toLowerCase())
  if (emails.length === 0) {
    console.error(
      'Usage: tsx --env-file=.env.local scripts/workos/invite-users.ts email1 [email2 ...]',
    )
    process.exit(1)
  }

  const apiKey = process.env.WORKOS_API_KEY
  const organizationId = process.env.WORKOS_ORGANIZATION_ID
  if (!apiKey || !organizationId) {
    console.error('Missing WORKOS_API_KEY or WORKOS_ORGANIZATION_ID in env.')
    process.exit(1)
  }

  const workos = new WorkOS(apiKey)

  const pending = await workos.userManagement.listInvitations({
    organizationId,
    limit: 100,
  })
  const pendingEmails = new Set(
    pending.data
      .filter((inv) => inv.state === 'pending')
      .map((inv) => inv.email.toLowerCase()),
  )

  for (const email of emails) {
    if (pendingEmails.has(email)) {
      console.log(`skip    ${email} — invitation already pending`)
      continue
    }
    const existing = await workos.userManagement.listUsers({
      email,
      organizationId,
      limit: 1,
    })
    if (existing.data.length > 0) {
      console.log(`skip    ${email} — already a member (${existing.data[0].id})`)
      continue
    }
    const invitation = await workos.userManagement.sendInvitation({
      email,
      organizationId,
    })
    console.log(
      `invited ${email} — expires ${invitation.expiresAt} (${invitation.id})`,
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
