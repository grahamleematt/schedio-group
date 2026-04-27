/**
 * SG DREAM — Typed mock data seed.
 *
 * Source of truth for the client-facing green flow (District Direct Pay).
 * Vendor hierarchy (contract → task orders by phase → change orders) is
 * seeded from real Sterling Ranch CAB reference data in the Downloads
 * examples folder so the mockup reads authentic to Tim.
 *
 * Shape mirrors the Phase 1 design handoff so shared screens can theme
 * themselves by workflow without branching logic at render time.
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
  code: string // 3-char client code for naming convention (SRC, HCA, DBI)
  name: string
  workflow: Workflow
  entityOwnerName: string
  region: string
  status: 'active' | 'pending_approval'
}

export const clients: ReadonlyArray<Client> = [
  {
    id: 'srcab',
    code: 'SRC',
    name: 'Sterling Ranch CAB',
    workflow: 'district_dp',
    entityOwnerName: 'Amy Lee',
    region: 'Douglas County, CO',
    status: 'active',
  },
  {
    id: 'hca',
    code: 'HCA',
    name: 'Highlands Creek Authority',
    workflow: 'district_dp',
    entityOwnerName: 'Amy Lee',
    region: 'Arapahoe County, CO',
    status: 'active',
  },
  {
    id: 'dbi',
    code: 'DBI',
    name: 'Downtown BID',
    workflow: 'district_dp',
    entityOwnerName: 'Amy Lee',
    region: 'City & County of Denver, CO',
    status: 'active',
  },
]

/**
 * Phase 2 placeholders so the `/clients` screen hints at the eventual
 * mixed-workflow shape Tim described in the meeting (blue developer
 * entities sitting alongside green district entities). These are
 * never selectable in the green-flow mockup.
 */
type GhostEntity = {
  id: string
  code: string
  name: string
  workflow: Workflow
  region: string
}

export const ghostDeveloperEntities: ReadonlyArray<GhostEntity> = [
  {
    id: 'oakwood-homes',
    code: 'OAK',
    name: 'Oakwood Homes',
    workflow: 'developer_reimb',
    region: 'Denver Metro, CO',
  },
  {
    id: 'lennar-colorado',
    code: 'LEN',
    name: 'Lennar Colorado',
    workflow: 'developer_reimb',
    region: 'Front Range, CO',
  },
]

export type User = {
  id: string
  initials: string
  name: string
  email: string
  role: 'entity_owner' | 'client_mgr' | 'client_viewer'
  permittedClientIds: ReadonlyArray<string>
}

