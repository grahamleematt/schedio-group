/**
 * SG DREAM — customer intake configuration.
 *
 * The customer-facing app is intentionally Dawson-only for Tim's first real
 * test. Uploaded files and pipeline state come from the server store, and the
 * verification schedule + vendor contract authorizations live in Postgres
 * (loaded through `getPortalConfig`). This module supplies stable entity,
 * workflow, and naming configuration, the `default*` seeds used when no
 * database is configured, and the pure helpers shared by client and server.
 */

import type { ExtractedFields } from '#/server/store'

export type Workflow = 'district_dp' | 'developer_reimb'

type WorkflowConfig = {
  id: Workflow
  label: string
  shortLabel: string
  refPrefix: 'SGD-DP' | 'SGD-DR'
  dashboardKind: 'stacked' | 'single'
  bannerCopy: string
}

export const workflowConfigs: Record<Workflow, WorkflowConfig> = {
  district_dp: {
    id: 'district_dp',
    label: 'District Direct Pay',
    shortLabel: 'Direct Pay',
    refPrefix: 'SGD-DP',
    dashboardKind: 'stacked',
    bannerCopy:
      'Pay apps and invoices are submitted here for Schedio Group approval and direct payment.',
  },
  developer_reimb: {
    id: 'developer_reimb',
    label: 'Developer Reimbursement',
    shortLabel: 'Reimbursement',
    refPrefix: 'SGD-DR',
    dashboardKind: 'single',
    bannerCopy:
      'Costs are submitted here for public reimbursement through the district.',
  },
}

export type DocType =
  | 'CTR' // Contract
  | 'TO' // Task Order
  | 'CO' // Change Order
  | 'PA' // Pay Application
  | 'INV' // Invoice
  | 'POP' // Proof of Payment
  | 'LSP' // Land Survey Plat
  | 'CD' // Construction Drawing
  | 'UNK' // Uncategorized

export const docTypeLabels: Record<DocType, string> = {
  CTR: 'Contracts',
  TO: 'Task Orders',
  CO: 'Change Orders',
  PA: 'Pay Applications',
  INV: 'Invoices',
  POP: 'Proofs of Payment',
  LSP: 'Land Survey Plats',
  CD: 'Construction Drawings',
  UNK: 'Uncategorized',
}

export const docTypeOrder: ReadonlyArray<DocType> = [
  'CTR',
  'TO',
  'CO',
  'PA',
  'INV',
  'POP',
  'LSP',
  'CD',
] as const

export type Client = {
  id: string
  code: string // 3-char client code for naming convention
  name: string
  workflow: Workflow
  egnyteRootPath?: string
  entityOwnerName: string
  region: string
  status: 'active' | 'pending_approval'
}

export const DEFAULT_CLIENT_ID = 'dawson-trails-md1'
export const DEFAULT_VERIFICATION_ID = 'dawson-trails-md1-v1'
export const CUSTOMER_INTAKE_CLIENT_IDS = [
  'dawson-trails-md1',
  'dawson-trails-md1-developer',
] as const

export const clients: ReadonlyArray<Client> = [
  {
    id: 'dawson-trails-md1',
    code: 'DT1',
    name: 'Dawson Trails MD One - District',
    workflow: 'district_dp',
    egnyteRootPath: '/Shared/Clients/Dawson Trails MD One/District',
    entityOwnerName: 'Tim',
    region: 'Castle Rock, CO',
    status: 'active',
  },
  {
    id: 'dawson-trails-md1-developer',
    code: 'DTD',
    name: 'Dawson Trails MD One - Developer',
    workflow: 'developer_reimb',
    egnyteRootPath: '/Shared/Clients/Dawson Trails MD One/Developer',
    entityOwnerName: 'Tim',
    region: 'Castle Rock, CO',
    status: 'active',
  },
]

type GhostEntity = {
  id: string
  code: string
  name: string
  workflow: Workflow
  region: string
}

export const ghostDeveloperEntities: ReadonlyArray<GhostEntity> = []

export type User = {
  id: string
  initials: string
  name: string
  email: string
  role: 'entity_owner' | 'client_mgr' | 'client_viewer'
  permittedClientIds: ReadonlyArray<string>
  /** Grants the Users & access admin page (invite/manage teammates). */
  canManageUsers: boolean
}

export const currentUser: User = {
  id: 'tim-mccarley',
  initials: 'TM',
  name: 'Tim McCarley',
  email: 'tim.mccarley@schedio.example',
  role: 'entity_owner',
  permittedClientIds: CUSTOMER_INTAKE_CLIENT_IDS,
  // The seeded persona is Tim, who administers the team.
  canManageUsers: true,
}

