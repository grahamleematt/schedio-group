/**
 * Staging preflight for the Tim intake demo. Read-only by default: it verifies
 * the target Postgres is the one we expect, that the access tables exist, and
 * that Tim's WorkOS identity maps to the two Dawson entities. pgvector is NOT
 * required — semantic recall is deferred (see db/intelligence/optional).
 *
 * Run after `yarn db:intelligence:migrate`:
 *   yarn db:intelligence:preflight
 *
 * To bind Tim's real WorkOS identity onto the seeded access row (uses
 * WORKOS_TIM_EMAIL and WORKOS_TIM_USER_ID), pass --bind-tim:
 *   yarn db:intelligence:preflight --bind-tim
 */

import { getDatabasePool } from '../../src/server/database'
import { getDatabaseEnv } from '../../src/server/env'

const REQUIRED_TABLES = [
  'intelligence_organizations',
  'intelligence_clients',
  'intelligence_users',
  'intelligence_user_client_access',
]

const EXPECTED_CLIENT_IDS = ['dawson-trails-md1', 'dawson-trails-md1-developer']

type Check = { label: string; ok: boolean; detail?: string }

function line(check: Check): string {
  const mark = check.ok ? 'PASS' : 'FAIL'
  return `  [${mark}] ${check.label}${check.detail ? ` — ${check.detail}` : ''}`
}

async function main(): Promise<number> {
  const bindTim = process.argv.slice(2).includes('--bind-tim')
  const timEmail = process.env.WORKOS_TIM_EMAIL?.trim()
  const timUserId = process.env.WORKOS_TIM_USER_ID?.trim()
  const checks: Array<Check> = []

  const dbEnv = getDatabaseEnv()
  const host = (() => {
    try {
      return new URL(dbEnv.DATABASE_URL).host
    } catch {
      return '<unparseable DATABASE_URL>'
    }
  })()
  console.log(`Preflight against Postgres host: ${host} (ssl: ${dbEnv.DATABASE_SSL})`)

  const pool = getDatabasePool()
  try {
    await pool.query('select 1')
    checks.push({ label: 'database connectivity', ok: true })

    const tables = await pool.query<{ table_name: string }>(
      `select table_name from information_schema.tables
        where table_schema = 'public' and table_name = any($1)`,
      [REQUIRED_TABLES],
    )
    const present = new Set(tables.rows.map((r) => r.table_name))
    for (const table of REQUIRED_TABLES) {
      checks.push({ label: `table ${table}`, ok: present.has(table) })
    }

    if (bindTim) {
      if (!timEmail) {
        checks.push({
          label: 'bind Tim identity',
          ok: false,
          detail: 'WORKOS_TIM_EMAIL is not set',
        })
      } else {
        await pool.query(
          `update intelligence_users
             set email = $1,
                 workos_user_id = coalesce($2, workos_user_id),
                 updated_at = now()
           where id = 'tim-mccarley'`,
          [timEmail, timUserId ?? null],
        )
        checks.push({
          label: 'bind Tim identity',
          ok: true,
          detail: `email=${timEmail}${timUserId ? `, workos_user_id=${timUserId}` : ''}`,
        })
      }
    }

    if (timEmail || timUserId) {
      const access = await pool.query<{ client_id: string; workos_user_id: string | null }>(
        `select a.client_id, u.workos_user_id
           from intelligence_users u
           join intelligence_user_client_access a on a.user_id = u.id
          where ($1::text is not null and u.workos_user_id = $1)
             or ($2::text is not null and lower(u.email) = lower($2))`,
        [timUserId ?? null, timEmail ?? null],
      )
      const clientIds = access.rows.map((r) => r.client_id).sort()
      const hasBoth = EXPECTED_CLIENT_IDS.every((id) => clientIds.includes(id))
      checks.push({
        label: 'Tim resolves to Dawson entity access',
        ok: access.rows.length > 0 && hasBoth,
        detail:
          access.rows.length === 0
            ? 'no access rows match WORKOS_TIM_EMAIL / WORKOS_TIM_USER_ID (run with --bind-tim)'
            : `entities: ${clientIds.join(', ')}`,
      })
      const boundToWorkos = access.rows.some((r) => r.workos_user_id)
      checks.push({
        label: 'Tim row bound to a WorkOS user id',
        ok: boundToWorkos,
        detail: boundToWorkos
          ? undefined
          : 'workos_user_id is null; set WORKOS_TIM_USER_ID and run --bind-tim',
      })
    } else {
      checks.push({
        label: 'WorkOS Tim identity env present',
        ok: false,
        detail: 'set WORKOS_TIM_EMAIL (and WORKOS_TIM_USER_ID) in the environment',
      })
    }
  } finally {
    await pool.end()
  }

  console.log('\nPreflight results:')
  for (const check of checks) console.log(line(check))
  const failed = checks.filter((c) => !c.ok)
  if (failed.length > 0) {
    console.error(`\n${failed.length} check(s) failed.`)
    return 1
  }
  console.log('\nAll preflight checks passed.')
  return 0
}

main()
  .then((code) => {
    process.exitCode = code
  })
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
