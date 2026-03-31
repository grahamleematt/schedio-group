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
  | 'Engineering review'
  | 'Available in Egnyte'

export type ClientFacingStatus = ProcessingStage

export type CreatePackageSourceContext = 'trust' | 'operations'

export type CreatePackageStep = 'context' | 'files' | 'review' | 'confirm'

export type LinkedRecord = {
  recordId: string
  relation: RelationshipType
  label: string
  status: string
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
  'Engineering review',
  'Available in Egnyte',
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

export const createPackageSourceLabels: Record<CreatePackageSourceContext, string> =
  {
    trust: 'Client Intake',
    operations: 'Client Operations',
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

export const uploadBatches: UploadBatch[] = [
  {
    id: 'batch-ver5',
    districtId: 'sterling-cab',
    name: 'Ver 5 invoice intake',
    submittedBy: 'Shared client login',
    submittedAt: 'March 29, 2026 at 8:18 AM',
    documentCount: 32,
    status: 'Processing',
    progress: 68,
    channel: 'Egnyte intake folder',
    linkedChains: 11,
    exceptionCount: 3,
    documentClasses: ['invoice', 'pay_application', 'proof_of_payment'],
    note: 'Evidence is preserved in Egnyte custody first, then drafted into manifests and linked record chains.',
    custodyState: 'processing',
    manifestState: 'draft',
  },
  {
    id: 'batch-agw',
    districtId: 'sterling-cab',
    name: 'AGW contract + task orders',
    submittedBy: 'Tim Case',
    submittedAt: 'March 28, 2026 at 4:12 PM',
    documentCount: 11,
    status: 'Engineering review',
    progress: 86,
    channel: 'Client custody submission',
    linkedChains: 6,
    exceptionCount: 1,
    documentClasses: ['contract', 'task_order', 'change_order'],
    note: 'Custody is clean and most manifests are drafted, but one placeholder contract still needs governed review.',
    custodyState: 'classified',
    manifestState: 'reviewed',
  },
  {
    id: 'batch-payapp',
    districtId: 'sterling-md',
    name: 'SRMD pay applications',
    submittedBy: 'Finance coordinator',
    submittedAt: 'March 27, 2026 at 2:42 PM',
    documentCount: 9,
    status: 'Engineering review',
    progress: 93,
    channel: 'Egnyte reconciliation folder',
    linkedChains: 5,
    exceptionCount: 1,
    documentClasses: ['pay_application', 'proof_of_payment', 'workbook'],
    note: 'Evidence package is nearly complete, but a support gap keeps the draft package from moving forward.',
    custodyState: 'classified',
    manifestState: 'reviewed',
  },
  {
    id: 'batch-ridgeview',
    districtId: 'ridgeview',
    name: 'MD4 locked package',
    submittedBy: 'Client portal',
    submittedAt: 'March 26, 2026 at 11:09 AM',
    documentCount: 14,
    status: 'Available in Egnyte',
    progress: 100,
    channel: 'Client portal',
    linkedChains: 4,
    exceptionCount: 0,
    documentClasses: ['invoice', 'task_order', 'proof_of_payment'],
    note: 'Package is locked with preserved originals, approved manifests, and Egnyte handoff complete.',
    custodyState: 'locked',
    manifestState: 'approved',
  },
]

export const createPackageDraft: PackageDraftSummary = {
  packageName: 'Sterling Ranch CAB March close package',
  packageLabel: 'PKG-SRCAB-20260330-017',
  districtId: 'sterling-cab',
  submissionChannel: 'Client custody submission',
  purpose:
    'Submit a mixed evidence package for Sterling Ranch CAB so contract, task order, invoice, pay application, and proof records enter one governed intake path.',
  description:
    'The package should preserve source files in Egnyte first, then let SG DREAM recognize classes, flag issues, and prepare linked evidence expectations before engineering review begins.',
  expectedClasses: [
    {
      documentClass: 'contract',
      selected: true,
      note: 'Master service agreement and supporting contract records.',
    },
    {
      documentClass: 'task_order',
      selected: true,
      note: 'Work authorization and referenced task order records.',
    },
    {
      documentClass: 'change_order',
      selected: false,
      note: 'Optional if the package includes downstream scope changes.',
    },
    {
      documentClass: 'invoice',
      selected: true,
      note: 'Primary invoice evidence and any vendor variations.',
    },
    {
      documentClass: 'pay_application',
      selected: true,
      note: 'Pay application records that may need supporting proof.',
    },
    {
      documentClass: 'proof_of_payment',
      selected: true,
      note: 'Waivers or payment support that completes the evidence chain.',
    },
  ],
  files: [
    {
      id: 'draft-file-contract-agw',
      recordId: 'record-contract-agw-xxx',
      linkedExpectation: 'Should anchor the AGW task order chain.',
      warningFlags: ['placeholder_contract'],
      sourcePreserved: true,
    },
    {
      id: 'draft-file-task-agw',
      recordId: 'record-task-agw-f6-005',
      linkedExpectation: 'Expected to link forward into invoice evidence.',
      warningFlags: [],
      sourcePreserved: true,
    },
    {
      id: 'draft-file-jds',
      recordId: 'record-invoice-jds-3601',
      linkedExpectation: 'Should connect to both task order and proof of payment.',
      warningFlags: [],
      sourcePreserved: true,
    },
    {
      id: 'draft-file-proof-jds',
      recordId: 'record-proof-jds-3601',
      linkedExpectation: 'Completes the JDS invoice support chain.',
      warningFlags: [],
      sourcePreserved: true,
    },
    {
      id: 'draft-file-payapp',
      recordId: 'record-payapp-pages-20',
      linkedExpectation: 'Needs supporting proof before the package can advance cleanly.',
      warningFlags: ['pay_app_variant', 'missing_support'],
      sourcePreserved: true,
    },
    {
      id: 'draft-file-mcdonal',
      recordId: 'record-invoice-mcdonal-7981',
      linkedExpectation: 'Invoice class is recognized, but governed naming still needs confirmation.',
      warningFlags: ['malformed_amount'],
      sourcePreserved: true,
    },
    {
      id: 'draft-file-sunflower-dup',
      recordId: 'record-invoice-sunflower-33032-dup',
      linkedExpectation: 'Should be checked against the primary Sunflower invoice as a possible duplicate.',
      warningFlags: ['duplicate_file'],
      sourcePreserved: true,
    },
  ],
  startingState: 'incoming',
  linkedEvidenceChain: [
    'VT_SRCAB_AGW_F6-00001-005_$55,410.00.pdf',
    'VI_JDS_3601_$2,639.67.pdf',
    'POP_JDS_3601_Unconditional Waiver.pdf',
  ],
  outcomes: [
    'Category recognition is available for all uploaded source files.',
    'One linked task-order-to-invoice-to-proof chain is ready to enter custody cleanly.',
    'Engineering review should start with the pay application support gap and the malformed McDonal filename.',
    'The package will enter SG DREAM as Incoming after the source files are preserved in Egnyte.',
  ],
  warnings: [
    {
      id: 'draft-warning-duplicate',
      flag: 'duplicate_file',
      title: 'Duplicate watch',
      note: 'A second Sunflower invoice copy is present and should stay visible for traceability until the package is reviewed.',
      severity: 'attention',
    },
    {
      id: 'draft-warning-placeholder',
      flag: 'placeholder_contract',
      title: 'Placeholder source',
      note: 'The AGW contract filename still contains an XXX placeholder and should stay visible as a governed source correction.',
      severity: 'warning',
    },
    {
      id: 'draft-warning-malformed',
      flag: 'malformed_amount',
      title: 'Malformed amount',
      note: 'The McDonal invoice keeps its source file, but the governed amount still needs engineering confirmation.',
      severity: 'warning',
    },
    {
      id: 'draft-warning-support',
      flag: 'missing_support',
      title: 'Missing supporting proof',
      note: 'The pay application is recognized, but it should remain under engineering review until support evidence is attached.',
      severity: 'attention',
    },
  ],
}

export const documents: DocumentRecord[] = [
  {
    id: 'record-contract-agw-xxx',
    batchId: 'batch-agw',
    districtId: 'sterling-cab',
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
    governanceStatus: 'valid',
    workbookStatus: 'not_ready',
    linkedRecords: [],
    exceptionFlags: [],
    clientOutcome: 'Internal governance artifact.',
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
]

export function getDistrict(districtId: string) {
  return districts.find((district) => district.id === districtId) ?? districts[0]
}

export function getBatchesByDistrict(districtId: string) {
  return uploadBatches.filter((batch) => batch.districtId === districtId)
}

export function getDocumentById(recordId: string) {
  return documents.find((document) => document.id === recordId)
}

export function getDocumentsByDistrict(districtId: string) {
  return documents.filter((document) => document.districtId === districtId)
}

export function getClientDocumentsByDistrict(districtId: string) {
  return getDocumentsByDistrict(districtId).filter(
    (document) =>
      document.documentClass !== 'workbook' &&
      document.documentClass !== 'governance_doc'
  )
}

export function getReviewItemsByDistrict(districtId: string) {
  return reviewItems.filter((item) => item.districtId === districtId)
}

export function getReviewItemById(reviewId: string) {
  return reviewItems.find((item) => item.id === reviewId)
}

export function getCreatePackageStepLabel(step: CreatePackageStep) {
  return createPackageStepLabels[step]
}

export function getCreatePackageSourceLabel(source: CreatePackageSourceContext) {
  return createPackageSourceLabels[source]
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
  const districtDocuments = getDocumentsByDistrict(districtId)

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
        `${relationshipLabels[record.relation]} ${record.label.replace('.pdf', '')}`
    )
    .join(' • ')
}

export function getClientFacingRecordStatus(document: DocumentRecord): ClientFacingStatus {
  if (document.custodyState === 'locked' || document.custodyState === 'relied') {
    return 'Available in Egnyte'
  }

  if (
    document.documentManifestState === 'reviewed' ||
    document.exceptionFlags.length > 0
  ) {
    return 'Engineering review'
  }

  return custodyStateLabels[document.custodyState] as ClientFacingStatus
}

export function getClientFacingBatchStatus(batch: UploadBatch): ClientFacingStatus {
  if (batch.custodyState === 'locked' || batch.custodyState === 'relied') {
    return 'Available in Egnyte'
  }

  if (batch.manifestState === 'reviewed' || batch.exceptionCount > 0) {
    return 'Engineering review'
  }

  return custodyStateLabels[batch.custodyState] as ClientFacingStatus
}
