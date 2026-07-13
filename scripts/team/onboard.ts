/**
 * One-command teammate onboarding: creates the Postgres identity + entity
 * grants and sends the WorkOS AuthKit invitation in a single step, so the
 * two halves of access (sign-in and authorization) can never drift apart.
 *
 * Idempotent — re-running updates the name/role/grants in place, skips a
 * pending invitation, and binds the WorkOS user ID immediately when the
 * person already has an account.
 *
 * Usage:
 *   yarn team:onboard <email> "<Full Name>" [--entities id1,id2] [--role r] [--no-invite]
 *
 * Defaults: every entity in the Schedio organization, role entity_owner.
 */

import { WorkOS } from '@workos-inc/node'

import { getDatabasePool } from '../../src/server/database'

const ORGANIZATION_ID = 'schedio'

type Args = {
  email: string
  name: string
  entities: Array<string> | null
  role: string
  invite: boolean
}

function parseArgs(argv: Array<string>): Args {
  const positional: Array<string> = []
  let entities: Array<string> | null = null
  let role = 'entity_owner'
  let invite = true
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--entities') {
      entities = (argv[++i] ?? '').split(',').filter(Boolean)
    } else if (arg === '--role') {
      role = argv[++i] ?? role
    } else if (arg === '--no-invite') {
      invite = false
    } else {
      positional.push(arg)
    }
  }
  const [email, name] = positional
  if (!email || !email.includes('@') || !name) {
    console.error(
      'Usage: yarn team:onboard <email> "<Full Name>" [--entities id1,id2] [--role entity_owner] [--no-invite]',
    )
    process.exit(1)
  }
  return {
    email: email.trim().toLowerCase(),
    name: name.trim(),
    entities,
    role,
    invite,
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const pool = await getDatabasePool()

  try {
    // Resolve target entities, defaulting to everything in the org.
    const known = await pool.query<{ id: string }>(
      `select id from intelligence_clients where organization_id = $1 order by id`,
      [ORGANIZATION_ID],
    )
    const knownIds = known.rows.map((r) => r.id)
    const entities = args.entities ?? knownIds
    const unknown = entities.filter((id) => !knownIds.includes(id))
    if (unknown.length > 0) {
      console.error(
        `Unknown entities: ${unknown.join(', ')}\nAvailable: ${knownIds.join(', ')}`,
      )
      process.exit(1)
    }

    // Upsert the user, keyed by email (the stable onboarding handle).
    const existing = await pool.query<{ id: string }>(
      `select id from intelligence_users where lower(email) = $1`,
      [args.email],
    )
    let userId = existing.rows[0]?.id
    if (userId) {
      await pool.query(
        `update intelligence_users
            set name = $2, role = $3, updated_at = now()
          where id = $1`,
        [userId, args.name, args.role],
      )
      console.log(`updated  ${args.email} (${userId})`)
    } else {
      const base = slugify(args.name)
      const taken = await pool.query<{ id: string }>(
        `select id from intelligence_users where id like $1`,
        [`${base}%`],
      )
      const takenIds = new Set(taken.rows.map((r) => r.id))
      userId = base
      for (let n = 2; takenIds.has(userId); n++) userId = `${base}-${n}`
      await pool.query(
        `insert into intelligence_users (id, organization_id, workos_user_id, email, name, role)
         values ($1, $2, null, $3, $4, $5)`,
        [userId, ORGANIZATION_ID, args.email, args.name, args.role],
      )
      console.log(`created  ${args.email} (${userId})`)
    }

    for (const clientId of entities) {
      await pool.query(
        `insert into intelligence_user_client_access
           (organization_id, user_id, client_id, role, granted_by)
         values ($1, $2, $3, $4, $5)
         on conflict (user_id, client_id) do update set
           role = excluded.role,
           granted_by = excluded.granted_by,
           granted_at = now()`,
        [ORGANIZATION_ID, userId, clientId, args.role, 'script:team-onboard'],
      )
      console.log(`granted  ${clientId} (${args.role})`)
    }

    if (!args.invite) {
      console.log('skipped  WorkOS invitation (--no-invite)')
      return
    }

    const apiKey = process.env.WORKOS_API_KEY
    const workosOrgId = process.env.WORKOS_ORGANIZATION_ID
    if (!apiKey || !workosOrgId) {
      console.warn(
        'WORKOS_API_KEY / WORKOS_ORGANIZATION_ID not set — Postgres grants applied, but no invitation was sent.',
      )
      return
    }
    const workos = new WorkOS(apiKey)

    // Already has an account: bind the WorkOS ID now and ensure membership
    // instead of inviting.
    const users = await workos.userManagement.listUsers({
      email: args.email,
      limit: 1,
    })
    const workosUser = users.data.at(0)
    if (workosUser) {
      await pool.query(
        `update intelligence_users
            set workos_user_id = $2, updated_at = now()
          where id = $1`,
        [userId, workosUser.id],
      )
      console.log(`bound    workos_user_id ${workosUser.id}`)
      // Include pending: an unaccepted invitation pre-creates the user with
      // a pending membership, and creating another membership then 400s.
      const memberships =
        await workos.userManagement.listOrganizationMemberships({
          userId: workosUser.id,
          organizationId: workosOrgId,
          statuses: ['active', 'pending', 'inactive'],
        })
      const membership = memberships.data.at(0)
      if (!membership) {
        await workos.userManagement.createOrganizationMembership({
          userId: workosUser.id,
          organizationId: workosOrgId,
        })
        console.log('added    to WorkOS organization')
      } else if (membership.status === 'pending') {
        console.log('pending  invitation awaiting acceptance')
      } else {
        console.log(`member   of WorkOS organization (${membership.status})`)
      }
      return
    }

    const invitations = await workos.userManagement.listInvitations({
      organizationId: workosOrgId,
      limit: 100,
    })
    const pending = invitations.data.find(
      (inv) =>
        inv.state === 'pending' && inv.email.toLowerCase() === args.email,
    )
    if (pending) {
      console.log(
        `pending  invitation already exists (expires ${pending.expiresAt})`,
      )
      return
    }
    const invitation = await workos.userManagement.sendInvitation({
      email: args.email,
      organizationId: workosOrgId,
    })
    console.log(`invited  ${args.email} (expires ${invitation.expiresAt})`)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