export const mockUser: User = {
  id: 'amy-lee',
  initials: 'AL',
  name: 'Amy Lee',
  email: 'amy.lee@districts.example',
  role: 'entity_owner',
  permittedClientIds: ['srcab', 'hca', 'dbi'],
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

export const verifications: ReadonlyArray<Verification> = [
  // Sterling Ranch CAB — the primary demo anchor.
  // V4 is open with a near-term cutoff so the countdown pill shows
  // the amber "few days left" state for Tim's scheduling narrative.
  {
    id: 'srcab-v1',
    clientId: 'srcab',
    number: 1,
    year: 2026,
    period: 'January 2026',
    cutoffDate: 'Feb 10, 2026',
    cutoffDateISO: '2026-02-10',
    status: 'approved',
    docsCount: 21,
    costsSubmitted: 1_284_580.42,
    costsVerified: 1_268_900.0,
    workAuthValue: 2_750_000,
    seq: 21,
  },
  {
    id: 'srcab-v2',
    clientId: 'srcab',
    number: 2,
    year: 2026,
    period: 'February 2026',
    cutoffDate: 'Mar 10, 2026',
    cutoffDateISO: '2026-03-10',
    status: 'approved',
    docsCount: 26,
    costsSubmitted: 1_512_240.17,
    costsVerified: 1_498_600.0,
    workAuthValue: 2_750_000,
    seq: 26,
  },
  {
    id: 'srcab-v3',
    clientId: 'srcab',
    number: 3,
    year: 2026,
    period: 'March 2026',
    cutoffDate: 'Apr 10, 2026',
    cutoffDateISO: '2026-04-10',
    status: 'under_review',
    docsCount: 28,
    costsSubmitted: 1_196_820.95,
    costsVerified: 0,
    workAuthValue: 2_750_000,
    seq: 28,
  },
  {
    id: 'srcab-v4',
    clientId: 'srcab',
    number: 4,
    year: 2026,
    period: 'April 2026',
    cutoffDate: 'Apr 19, 2026',
    cutoffDateISO: '2026-04-19',
    status: 'open',
    docsCount: 11,
    costsSubmitted: 322_940.11,
    costsVerified: 0,
    workAuthValue: 2_750_000,
    seq: 11,
  },

  // Highlands Creek Authority — secondary entity, comfy cutoff (healthy).
  {
    id: 'hca-v1',
    clientId: 'hca',
    number: 1,
    year: 2026,
    period: 'November 2025',
    cutoffDate: 'Dec 10, 2025',
    cutoffDateISO: '2025-12-10',
    status: 'approved',
    docsCount: 18,
    costsSubmitted: 482_140.22,
    costsVerified: 471_850.0,
    workAuthValue: 1_250_000,
    seq: 18,
  },
  {
    id: 'hca-v2',
    clientId: 'hca',
    number: 2,
    year: 2026,
    period: 'December 2025',
    cutoffDate: 'Jan 12, 2026',
    cutoffDateISO: '2026-01-12',
    status: 'approved',
    docsCount: 22,
    costsSubmitted: 617_412.88,
    costsVerified: 612_200.0,
    workAuthValue: 1_250_000,
    seq: 22,
  },
  {
    id: 'hca-v3',
    clientId: 'hca',
    number: 3,
    year: 2026,
    period: 'February 2026',
    cutoffDate: 'Mar 10, 2026',
    cutoffDateISO: '2026-03-10',
    status: 'under_review',
    docsCount: 24,
    costsSubmitted: 538_902.1,
    costsVerified: 0,
    workAuthValue: 1_250_000,
    seq: 24,
  },
  {
    id: 'hca-v4',
    clientId: 'hca',
    number: 4,
    year: 2026,
    period: 'March 2026',
    cutoffDate: 'May 8, 2026',
    cutoffDateISO: '2026-05-08',
    status: 'open',
    docsCount: 11,
    costsSubmitted: 284_560.5,
    costsVerified: 0,
    workAuthValue: 1_250_000,
    seq: 11,
  },

  // Downtown BID — smallest portfolio, a cutoff that's effectively
  // "tomorrow" so the countdown demos the red/critical state.
  {
    id: 'dbi-v1',
    clientId: 'dbi',
    number: 1,
    year: 2026,
    period: 'Q4 2025',
    cutoffDate: 'Jan 20, 2026',
    cutoffDateISO: '2026-01-20',
    status: 'approved',
    docsCount: 7,
    costsSubmitted: 88_650.0,
    costsVerified: 86_400.0,
    workAuthValue: 280_000,
    seq: 7,
  },
  {
    id: 'dbi-v2',
    clientId: 'dbi',
    number: 2,
    year: 2026,
    period: 'Q1 2026',
    cutoffDate: 'Apr 17, 2026',
    cutoffDateISO: '2026-04-17',
    status: 'open',
    docsCount: 4,
    costsSubmitted: 42_180.33,
    costsVerified: 0,
    workAuthValue: 280_000,
    seq: 4,
  },
]

export type DuplicateFlag = 'none' | 'exact' | 'likely'

export type Document = {
  id: string
  verificationId: string
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
  /**
   * Optional custody + trust metadata, surfaced by the server when available
   * and absent in the pure-mock rows below. Kept optional so every existing
   * component stays working without extra guards.
   */
  egnyteWebUrl?: string
  egnyteClassifiedPath?: string
  custodyState?:
    | 'incoming'
    | 'processing'
    | 'classified'
    | 'relied'
    | 'locked'
  visualReviewUrl?: string
  fieldConfidence?: Record<string, number>
  lowConfidence?: boolean
}

/**
 * Default year used by the seed mock documents (Sterling Ranch CAB V4 was
 * filed in 2026). The webhook always passes the verification's actual year
 * so this default never escapes seed data.
 */
const DEFAULT_RENAMED_YEAR = 2026

/**
 * Build the canonical SG DREAM renamed filename for a verified document.
 * Exported so the server-side webhook can rename the file identically
 * before promoting it from Egnyte Incoming/ to Classified/.
 *
 * @param year — verification year. Defaults to {@link DEFAULT_RENAMED_YEAR}
 *   so the in-repo mock seeds remain a single-arg call; the webhook should
 *   always pass `verification.year` explicitly.
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

/**
 * Sterling Ranch CAB V4 (April 2026) — the primary demo submission.
 * Real vendor codes synthesized to the 4-char SG DREAM spec:
 *   AGWE = AGW (Geotechnical), AZTC = Aztec (Utility Locating),
 *   ATWL = Atwell, AQTC = Aquatic, RSIN = Rusin.
 *
 * 2 exact dupes + 1 likely dupe → 3 flagged, matches the original
 * narrative so every duplicate touch point still fires.
 */
export const documents: ReadonlyArray<Document> = [
  {
    id: 'srcab-v4-d1',
    verificationId: 'srcab-v4',
    docType: 'CTR',
    vendor: 'AGWE',
    vendorName: 'AGW Engineering',
    originalName:
      'VC_SRCAB_AGW_MSA for Geotechnical Services_(Fully Executed).pdf',
    renamedName: renamed('SRC', 4, 'CTR', 'AGWE', 1),
    amount: 0,
    seq: 1,
    duplicateFlag: 'none',
  },
  {
    id: 'srcab-v4-d2',
    verificationId: 'srcab-v4',
    docType: 'TO',
    vendor: 'AGWE',
    vendorName: 'AGW Engineering',
    originalName: 'VT_Sterling Ranch CAB_AGW_F5 WO 01_$17,600.00.pdf',
    renamedName: renamed('SRC', 4, 'TO', 'AGWE', 1),
    amount: 17_600.0,
    seq: 1,
    duplicateFlag: 'none',
  },
  {
    id: 'srcab-v4-d3',
    verificationId: 'srcab-v4',
    docType: 'TO',
    vendor: 'AZTC',
    vendorName: 'Aztec Utility Locating',
    originalName: 'VT_SRCAB_Aztec_FG WO14_$15,000.00.pdf',
    renamedName: renamed('SRC', 4, 'TO', 'AZTC', 2),
    amount: 15_000.0,
    seq: 2,
    duplicateFlag: 'none',
  },
  {
    id: 'srcab-v4-d4',
    verificationId: 'srcab-v4',
    docType: 'TO',
    vendor: 'AZTC',
    vendorName: 'Aztec Utility Locating',
    originalName: 'VT_SRCAB_Aztec_FG WO16_$7,560.00.pdf',
    renamedName: renamed('SRC', 4, 'TO', 'AZTC', 3),
    amount: 7_560.0,
    seq: 3,
    duplicateFlag: 'none',
  },
  {
    id: 'srcab-v4-d5',
    verificationId: 'srcab-v4',
    docType: 'PA',
    vendor: 'AZTC',
    vendorName: 'Aztec Utility Locating',
    originalName: 'PayApp_Aztec_April2026_final.pdf',
    renamedName: renamed('SRC', 4, 'PA', 'AZTC', 1),
    amount: 46_500.0,
    seq: 1,
    duplicateFlag: 'none',
  },
  {
    id: 'srcab-v4-d6',
    verificationId: 'srcab-v4',
    docType: 'INV',
    vendor: 'AZTC',
    vendorName: 'Aztec Utility Locating',
    originalName: 'Aztec_Invoice_INV-2026-0077.pdf',
    renamedName: renamed('SRC', 4, 'INV', 'AZTC', 1),
    amount: 24_118.6,
    seq: 1,
    duplicateFlag: 'likely',
    matchedPreviousName: 'Aztec_Invoice_INV-2026-0077_v2.pdf',
    matchedVerificationRef: 'SGD-DP-V3-2026-0028',
  },
  {
    id: 'srcab-v4-d7',
    verificationId: 'srcab-v4',
    docType: 'CO',
    vendor: 'RSIN',
    vendorName: 'Rusin Drafting',
    originalName: 'VO_Rusin_CO2_$3,880.01.pdf',
    renamedName: renamed('SRC', 4, 'CO', 'RSIN', 1),
    amount: 3_880.01,
    seq: 1,
    duplicateFlag: 'none',
  },
  {
    id: 'srcab-v4-d8',
    verificationId: 'srcab-v4',
    docType: 'INV',
    vendor: 'RSIN',
    vendorName: 'Rusin Drafting',
    originalName: 'Rusin_Invoice_March2026.pdf',
    renamedName: renamed('SRC', 4, 'INV', 'RSIN', 2),
    amount: 18_240.0,
    seq: 2,
    duplicateFlag: 'exact',
    matchedPreviousName: 'Rusin_Invoice_March2026.pdf',
    matchedVerificationRef: 'SGD-DP-V3-2026-0028',
  },
  {
    id: 'srcab-v4-d9',
    verificationId: 'srcab-v4',
    docType: 'POP',
    vendor: 'AGWE',
    vendorName: 'AGW Engineering',
    originalName: 'BankWire_Confirmation_AGW_PayApp_April.pdf',
    renamedName: renamed('SRC', 4, 'POP', 'AGWE', 1),
    amount: 118_450.0,
    seq: 1,
    duplicateFlag: 'none',
  },
  {
    id: 'srcab-v4-d10',
    verificationId: 'srcab-v4',
    docType: 'LSP',
    vendor: 'ATWL',
    vendorName: 'Atwell LLC',
    originalName: 'SterlingRanch_Plat_F2_Townhome.pdf',
    renamedName: renamed('SRC', 4, 'LSP', 'ATWL', 1),
    amount: 0,
    seq: 1,
    duplicateFlag: 'exact',
    matchedPreviousName: 'SterlingRanch_Plat_F2_Townhome.pdf',
    matchedVerificationRef: 'SGD-DP-V2-2026-0026',
  },
  {
    id: 'srcab-v4-d11',
    verificationId: 'srcab-v4',
    docType: 'INV',
    vendor: 'AQTC',
    vendorName: 'Aquatic Consultants',
    originalName: 'Aquatic_Invoice_WO1_April.pdf',
    renamedName: renamed('SRC', 4, 'INV', 'AQTC', 3),
    amount: 7_320.5,
    seq: 3,
    duplicateFlag: 'none',
  },
]

export type TaskOrder = {
  id: string
  phase: string // Sterling Ranch subdivision filings: 'F2', 'F3', 'F3B', 'F4A', 'F5', 'F6', 'F7', 'FG'
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

export const vendors: ReadonlyArray<Vendor> = [
  // --- Sterling Ranch CAB — real vendor hierarchy from Downloads examples ---
  {
    id: 'srcab-agwe',
    code: 'AGWE',
    name: 'AGW Engineering',
    clientId: 'srcab',
    authorized: 1_935_000,
    spent: 1_252_500,
    contract: {
      refName: 'MSA for Geotechnical Services',
      executedOn: 'Jun 18, 2024',
      value: 1_935_000,
    },
    taskOrders: [
      { id: 'srcab-agwe-to-1', phase: 'F2', number: 'WO 05', value: 33_694.5 },
      { id: 'srcab-agwe-to-2', phase: 'F2', number: 'WO 10', value: 10_510.0 },
      { id: 'srcab-agwe-to-3', phase: 'F3', number: 'WO 12', value: 30_540.0 },
      { id: 'srcab-agwe-to-4', phase: 'F3', number: 'WO 13', value: 99_295.0 },
      { id: 'srcab-agwe-to-5', phase: 'F3B', number: 'WO 10', value: 157_946.0 },
      { id: 'srcab-agwe-to-6', phase: 'F3B', number: 'WO 11', value: 332_812.0 },
      { id: 'srcab-agwe-to-7', phase: 'F4A', number: 'WO 12', value: 114_268.0 },
      { id: 'srcab-agwe-to-8', phase: 'F5', number: 'WO 01', value: 17_600.0 },
      {
        id: 'srcab-agwe-to-9',
        phase: 'F3',
        number: 'WO 08',
        value: 278_976.5,
        referencedByInvoice: true,
      },
      {
        id: 'srcab-agwe-to-10',
        phase: 'F3',
        number: '00001-009',
        value: 557_961.5,
        referencedByInvoice: true,
      },
      {
        id: 'srcab-agwe-to-11',
        phase: 'F6',
        number: '00001-003',
        value: 6_163.0,
        referencedByInvoice: true,
      },
      {
        id: 'srcab-agwe-to-12',
        phase: 'F6',
        number: '00001-004',
        value: 20_140.0,
        referencedByInvoice: true,
      },
      {
        id: 'srcab-agwe-to-13',
        phase: 'F6',
        number: '00001-005',
        value: 55_410.0,
        referencedByInvoice: true,
      },
      {
        id: 'srcab-agwe-to-14',
        phase: 'FG',
        number: '00001-003',
        value: 53_488.0,
        referencedByInvoice: true,
      },
      {
        id: 'srcab-agwe-to-15',
        phase: 'FG',
        number: '00001-007',
        value: 96_364.0,
        referencedByInvoice: true,
      },
      {
        id: 'srcab-agwe-to-16',
        phase: 'FG',
        number: '00001-009',
        value: 68_270.0,
        referencedByInvoice: true,
      },
    ],
  },
  {
    id: 'srcab-aztc',
    code: 'AZTC',
    name: 'Aztec Utility Locating',
    clientId: 'srcab',
    // Pushed into the amend band (~94% utilized) to demo Tim's
    // "as you get close to spending all that money" amendment cue.
    authorized: 490_000,
    spent: 460_000,
    contract: {
      refName: 'MSA for Utility Locating Services',
      executedOn: 'Aug 03, 2024',
      value: 490_000,
    },
    taskOrders: [
      { id: 'srcab-aztc-to-1', phase: 'F3', number: 'WO 12', value: 46_500.0 },
      { id: 'srcab-aztc-to-2', phase: 'F3', number: 'WO 13', value: 30_500.0 },
      { id: 'srcab-aztc-to-3', phase: 'F3', number: 'WO 15', value: 138_060.0 },
      { id: 'srcab-aztc-to-4', phase: 'F6', number: 'WO 02B', value: 27_440.0 },
      { id: 'srcab-aztc-to-5', phase: 'F6', number: 'WO 03C', value: 28_140.0 },
      { id: 'srcab-aztc-to-6', phase: 'F6', number: 'WO 06A', value: 5_400.0 },
      { id: 'srcab-aztc-to-7', phase: 'F6', number: 'WO 07', value: 24_520.0 },
      { id: 'srcab-aztc-to-8', phase: 'F7', number: 'WO 01', value: 24_600.0 },
      { id: 'srcab-aztc-to-9', phase: 'F7', number: 'WO 03', value: 14_625.0 },
      { id: 'srcab-aztc-to-10', phase: 'F7', number: 'WO 08', value: 46_500.0 },
      { id: 'srcab-aztc-to-11', phase: 'FG', number: 'WO 14', value: 15_000.0 },
      { id: 'srcab-aztc-to-12', phase: 'FG', number: 'WO 16', value: 7_560.0 },
      { id: 'srcab-aztc-to-13', phase: 'FG', number: 'WO 18', value: 43_150.0 },
      { id: 'srcab-aztc-to-14', phase: 'FG', number: 'WO 25', value: 27_000.0 },
      { id: 'srcab-aztc-to-15', phase: 'FG', number: 'WO 26', value: 10_360.0 },
    ],
  },
  {
    id: 'srcab-atwl',
    code: 'ATWL',
    name: 'Atwell LLC',
    clientId: 'srcab',
    authorized: 85_000,
    spent: 66_300,
    contract: {
      refName: 'Master Service Agreement (Fully Executed)',
      executedOn: 'Mar 22, 2024',
      value: 85_000,
    },
    taskOrders: [
      {
        id: 'srcab-atwl-to-1',
        phase: 'F2',
        number: 'Townhome Advanced Concrete WO',
        value: 66_300.0,
      },
    ],
  },
  {
    id: 'srcab-aqtc',
    code: 'AQTC',
    name: 'Aquatic Consultants',
    clientId: 'srcab',
    authorized: 28_700,
    spent: 12_900,
    contract: {
      refName: 'Water Features Consulting Agreement',
      executedOn: 'Sep 14, 2024',
      value: 28_700,
    },
    taskOrders: [
      { id: 'srcab-aqtc-to-1', phase: 'FG', number: 'WO 01', value: 28_700.0 },
    ],
  },
  {
    id: 'srcab-rsin',
    code: 'RSIN',
    name: 'Rusin Drafting',
    clientId: 'srcab',
    authorized: 180_000,
    spent: 82_400,
    contract: {
      refName: 'Structural Drafting Services Agreement',
      executedOn: 'Nov 02, 2024',
      value: 180_000,
    },
    taskOrders: [
      { id: 'srcab-rsin-to-1', phase: 'F3', number: 'WO 04', value: 55_800.0 },
      { id: 'srcab-rsin-to-2', phase: 'F6', number: 'WO 02', value: 26_600.0 },
    ],
    changeOrders: [
      { id: 'srcab-rsin-co-1', number: 'CO-001', value: 2_254.0 },
      { id: 'srcab-rsin-co-2', number: 'CO-002', value: 3_880.01 },
      { id: 'srcab-rsin-co-3', number: 'CO-003', value: 20_290.26 },
    ],
  },

  // --- Highlands Creek Authority — secondary entity, flat per-vendor ---
  {
    id: 'hca-apex',
    code: 'APEX',
    name: 'Apex Civil Construction',
    clientId: 'hca',
    authorized: 780_000,
    spent: 734_820,
  },
  {
    id: 'hca-meri',
    code: 'MERI',
    name: 'Meridian Engineering',
    clientId: 'hca',
    authorized: 180_000,
    spent: 112_480,
  },
  {
    id: 'hca-dlta',
    code: 'DLTA',
    name: 'Delta Underground Utilities',
    clientId: 'hca',
    authorized: 240_000,
    spent: 181_200,
  },
  {
    id: 'hca-slno',
    code: 'SLNO',
    name: 'Solano Surveying',
    clientId: 'hca',
    authorized: 50_000,
    spent: 21_650,
  },

  // --- Downtown BID — smallest, flat per-vendor ---
  {
    id: 'dbi-apex',
    code: 'APEX',
    name: 'Apex Civil Construction',
    clientId: 'dbi',
    authorized: 180_000,
    spent: 71_200,
  },
  {
    id: 'dbi-slno',
    code: 'SLNO',
    name: 'Solano Surveying',
    clientId: 'dbi',
    authorized: 40_000,
    spent: 14_800,
  },
  {
    id: 'dbi-meri',
    code: 'MERI',
    name: 'Meridian Engineering',
    clientId: 'dbi',
    authorized: 60_000,
    spent: 42_830,
  },
]

// ---- Helpers ----

export function getClientById(clientId: string | undefined): Client {
  return clients.find((c) => c.id === clientId) ?? clients[0]
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

export function computeCutoffUrgency(cutoffDateISO: string): {
  daysLeft: number
  urgency: CutoffUrgency
} {
  // Using a render-time Date() call is fine in this mockup; no useEffect needed.
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(`${cutoffDateISO}T00:00:00`)
  const diffMs = target.getTime() - now.getTime()
  const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24))

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
