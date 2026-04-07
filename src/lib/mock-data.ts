import {
  clientPackageDetails,
  districtProfiles,
  packageDrafts,
  reviewFieldConfirmations,
  scenarioPacks,
} from './scenario-data'
import type { PackageMode } from './scenario-data'

export type {
  ClientPackageDetail,
  DistrictProfile,
  FieldConfirmation,
  ScenarioPack,
  VerificationPackageSummary,
} from './scenario-data'

export type DistrictOption = {
  id: string
  name: string
  region: string
  programLabel: string
  contact: string
}

export type DocumentClass =
  | 'contract'
  | 'task_order'
  | 'change_order'
  | 'invoice'
  | 'pay_application'
  | 'proof_of_payment'
  | 'workbook'
  | 'governance_doc'

export type RelationshipType =
  | 'referenced_by'
  | 'supports'
  | 'derived_from'
  | 'duplicate_of'

export type GovernanceStatus =
  | 'valid'
  | 'needs_review'
  | 'missing_reference'
  | 'duplicate_detected'
  | 'malformed_name'
  | 'placeholder_source'

export type WorkbookStatus =
  | 'not_ready'
  | 'ready_to_map'
  | 'mapped'
  | 'exported'

export type CustodyState =
  | 'incoming'
  | 'processing'
  | 'classified'
  | 'relied'
  | 'locked'

export type ManifestState =
  | 'draft'
  | 'reviewed'
  | 'approved'
  | 'superseded'

export type UserCapability = 'drafting' | 'approval'

export type DeterminationMethod = 'plat_geometry' | 'scope_interpretation'

export type EvidenceMaturityStage =
  | 'engineer_estimate'
  | 'planning_document'
  | 'preliminary_plat'
  | 'final_plat'
  | 'plat_amendment'

export type ExceptionFlag =
  | 'duplicate_file'
  | 'placeholder_contract'
  | 'malformed_amount'
  | 'pay_app_variant'
  | 'missing_support'

export type ProcessingStage =
  | 'Incoming'
  | 'Processing'
  | 'Classified'
  | 'Ready for review'
  | 'Available'

export type ClientFacingStatus = ProcessingStage

export type CreatePackageStep = 'context' | 'files' | 'review' | 'confirm'

export type VerificationTimingState =
  | 'Open'
  | 'Approaching cutoff'
  | 'Past cutoff'

export type WorkspaceType = 'client' | 'admin'

export type MockWorkOSSession = {
  id: string
  accountLabel: string
  workspaceType: WorkspaceType
  organizationName: string
  roleLabel: string
  permittedDistrictIds: string[]
  defaultRoute: string
}

export type VerificationRecord = {
  id: string
  districtId: string
  number: number
  label: string
  cutoffDate: string
  timing: VerificationTimingState
  note: string
}

export type LinkedRecord = {
  recordId: string
  relation: RelationshipType
  label: string
  status: string
}

export type RelationshipChainSummary = {
  id: string
  districtId: string
  verificationId: string
  title: string
  note: string
  steps: Array<{
    label: string
    recordId: string
    status: string
  }>
}

export type PreviewAsset = {
  kind: 'pdf'
  src: string
}

export type GovernanceCheck = {
  id: string
  label: string
  result: 'pass' | 'warning' | 'fail'
  note: string
}

export type RationaleRecord = {
  summary: string
  sourceBasis: string
  changeReason: string
  approvalStatus: ManifestState
}

export type AdjustmentRecord = {
  id: string
  priorState: string
  newState: string
  reason: string
  affectedOutputs: string[]
}

export type UploadBatch = {
  id: string
  districtId: string
  verificationId: string
  name: string
  submittedBy: string
  submittedAt: string
  documentCount: number
  status: ProcessingStage
  progress: number
  channel: string
  linkedChains: number
  exceptionCount: number
  documentClasses: DocumentClass[]
  note: string
  custodyState: CustodyState
  manifestState: ManifestState
}

export type DocumentRecord = {
  id: string
  batchId: string
  districtId: string
  verificationId: string
  originalName: string
  organizedName: string
  documentClass: DocumentClass
  pageCount: number
  source: string
  igniteUrl: string
  custodyPath: string
  sourcePreserved: boolean
  custodyState: CustodyState
  documentManifestState: ManifestState
  runManifestState: ManifestState
  updatedAt: string
  submittedAmount?: number | null
  governanceStatus: GovernanceStatus
  workbookStatus: WorkbookStatus
  linkedRecords: LinkedRecord[]
  exceptionFlags: ExceptionFlag[]
  clientOutcome: string
  previewAsset?: PreviewAsset
  reasonCode?: string
}

export type ReviewStatus =
  | 'Needs review'
  | 'Naming check'
  | 'Ready to publish'
  | 'Published'

export type ReviewItem = {
  id: string
  recordId: string
  districtId: string
  reasonCode: string
  reason: string
  confidence: number
  reviewer: string
  status: ReviewStatus
  publishReadiness: 'Blocked' | 'Needs review' | 'Ready'
  workbookStatus: WorkbookStatus
  capability: UserCapability
  determinationMethod: DeterminationMethod
  evidenceMaturityStage: EvidenceMaturityStage
  targetCustodyState: CustodyState
  documentManifestState: ManifestState
  runManifestState: ManifestState
  exceptionFlags: ExceptionFlag[]
  evidenceHierarchy: string[]
  governanceChecks: GovernanceCheck[]
  rationale: RationaleRecord
  adjustmentHistory: AdjustmentRecord[]
  notes: string[]
}

export type PortalMetric = {
  label: string
  value: string
  note: string
}

export type PackageDraftClassSelection = {
  documentClass: DocumentClass
  selected: boolean
  note: string
}

export type PackageDraftFile = {
  id: string
  recordId: string
  linkedExpectation: string
  warningFlags: ExceptionFlag[]
  sourcePreserved: boolean
}

export type PackageDraftWarning = {
  id: string
  flag: ExceptionFlag
  title: string
  note: string
  severity: 'warning' | 'attention'
}

export type PackageDraftSummary = {
  packageName: string
  packageLabel: string
  districtId: string
  verificationId: string
  submissionChannel: string
  purpose: string
  description: string
  expectedClasses: PackageDraftClassSelection[]
  files: PackageDraftFile[]
  startingState: CustodyState
  linkedEvidenceChain: string[]
  outcomes: string[]
  warnings: PackageDraftWarning[]
}

export const archiveFacts = {
  totalEntries: 290,
  fileCount: 288,
  directoryCount: 2,
  pdfCount: 283,
  xlsxCount: 3,
  docxCount: 2,
  invoiceCount: 234,
  taskOrderCount: 33,
  payApplicationCount: 6,
  changeOrderCount: 3,
  contractCount: 3,
}

export const EGNYTE_DREAM_URL =
  'https://schediogroup.egnyte.com/app/index.do#storage/files/1/Shared/____SG%20DREAM'

export const documentClassLabels: Record<DocumentClass, string> = {
  contract: 'Contracts',
  task_order: 'Task Orders',
  change_order: 'Change Orders',
  invoice: 'Invoices',
  pay_application: 'Pay Applications',
  proof_of_payment: 'Proofs of Payment',
  workbook: 'Workbook',
  governance_doc: 'Governance',
}

export const relationshipLabels: Record<RelationshipType, string> = {
  referenced_by: 'Referenced by',
  supports: 'Supports',
  derived_from: 'Derived from',
  duplicate_of: 'Duplicate of',
}

export const governanceStatusLabels: Record<GovernanceStatus, string> = {
  valid: 'Governance clear',
  needs_review: 'Needs review',
  missing_reference: 'Missing reference',
  duplicate_detected: 'Duplicate detected',
  malformed_name: 'Malformed filename',
  placeholder_source: 'Placeholder source',
}

export const custodyStateLabels: Record<CustodyState, string> = {
  incoming: 'Incoming',
  processing: 'Processing',
  classified: 'Classified',
  relied: 'Relied',
  locked: 'Locked',
}

export const manifestStateLabels: Record<ManifestState, string> = {
  draft: 'Draft',
  reviewed: 'Reviewed',
  approved: 'Approved',
  superseded: 'Superseded',
}

export const userCapabilityLabels: Record<UserCapability, string> = {
  drafting: 'Drafting capability',
  approval: 'Approval capability',
}

export const determinationMethodLabels: Record<DeterminationMethod, string> = {
  plat_geometry: 'PLAT_GEOMETRY',
  scope_interpretation: 'SCOPE_INTERPRETATION',
}

export const evidenceMaturityStageLabels: Record<EvidenceMaturityStage, string> = {
  engineer_estimate: 'ENGINEER_ESTIMATE',
  planning_document: 'PLANNING_DOCUMENT',
  preliminary_plat: 'PRELIMINARY_PLAT',
  final_plat: 'FINAL_PLAT',
  plat_amendment: 'PLAT_AMENDMENT',
}

export const exceptionFlagLabels: Record<ExceptionFlag, string> = {
  duplicate_file: 'Duplicate file',
  placeholder_contract: 'Placeholder contract',
  malformed_amount: 'Malformed amount',
  pay_app_variant: 'Pay app variant',
  missing_support: 'Missing supporting proof',
}

export const documentClassOrder: DocumentClass[] = [
  'contract',
  'task_order',
  'change_order',
  'invoice',
  'pay_application',
  'proof_of_payment',
  'workbook',
  'governance_doc',
]

export const clientDocumentClassOrder: DocumentClass[] = [
  'contract',
  'task_order',
  'change_order',
  'invoice',
  'pay_application',
  'proof_of_payment',
]

export const processingStages: ProcessingStage[] = [
  'Incoming',
  'Processing',
  'Classified',
  'Ready for review',
  'Available',
]

export const clientFacingStages: ClientFacingStatus[] = [...processingStages]

export const createPackageSteps: CreatePackageStep[] = [
  'context',
  'files',
  'review',
  'confirm',
]

export const createPackageStepLabels: Record<CreatePackageStep, string> = {
  context: 'Package context',
  files: 'Source files',
  review: 'Review package',
  confirm: 'Confirm',
}

export const verificationTimingLabels: Record<
  VerificationTimingState,
  VerificationTimingState
> = {
  Open: 'Open',
  'Approaching cutoff': 'Approaching cutoff',
  'Past cutoff': 'Past cutoff',
}