type VerificationStatus = 'open' | 'under_review' | 'approved'

export type Verification = {
  id: string
  clientId: string
  number: number
  year: number
  period: string
  cutoffDate: string // display-friendly, e.g., 'Apr 24, 2026'
  cutoffDateISO: string // ISO date for countdown math, e.g., '2026-04-24'
  status: VerificationStatus
  docsCount: number
  costsSubmitted: number
  costsVerified: number // 0 until approved
  seq: number // last-used doc sequence used for ref generation
}

/**
 * Seed verification schedule. The live schedule is stored in Postgres
 * (`dream_verifications` config columns) and edited there as cycles open and
 * close; these rows are the first-boot seed and the fallback when no database
 * is configured (local dev / tests).
 */
export const defaultVerifications: ReadonlyArray<Verification> = [
  {
    id: 'dawson-trails-md1-v1',
    clientId: 'dawson-trails-md1',
    number: 1,
    year: 2026,
    period: 'Verification No. 01',
    cutoffDate: 'Aug 03, 2026',
    cutoffDateISO: '2026-08-03',
    status: 'open',
    docsCount: 0,
    costsSubmitted: 0,
    costsVerified: 0,
    seq: 1,
  },
  {
    id: 'dawson-trails-md1-developer-v1',
    clientId: 'dawson-trails-md1-developer',
    number: 1,
    year: 2026,
    period: 'Developer Reimbursement No. 01',
    cutoffDate: 'Aug 03, 2026',
    cutoffDateISO: '2026-08-03',
    status: 'open',
    docsCount: 0,
    costsSubmitted: 0,
    costsVerified: 0,
    seq: 1,
  },
]

export type DuplicateFlag = 'none' | 'exact' | 'likely'

export type Document = {
  id: string
  verificationId: string
  /** Owning entity — present on documents adapted from the server store. */
  clientId?: string
  sourceKind?: 'upload' | 'egnyte_import'
  docType: DocType
  vendor: string // 4-char vendor code
  vendorName: string
  originalName: string
  renamedName: string
  amount: number
  seq: number
  duplicateFlag: DuplicateFlag
  matchedPreviousName?: string
  matchedVerificationRef?: string
  /** Optional custody + trust metadata, surfaced by the server when available. */
  egnyteWebUrl?: string
  egnyteClassifiedPath?: string
  /** Destination Egnyte path computed at analysis time, before filing. */
  egnytePlannedPath?: string
  egnyteSourcePath?: string
  egnyteIncomingPath?: string
  egnyteEntryId?: string
  egnyteGroupId?: string
  custodyState?:
    | 'incoming'
    | 'processing'
    | 'ready'
    | 'classified'
    | 'relied'
    | 'locked'
  /** DocuPipe Review object ID; powers the on-demand overlay viewer link. */
  docupipeReviewId?: string
  fieldConfidence?: Record<string, number>
  lowConfidence?: boolean
  /** Lifecycle status mirrored from the server `StoredDocument`. */
  status?: 'queued' | 'classifying' | 'standardizing' | 'completed' | 'error'
  /** First failure message when `status === 'error'`. */
  errorMessage?: string
  /** ISO timestamp of when the upload landed on the server. */
  uploadedAt?: string
  /**
   * The full DocuPipe extraction (vendor, amount, dates, document number,
   * contract reference, and the PA payment waterfall). Carried through from
   * the server `StoredDocument` so the processing view can surface the
   * detail and validate pay-app math rather than showing the headline amount
   * alone.
   */
  extractedFields?: ExtractedFields
}

const DEFAULT_RENAMED_YEAR = 2026

/**
 * Build the canonical SG DREAM renamed filename for a verified document.
 * Exported so the server-side webhook can rename the file identically
 * before promoting it from Egnyte Incoming/ to Classified/.
 *
 * @param year — verification year. The webhook should always pass
 *   `verification.year` explicitly.
 */
export function renamed(
  clientCode: string,
  vNumber: number,
  docType: DocType,
  vendor: string,
  seq: number,
  year: number = DEFAULT_RENAMED_YEAR,
  ext = 'pdf',
) {
  const v = `V${String(vNumber).padStart(3, '0')}`
  const s = String(seq).padStart(3, '0')
  return `SG-${clientCode}-${v}-${docType}-${vendor}-${year}-${s}.${ext}`
}

