/**
 * CLI wrapper over the shared onboarding core (src/server/team.ts): creates
 * the Postgres identity + entity grants and sends the WorkOS AuthKit
 * invitation in one step. Idempotent — safe to re-run.
 *
 * Usage:
 *   yarn team:onboard <email> "<Full Name>" [--entities id1,id2] [--role r] [--admin] [--no-invite]
 *
 * Defaults: every entity in the Schedio organization, role entity_owner,
 * no admin access.
 */

import { getDatabasePool } from '../../src/server/database'
import { onboardTeammate } from '../../src/server/team'

type Args = {
  email: string
  name: string
  entities: Array<string> | null
  role: string
  admin: boolean
  invite: boolean
}

function parseArgs(argv: Array<string>): Args {
  const positional: Array<string> = []
  let entities: Array<string> | null = null
  let role = 'entity_owner'
  let admin = false
  let invite = true
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--entities') {
      entities = (argv[++i] ?? '').split(',').filter(Boolean)
    } else if (arg === '--role') {
      role = argv[++i] ?? role
    } else if (arg === '--admin') {
      admin = true
    } else if (arg === '--no-invite') {
      invite = false
    } else {
      positional.push(arg)
    }
  }
  const [email, name] = positional
  if (!email || !email.includes('@') || !name) {
    console.error(
      'Usage: yarn team:onboard <email> "<Full Name>" [--entities id1,id2] [--role entity_owner] [--admin] [--no-invite]',
    )
    process.exit(1)
  }
  return { email, name, entities, role, admin, invite }
}

const WORKOS_MESSAGES: Record<string, string> = {
  invited: 'invited via WorkOS',
  invitation_pending: 'invitation already pending',
  member_added: 'added to WorkOS organization',
  member_already: 'member of WorkOS organization already',
  membership_pending: 'invitation awaiting acceptance',
  skipped: 'WorkOS invitation skipped (--no-invite)',
  unconfigured: 'WorkOS env not set — no invitation sent',
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  try {
    const result = await onboardTeammate({
      email: args.email,
      name: args.name,
      entities: args.entities,
      role: args.role,
      isAdmin: args.admin ? true : undefined,
      invite: args.invite,
      grantedBy: 'script:team-onboard',
    })
    console.log(
      `${result.created ? 'created' : 'updated'}  ${args.email} (${result.userId})${args.admin ? ' [admin]' : ''}`,
    )
    for (const entity of result.grantedEntities) {
      console.log(`granted  ${entity} (${args.role})`)
    }
    console.log(
      `workos   ${WORKOS_MESSAGES[result.workos]}${
        result.invitationExpiresAt
          ? ` (expires ${result.invitationExpiresAt})`
          : ''
      }`,
    )
  } finally {
    const pool = await getDatabasePool()
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