export const districts: DistrictOption[] = [
  {
    id: 'sterling-cab',
    name: 'Sterling Ranch CAB',
    region: 'Douglas County, Colorado',
    programLabel: 'SG DREAM governed evidence intake',
    contact: 'Tim Case',
  },
  {
    id: 'sterling-md',
    name: 'Sterling Ranch Metro District',
    region: 'Douglas County, Colorado',
    programLabel: 'Pay application evidence chain',
    contact: 'John Rogers',
  },
  {
    id: 'ridgeview',
    name: 'Sterling Ranch MD4',
    region: 'Douglas County, Colorado',
    programLabel: 'Locked evidence package',
    contact: 'Finance coordinator',
  },
]

export const clientSessions: MockWorkOSSession[] = [
  {
    id: 'client-sterling-ranch-full',
    accountLabel: 'Sterling Ranch (all districts)',
    workspaceType: 'client',
    organizationName: 'Sterling Ranch client team',
    roleLabel: 'Client workspace',
    permittedDistrictIds: ['sterling-cab', 'sterling-md', 'ridgeview'],
    defaultRoute: '/',
  },
  {
    id: 'client-sterling-ranch-cab-only',
    accountLabel: 'Sterling Ranch (CAB only)',
    workspaceType: 'client',
    organizationName: 'Sterling Ranch field staff',
    roleLabel: 'Client workspace',
    permittedDistrictIds: ['sterling-cab'],
    defaultRoute: '/',
  },
  {
    id: 'client-sterling-ranch-md-only',
    accountLabel: 'Sterling Ranch (Metro District)',
    workspaceType: 'client',
    organizationName: 'Sterling Ranch finance',
    roleLabel: 'Client workspace',
    permittedDistrictIds: ['sterling-md'],
    defaultRoute: '/',
  },
]

export const clientWorkspaceSession = clientSessions[0]

export const draftingWorkspaceSession: MockWorkOSSession = {
  id: 'admin-drafting',
  accountLabel: 'Drafting analyst',
  workspaceType: 'admin',
  organizationName: 'Schedio Group engineering',
  roleLabel: 'Drafting capability',
  permittedDistrictIds: districts.map((district) => district.id),
  defaultRoute: '/review-workbench',
}

export const approvalWorkspaceSession: MockWorkOSSession = {
  id: 'admin-approval',
  accountLabel: 'Approval engineer',
  workspaceType: 'admin',
  organizationName: 'Schedio Group engineering',
  roleLabel: 'Approval capability',
  permittedDistrictIds: districts.map((district) => district.id),
  defaultRoute: '/review-console',
}

export const operationsWorkspaceSession: MockWorkOSSession = {
  id: 'admin-operations',
  accountLabel: 'Operations manager',
  workspaceType: 'admin',
  organizationName: 'Schedio Group engineering',
  roleLabel: 'Operations command',
  permittedDistrictIds: districts.map((district) => district.id),
  defaultRoute: '/internal-dashboard',
}

export const verificationWorkspaceSession: MockWorkOSSession = {
  id: 'admin-verifications',
  accountLabel: 'Verification manager',
  workspaceType: 'admin',
  organizationName: 'Schedio Group engineering',
  roleLabel: 'Verification management',
  permittedDistrictIds: districts.map((district) => district.id),
  defaultRoute: '/verification-management',
}

export const adminWorkspaceSession: MockWorkOSSession = {
  id: 'admin-sg-admin',
  accountLabel: 'SG admin',
  workspaceType: 'admin',
  organizationName: 'Schedio Group engineering',
  roleLabel: 'Entity administration',
  permittedDistrictIds: districts.map((district) => district.id),
  defaultRoute: '/entity-admin',
}

export const workOSWorkspaceAccounts: MockWorkOSSession[] = [
  ...clientSessions,
  operationsWorkspaceSession,
  draftingWorkspaceSession,
  approvalWorkspaceSession,
  verificationWorkspaceSession,
  adminWorkspaceSession,
]

export const verifications: VerificationRecord[] = [
  {
    id: 'sterling-cab-ver-16',
    districtId: 'sterling-cab',
    number: 16,
    label: 'Verification 16',
    cutoffDate: 'April 2, 2026',
    timing: 'Approaching cutoff',
    note: 'Uploads after the April 2 cutoff roll into Verification 17.',
  },
  {
    id: 'sterling-cab-ver-17',
    districtId: 'sterling-cab',
    number: 17,
    label: 'Verification 17',
    cutoffDate: 'April 30, 2026',
    timing: 'Open',
    note: 'The next monthly verification window is open for late or supplemental records.',
  },
  {
    id: 'sterling-md-ver-11',
    districtId: 'sterling-md',
    number: 11,
    label: 'Verification 11',
    cutoffDate: 'April 4, 2026',
    timing: 'Open',
    note: 'Metro District pay application support is still accepting uploads.',
  },
  {
    id: 'ridgeview-ver-9',
    districtId: 'ridgeview',
    number: 9,
    label: 'Verification 9',
    cutoffDate: 'March 21, 2026',
    timing: 'Past cutoff',
    note: 'The locked MD4 package is already beyond cutoff and held for audit traceability.',
  },
]

export const relationshipChains: RelationshipChainSummary[] = [
  {
    id: 'chain-jds-monthly-close',
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-16',
    title: 'Monthly reimbursement chain',
    note: 'This is the compact client-facing version of Tim’s walkthrough: contract and task order establish scope, change order updates it, invoice carries the submitted amount, and proof closes the package.',
    steps: [
      {
        label: 'Contract',
        recordId: 'record-contract-agw-xxx',
        status: 'Master agreement on file',
      },
      {
        label: 'Task order',
        recordId: 'record-task-agw-f6-005',
        status: 'Authorized scope on file',
      },
      {
        label: 'Change order',
        recordId: 'record-change-rusin-co2',
        status: 'Scope adjustment attached',
      },
      {
        label: 'Invoice / pay application',
        recordId: 'record-invoice-jds-3601',
        status: 'Submitted amount attached',
      },
      {
        label: 'Proof of payment',
        recordId: 'record-proof-jds-3601',
        status: 'Support linked for review',
      },
    ],
  },
  {
    id: 'chain-jds-rollover',
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-17',
    title: 'Late rollover chain',
    note: 'Late invoices roll forward to the next verification while keeping the underlying task order visible and the proof requirement open.',
    steps: [
      {
        label: 'Task order',
        recordId: 'record-task-agw-f6-005',
        status: 'Authorization carried forward from Verification 16',
      },
      {
        label: 'Invoice / pay application',
        recordId: 'record-invoice-jds-3645',
        status: 'Late invoice assigned to Verification 17',
      },
      {
        label: 'Proof of payment',
        recordId: 'record-proof-conditional-blank',
        status: 'Support still needs confirmation',
      },
    ],
  },
  {
    id: 'chain-atwell-kickoff',
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-17',
    title: 'Contract kickoff chain',
    note: 'Kickoff packages establish contract and task-order context before recurring monthly submissions begin.',
    steps: [
      {
        label: 'Contract',
        recordId: 'record-contract-atwell-msa',
        status: 'Executed agreement attached',
      },
      {
        label: 'Task order',
        recordId: 'record-task-atwell-f2',
        status: 'Initial work order attached',
      },
      {
        label: 'Change order',
        recordId: 'record-change-rusin-co1',
        status: 'Early scope adjustment visible for review',
      },
    ],
  },
  {
    id: 'chain-metro-finance',
    districtId: 'sterling-md',
    verificationId: 'sterling-md-ver-11',
    title: 'Metro finance chain',
    note: 'Finance packages emphasize pay applications and keep support gaps visible while the package is still in progress.',
    steps: [
      {
        label: 'Pay application',
        recordId: 'record-payapp-classic-23',
        status: 'Submitted amount attached',
      },
      {
        label: 'Proof of payment',
        recordId: 'record-proof-conditional-blank-md',
        status: 'Support still needs confirmation',
      },
    ],
  },
  {
    id: 'chain-md4-archived',
    districtId: 'ridgeview',
    verificationId: 'ridgeview-ver-9',
    title: 'Archived audit chain',
    note: 'The archived MD4 package remains locked, read-only, and available for audit traceability.',
    steps: [
      {
        label: 'Pay application',
        recordId: 'record-payapp-classic-17',
        status: 'Locked record available',
      },
      {
        label: 'Proof of payment',
        recordId: 'record-proof-md4-unconditional',
        status: 'Supporting waiver attached',
      },
    ],
  },
]

export const uploadBatches: UploadBatch[] = [
  {
    id: 'batch-ver5',
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-16',
    name: 'Verification 16 monthly intake',
    submittedBy: 'Shared client login',
    submittedAt: 'March 29, 2026 at 8:18 AM',
    documentCount: 32,
    status: 'Processing',
    progress: 68,
    channel: 'District upload folder',
    linkedChains: 11,
    exceptionCount: 3,
    documentClasses: ['invoice', 'pay_application', 'proof_of_payment'],
    note: 'Monthly invoice, pay application, and proof uploads are staged for Verification 16 with renamed inventory and review flags.',
    custodyState: 'processing',
    manifestState: 'draft',
  },
  {
    id: 'batch-agw',
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-16',
    name: 'AGW support records',
    submittedBy: 'Tim Case',
    submittedAt: 'March 28, 2026 at 4:12 PM',
    documentCount: 11,
    status: 'Ready for review',
    progress: 86,
    channel: 'Client custody submission',
    linkedChains: 6,
    exceptionCount: 1,
    documentClasses: ['contract', 'task_order', 'change_order'],
    note: 'Contract and task order records are attached so the monthly invoice package can keep its verification chain intact.',
    custodyState: 'classified',
    manifestState: 'reviewed',
  },
  {
    id: 'batch-payapp',
    districtId: 'sterling-md',
    verificationId: 'sterling-md-ver-11',
    name: 'SRMD pay applications',
    submittedBy: 'Finance coordinator',
    submittedAt: 'March 27, 2026 at 2:42 PM',
    documentCount: 9,
    status: 'Ready for review',
    progress: 93,
    channel: 'Finance upload folder',
    linkedChains: 5,
    exceptionCount: 1,
    documentClasses: ['pay_application', 'proof_of_payment', 'workbook'],
    note: 'Pay applications are present, but one support gap still keeps the verification package in confirmation.',
    custodyState: 'classified',
    manifestState: 'reviewed',
  },
  {
    id: 'batch-ridgeview',
    districtId: 'ridgeview',
    verificationId: 'ridgeview-ver-9',
    name: 'MD4 archived package',
    submittedBy: 'Client portal',
    submittedAt: 'March 26, 2026 at 11:09 AM',
    documentCount: 14,
    status: 'Classified',
    progress: 100,
    channel: 'Client portal',
    linkedChains: 4,
    exceptionCount: 0,
    documentClasses: ['invoice', 'task_order', 'proof_of_payment'],
    note: 'This district package is already archived and available for read-only traceability.',
    custodyState: 'locked',
    manifestState: 'approved',
  },
  {
    id: 'batch-rollover-cab',
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-17',
    name: 'Verification 17 rollover',
    submittedBy: 'Sterling Ranch client team',
    submittedAt: 'April 3, 2026 at 9:06 AM',
    documentCount: 3,
    status: 'Ready for review',
    progress: 74,
    channel: 'District upload folder',
    linkedChains: 1,
    exceptionCount: 1,
    documentClasses: ['invoice', 'proof_of_payment'],
    note: 'Late uploads from Verification 16 are visible in Verification 17 with support still pending.',
    custodyState: 'classified',
    manifestState: 'reviewed',
  },
  {
    id: 'batch-kickoff-cab',
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-17',
    name: 'Contract kickoff package',
    submittedBy: 'Sterling Ranch field staff',
    submittedAt: 'April 1, 2026 at 1:22 PM',
    documentCount: 3,
    status: 'Processing',
    progress: 58,
    channel: 'Client custody submission',
    linkedChains: 1,
    exceptionCount: 0,
    documentClasses: ['contract', 'task_order', 'change_order'],
    note: 'Kickoff records are being organized before recurring monthly submissions begin.',
    custodyState: 'processing',
    manifestState: 'draft',
  },
]

