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
  clients,
  defaultVendors,
  defaultVerifications,
  formatCutoffLabel,
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
        id, client_id, number, year, period,
        to_char(cutoff_date, 'YYYY-MM-DD') as cutoff_date,
        status, docs_count, costs_submitted, costs_verified, ref_seq
      from dream_verifications
      where number is not null and cutoff_date is not null
      order by client_id, number
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
