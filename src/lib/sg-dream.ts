/**
 * SG DREAM — customer intake configuration.
 *
 * The customer-facing app is intentionally Dawson-only for Tim's first real
 * test. Uploaded files and pipeline state come from the server store; this
 * module only supplies stable entity, workflow, and naming configuration.
 */

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
}

export const currentUser: User = {
  id: 'tim-mccarley',
  initials: 'TM',
  name: 'Tim McCarley',
  email: 'tim.mccarley@schedio.example',
  role: 'entity_owner',
  permittedClientIds: CUSTOMER_INTAKE_CLIENT_IDS,
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
  workAuthValue: number
  seq: number // last-used doc sequence used for ref generation
}

const verificationSeeds: ReadonlyArray<Verification> = [
  {
    id: 'dawson-trails-md1-v1',
    clientId: 'dawson-trails-md1',
    number: 1,
    year: 2026,
    period: 'Verification No. 01',
    cutoffDate: 'May 04, 2026',
    cutoffDateISO: '2026-05-04',
    status: 'open',
    docsCount: 0,
    costsSubmitted: 0,
    costsVerified: 0,
    workAuthValue: 0,
    seq: 1,
  },
  {
    id: 'dawson-trails-md1-developer-v1',
    clientId: 'dawson-trails-md1-developer',
    number: 1,
    year: 2026,
    period: 'Developer Reimbursement No. 01',
    cutoffDate: 'May 04, 2026',
    cutoffDateISO: '2026-05-04',
    status: 'open',
    docsCount: 0,
    costsSubmitted: 0,
    costsVerified: 0,
    workAuthValue: 0,
    seq: 1,
  },
]

export const verifications: ReadonlyArray<Verification> =
  verificationSeeds.filter((verification) =>
    currentUser.permittedClientIds.includes(verification.clientId),
  )

export type DuplicateFlag = 'none' | 'exact' | 'likely'