export const createPackageDraft: PackageDraftSummary = packageDrafts[0].draft

export const documents: DocumentRecord[] = [
  {
    id: 'record-contract-agw-xxx',
    batchId: 'batch-agw',
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-16',
    originalName: 'VC_SRCAB_AGW_MSA FOR GEOTECHNICAL SERVICES_XXX.pdf',
    organizedName: 'VC_SRCAB_AGW_Master Service Agreement_XXX.pdf',
    documentClass: 'contract',
    pageCount: 19,
    source: 'Egnyte contract custody archive',
    igniteUrl: EGNYTE_DREAM_URL,
    custodyPath:
      'Shared/____SG DREAM/1.0 Examples/2.1 Contracts/AGW/VC_SRCAB_AGW_MSA FOR GEOTECHNICAL SERVICES_XXX.pdf',
    sourcePreserved: true,
    custodyState: 'classified',
    documentManifestState: 'draft',
    runManifestState: 'draft',
    updatedAt: '14 minutes ago',
    submittedAmount: null,
    governanceStatus: 'placeholder_source',
    workbookStatus: 'not_ready',
    linkedRecords: [
      {
        recordId: 'record-task-agw-f6-005',
        relation: 'referenced_by',
        label: 'VT_SRCAB_AGW_F6-00001-005_$55,410.00.pdf',
        status: 'Linked task order available',
      },
    ],
    exceptionFlags: ['placeholder_contract'],
    clientOutcome:
      'Original contract is preserved in custody, classified correctly, and waiting on one governed source correction before it can move forward.',
    previewAsset: {
      kind: 'pdf',
      src: '/review-previews/review-contract-agw-xxx.pdf',
    },
    reasonCode: 'Placeholder source',
  },
  {
    id: 'record-task-agw-f6-005',
    batchId: 'batch-agw',
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-16',
    originalName: 'VT_Sterling Ranch CAB_AGW_F6-00001-005_$55,410.00.pdf',
    organizedName: 'VT_SRCAB_AGW_F6-00001-005_$55,410.00.pdf',
    documentClass: 'task_order',
    pageCount: 18,
    source: 'Referenced by invoices archive',
    igniteUrl: EGNYTE_DREAM_URL,
    custodyPath:
      'Shared/____SG DREAM/1.0 Examples/2.2 Task Orders/AGW/Referenced by Invoices/VT_Sterling Ranch CAB_AGW_F6-00001-005_$55,410.00.pdf',
    sourcePreserved: true,
    custodyState: 'classified',
    documentManifestState: 'reviewed',
    runManifestState: 'draft',
    updatedAt: '9 minutes ago',
    submittedAmount: 55410,
    governanceStatus: 'valid',
    workbookStatus: 'ready_to_map',
    linkedRecords: [
      {
        recordId: 'record-invoice-jds-3601',
        relation: 'referenced_by',
        label: 'VI_JDS_3601_$2,639.67.pdf',
        status: '1 invoice linked',
      },
      {
        recordId: 'record-invoice-jds-3606-bbb',
        relation: 'referenced_by',
        label: 'VI_JDS_3606-BBB_$39,268.11.pdf',
        status: 'Secondary invoice linked',
      },
    ],
    exceptionFlags: [],
    clientOutcome:
      'Task order is classified, linked to downstream invoices, and visible inside the evidence chain.',
  },
  {
    id: 'record-invoice-jds-3601',
    batchId: 'batch-ver5',
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-16',
    originalName: 'VI_JDS_3601_$2,639.67.pdf',
    organizedName: 'VI_JDS_3601_$2,639.67.pdf',
    documentClass: 'invoice',
    pageCount: 1,
    source: 'Ver 4 invoice archive',
    igniteUrl: EGNYTE_DREAM_URL,
    custodyPath:
      'Shared/____SG DREAM/1.0 Examples/3.1 Invoices/Ver 4/VI_JDS_3601_$2,639.67.pdf',
    sourcePreserved: true,
    custodyState: 'locked',
    documentManifestState: 'approved',
    runManifestState: 'approved',
    updatedAt: '4 minutes ago',
    submittedAmount: 2639.67,
    governanceStatus: 'valid',
    workbookStatus: 'mapped',
    linkedRecords: [
      {
        recordId: 'record-task-agw-f6-005',
        relation: 'referenced_by',
        label: 'VT_SRCAB_AGW_F6-00001-005_$55,410.00.pdf',
        status: 'Linked task order found',
      },
      {
        recordId: 'record-proof-jds-3601',
        relation: 'supports',
        label: 'Unconditional Waiver and Release Form (002).pdf',
        status: 'Supporting proof attached',
      },
    ],
    exceptionFlags: [],
    clientOutcome:
      'This evidence chain is complete, approved, and available in Egnyte with original-file traceability preserved.',
    previewAsset: {
      kind: 'pdf',
      src: '/review-previews/review-jds-3601.pdf',
    },
  },
  {
    id: 'record-invoice-jds-3606-bbb',
    batchId: 'batch-ver5',
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-16',
    originalName: 'VI_JDS_3606-BBB_$39,268.11.pdf',
    organizedName: 'VI_JDS_3606-BBB_$39,268.11.pdf',
    documentClass: 'invoice',
    pageCount: 7,
    source: 'Ver 4 invoice archive',
    igniteUrl: EGNYTE_DREAM_URL,
    custodyPath:
      'Shared/____SG DREAM/1.0 Examples/3.1 Invoices/Ver 1/JDS CONSTRUCTION/VI_JDS_3423_$39,268.11.pdf',
    sourcePreserved: true,
    custodyState: 'classified',
    documentManifestState: 'reviewed',
    runManifestState: 'draft',
    updatedAt: '4 minutes ago',
    submittedAmount: 39268.11,
    governanceStatus: 'valid',
    workbookStatus: 'ready_to_map',
    linkedRecords: [
      {
        recordId: 'record-task-agw-f6-005',
        relation: 'referenced_by',
        label: 'VT_SRCAB_AGW_F6-00001-005_$55,410.00.pdf',
        status: 'Linked task order found',
      },
    ],
    exceptionFlags: [],
    clientOutcome:
      'Invoice is classified and linked, with the governed evidence package still moving through drafting and approval.',
  },
  {
    id: 'record-proof-jds-3601',
    batchId: 'batch-ver5',
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-16',
    originalName: 'Unconditional Waiver and Release Form (002).pdf',
    organizedName: 'POP_JDS_3601_Unconditional Waiver.pdf',
    documentClass: 'proof_of_payment',
    pageCount: 2,
    source: 'Proof of payment archive',
    igniteUrl: EGNYTE_DREAM_URL,
    custodyPath:
      'Shared/____SG DREAM/1.0 Examples/4.3 Proofs of Payments - Unconditional Lien Waivers/Unconditional Waiver and Release Form (002).pdf',
    sourcePreserved: true,
    custodyState: 'relied',
    documentManifestState: 'approved',
    runManifestState: 'approved',
    updatedAt: '3 minutes ago',
    submittedAmount: null,
    governanceStatus: 'valid',
    workbookStatus: 'ready_to_map',
    linkedRecords: [
      {
        recordId: 'record-invoice-jds-3601',
        relation: 'supports',
        label: 'VI_JDS_3601_$2,639.67.pdf',
        status: 'Support chain complete',
      },
    ],
    exceptionFlags: [],
    clientOutcome:
      'Supporting proof is preserved and attached to the governed record package.',
  },
  {
    id: 'record-payapp-pages-20',
    batchId: 'batch-ver5',
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-16',
    originalName: 'Pages from SRMD - SRD Pay App 20 - 7.31.24.pdf',
    organizedName: 'VI_Classic_Pay App 20_$UNVERIFIED.pdf',
    documentClass: 'pay_application',
    pageCount: 1,
    source: 'Invoice version archive',
    igniteUrl: EGNYTE_DREAM_URL,
    custodyPath:
      'Shared/____SG DREAM/1.0 Examples/3.1 Invoices/Ver 4/Pages from SRMD - SRD Pay App 20 - 7.31.24.pdf',
    sourcePreserved: true,
    custodyState: 'processing',
    documentManifestState: 'draft',
    runManifestState: 'draft',
    updatedAt: '8 minutes ago',
    submittedAmount: null,
    governanceStatus: 'missing_reference',
    workbookStatus: 'not_ready',
    linkedRecords: [],
    exceptionFlags: ['pay_app_variant', 'missing_support'],
    clientOutcome:
      'A pay application has been recognized inside the package, but it still needs supporting proof and analyst drafting before it can move forward.',
    previewAsset: {
      kind: 'pdf',
      src: '/review-previews/review-payapp-pages-20.pdf',
    },
    reasonCode: 'Missing payment proof',
  },
  {
    id: 'record-invoice-mcdonal-7981',
    batchId: 'batch-ver5',
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-16',
    originalName: 'VI_McDonal Paving_7981_$.pdf',
    organizedName: 'VI_McDonal Paving_7981_$UNKNOWN.pdf',
    documentClass: 'invoice',
    pageCount: 2,
    source: 'Ver 3 invoice archive',
    igniteUrl: EGNYTE_DREAM_URL,
    custodyPath:
      'Shared/____SG DREAM/1.0 Examples/3.1 Invoices/Ver 3/McDonal Paving/VI_McDonal Paving_7981_$.pdf',
    sourcePreserved: true,
    custodyState: 'processing',
    documentManifestState: 'draft',
    runManifestState: 'draft',
    updatedAt: '11 minutes ago',
    submittedAmount: null,
    governanceStatus: 'malformed_name',
    workbookStatus: 'not_ready',
    linkedRecords: [],
    exceptionFlags: ['malformed_amount'],
    clientOutcome:
      'Source record is preserved in custody, but the governed meaning and naming still need analyst review.',
    previewAsset: {
      kind: 'pdf',
      src: '/review-previews/review-mcdonal-7981.pdf',
    },
    reasonCode: 'Malformed amount',
  },
  {
    id: 'record-invoice-sunflower-33032',
    batchId: 'batch-ver5',
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-16',
    originalName: 'VI_Sunflower_33032_$96,141.00.pdf',
    organizedName: 'VI_Sunflower_33032_$96,141.00.pdf',
    documentClass: 'invoice',
    pageCount: 1,
    source: 'Ver 5 invoice archive',
    igniteUrl: EGNYTE_DREAM_URL,
    custodyPath:
      'Shared/____SG DREAM/1.0 Examples/3.1 Invoices/Ver 5/VI_Sunflower_33032_$96,141.00.pdf',
    sourcePreserved: true,
    custodyState: 'locked',
    documentManifestState: 'approved',
    runManifestState: 'approved',
    updatedAt: '6 minutes ago',
    submittedAmount: 96141,
    governanceStatus: 'valid',
    workbookStatus: 'mapped',
    linkedRecords: [
      {
        recordId: 'record-invoice-sunflower-33032-dup',
        relation: 'duplicate_of',
        label: 'VI_Sunflower_33032_$96,141.00 (2).pdf',
        status: 'Duplicate detected in queue',
      },
    ],
    exceptionFlags: [],
    clientOutcome:
      'Primary invoice remains the governed source of truth while the duplicate stays visible only for audit.',
  },
  {
    id: 'record-invoice-sunflower-33032-dup',
    batchId: 'batch-ver5',
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-16',
    originalName: 'VI_Sunflower_33032_$96,141.00 (2).pdf',
    organizedName: 'VI_Sunflower_33032_$96,141.00_DUPLICATE.pdf',
    documentClass: 'invoice',
    pageCount: 6,
    source: 'Ver 5 invoice archive',
    igniteUrl: EGNYTE_DREAM_URL,
    custodyPath:
      'Shared/____SG DREAM/1.0 Examples/3.1 Invoices/Ver 5/VI_Sunflower_33032_$96,141.00 (2).pdf',
    sourcePreserved: true,
    custodyState: 'classified',
    documentManifestState: 'reviewed',
    runManifestState: 'reviewed',
    updatedAt: '5 minutes ago',
    submittedAmount: 96141,
    governanceStatus: 'duplicate_detected',
    workbookStatus: 'not_ready',
    linkedRecords: [
      {
        recordId: 'record-invoice-sunflower-33032',
        relation: 'duplicate_of',
        label: 'VI_Sunflower_33032_$96,141.00.pdf',
        status: 'Primary invoice already filed',
      },
    ],
    exceptionFlags: ['duplicate_file'],
    clientOutcome:
      'Duplicate file remains visible for traceability, but it cannot progress until the approval layer confirms the final audit posture.',
    previewAsset: {
      kind: 'pdf',
      src: '/review-previews/review-sunflower-duplicate.pdf',
    },
    reasonCode: 'Duplicate file',
  },
  {
    id: 'record-change-rusin-co2',
    batchId: 'batch-agw',
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-16',
    originalName: 'VO_Rusin_CO2_$3,880.01.pdf',
    organizedName: 'VO_Rusin_CO2_$3,880.01.pdf',
    documentClass: 'change_order',
    pageCount: 5,
    source: 'Change orders archive',
    igniteUrl: EGNYTE_DREAM_URL,
    custodyPath:
      'Shared/____SG DREAM/1.0 Examples/2.3 Change Orders/Rusin/VO_Rusin_CO2_$3,880.01.pdf',
    sourcePreserved: true,
    custodyState: 'classified',
    documentManifestState: 'reviewed',
    runManifestState: 'reviewed',
    updatedAt: '19 minutes ago',
    submittedAmount: 3880.01,
    governanceStatus: 'valid',
    workbookStatus: 'ready_to_map',
    linkedRecords: [],
    exceptionFlags: [],
    clientOutcome:
      'Change order is preserved and classified, with governed drafting ready to support downstream reporting.',
  },
  {
    id: 'record-workbook-ver5',
    batchId: 'batch-payapp',
    districtId: 'sterling-md',
    verificationId: 'sterling-md-ver-11',
    originalName: '20240814_Sterling Ranch Md4_Ver 04.xlsx',
    organizedName: '20240814_Sterling Ranch Md4_Ver 04.xlsx',
    documentClass: 'workbook',
    pageCount: 1,
    source: '1.1 Workbook archive',
    igniteUrl: EGNYTE_DREAM_URL,
    custodyPath:
      'Shared/____SG DREAM/1.0 Examples/1.1 Workbook/20240814_Sterling Ranch Md4_Ver 04.xlsx',
    sourcePreserved: true,
    custodyState: 'locked',
    documentManifestState: 'approved',
    runManifestState: 'approved',
    updatedAt: '22 minutes ago',
    submittedAmount: null,
    governanceStatus: 'valid',
    workbookStatus: 'exported',
    linkedRecords: [
      {
        recordId: 'record-change-rusin-co2',
        relation: 'derived_from',
        label: 'VO_Rusin_CO2_$3,880.01.pdf',
        status: 'Mapped into workbook export',
      },
    ],
    exceptionFlags: [],
    clientOutcome: 'Internal workbook export complete.',
  },
  {
    id: 'record-governance-constitution',
    batchId: 'batch-payapp',
    districtId: 'sterling-md',
    verificationId: 'sterling-md-ver-11',
    originalName: 'SG_DREAM_SYSTEM_CONSTITUTION_v1.0.pdf',
    organizedName: 'SG_DREAM_SYSTEM_CONSTITUTION_v1.0.pdf',
    documentClass: 'governance_doc',
    pageCount: 3,
    source: 'Governance archive',
    igniteUrl: EGNYTE_DREAM_URL,
    custodyPath:
      'Shared/____SG DREAM/Governance/System Constitution/SG_DREAM_SYSTEM_CONSTITUTION_v1.0.pdf',
    sourcePreserved: true,
    custodyState: 'locked',
    documentManifestState: 'approved',
    runManifestState: 'approved',
    updatedAt: '1 day ago',
    submittedAmount: null,
    governanceStatus: 'valid',
    workbookStatus: 'not_ready',
    linkedRecords: [],
    exceptionFlags: [],
    clientOutcome: 'Internal governance artifact.',
  },
  {
    id: 'record-contract-atwell-msa',
    batchId: 'batch-kickoff-cab',
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-17',
    originalName: 'VC_Atwell LLC_Master Service Agreement_(Fully Executed).pdf',
    organizedName: 'VC_Atwell LLC_Master Service Agreement_(Fully Executed).pdf',
    documentClass: 'contract',
    pageCount: 14,
    source: 'Contracts archive',
    igniteUrl: EGNYTE_DREAM_URL,
    custodyPath:
      'Shared/____SG DREAM/1.0 Examples/2.1 Contracts/Atwell/VC_Atwell LLC_Master Service Agreement_(Fully Executed).pdf',
    sourcePreserved: true,
    custodyState: 'processing',
    documentManifestState: 'draft',
    runManifestState: 'draft',
    updatedAt: '12 minutes ago',
    submittedAmount: null,
    governanceStatus: 'valid',
    workbookStatus: 'not_ready',
    linkedRecords: [
      {
        recordId: 'record-task-atwell-f2',
        relation: 'referenced_by',
        label:
          'VC_Atwell Sterling Ranch F2 Townhome - Advanced Concrete Work Order - EXECUTED.pdf',
        status: 'Kickoff task order attached',
      },
    ],
    exceptionFlags: [],
    clientOutcome:
      'Executed contract is preserved and visible while the kickoff package is organized.',
    previewAsset: {
      kind: 'pdf',
      src: '/review-previews/review-atwell-contract.pdf',
    },
    reasonCode: 'Kickoff contract',
  },
  {
    id: 'record-task-atwell-f2',
    batchId: 'batch-kickoff-cab',
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-17',
    originalName:
      'VC_Atwell Sterling Ranch F2 Townhome - Advanced Concrete Work Order - EXECUTED.pdf',
    organizedName:
      'VC_Atwell Sterling Ranch F2 Townhome - Advanced Concrete Work Order - EXECUTED.pdf',
    documentClass: 'task_order',
    pageCount: 8,
    source: 'Task orders archive',
    igniteUrl: EGNYTE_DREAM_URL,
    custodyPath:
      'Shared/____SG DREAM/1.0 Examples/2.2 Task Orders/Atwell/VC_Atwell Sterling Ranch F2 Townhome - Advanced Concrete Work Order - EXECUTED.pdf',
    sourcePreserved: true,
    custodyState: 'processing',
    documentManifestState: 'draft',
    runManifestState: 'draft',
    updatedAt: '11 minutes ago',
    submittedAmount: null,
    governanceStatus: 'valid',
    workbookStatus: 'not_ready',
    linkedRecords: [
      {
        recordId: 'record-contract-atwell-msa',
        relation: 'referenced_by',
        label: 'VC_Atwell LLC_Master Service Agreement_(Fully Executed).pdf',
        status: 'Executed contract attached',
      },
      {
        recordId: 'record-change-rusin-co1',
        relation: 'supports',
        label: 'VO_Rusin_CO1_$2,254.00.pdf',
        status: 'Early change order visible',
      },
    ],
    exceptionFlags: [],
    clientOutcome:
      'Kickoff task order is visible and ready to anchor downstream monthly records.',
    previewAsset: {
      kind: 'pdf',
      src: '/review-previews/review-atwell-task-order.pdf',
    },
    reasonCode: 'Kickoff task order',
  },
  {
    id: 'record-change-rusin-co1',
    batchId: 'batch-kickoff-cab',
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-17',
    originalName: 'VO_Rusin_CO1_$2,254.00.pdf',
    organizedName: 'VO_Rusin_CO1_$2,254.00.pdf',
    documentClass: 'change_order',
    pageCount: 4,
    source: 'Change orders archive',
    igniteUrl: EGNYTE_DREAM_URL,
    custodyPath:
      'Shared/____SG DREAM/1.0 Examples/2.3 Change Orders/Rusin/VO_Rusin_CO1_$2,254.00.pdf',
    sourcePreserved: true,
    custodyState: 'processing',
    documentManifestState: 'draft',
    runManifestState: 'draft',
    updatedAt: '10 minutes ago',
    submittedAmount: 2254,
    governanceStatus: 'valid',
    workbookStatus: 'not_ready',
    linkedRecords: [
      {
        recordId: 'record-task-atwell-f2',
        relation: 'supports',
        label:
          'VC_Atwell Sterling Ranch F2 Townhome - Advanced Concrete Work Order - EXECUTED.pdf',
        status: 'Kickoff scope update attached',
      },
    ],
    exceptionFlags: [],
    clientOutcome:
      'Early scope change is attached to the kickoff package for review.',
    previewAsset: {
      kind: 'pdf',
      src: '/review-previews/review-rusin-co1.pdf',
    },
    reasonCode: 'Kickoff change order',
  },
  {
    id: 'record-invoice-jds-3645',
    batchId: 'batch-rollover-cab',
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-17',
    originalName: 'VI_JDS_3645_$100,000.00.pdf',
    organizedName: 'VI_JDS_3645_$100,000.00.pdf',
    documentClass: 'invoice',
    pageCount: 1,
    source: 'Ver 5 invoice archive',
    igniteUrl: EGNYTE_DREAM_URL,
    custodyPath:
      'Shared/____SG DREAM/1.0 Examples/3.1 Invoices/Ver 5/VI_JDS_3645_$100,000.00.pdf',
    sourcePreserved: true,
    custodyState: 'classified',
    documentManifestState: 'reviewed',
    runManifestState: 'draft',
    updatedAt: '7 minutes ago',
    submittedAmount: 100000,
    governanceStatus: 'valid',
    workbookStatus: 'ready_to_map',
    linkedRecords: [
      {
        recordId: 'record-task-agw-f6-005',
        relation: 'referenced_by',
        label: 'VT_SRCAB_AGW_F6-00001-005_$55,410.00.pdf',
        status: 'Task order carried forward from prior verification',
      },
      {
        recordId: 'record-proof-conditional-blank',
        relation: 'supports',
        label: 'Blank Conditional Lien Waiver.pdf',
        status: 'Support record still needs confirmation',
      },
    ],
    exceptionFlags: [],
    clientOutcome:
      'Late invoice rolled into the next verification and stays visible with its original filename.',
    previewAsset: {
      kind: 'pdf',
      src: '/review-previews/review-jds-3645-rollover.pdf',
    },
    reasonCode: 'Late rollover',
  },
  {
    id: 'record-proof-conditional-blank',
    batchId: 'batch-rollover-cab',
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-17',
    originalName: 'Blank Conditional Lien Waiver.pdf',
    organizedName: 'Blank Conditional Lien Waiver.pdf',
    documentClass: 'proof_of_payment',
    pageCount: 1,
    source: 'Conditional lien waiver archive',
    igniteUrl: EGNYTE_DREAM_URL,
    custodyPath:
      'Shared/____SG DREAM/1.0 Examples/4.2 Proofs of Payments - Conditional Lien Waivers/Blank Conditional Lien Waiver.pdf',
    sourcePreserved: true,
    custodyState: 'processing',
    documentManifestState: 'draft',
    runManifestState: 'draft',
    updatedAt: '7 minutes ago',
    submittedAmount: null,
    governanceStatus: 'needs_review',
    workbookStatus: 'not_ready',
    linkedRecords: [
      {
        recordId: 'record-invoice-jds-3645',
        relation: 'supports',
        label: 'VI_JDS_3645_$100,000.00.pdf',
        status: 'Conditional support needs confirmation',
      },
    ],
    exceptionFlags: ['missing_support'],
    clientOutcome:
      'Support record is visible, but the package still needs confirmation before it is complete.',
    previewAsset: {
      kind: 'pdf',
      src: '/review-previews/review-conditional-waiver.pdf',
    },
    reasonCode: 'Missing payment proof',
  },
  {
    id: 'record-payapp-classic-23',
    batchId: 'batch-payapp',
    districtId: 'sterling-md',
    verificationId: 'sterling-md-ver-11',
    originalName: 'VI_Classic_Pay App 23_$788,747.57.pdf',
    organizedName: 'VI_Classic_Pay App 23_$788,747.57.pdf',
    documentClass: 'pay_application',
    pageCount: 32,
    source: 'Pay applications archive',
    igniteUrl: EGNYTE_DREAM_URL,
    custodyPath:
      'Shared/____SG DREAM/1.0 Examples/3.2 Pay Applications/VI_Classic_Pay App 23_$788,747.57.pdf',
    sourcePreserved: true,
    custodyState: 'classified',
    documentManifestState: 'reviewed',
    runManifestState: 'draft',
    updatedAt: '16 minutes ago',
    submittedAmount: 788747.57,
    governanceStatus: 'missing_reference',
    workbookStatus: 'ready_to_map',
    linkedRecords: [
      {
        recordId: 'record-proof-conditional-blank-md',
        relation: 'supports',
        label: 'Blank Conditional Lien Waiver.pdf',
        status: 'Support still needs confirmation',
      },
    ],
    exceptionFlags: ['missing_support'],
    clientOutcome:
      'Metro pay application is visible in the verification inventory with support still pending.',
    previewAsset: {
      kind: 'pdf',
      src: '/review-previews/review-classic-payapp-23.pdf',
    },
    reasonCode: 'Missing payment proof',
  },
  {
    id: 'record-proof-conditional-blank-md',
    batchId: 'batch-payapp',
    districtId: 'sterling-md',
    verificationId: 'sterling-md-ver-11',
    originalName: 'Blank Conditional Lien Waiver.pdf',
    organizedName: 'Blank Conditional Lien Waiver.pdf',
    documentClass: 'proof_of_payment',
    pageCount: 1,
    source: 'Conditional lien waiver archive',
    igniteUrl: EGNYTE_DREAM_URL,
    custodyPath:
      'Shared/____SG DREAM/1.0 Examples/4.2 Proofs of Payments - Conditional Lien Waivers/Blank Conditional Lien Waiver.pdf',
    sourcePreserved: true,
    custodyState: 'processing',
    documentManifestState: 'draft',
    runManifestState: 'draft',
    updatedAt: '15 minutes ago',
    submittedAmount: null,
    governanceStatus: 'needs_review',
    workbookStatus: 'not_ready',
    linkedRecords: [
      {
        recordId: 'record-payapp-classic-23',
        relation: 'supports',
        label: 'VI_Classic_Pay App 23_$788,747.57.pdf',
        status: 'Finance support still incomplete',
      },
    ],
    exceptionFlags: ['missing_support'],
    clientOutcome:
      'Support record is present, but the Metro finance package still needs confirmation.',
  },
  {
    id: 'record-payapp-classic-17',
    batchId: 'batch-ridgeview',
    districtId: 'ridgeview',
    verificationId: 'ridgeview-ver-9',
    originalName: 'VI_Classic_Pay App 17_$865,464.69.pdf',
    organizedName: 'VI_Classic_Pay App 17_$865,464.69.pdf',
    documentClass: 'pay_application',
    pageCount: 29,
    source: 'Pay applications archive',
    igniteUrl: EGNYTE_DREAM_URL,
    custodyPath:
      'Shared/____SG DREAM/1.0 Examples/3.2 Pay Applications/VI_Classic_Pay App 17_$865,464.69.pdf',
    sourcePreserved: true,
    custodyState: 'locked',
    documentManifestState: 'approved',
    runManifestState: 'approved',
    updatedAt: '1 day ago',
    submittedAmount: 865464.69,
    governanceStatus: 'valid',
    workbookStatus: 'mapped',
    linkedRecords: [
      {
        recordId: 'record-proof-md4-unconditional',
        relation: 'supports',
        label: 'Unconditional Waiver and Release Form (002).pdf',
        status: 'Archived support attached',
      },
    ],
    exceptionFlags: [],
    clientOutcome:
      'Archived pay application remains available as a locked, read-only record.',
    previewAsset: {
      kind: 'pdf',
      src: '/review-previews/review-classic-payapp-17.pdf',
    },
    reasonCode: 'Archived package',
  },
  {
    id: 'record-proof-md4-unconditional',
    batchId: 'batch-ridgeview',
    districtId: 'ridgeview',
    verificationId: 'ridgeview-ver-9',
    originalName: 'Unconditional Waiver and Release Form (002).pdf',
    organizedName: 'Unconditional Waiver and Release Form (002).pdf',
    documentClass: 'proof_of_payment',
    pageCount: 2,
    source: 'Proof of payment archive',
    igniteUrl: EGNYTE_DREAM_URL,
    custodyPath:
      'Shared/____SG DREAM/1.0 Examples/4.3 Proofs of Payments - Unconditional Lien Waivers/Unconditional Waiver and Release Form (002).pdf',
    sourcePreserved: true,
    custodyState: 'locked',
    documentManifestState: 'approved',
    runManifestState: 'approved',
    updatedAt: '1 day ago',
    submittedAmount: null,
    governanceStatus: 'valid',
    workbookStatus: 'mapped',
    linkedRecords: [
      {
        recordId: 'record-payapp-classic-17',
        relation: 'supports',
        label: 'VI_Classic_Pay App 17_$865,464.69.pdf',
        status: 'Archived package complete',
      },
    ],
    exceptionFlags: [],
    clientOutcome:
      'Supporting waiver remains attached to the archived MD4 package for audit.',
  },
]