export const documents: ReadonlyArray<Document> = []

type ContractMSA = {
  refName: string
  /** ISO `YYYY-MM-DD` execution date; format with `formatCutoffLabel`. */
  executedOn: string
  value: number
}

export type Vendor = {
  id: string
  code: string
  name: string
  clientId: string
  /**
   * Contract authorization ceiling (SG-entered from the executed MSA). This is
   * not derivable from DocuPipe — it comes from the contract itself — so it
   * stays configured. Spend is computed live from filed documents; see
   * `liveSpendByVendor`.
   */
  authorized: number
  contract?: ContractMSA
}

/**
 * Seed vendor contract authorizations for the District Direct Pay entity
 * (DT1). The live rows are stored in Postgres (`dream_vendors`) and edited
 * there as contracts are executed or amended; this list is the first-boot
 * seed and the fallback when no database is configured.
 *
 * Vendor identities and `code` here match the live DocuPipe extractions on
 * DT1's filed documents (Classic SRJ pay apps, A.G. Wassenaar task orders),
 * so spend computed from those documents attributes to the right contract.
 * `code` must equal `vendorCode(extractedFields.vendorName)` — the same 4-char
 * derivation the adapter applies — for the live join to land.
 *
 * `authorized` is the configured MSA ceiling; `spent` is NOT stored here — it
 * is summed live from each vendor's invoices + pay-apps. Developer
 * Reimbursement (DTD) carries no vendor contracts; its dashboard renders the
 * single-column layout.
 */
export const defaultVendors: ReadonlyArray<Vendor> = [
  {
    id: 'dt1-classic',
    code: 'CLAS',
    name: 'Classic SRJ, LLC',
    clientId: 'dawson-trails-md1',
    authorized: 1_350_000,
    contract: {
      refName: 'MSA-2024-CLAS',
      executedOn: '2024-01-12',
      value: 1_350_000,
    },
  },
  {
    id: 'dt1-wassenaar',
    code: 'AGWA',
    name: 'A.G. Wassenaar, Inc.',
    clientId: 'dawson-trails-md1',
    authorized: 850_000,
    contract: {
      refName: 'MSA-2024-AGWA',
      executedOn: '2024-03-03',
      value: 850_000,
    },
  },
]

// ---- Helpers ----

export function getClientById(clientId: string | undefined): Client {
  return clients.find((c) => c.id === clientId) ?? clients[0]
}

export function getKnownClientById(
  clientId: string | undefined,
): Client | null {
  return clients.find((c) => c.id === clientId) ?? null
}

export function getVerificationsByClient(
  verifications: ReadonlyArray<Verification>,
  clientId: string,
) {
  return verifications
    .filter((v) => v.clientId === clientId)
    .sort((a, b) => b.number - a.number)
}

export function getOpenVerification(
  verifications: ReadonlyArray<Verification>,
  clientId: string,
): Verification {
  const all = getVerificationsByClient(verifications, clientId)
  return all.find((v) => v.status === 'open') ?? all[0]
}

/**
 * Lookup a verification by id, optionally guarded by `clientId` to prevent
 * URL drift between entities. Returns `null` when the verification belongs
 * to a different client than `clientId`; callers should handle this by
 * redirecting to the requested client's open verification.
 *
 * Without `clientId`, this is the legacy lookup that just falls back to
 * `verifications[0]` — kept for the few internal callers that already know
 * the client out-of-band.
 */
export function getVerificationById(
  verifications: ReadonlyArray<Verification>,
  verificationId: string | undefined,
  clientId?: string,
): Verification | null {
  const found = verifications.find((v) => v.id === verificationId)
  if (!found) {
    return clientId ? null : verifications[0]
  }
  if (clientId && found.clientId !== clientId) return null
  return found
}

export function getVendorsByClient(
  vendors: ReadonlyArray<Vendor>,
  clientId: string,
) {
  return vendors.filter((v) => v.clientId === clientId)
}

export function getDuplicateCounts(docs: ReadonlyArray<Document>) {
  const exact = docs.filter((d) => d.duplicateFlag === 'exact').length
  const likely = docs.filter((d) => d.duplicateFlag === 'likely').length
  return { exact, likely, total: exact + likely }
}

type UtilizationBand = 'healthy' | 'monitor' | 'amend'

function getUtilizationBand(pct: number): UtilizationBand {
  if (pct >= 90) return 'amend'
  if (pct >= 70) return 'monitor'
  return 'healthy'
}