export type Document = {
  id: string
  verificationId: string
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
  egnyteSourcePath?: string
  egnyteIncomingPath?: string
  egnyteEntryId?: string
  egnyteGroupId?: string
  custodyState?: 'incoming' | 'processing' | 'classified' | 'relied' | 'locked'
  visualReviewUrl?: string
  fieldConfidence?: Record<string, number>
  lowConfidence?: boolean
  /** Lifecycle status mirrored from the server `StoredDocument`. */
  status?: 'queued' | 'classifying' | 'standardizing' | 'completed' | 'error'
  /** First failure message when `status === 'error'`. */
  errorMessage?: string
  /** ISO timestamp of when the upload landed on the server. */
  uploadedAt?: string
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

export type TaskOrder = {
  id: string
  phase: string
  number: string // e.g., 'WO 05', 'WO01'
  value: number
  referencedByInvoice?: boolean
}

export type ChangeOrder = {
  id: string
  number: string // e.g., 'CO-001'
  value: number
}

type ContractMSA = {
  refName: string
  executedOn: string
  value: number
}

export type Vendor = {
  id: string
  code: string
  name: string
  clientId: string
  authorized: number
  spent: number
  contract?: ContractMSA
  taskOrders?: ReadonlyArray<TaskOrder>
  changeOrders?: ReadonlyArray<ChangeOrder>
}

export const vendors: ReadonlyArray<Vendor> = []

// ---- Helpers ----

export function getClientById(clientId: string | undefined): Client {
  return clients.find((c) => c.id === clientId) ?? clients[0]
}

export function getKnownClientById(
  clientId: string | undefined,
): Client | null {
  return clients.find((c) => c.id === clientId) ?? null
}

export function getVerificationsByClient(clientId: string) {
  return verifications
    .filter((v) => v.clientId === clientId)
    .sort((a, b) => b.number - a.number)
}

export function getOpenVerification(clientId: string): Verification {
  const all = getVerificationsByClient(clientId)
  return all.find((v) => v.status === 'open') ?? all[0]
}

/**
 * Lookup a verification by id, optionally guarded by `clientId` to prevent
 * URL drift between entities. Returns `null` when the verification belongs
 * to a different client than `clientId`; callers should handle this by
 * redirecting to the requested client's open verification.
 *
 * Without `clientId`, this is the legacy lookup that just falls back to
 * `verifications[0]` — kept for the few internal callers (e.g. the upload
 * server fn) that already know the client out-of-band.
 */
export function getVerificationById(
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

export function getDocumentsByVerification(verificationId: string) {
  return documents.filter((d) => d.verificationId === verificationId)
}

export function getDocumentById(documentId: string | undefined) {
  if (!documentId) return undefined
  return documents.find((d) => d.id === documentId)
}

export function getVendorsByClient(clientId: string) {
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

export function computeVendorUtilization(vendor: Vendor) {
  const remaining = Math.max(0, vendor.authorized - vendor.spent)
  const pct =
    vendor.authorized > 0
      ? Math.min(100, (vendor.spent / vendor.authorized) * 100)
      : 0
  return {
    remaining,
    pct,
    band: getUtilizationBand(pct),
  }
}

export function computeContractSummary(clientId: string) {
  const v = getVendorsByClient(clientId)
  const authorized = v.reduce((s, x) => s + x.authorized, 0)
  const spent = v.reduce((s, x) => s + x.spent, 0)
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

// ---- Countdown helpers (used by CutoffCountdown) ----

export type CutoffUrgency = 'healthy' | 'warning' | 'critical' | 'passed'

const MOCKUP_TODAY_ISO = '2026-04-16'

function isoDateToUtcMs(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return Number.NaN
  return Date.UTC(year, month - 1, day)
}

export function daysUntilCutoff(
  cutoffDateISO: string,
  todayISO = MOCKUP_TODAY_ISO,
): number {
  const target = isoDateToUtcMs(cutoffDateISO)
  const today = isoDateToUtcMs(todayISO)
  if (Number.isNaN(target) || Number.isNaN(today)) return 0
  return Math.round((target - today) / (1000 * 60 * 60 * 24))
}

export function computeCutoffUrgency(cutoffDateISO: string): {
  daysLeft: number
  urgency: CutoffUrgency
} {
  const daysLeft = daysUntilCutoff(cutoffDateISO)

  let urgency: CutoffUrgency
  if (daysLeft < 0) urgency = 'passed'
  else if (daysLeft <= 3) urgency = 'critical'
  else if (daysLeft <= 7) urgency = 'warning'
  else urgency = 'healthy'

  return { daysLeft, urgency }
}

// ---- Task-order / change-order helpers ----

type PhaseGroup = {
  phase: string
  taskOrders: ReadonlyArray<TaskOrder>
  total: number
}

export function groupTaskOrdersByPhase(
  taskOrders: ReadonlyArray<TaskOrder>,
): ReadonlyArray<PhaseGroup> {
  const byPhase = new Map<string, Array<TaskOrder>>()
  for (const to of taskOrders) {
    const existing = byPhase.get(to.phase)
    if (existing) existing.push(to)
    else byPhase.set(to.phase, [to])
  }
  const phaseOrder: ReadonlyArray<string> = [
    'F2',
    'F3',
    'F3B',
    'F4A',
    'F5',
    'F6',
    'F7',
    'FG',
  ]
  const entries = [...byPhase.entries()].sort((a, b) => {
    const ia = phaseOrder.indexOf(a[0])
    const ib = phaseOrder.indexOf(b[0])
    if (ia === -1 && ib === -1) return a[0].localeCompare(b[0])
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
  return entries.map(([phase, orders]) => ({
    phase,
    taskOrders: orders,
    total: orders.reduce((s, to) => s + to.value, 0),
  }))
}

export function sumTaskOrders(taskOrders?: ReadonlyArray<TaskOrder>) {
  return (taskOrders ?? []).reduce((s, to) => s + to.value, 0)
}

export function sumChangeOrders(changeOrders?: ReadonlyArray<ChangeOrder>) {
  return (changeOrders ?? []).reduce((s, co) => s + co.value, 0)
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

export type PendingUser = {
  id: string
  initials: string
  name: string
  affiliation: string
  email: string
  requestedRole: AccessRole
  entityCode: string
  expiresInHours: number
}

export const pendingUsers: ReadonlyArray<PendingUser> = []

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