export const reviewItems: ReviewItem[] = [
  {
    id: 'review-payapp-pages-20',
    recordId: 'record-payapp-pages-20',
    districtId: 'sterling-cab',
    reasonCode: 'Missing payment proof',
    reason:
      'Pay application arrived as “Pages from ...” inside the invoice set and is still missing a linked proof-of-payment record.',
    confidence: 0.82,
    reviewer: 'Drafting queue',
    status: 'Needs review',
    publishReadiness: 'Blocked',
    workbookStatus: 'not_ready',
    capability: 'drafting',
    determinationMethod: 'scope_interpretation',
    evidenceMaturityStage: 'planning_document',
    targetCustodyState: 'classified',
    documentManifestState: 'draft',
    runManifestState: 'draft',
    exceptionFlags: ['pay_app_variant', 'missing_support'],
    evidenceHierarchy: [
      'Work Authorization Documents unavailable',
      'Scope Evidence: pay application variant found',
      'Geometric Evidence not used for this draft',
    ],
    governanceChecks: [
      {
        id: 'check-payapp-class',
        label: 'Document class identified as pay application',
        result: 'pass',
        note: 'Title pattern and page layout match an SRMD pay application.',
      },
      {
        id: 'check-payapp-support',
        label: 'Supporting proof of payment linked',
        result: 'fail',
        note: 'No matching proof-of-payment file exists in the current submission package.',
      },
      {
        id: 'check-payapp-workbook',
        label: 'Draft package ready for approval',
        result: 'fail',
        note: 'Draft package cannot move forward until support evidence is attached and rationale is complete.',
      },
    ],
    rationale: {
      summary:
        'Draft interpretation identifies this file as a pay application that should be separated from the invoice set and held until support evidence is linked.',
      sourceBasis:
        'Based on file title, package location, page structure, and neighboring Classic pay application examples in SG DREAM.',
      changeReason:
        'The source file entered the wrong evidence chain and cannot be relied upon until the missing support relationship is resolved.',
      approvalStatus: 'draft',
    },
    adjustmentHistory: [],
    notes: [
      'Originated in the invoice folder rather than the pay applications folder.',
      'Human drafting is needed before the record can be classified for approval.',
    ],
  },
  {
    id: 'review-mcdonal-7981',
    recordId: 'record-invoice-mcdonal-7981',
    districtId: 'sterling-cab',
    reasonCode: 'Malformed amount',
    reason:
      'Filename amount token is malformed, so the governed naming standard and workbook total cannot be trusted yet.',
    confidence: 0.76,
    reviewer: 'Drafting queue',
    status: 'Naming check',
    publishReadiness: 'Blocked',
    workbookStatus: 'not_ready',
    capability: 'drafting',
    determinationMethod: 'scope_interpretation',
    evidenceMaturityStage: 'planning_document',
    targetCustodyState: 'classified',
    documentManifestState: 'draft',
    runManifestState: 'draft',
    exceptionFlags: ['malformed_amount'],
    evidenceHierarchy: [
      'Work Authorization Documents not needed for naming correction',
      'Scope Evidence: invoice source body',
      'Geometric Evidence not applicable',
    ],
    governanceChecks: [
      {
        id: 'check-mcdonal-class',
        label: 'Invoice class confirmed',
        result: 'pass',
        note: 'Vendor and invoice number are clear even though the amount token is broken.',
      },
      {
        id: 'check-mcdonal-name',
        label: 'Governed naming pattern complete',
        result: 'fail',
        note: 'Amount placeholder prevents final governed naming.',
      },
      {
        id: 'check-mcdonal-workbook',
        label: 'Draft rationale complete',
        result: 'warning',
        note: 'Source amount still needs to be recovered from the PDF body before approval.',
      },
    ],
    rationale: {
      summary:
        'Draft meaning is stable enough to classify the record as an invoice, but the governed name remains provisional until the amount is recovered.',
      sourceBasis:
        'Based on source invoice content, vendor naming pattern, and neighboring Ver 3 invoice examples in SG DREAM.',
      changeReason:
        'The malformed filename breaks disciplined naming, so drafting must restore defensible meaning before approval.',
      approvalStatus: 'draft',
    },
    adjustmentHistory: [],
    notes: [
      'Compare against source invoice body to recover the missing amount.',
      'Do not send to approval until the governed draft rationale is complete.',
    ],
  },
  {
    id: 'review-sunflower-duplicate',
    recordId: 'record-invoice-sunflower-33032-dup',
    districtId: 'sterling-cab',
    reasonCode: 'Duplicate file',
    reason:
      'A second copy of the same Sunflower invoice was found in Ver 5 and should not be mapped or published as a new record.',
    confidence: 0.94,
    reviewer: 'Approval queue',
    status: 'Needs review',
    publishReadiness: 'Blocked',
    workbookStatus: 'not_ready',
    capability: 'approval',
    determinationMethod: 'scope_interpretation',
    evidenceMaturityStage: 'final_plat',
    targetCustodyState: 'locked',
    documentManifestState: 'reviewed',
    runManifestState: 'reviewed',
    exceptionFlags: ['duplicate_file'],
    evidenceHierarchy: [
      'Work Authorization Documents not needed for duplicate decision',
      'Scope Evidence: duplicate invoice pair',
      'Geometric Evidence not applicable',
    ],
    governanceChecks: [
      {
        id: 'check-sunflower-class',
        label: 'Invoice class confirmed',
        result: 'pass',
        note: 'Both files match the same vendor, invoice number, and amount pattern.',
      },
      {
        id: 'check-sunflower-duplicate',
        label: 'Duplicate source cleared',
        result: 'fail',
        note: 'One file must be suppressed before the authority state can be locked.',
      },
      {
        id: 'check-sunflower-workbook',
        label: 'Superseded path recorded',
        result: 'warning',
        note: 'Primary record is approved; duplicate needs an explicit audit disposition.',
      },
    ],
    rationale: {
      summary:
        'Draft recommendation suppresses the duplicate while preserving it as immutable evidence in the audit chain.',
      sourceBasis:
        'Based on matching vendor, invoice number, amount, and the existing approved primary record already present in SG DREAM.',
      changeReason:
        'Approval is needed because this decision changes authority state, not just display status.',
      approvalStatus: 'reviewed',
    },
    adjustmentHistory: [
      {
        id: 'adj-sunflower-duplicate-1',
        priorState: 'Draft duplicate disposition',
        newState: 'Awaiting locked audit disposition',
        reason: 'Primary invoice already approved as the relied source.',
        affectedOutputs: ['Duplicate suppression register', 'Approval audit chain'],
      },
    ],
    notes: [
      'Primary invoice file is already approved and available in Egnyte.',
      'Duplicate should remain visible for audit but excluded from governed outputs.',
    ],
  },
  {
    id: 'review-contract-agw-xxx',
    recordId: 'record-contract-agw-xxx',
    districtId: 'sterling-cab',
    reasonCode: 'Placeholder source',
    reason:
      'The AGW contract still contains an XXX placeholder in the source filename, so the evidence chain cannot be marked complete.',
    confidence: 0.71,
    reviewer: 'Drafting queue',
    status: 'Needs review',
    publishReadiness: 'Needs review',
    workbookStatus: 'not_ready',
    capability: 'drafting',
    determinationMethod: 'scope_interpretation',
    evidenceMaturityStage: 'planning_document',
    targetCustodyState: 'classified',
    documentManifestState: 'draft',
    runManifestState: 'draft',
    exceptionFlags: ['placeholder_contract'],
    evidenceHierarchy: [
      'Work Authorization Documents: master service agreement',
      'Scope Evidence: linked task orders',
      'Geometric Evidence not applicable',
    ],
    governanceChecks: [
      {
        id: 'check-contract-class',
        label: 'Contract class confirmed',
        result: 'pass',
        note: 'The file is clearly a master service agreement.',
      },
      {
        id: 'check-contract-placeholder',
        label: 'Placeholder text cleared',
        result: 'fail',
        note: 'XXX token must be replaced or explicitly accepted before approval.',
      },
      {
        id: 'check-contract-link',
        label: 'Linked task orders preserved',
        result: 'pass',
        note: 'Downstream task orders remain connected to the contract source.',
      },
    ],
    rationale: {
      summary:
        'Draft package keeps the contract in custody, links downstream task orders, and flags the placeholder as a governed drafting issue.',
      sourceBasis:
        'Based on the contract body, AGW task order references, and SG DREAM naming standards for executed work authorizations.',
      changeReason:
        'The record should not advance into approval while the placeholder leaves meaning ambiguous.',
      approvalStatus: 'draft',
    },
    adjustmentHistory: [],
    notes: [
      'Drafting should determine whether the placeholder can be normalized or must remain explicit for audit.',
    ],
  },
  {
    id: 'review-jds-3601',
    recordId: 'record-invoice-jds-3601',
    districtId: 'sterling-cab',
    reasonCode: 'Governance clear',
    reason:
      'Invoice, task order, and proof-of-payment chain are complete and ready for approval into a relied or locked state.',
    confidence: 0.98,
    reviewer: 'Approval queue',
    status: 'Ready to publish',
    publishReadiness: 'Ready',
    workbookStatus: 'mapped',
    capability: 'approval',
    determinationMethod: 'scope_interpretation',
    evidenceMaturityStage: 'final_plat',
    targetCustodyState: 'locked',
    documentManifestState: 'reviewed',
    runManifestState: 'reviewed',
    exceptionFlags: [],
    evidenceHierarchy: [
      'Work Authorization Documents: AGW task order',
      'Scope Evidence: invoice and supporting proof',
      'Geometric Evidence not needed for this approval package',
    ],
    governanceChecks: [
      {
        id: 'check-jds-class',
        label: 'Invoice class confirmed',
        result: 'pass',
        note: 'Vendor, sequence, and amount all match the governed naming standard.',
      },
      {
        id: 'check-jds-link',
        label: 'Linked evidence chain complete',
        result: 'pass',
        note: 'Task order and proof-of-payment links are attached.',
      },
      {
        id: 'check-jds-export',
        label: 'Approval package complete',
        result: 'pass',
        note: 'Draft manifests, rationale, and custody posture are ready for engineer sign-off.',
      },
    ],
    rationale: {
      summary:
        'Draft recommendation is complete and defensible: this invoice package can advance from classified custody into a locked governed record.',
      sourceBasis:
        'Based on the linked task order, preserved source invoice, and unconditional waiver already attached in SG DREAM.',
      changeReason:
        'Approval moves this record from drafted meaning into final relied authority with no unresolved exceptions.',
      approvalStatus: 'reviewed',
    },
    adjustmentHistory: [
      {
        id: 'adj-jds-3601-1',
        priorState: 'Reviewed draft package',
        newState: 'Ready for locked authority state',
        reason: 'All supporting evidence and governed rationale are complete.',
        affectedOutputs: ['Approval queue', 'Locked evidence register'],
      },
    ],
    notes: [
      'This is the clearest example of the SG DREAM path the client-facing portals should communicate.',
    ],
  },
  {
    id: 'review-jds-3645-rollover',
    recordId: 'record-invoice-jds-3645',
    districtId: 'sterling-cab',
    reasonCode: 'Late rollover',
    reason:
      'Invoice arrived after the Verification 16 cutoff and needs drafting confirmation before it is carried into Verification 17.',
    confidence: 0.88,
    reviewer: 'Drafting queue',
    status: 'Needs review',
    publishReadiness: 'Needs review',
    workbookStatus: 'ready_to_map',
    capability: 'drafting',
    determinationMethod: 'scope_interpretation',
    evidenceMaturityStage: 'planning_document',
    targetCustodyState: 'classified',
    documentManifestState: 'reviewed',
    runManifestState: 'draft',
    exceptionFlags: [],
    evidenceHierarchy: [
      'Work Authorization Documents: AGW task order carried from prior verification',
      'Scope Evidence: invoice rolled into the next verification',
      'Geometric Evidence not applicable',
    ],
    governanceChecks: [
      {
        id: 'check-rollover-cutoff',
        label: 'Verification rollover confirmed',
        result: 'warning',
        note: 'Drafting should confirm the invoice missed the prior cutoff and belongs in Verification 17.',
      },
      {
        id: 'check-rollover-support',
        label: 'Supporting proof linked',
        result: 'fail',
        note: 'Proof record is still conditional and needs confirmation before the draft can advance.',
      },
      {
        id: 'check-rollover-rationale',
        label: 'Rollover rationale complete',
        result: 'warning',
        note: 'Explain why the record moved forward into the next verification window.',
      },
    ],
    rationale: {
      summary:
        'Draft recommendation keeps the invoice visible in Verification 17 while the late-upload rationale and support chain are confirmed.',
      sourceBasis:
        'Based on the invoice date, the CAB cutoff schedule, and the carried-forward AGW task order.',
      changeReason:
        'Rollover changes verification placement and must stay explicit in the draft package.',
      approvalStatus: 'draft',
    },
    adjustmentHistory: [],
    notes: [
      'Late uploads should remain visible with their original filename and new verification assignment.',
    ],
  },
  {
    id: 'review-contract-atwell-kickoff',
    recordId: 'record-contract-atwell-msa',
    districtId: 'sterling-cab',
    reasonCode: 'Kickoff contract',
    reason:
      'Executed Atwell contract and work order need a draft package before recurring monthly submissions can reference them cleanly.',
    confidence: 0.84,
    reviewer: 'Drafting queue',
    status: 'Needs review',
    publishReadiness: 'Needs review',
    workbookStatus: 'not_ready',
    capability: 'drafting',
    determinationMethod: 'scope_interpretation',
    evidenceMaturityStage: 'planning_document',
    targetCustodyState: 'classified',
    documentManifestState: 'draft',
    runManifestState: 'draft',
    exceptionFlags: [],
    evidenceHierarchy: [
      'Work Authorization Documents: executed contract and work order',
      'Scope Evidence not yet attached',
      'Geometric Evidence not applicable',
    ],
    governanceChecks: [
      {
        id: 'check-kickoff-contract',
        label: 'Executed contract preserved',
        result: 'pass',
        note: 'Original executed agreement is preserved in custody.',
      },
      {
        id: 'check-kickoff-work-order',
        label: 'Work order linked to kickoff package',
        result: 'pass',
        note: 'Task-order record is attached to the same kickoff package.',
      },
      {
        id: 'check-kickoff-rationale',
        label: 'Kickoff rationale complete',
        result: 'warning',
        note: 'Drafting should explain how this package will anchor downstream monthly invoices.',
      },
    ],
    rationale: {
      summary:
        'Kickoff package establishes contract and task-order context before monthly reimbursement evidence begins arriving.',
      sourceBasis:
        'Based on the executed Atwell agreement, the associated work order, and the contract-first evidence hierarchy.',
      changeReason:
        'Drafting is needed so future invoice chains can rely on a prepared kickoff package.',
      approvalStatus: 'draft',
    },
    adjustmentHistory: [],
    notes: [
      'Use field confirmation to verify the work-order scope label before approval.',
    ],
  },
  {
    id: 'review-payapp-classic-23',
    recordId: 'record-payapp-classic-23',
    districtId: 'sterling-md',
    reasonCode: 'Metro support gap',
    reason:
      'Metro finance package is missing confirmed proof-of-payment support and needs drafting before approval.',
    confidence: 0.83,
    reviewer: 'Drafting queue',
    status: 'Needs review',
    publishReadiness: 'Blocked',
    workbookStatus: 'ready_to_map',
    capability: 'drafting',
    determinationMethod: 'scope_interpretation',
    evidenceMaturityStage: 'planning_document',
    targetCustodyState: 'classified',
    documentManifestState: 'reviewed',
    runManifestState: 'draft',
    exceptionFlags: ['missing_support'],
    evidenceHierarchy: [
      'Work Authorization Documents not attached to this finance package',
      'Scope Evidence: pay application source body',
      'Geometric Evidence not applicable',
    ],
    governanceChecks: [
      {
        id: 'check-metro-payapp-class',
        label: 'Pay application class confirmed',
        result: 'pass',
        note: 'Source file matches the Metro pay application pattern.',
      },
      {
        id: 'check-metro-support',
        label: 'Supporting proof linked',
        result: 'fail',
        note: 'Finance package still needs a confirmed proof-of-payment record.',
      },
      {
        id: 'check-metro-draft',
        label: 'Draft rationale complete',
        result: 'warning',
        note: 'Document is ready for drafting, but not yet ready for approval.',
      },
    ],
    rationale: {
      summary:
        'Metro pay application is stable enough to classify, but the package stays blocked until support evidence is confirmed.',
      sourceBasis:
        'Based on the pay application body, current verification context, and the missing support record in the finance package.',
      changeReason:
        'Drafting must keep the missing-support posture explicit before engineer approval can occur.',
      approvalStatus: 'draft',
    },
    adjustmentHistory: [],
    notes: ['Finance reviewers need a clear support-pending posture on this package.'],
  },
  {
    id: 'review-payapp-classic-23-approval',
    recordId: 'record-payapp-classic-23',
    districtId: 'sterling-md',
    reasonCode: 'Missing payment proof',
    reason:
      'Drafting is complete enough for review, but the package remains blocked until the missing support decision is resolved.',
    confidence: 0.86,
    reviewer: 'Approval queue',
    status: 'Needs review',
    publishReadiness: 'Blocked',
    workbookStatus: 'ready_to_map',
    capability: 'approval',
    determinationMethod: 'scope_interpretation',
    evidenceMaturityStage: 'preliminary_plat',
    targetCustodyState: 'relied',
    documentManifestState: 'reviewed',
    runManifestState: 'reviewed',
    exceptionFlags: ['missing_support'],
    evidenceHierarchy: [
      'Work Authorization Documents not attached in this package',
      'Scope Evidence: pay application source body',
      'Geometric Evidence not applicable',
    ],
    governanceChecks: [
      {
        id: 'check-metro-approval-support',
        label: 'Supporting proof resolved',
        result: 'fail',
        note: 'Engineer approval cannot advance while the proof-of-payment gap remains open.',
      },
      {
        id: 'check-metro-approval-rationale',
        label: 'Draft rationale reviewed',
        result: 'pass',
        note: 'Draft rationale is present and ready for engineer review.',
      },
      {
        id: 'check-metro-approval-custody',
        label: 'Authority transition allowed',
        result: 'warning',
        note: 'Target state can only advance if the support gap is explicitly resolved.',
      },
    ],
    rationale: {
      summary:
        'Approval remains blocked because the Metro package still needs a confirmed proof-of-payment decision.',
      sourceBasis:
        'Based on the reviewed draft package and the unresolved supporting-proof flag.',
      changeReason:
        'Engineer review is needed to either hold or explicitly transition the package once support is resolved.',
      approvalStatus: 'reviewed',
    },
    adjustmentHistory: [],
    notes: ['This is the blocked missing-support case for the approval console.'],
  },
  {
    id: 'review-payapp-classic-17-archive',
    recordId: 'record-payapp-classic-17',
    districtId: 'ridgeview',
    reasonCode: 'Archived package',
    reason:
      'Locked MD4 package remains available for audit and carries prior approval history that can be reviewed without reopening the client workflow.',
    confidence: 0.97,
    reviewer: 'Approval queue',
    status: 'Published',
    publishReadiness: 'Ready',
    workbookStatus: 'mapped',
    capability: 'approval',
    determinationMethod: 'scope_interpretation',
    evidenceMaturityStage: 'final_plat',
    targetCustodyState: 'locked',
    documentManifestState: 'approved',
    runManifestState: 'approved',
    exceptionFlags: [],
    evidenceHierarchy: [
      'Work Authorization Documents recorded in prior package history',
      'Scope Evidence: archived pay application and waiver',
      'Geometric Evidence not applicable',
    ],
    governanceChecks: [
      {
        id: 'check-md4-archive-locked',
        label: 'Locked custody preserved',
        result: 'pass',
        note: 'Package remains in the locked audit register.',
      },
      {
        id: 'check-md4-archive-history',
        label: 'Superseded history preserved',
        result: 'pass',
        note: 'Prior approval transition remains attached to the archive.',
      },
      {
        id: 'check-md4-archive-visibility',
        label: 'Read-only visibility maintained',
        result: 'pass',
        note: 'Client can view the archived package without re-opening the workflow.',
      },
    ],
    rationale: {
      summary:
        'Archived package remains locked and visible for audit with prior decision history preserved.',
      sourceBasis:
        'Based on the locked pay application, supporting waiver, and prior approval trail already attached to MD4.',
      changeReason:
        'Archive review confirms the current read-only posture and preserves the superseded decision trail.',
      approvalStatus: 'approved',
    },
    adjustmentHistory: [
      {
        id: 'adj-md4-archive-1',
        priorState: 'Relied package',
        newState: 'Locked archive',
        reason: 'Package completed reimbursement review and moved into archived authority.',
        affectedOutputs: ['Locked archive register', 'Client read-only package'],
      },
      {
        id: 'adj-md4-archive-2',
        priorState: 'Draft closeout',
        newState: 'Relied package',
        reason: 'Historical approval completed before archive transition.',
        affectedOutputs: ['Approval history', 'Audit trace'],
      },
    ],
    notes: ['This is the superseded-history example for the approval console.'],
  },
]