/**
 * Sum live contract spend per 4-char vendor code from filed documents. Only
 * invoices (`INV`) and pay-apps (`PA`) are claim dollars drawn against a
 * contract; task orders, change orders, contracts, proofs of payment, and
 * lien waivers are authorization or evidence, not spend — matching the same
 * rule `liveVerificationTotals` uses so contract spend and "costs submitted"
 * stay consistent.
 */
export function liveSpendByVendor(
  docs: ReadonlyArray<Document>,
): Map<string, number> {
  const byCode = new Map<string, number>()
  for (const doc of docs) {
    if (doc.docType !== 'INV' && doc.docType !== 'PA') continue
    const amount = doc.amount
    if (!amount) continue
    byCode.set(doc.vendor, (byCode.get(doc.vendor) ?? 0) + amount)
  }
  return byCode
}

export function computeVendorUtilization(vendor: Vendor, spent: number) {
  const remaining = Math.max(0, vendor.authorized - spent)
  const pct =
    vendor.authorized > 0 ? Math.min(100, (spent / vendor.authorized) * 100) : 0
  return {
    spent,
    remaining,
    pct,
    band: getUtilizationBand(pct),
  }
}

export function computeContractSummary(
  vendors: ReadonlyArray<Vendor>,
  clientId: string,
  spendByVendor: Map<string, number>,
) {
  const v = getVendorsByClient(vendors, clientId)
  const authorized = v.reduce((s, x) => s + x.authorized, 0)
  const spent = v.reduce((s, x) => s + (spendByVendor.get(x.code) ?? 0), 0)
  const remaining = Math.max(0, authorized - spent)
  const pct = authorized > 0 ? (spent / authorized) * 100 : 0
  return { authorized, spent, remaining, pct }
}

export function formatRef(input: {
  workflow: Workflow
  number: number
  year: number
  seq: number
}) {
  const prefix = workflowConfigs[input.workflow].refPrefix
  const seq = String(input.seq).padStart(4, '0')
  return `${prefix}-V${input.number}-${input.year}-${seq}`
}

/**
 * Prefer the live Schedio-assigned ref off the snapshot; otherwise rebuild
 * from the configured verification sequence. Centralised so /processing,
 * /dashboard, /confirmation, and the AppShell topbar all show the same value.
 */
export function displayRef(input: {
  snapshotRef?: string | null
  client: Client
  verification: Verification
}) {
  if (input.snapshotRef) return input.snapshotRef
  return formatRef({
    workflow: input.client.workflow,
    number: input.verification.number,
    year: input.verification.year,
    seq: input.verification.seq,
  })
}

