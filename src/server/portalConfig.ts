/**
 * Verification schedule + vendor contract config.
 *
 * Postgres is the source of truth (`dream_verifications` config columns and
 * `dream_vendors`), so Schedio can open/close cycles, move cutoffs, and add
 * contract authorizations with a SQL update instead of a redeploy. When no
 * database is configured (local dev, tests) the static `default*` seeds in
 * `src/lib/sg-dream.ts` are used unchanged.
 *
 * The Postgres store's init path seeds these rows on first boot
 * (`seedPortalConfig` in postgresStore.ts), so reads here are plain selects.
 */

import {
  buildNextVerification,
  clients,
  defaultVendors,
  defaultVerifications,
  formatCutoffLabel,
  formatRef,
} from '#/lib/sg-dream'
import type { Vendor, Verification } from '#/lib/sg-dream'
import { dbQuery } from '#/server/database'
import { isDatabaseConfigured } from '#/server/env'
import { getStore } from '#/server/store'

type VerificationConfigRow = {
  id: string
  client_id: string
  number: number
  year: number
  period: string
  cutoff_date: string
  status: string
  docs_count: number
  costs_submitted: string | number
  costs_verified: string | number
  ref_seq: number
  submitted_at: string | null
}

type VendorRow = {
  id: string
  client_id: string
  code: string
  name: string
  authorized: string | number
  contract_ref: string | null
  contract_executed_on: string | null
  contract_value: string | number | null
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function rowToVerification(row: VerificationConfigRow): Verification {
  const status =
    row.status === 'approved' || row.status === 'under_review'
      ? row.status
      : 'open'
  return {
    id: row.id,
    clientId: row.client_id,
    number: row.number,
    year: row.year,
    period: row.period,
    cutoffDate: formatCutoffLabel(row.cutoff_date),
    cutoffDateISO: row.cutoff_date,
    status,
    docsCount: row.docs_count,
    costsSubmitted: toNumber(row.costs_submitted),
    costsVerified: toNumber(row.costs_verified),
    seq: row.ref_seq,
    submittedAtISO: row.submitted_at ?? undefined,
  }
}

function rowToVendor(row: VendorRow): Vendor {
  return {
    id: row.id,
    clientId: row.client_id,
    code: row.code,
    name: row.name,
    authorized: toNumber(row.authorized),
    contract: row.contract_ref
      ? {
          refName: row.contract_ref,
          executedOn: row.contract_executed_on ?? '',
          value: toNumber(row.contract_value ?? row.authorized),
        }
      : undefined,
  }
}

/** Ensure schema + config seed rows exist before the first read. */
async function ensureStoreReady(): Promise<void> {
  await getStore().init()
}

export async function listVerificationConfigs(): Promise<
  ReadonlyArray<Verification>
> {
  if (!isDatabaseConfigured()) return defaultVerifications
  await ensureStoreReady()
  const result = await dbQuery<VerificationConfigRow>(
    `
      select
        v.id, v.client_id, v.number, v.year, v.period,
        to_char(v.cutoff_date, 'YYYY-MM-DD') as cutoff_date,
        v.status,
        -- The config column is seeded, never maintained by intake — overlay
        -- the live per-cycle document count so closed cycles report what was
        -- actually submitted (drives "View N docs" on /verifications).
        greatest(v.docs_count, coalesce(d.live_count, 0)) as docs_count,
        v.costs_submitted, v.costs_verified, v.ref_seq,
        to_char(v.submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          as submitted_at
      from dream_verifications v
      left join (
        select verification_id, count(*)::int as live_count
        from dream_documents
        group by verification_id
      ) d on d.verification_id = v.id
      where v.number is not null and v.cutoff_date is not null
      order by v.client_id, v.number
    `,
  )
  const fromDb = result.rows.map(rowToVerification)
  // A client with zero configured rows falls back to its static seed so a
  // half-seeded database can't render an entity with no schedule at all.
  const coveredClients = new Set(fromDb.map((v) => v.clientId))
  const fallback = defaultVerifications.filter(
    (v) =>
      !coveredClients.has(v.clientId) &&
      clients.some((c) => c.id === v.clientId),
  )
  return [...fromDb, ...fallback]
}

export async function getVerificationConfigById(
  verificationId: string,
): Promise<Verification | null> {
  const all = await listVerificationConfigs()
  return all.find((v) => v.id === verificationId) ?? null
}

export async function listVendorConfigs(): Promise<ReadonlyArray<Vendor>> {
  if (!isDatabaseConfigured()) return defaultVendors
  await ensureStoreReady()
  const result = await dbQuery<VendorRow>(
    `
      select
        id, client_id, code, name, authorized, contract_ref,
        to_char(contract_executed_on, 'YYYY-MM-DD') as contract_executed_on,
        contract_value
      from dream_vendors
      order by client_id, name
    `,
  )
  return result.rows.map(rowToVendor)
}

/**
 * Late-submission rollover: make sure the cycle after `current` exists and is
 * open, and retire `current` from the open state. Returns the destination
 * cycle, or `null` when no database is configured — static seeds can't roll,
 * so the cutoff stays advisory there.
 *
 * Idempotent and race-safe: the insert is `on conflict do nothing` and the
 * status update only touches a row still marked open, so concurrent late
 * uploads converge on the same next cycle.
 */
export async function ensureNextVerification(
  current: Verification,
): Promise<Verification | null> {
  if (!isDatabaseConfigured()) return null
  await ensureStoreReady()
  const next = buildNextVerification(current)
  const workflow =
    clients.find((c) => c.id === current.clientId)?.workflow ?? 'district_dp'
  const ref = formatRef({
    workflow,
    number: next.number,
    year: next.year,
    seq: next.seq,
  })
  await dbQuery(
    `
      insert into dream_verifications
        (id, client_id, ref, number, year, period, cutoff_date, status, ref_seq)
      values ($1, $2, $3, $4, $5, $6, $7, 'open', $8)
      on conflict (id) do nothing
    `,
    [
      next.id,
      next.clientId,
      ref,
      next.number,
      next.year,
      next.period,
      next.cutoffDateISO,
      next.seq,
    ],
  )
  await dbQuery(
    `
      update dream_verifications
      set status = 'under_review', updated_at = now()
      where id = $1 and status = 'open'
    `,
    [current.id],
  )
  // Read back so an already-existing next cycle (created by a concurrent
  // upload or edited by Schedio) wins over our locally built row.
  const persisted = await getVerificationConfigById(next.id)
  return persisted ?? next
}

/**
 * Today's date in the entity's timezone (Castle Rock, CO — America/Denver),
 * as `YYYY-MM-DD`. Cutoffs are Denver-local calendar dates, so countdown math
 * runs against Denver's "today" no matter where the server or browser sits.
 */
export function todayISOInDenver(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Denver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}