export function getDistrict(districtId: string) {
  return districts.find((district) => district.id === districtId) ?? districts[0]
}

export function getVerification(verificationId: string) {
  return (
    verifications.find((verification) => verification.id === verificationId) ??
    verifications[0]
  )
}

export function getVerificationsByDistrict(districtId: string) {
  return verifications.filter((verification) => verification.districtId === districtId)
}

export function getActiveVerificationByDistrict(districtId: string) {
  return (
    getVerificationsByDistrict(districtId).find(
      (verification) => verification.timing !== 'Past cutoff',
    ) ?? getVerificationsByDistrict(districtId)[0]
  )
}

export function getNextVerificationByDistrict(
  districtId: string,
): VerificationRecord | undefined {
  const districtVerifications = getVerificationsByDistrict(districtId)
  const activeVerification = getActiveVerificationByDistrict(districtId)
  const activeIndex = districtVerifications.findIndex(
    (verification) => verification.id === activeVerification.id,
  )

  return districtVerifications[activeIndex + 1]
}

export function getNextVerificationAfter(
  verificationId: string,
): VerificationRecord | undefined {
  const currentVerification = getVerification(verificationId)
  const districtVerifications = getVerificationsByDistrict(
    currentVerification.districtId,
  )
  const currentIndex = districtVerifications.findIndex(
    (verification) => verification.id === verificationId,
  )

  return districtVerifications[currentIndex + 1]
}

