/**
 * Teammate onboarding core, shared by the CLI (`yarn team:onboard`) and the
 * in-app admin page (`addPortalUser`). One call handles both halves of
 * access atomically: the Postgres identity + entity grants (authorization)
 * and the WorkOS side (authentication) — an AuthKit invitation for new
 * people, or ID binding + organization membership for existing accounts.
 *
 * Idempotent: re-running updates the name/role/grants in place and never
 * double-invites.
 */

import { dbQuery } from '#/server/database'

const ORGANIZATION_ID = 'schedio'

export type OnboardInput = {
  email: string
  name: string
  /** Entity (client) IDs to grant. Omit/null to grant every org entity. */
  entities?: ReadonlyArray<string> | null
  role?: string
  /** Grants user-management access (the admin page). */
  isAdmin?: boolean
  /** Skip the WorkOS half entirely (Postgres grants only). */
  invite?: boolean
  /** Recorded on each grant row, e.g. `script:team-onboard` or `admin:tim`. */
  grantedBy: string
}

export type OnboardResult = {
  userId: string
  created: boolean
  grantedEntities: ReadonlyArray<string>
  /** What happened on the WorkOS side. */
  workos:
    | 'invited'
    | 'invitation_pending'
    | 'member_added'
    | 'member_already'
    | 'membership_pending'
    | 'skipped'
    | 'unconfigured'
  invitationExpiresAt?: string
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function onboardTeammate(
  input: OnboardInput,
): Promise<OnboardResult> {
  const email = input.email.trim().toLowerCase()
  const name = input.name.trim()
  const role = input.role ?? 'entity_owner'
  if (!email.includes('@')) throw new Error('A valid email is required')
  if (!name) throw new Error('A name is required')

  // Resolve target entities, defaulting to everything in the org.
  const known = await dbQuery<{ id: string }>(
    `select id from intelligence_clients where organization_id = $1 order by id`,
    [ORGANIZATION_ID],
  )
  const knownIds = known.rows.map((r) => r.id)
  const entities = [...(input.entities ?? knownIds)]
  if (entities.length === 0) throw new Error('Select at least one entity')
  const unknown = entities.filter((id) => !knownIds.includes(id))
  if (unknown.length > 0) {
    throw new Error(`Unknown entities: ${unknown.join(', ')}`)
  }

  // Upsert the user, keyed by email (the stable onboarding handle).
  const existing = await dbQuery<{ id: string }>(
    `select id from intelligence_users where lower(email) = $1`,
    [email],
  )
  let userId = existing.rows.at(0)?.id
  const created = !userId
  if (userId) {
    await dbQuery(
      `update intelligence_users
          set name = $2,
              role = $3,
              is_admin = coalesce($4, is_admin),
              updated_at = now()
        where id = $1`,
      [userId, name, role, input.isAdmin ?? null],
    )
  } else {
    const base = slugify(name) || email.split('@')[0]
    const taken = await dbQuery<{ id: string }>(
      `select id from intelligence_users where id like $1`,
      [`${base}%`],
    )
    const takenIds = new Set(taken.rows.map((r) => r.id))
    userId = base
    for (let n = 2; takenIds.has(userId); n++) userId = `${base}-${n}`
    await dbQuery(
      `insert into intelligence_users
         (id, organization_id, workos_user_id, email, name, role, is_admin)
       values ($1, $2, null, $3, $4, $5, $6)`,
      [userId, ORGANIZATION_ID, email, name, role, input.isAdmin ?? false],
    )
  }

  for (const clientId of entities) {
    await dbQuery(
      `insert into intelligence_user_client_access
         (organization_id, user_id, client_id, role, granted_by)
       values ($1, $2, $3, $4, $5)
       on conflict (user_id, client_id) do update set
         role = excluded.role,
         granted_by = excluded.granted_by,
         granted_at = now()`,
      [ORGANIZATION_ID, userId, clientId, role, input.grantedBy],
    )
  }

  const base: Omit<OnboardResult, 'workos'> = {
    userId,
    created,
    grantedEntities: entities,
  }

  if (input.invite === false) return { ...base, workos: 'skipped' }

  const apiKey = process.env.WORKOS_API_KEY
  const workosOrgId = process.env.WORKOS_ORGANIZATION_ID
  if (!apiKey || !workosOrgId) return { ...base, workos: 'unconfigured' }

  const { WorkOS } = await import('@workos-inc/node')
  const workos = new WorkOS(apiKey)

  // Already has an account (including the shell account WorkOS pre-creates
  // for a pending invitation): bind the WorkOS ID now and ensure membership
  // instead of inviting.
  const users = await workos.userManagement.listUsers({ email, limit: 1 })
  const workosUser = users.data.at(0)
  if (workosUser) {
    await dbQuery(
      `update intelligence_users
          set workos_user_id = $2, updated_at = now()
        where id = $1`,
      [userId, workosUser.id],
    )
    const memberships = await workos.userManagement.listOrganizationMemberships(
      {
        userId: workosUser.id,
        organizationId: workosOrgId,
        statuses: ['active', 'pending', 'inactive'],
      },
    )
    const membership = memberships.data.at(0)
    if (!membership) {
      await workos.userManagement.createOrganizationMembership({
        userId: workosUser.id,
        organizationId: workosOrgId,
      })
      return { ...base, workos: 'member_added' }
    }
    if (membership.status === 'pending') {
      return { ...base, workos: 'membership_pending' }
    }
    return { ...base, workos: 'member_already' }
  }

  const invitations = await workos.userManagement.listInvitations({
    organizationId: workosOrgId,
    limit: 100,
  })
  const pending = invitations.data.find(
    (inv) => inv.state === 'pending' && inv.email.toLowerCase() === email,
  )
  if (pending) {
    return {
      ...base,
      workos: 'invitation_pending',
      invitationExpiresAt: pending.expiresAt,
    }
  }
  const invitation = await workos.userManagement.sendInvitation({
    email,
    organizationId: workosOrgId,
  })
  return {
    ...base,
    workos: 'invited',
    invitationExpiresAt: invitation.expiresAt,
  }
}