export function displaySubmissionCycle(verification: Verification): string {
  const n = String(verification.number).padStart(2, '0')
  if (/developer reimbursement/i.test(verification.period)) {
    return `Reimbursement cycle ${n}`
  }
  return `Review cycle ${n}`
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatCurrencyPrecise(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatPercent(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`
}

/**
 * Format a DocuPipe `YYYY-MM-DD` date for display. Returns the raw string for
 * any value that isn't a clean ISO date so we never hide unexpected data.
 */
export function formatDocDate(value: string | undefined): string | undefined {
  if (!value) return undefined
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!m) return value
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ---- DocuPipe extraction display helpers ----

/**
 * Client-side mirror of the server's `LOW_CONFIDENCE_THRESHOLD`
 * (src/server/docupipe.ts). Duplicated as a plain constant so this
 * client-imported module never pulls in server runtime code.
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.85

/**
 * Human labels for the snake_case field keys DocuPipe returns (and that the
 * webhook stores in `fieldConfidence`). Used to render which fields tripped
 * the low-confidence threshold.
 */
export const extractedFieldLabels: Record<string, string> = {
  vendor_name: 'Vendor',
  vendor_id_guess: 'Vendor ID',
  document_number: 'Document #',
  amount: 'Amount',
  current_payment_due: 'Current payment due',
  contract_sum_to_date: 'Contract sum to date',
  completed_and_stored_to_date: 'Completed & stored',
  retainage: 'Retainage',
  total_earned_less_retainage: 'Earned less retainage',
  less_previous_payments: 'Less previous payments',
  balance_to_finish: 'Balance to finish',
  currency: 'Currency',
  document_date: 'Document date',
  period_start: 'Period start',
  period_end: 'Period end',
  contract_reference: 'Contract ref',
  po_number: 'PO #',
  line_item_count: 'Line items',
}

export type LowConfidenceField = {
  key: string
  label: string
  score: number
}

/**
 * The extracted fields that scored below the review threshold, lowest first.
 * Turns the single `lowConfidence` boolean into the actionable "which fields
 * need a human" list.
 */
export function lowConfidenceFields(
  fieldConfidence: Record<string, number> | undefined,
  threshold = LOW_CONFIDENCE_THRESHOLD,
): ReadonlyArray<LowConfidenceField> {
  if (!fieldConfidence) return []
  return Object.entries(fieldConfidence)
    .filter(([, score]) => typeof score === 'number' && score < threshold)
    .map(([key, score]) => ({
      key,
      label: extractedFieldLabels[key] ?? key,
      score,
    }))
    .sort((a, b) => a.score - b.score)
}

export type PayAppCheck = {
  /**
   * - `ok`           — Current Payment Due matches the G702 math within tolerance
   * - `mismatch`     — the headline amount disagrees with the waterfall
   * - `unverifiable` — the waterfall lines needed to check are missing
   */
  status: 'ok' | 'mismatch' | 'unverifiable'
  /** Total Earned Less Retainage (Line 6) − Less Previous Payments (Line 7). */
  expected?: number
  /** Current Payment Due (Line 11), i.e. the headline `amount`. */
  actual?: number
  /** `actual − expected`. */
  delta?: number
}

/**
 * Validate a pay application's headline amount (G702 Line 11, Current Payment
 * Due) against the rest of the captured waterfall:
 *
 *   Current Payment Due = Total Earned Less Retainage − Less Previous Payments
 *
 * A missing `lessPreviousPayments` is treated as 0 (the schema returns null
 * for a first application). Tolerance is the greater of $1 or 0.5% to absorb
 * rounding in the source document.
 */
export function validatePayApp(
  fields: ExtractedFields | undefined,
): PayAppCheck {
  const actual = fields?.amount
  const earned = fields?.totalEarnedLessRetainage
  if (typeof actual !== 'number' || typeof earned !== 'number') {
    return { status: 'unverifiable', actual }
  }
  const prev =
    typeof fields?.lessPreviousPayments === 'number'
      ? fields.lessPreviousPayments
      : 0
  const expected = earned - prev
  const delta = actual - expected
  const tolerance = Math.max(1, Math.abs(expected) * 0.005)
  return {
    status: Math.abs(delta) <= tolerance ? 'ok' : 'mismatch',
    expected,
    actual,
    delta,
  }
}

/**
 * The captured PA waterfall lines, in G702 order, with only the present
 * numeric values. Drives the waterfall mini-table on the processing view.
 */
export function payAppWaterfall(
  fields: ExtractedFields | undefined,
): ReadonlyArray<{ label: string; value: number }> {
  if (!fields) return []
  const rows: ReadonlyArray<{ label: string; value: number | undefined }> = [
    { label: 'Contract sum to date', value: fields.contractSumToDate },
    { label: 'Completed & stored', value: fields.completedAndStoredToDate },
    { label: 'Retainage', value: fields.retainage },
    { label: 'Earned less retainage', value: fields.totalEarnedLessRetainage },
    { label: 'Less previous payments', value: fields.lessPreviousPayments },
    { label: 'Balance to finish', value: fields.balanceToFinish },
  ]
  return rows.filter(
    (r): r is { label: string; value: number } => typeof r.value === 'number',
  )
}

/**
 * Derive up-to-two-letter initials from a display name. UI-side safety net for
 * the avatar: the server computes initials when it resolves a user, but the
 * non-DB auth fallback path overrides the name without recomputing initials,
 * so components derive from the name they actually render. Falls back to a
 * neutral dash when the name is empty rather than rendering a blank circle.
 */
export function initialsFromName(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0) return '—'
  return parts
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

export function getStatusLabel(status: VerificationStatus): string {
  switch (status) {
    case 'approved':
      return 'Approved'
    case 'under_review':
      return 'Under Review'
    case 'open':
      return 'Open'
  }
}

export type DocTypeSummary = {
  docType: DocType
  label: string
  count: number
  flaggedCount: number
}

export function summarizeDocTypes(
  docs: ReadonlyArray<Document>,
): ReadonlyArray<DocTypeSummary> {
  return docTypeOrder.map((docType) => {
    const inType = docs.filter((d) => d.docType === docType)
    return {
      docType,
      label: docTypeLabels[docType],
      count: inType.length,
      flaggedCount: inType.filter((d) => d.duplicateFlag !== 'none').length,
    }
  })
}

// ---- Countdown helpers ----
// `daysUntilCutoff` powers the cutoff "days left" pills on /dashboard and
// /verifications. `todayISO` is required and comes from the portal config
// (computed once server-side in the entity's timezone) so SSR and hydration
// agree on the same "today" instead of each racing its own clock.

function isoDateToUtcMs(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return Number.NaN
  return Date.UTC(year, month - 1, day)
}

export function daysUntilCutoff(
  cutoffDateISO: string,
  todayISO: string,
): number {
  const target = isoDateToUtcMs(cutoffDateISO)
  const today = isoDateToUtcMs(todayISO)
  if (Number.isNaN(target) || Number.isNaN(today)) return 0
  return Math.round((target - today) / (1000 * 60 * 60 * 24))
}

/**
 * Format an ISO `YYYY-MM-DD` cutoff into the display label used across the
 * schedule surfaces (e.g. `Aug 03, 2026`). UTC-parsed so the label never
 * shifts a day across timezones.
 */
export function formatCutoffLabel(iso: string): string {
  const ms = isoDateToUtcMs(iso)
  if (Number.isNaN(ms)) return iso
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Late means strictly after the cutoff date — files landing on the cutoff
 * day itself still make the cycle. Keep every surface (countdown pills,
 * upload gating, rollover) on this one boundary.
 */
export function isPastCutoff(cutoffDateISO: string, todayISO: string): boolean {
  return daysUntilCutoff(cutoffDateISO, todayISO) < 0
}

/** Same calendar day next month, clamped to the shorter month's last day
 * (Jan 31 → Feb 28/29). Verifications recur monthly. */
export function addOneMonthISO(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  const lastDayOfNextMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const next = new Date(Date.UTC(year, month, Math.min(day, lastDayOfNextMonth)))
  return next.toISOString().slice(0, 10)
}

/** "Verification No. 01" → "Verification No. 02"; pads to the source width. */
function incrementPeriodLabel(period: string, nextNumber: number): string {
  const match = /(\d+)\s*$/.exec(period)
  if (!match) {
    return `${period} ${String(nextNumber).padStart(2, '0')}`
  }
  const width = Math.max(match[1].length, 2)
  return period.slice(0, match.index) + String(nextNumber).padStart(width, '0')
}

/**
 * The cycle a late submission rolls into: next number, cutoff one month out,
 * fresh totals. Pure so the server can persist it (`ensureNextVerification`)
 * and the upload page can preview the destination cycle before it exists.
 */
export function buildNextVerification(current: Verification): Verification {
  const number = current.number + 1
  const cutoffDateISO = addOneMonthISO(current.cutoffDateISO)
  return {
    id: `${current.clientId}-v${number}`,
    clientId: current.clientId,
    number,
    year: Number(cutoffDateISO.slice(0, 4)) || current.year,
    period: incrementPeriodLabel(current.period, number),
    cutoffDate: formatCutoffLabel(cutoffDateISO),
    cutoffDateISO,
    status: 'open',
    docsCount: 0,
    costsSubmitted: 0,
    costsVerified: 0,
    seq: 1,
  }
}

/* ───────────────────────────── Users & access ───────────────────────────── */

export type AccessRole =
  | 'sg_admin'
  | 'sg_pm'
  | 'entity_owner'
  | 'client_mgr'
  | 'client_viewer'

export const accessRoleLabels: Record<AccessRole, string> = {
  sg_admin: 'SG Admin',
  sg_pm: 'SG PM',
  entity_owner: 'Entity Owner',
  client_mgr: 'Client Mgr',
  client_viewer: 'Client Viewer',
}

export type MfaState = 'enabled' | 'not_set'

export type ActiveUser = {
  id: string
  initials: string
  name: string
  email: string
  role: AccessRole
  entityCodes: ReadonlyArray<string>
  mfa: MfaState
  lastSignInLabel: string
  isYou?: boolean
}

/* ───────────────────────────── Audit log ───────────────────────────── */

export type AuditCategory = 'auth' | 'documents' | 'verifications' | 'access'

export type AuditResult = 'ok' | 'override' | 'flagged' | 'pending' | 'failed'

export const auditResultLabels: Record<AuditResult, string> = {
  ok: 'OK',
  override: 'Override',
  flagged: 'Flagged',
  pending: 'Pending',
  failed: 'Failed',
}

export type AuditEvent = {
  id: string
  timeLabel: string
  clientId: string
  actor: string
  event: string
  object: string
  result: AuditResult
  ip: string
  category: AuditCategory
}

export const auditEvents: ReadonlyArray<AuditEvent> = []