export function getBatchesByDistrict(districtId: string) {
  return uploadBatches.filter((batch) => batch.districtId === districtId)
}

export function getBatchById(batchId: string) {
  return uploadBatches.find((batch) => batch.id === batchId)
}

export function getDocumentById(recordId: string) {
  return documents.find((document) => document.id === recordId)
}

export function getDocumentsByVerification(verificationId: string) {
  return documents.filter((document) => document.verificationId === verificationId)
}

export function getDocumentsByDistrict(districtId: string) {
  return documents.filter((document) => document.districtId === districtId)
}

export function getDistrictProfile(districtId: string) {
  return districtProfiles[districtId] ?? 'active'
}

export function getClientDocumentsByDistrict(
  districtId: string,
  verificationId?: string,
) {
  return getDocumentsByDistrict(districtId).filter(
    (document) =>
      document.documentClass !== 'workbook' &&
      document.documentClass !== 'governance_doc' &&
      (verificationId ? document.verificationId === verificationId : true)
  )
}

export function getCurrentVerificationDocumentsByDistrict(districtId: string) {
  const activeVerification = getActiveVerificationByDistrict(districtId)
  return getClientDocumentsByDistrict(districtId, activeVerification.id)
}

export function getPackageDetailById(packageId: string) {
  return clientPackageDetails.find((detail) => detail.id === packageId)
}

export function getVerificationPackages(
  districtId: string,
  verificationId: string,
) {
  return clientPackageDetails.filter(
    (detail) =>
      detail.districtId === districtId && detail.verificationId === verificationId,
  )
}

export function getDocumentsByPackageId(packageId: string) {
  const detail = getPackageDetailById(packageId)

  if (!detail) {
    return [] as DocumentRecord[]
  }

  return detail.fileRecordIds.flatMap((recordId) => {
    const record = getDocumentById(recordId)
    return record ? [record] : []
  })
}

export function getScenarioPackByPackageId(packageId: string) {
  return scenarioPacks.find((scenario) => scenario.packageId === packageId)
}

export function getAvailablePackageModes(districtId: string) {
  return Array.from(
    new Set(
      clientPackageDetails
        .filter((detail) => detail.districtId === districtId)
        .map((detail) => detail.mode),
    ),
  )
}

export function getAllowedCreatePackageDistrictId(
  permittedDistrictIds: string[],
  requestedDistrictId?: string,
) {
  const permittedDistricts = getPermittedDistrictOptions(permittedDistrictIds)
  const eligibleDistricts = permittedDistricts.filter(
    (district) => getDistrictProfile(district.id) !== 'archived',
  )

  if (requestedDistrictId) {
    const requestedDistrict = eligibleDistricts.find(
      (district) => district.id === requestedDistrictId,
    )

    if (requestedDistrict) {
      return requestedDistrict.id
    }
  }

  return eligibleDistricts.at(0)?.id ?? permittedDistricts.at(0)?.id ?? districts[0].id
}

export function getCreatePackageDraftByContext(
  districtId: string,
  verificationId: string,
  mode: PackageMode,
) {
  return (
    packageDrafts.find(
      (draft) =>
        draft.districtId === districtId &&
        draft.verificationId === verificationId &&
        draft.mode === mode,
    )?.draft ??
    packageDrafts.find(
      (draft) => draft.districtId === districtId && draft.mode === mode,
    )?.draft ??
    packageDrafts.find((draft) => draft.mode === mode)?.draft ??
    createPackageDraft
  )
}

export function getReviewItemsByDistrict(districtId: string) {
  return reviewItems.filter((item) => item.districtId === districtId)
}

export function getReviewItemById(reviewId: string) {
  return reviewItems.find((item) => item.id === reviewId)
}

export function getReviewFieldConfirmations(reviewId: string) {
  return reviewFieldConfirmations[reviewId] ?? []
}

export function getCreatePackageStepLabel(step: CreatePackageStep) {
  return createPackageStepLabels[step]
}

export function getVerificationTimingLabel(timing: VerificationTimingState) {
  return verificationTimingLabels[timing]
}

export function getDocumentClassLabel(documentClass: DocumentClass) {
  return documentClassLabels[documentClass]
}

export function getRelationshipLabel(relationship: RelationshipType) {
  return relationshipLabels[relationship]
}

export function getGovernanceStatusLabel(status: GovernanceStatus) {
  return governanceStatusLabels[status]
}

export function getCustodyStateLabel(state: CustodyState) {
  return custodyStateLabels[state]
}

export function getManifestStateLabel(state: ManifestState) {
  return manifestStateLabels[state]
}

export function getUserCapabilityLabel(capability: UserCapability) {
  return userCapabilityLabels[capability]
}

export function getDeterminationMethodLabel(method: DeterminationMethod) {
  return determinationMethodLabels[method]
}

export function getEvidenceMaturityStageLabel(stage: EvidenceMaturityStage) {
  return evidenceMaturityStageLabels[stage]
}

export function getExceptionFlagLabel(flag: ExceptionFlag) {
  return exceptionFlagLabels[flag]
}

export function getCategoryCountsByDistrict(districtId: string) {
  const districtDocuments = getClientDocumentsByDistrict(districtId)

  return clientDocumentClassOrder.map((documentClass) => ({
    documentClass,
    label: getDocumentClassLabel(documentClass),
    count: districtDocuments.filter(
      (document) => document.documentClass === documentClass
    ).length,
  }))
}

export function getExceptionCountsByDistrict(districtId: string) {
  const districtDocuments = getClientDocumentsByDistrict(districtId)

  return Object.entries(exceptionFlagLabels)
    .map(([flag, label]) => ({
      flag: flag as ExceptionFlag,
      label,
      count: districtDocuments.filter((document) =>
        document.exceptionFlags.includes(flag as ExceptionFlag)
      ).length,
    }))
    .filter((entry) => entry.count > 0)
}

export function getLinkedRecordSummary(document: DocumentRecord) {
  if (document.linkedRecords.length === 0) {
    return 'Evidence chain not linked yet'
  }

  return document.linkedRecords
    .map(
      (record) =>
        `${relationshipLabels[record.relation]} ${record.label.replace('.pdf', '')}`,
    )
    .join(' • ')
}

export function getSubmittedAmountTotal(records: DocumentRecord[]) {
  return records.reduce(
    (sum, record) =>
      record.exceptionFlags.includes('duplicate_file') ||
      !record.submittedAmount ||
      record.submittedAmount <= 0
        ? sum
        : sum + record.submittedAmount,
    0,
  )
}

export function getSubmittedAmountByDistrict(
  districtId: string,
  verificationId?: string,
) {
  return getSubmittedAmountTotal(
    getClientDocumentsByDistrict(districtId, verificationId).filter(
      (document) =>
        document.documentClass === 'invoice' ||
        document.documentClass === 'pay_application',
    ),
  )
}

export function getRelationshipChainsByDistrict(
  districtId: string,
  verificationId?: string,
) {
  return relationshipChains.filter(
    (chain) =>
      chain.districtId === districtId &&
      (verificationId ? chain.verificationId === verificationId : true),
  )
}

export function getPermittedDistrictOptions(permittedDistrictIds: string[]) {
  return districts.filter((district) => permittedDistrictIds.includes(district.id))
}

export function getClientWorkspaceSession(accountId?: string) {
  return clientSessions.find((account) => account.id === accountId) ??
    clientWorkspaceSession
}

export function getWorkspaceContext(
  pathname: string,
  accountId?: string,
): MockWorkOSSession {
  if (
    pathname.startsWith('/internal-dashboard') ||
    pathname.startsWith('/submission-inbox')
  ) {
    return operationsWorkspaceSession
  }

  if (pathname.startsWith('/verification-management')) {
    return verificationWorkspaceSession
  }

  if (pathname.startsWith('/entity-admin')) {
    return adminWorkspaceSession
  }

  if (pathname.startsWith('/review-console')) {
    return approvalWorkspaceSession
  }

  if (pathname.startsWith('/review-workbench')) {
    return draftingWorkspaceSession
  }

  return getClientWorkspaceSession(accountId)
}

export function getWorkspaceAccountById(accountId: string) {
  return workOSWorkspaceAccounts.find((account) => account.id === accountId)
}

export function getClientFacingRecordStatus(
  document: DocumentRecord,
): ClientFacingStatus {
  if (document.custodyState === 'locked' || document.custodyState === 'relied') {
    return 'Available'
  }

  if (
    document.documentManifestState === 'reviewed' ||
    document.documentManifestState === 'approved' ||
    document.custodyState === 'classified'
  ) {
    return 'Ready for review'
  }

  return custodyStateLabels[document.custodyState] as ClientFacingStatus
}

export function getClientFacingBatchStatus(
  batch: UploadBatch,
): ClientFacingStatus {
  if (batch.custodyState === 'locked' || batch.custodyState === 'relied') {
    return 'Available'
  }

  if (
    batch.manifestState === 'reviewed' ||
    batch.manifestState === 'approved' ||
    batch.custodyState === 'classified'
  ) {
    return 'Ready for review'
  }

  return custodyStateLabels[batch.custodyState] as ClientFacingStatus
}
