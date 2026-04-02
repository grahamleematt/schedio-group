import type {
  ClientFacingStatus,
  DocumentClass,
  PackageDraftSummary,
} from './mock-data'

export type PackageMode = 'monthly' | 'setup'

export type DistrictProfile = 'active' | 'finance' | 'archived'

export type ScenarioPack = {
  id: string
  title: string
  districtId: string
  verificationId: string
  packageId: string
  mode: PackageMode
  districtProfile: DistrictProfile
  previewRecordIds: string[]
}

export type VerificationPackageSummary = {
  id: string
  districtId: string
  verificationId: string
  label: string
  title: string
  mode: PackageMode
  status: ClientFacingStatus
  note: string
  chainId?: string
  fileRecordIds: string[]
  watchItems: string[]
  chainCompleteness: string
  readOnly: boolean
  rolloverFromVerificationId?: string
  rolloverToVerificationId?: string
}

export type ClientPackageDetail = VerificationPackageSummary & {
  organizedRecordIds: string[]
}

export type FieldConfirmation = {
  id: string
  label: string
  extractedValue: string
  sourceRegion: string
  note: string
  status: 'Confirmed' | 'Needs confirmation'
}

export const districtProfiles: Record<string, DistrictProfile> = {
  'sterling-cab': 'active',
  'sterling-md': 'finance',
  ridgeview: 'archived',
}

export const scenarioPacks: ScenarioPack[] = [
  {
    id: 'scenario-cab-monthly-close',
    title: 'CAB monthly close',
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-16',
    packageId: 'package-cab-monthly-close',
    mode: 'monthly',
    districtProfile: 'active',
    previewRecordIds: [
      'record-contract-agw-xxx',
      'record-invoice-jds-3601',
      'record-proof-jds-3601',
    ],
  },
  {
    id: 'scenario-cab-late-rollover',
    title: 'CAB late rollover',
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-17',
    packageId: 'package-cab-rollover',
    mode: 'monthly',
    districtProfile: 'active',
    previewRecordIds: ['record-invoice-jds-3645', 'record-proof-conditional-blank'],
  },
  {
    id: 'scenario-cab-contract-kickoff',
    title: 'CAB contract kickoff',
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-17',
    packageId: 'package-cab-kickoff',
    mode: 'setup',
    districtProfile: 'active',
    previewRecordIds: [
      'record-contract-atwell-msa',
      'record-task-atwell-f2',
      'record-change-rusin-co1',
    ],
  },
  {
    id: 'scenario-metro-finance-gap',
    title: 'Metro finance support gap',
    districtId: 'sterling-md',
    verificationId: 'sterling-md-ver-11',
    packageId: 'package-md-finance',
    mode: 'monthly',
    districtProfile: 'finance',
    previewRecordIds: ['record-payapp-classic-23', 'record-proof-conditional-blank-md'],
  },
  {
    id: 'scenario-md4-archived-read-only',
    title: 'MD4 archived read-only',
    districtId: 'ridgeview',
    verificationId: 'ridgeview-ver-9',
    packageId: 'package-md4-archived',
    mode: 'monthly',
    districtProfile: 'archived',
    previewRecordIds: ['record-payapp-classic-17', 'record-proof-md4-unconditional'],
  },
]

export const clientPackageDetails: ClientPackageDetail[] = [
  {
    id: 'package-cab-monthly-close',
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-16',
    label: 'Verification 16 monthly close',
    title: 'Monthly close package',
    mode: 'monthly',
    status: 'Available',
    note: 'Complete contract-to-proof package is organized and available.',
    chainId: 'chain-jds-monthly-close',
    fileRecordIds: [
      'record-contract-agw-xxx',
      'record-task-agw-f6-005',
      'record-change-rusin-co2',
      'record-invoice-jds-3601',
      'record-proof-jds-3601',
    ],
    organizedRecordIds: [
      'record-task-agw-f6-005',
      'record-change-rusin-co2',
      'record-invoice-jds-3601',
      'record-proof-jds-3601',
    ],
    watchItems: ['Chain complete', 'Primary invoice available'],
    chainCompleteness:
      'Contract, task order, change order, invoice, and proof are all attached.',
    readOnly: false,
  },
  {
    id: 'package-cab-rollover',
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-17',
    label: 'Verification 17 rollover',
    title: 'Late rollover package',
    mode: 'monthly',
    status: 'Ready for review',
    note: 'Late uploads from Verification 16 rolled into the next window.',
    chainId: 'chain-jds-rollover',
    fileRecordIds: [
      'record-task-agw-f6-005',
      'record-invoice-jds-3645',
      'record-proof-conditional-blank',
    ],
    organizedRecordIds: ['record-invoice-jds-3645'],
    watchItems: ['Missed Verification 16 cutoff', 'Support pending'],
    chainCompleteness:
      'Task order and invoice are attached; proof-of-payment still needs confirmation.',
    readOnly: false,
    rolloverFromVerificationId: 'sterling-cab-ver-16',
    rolloverToVerificationId: 'sterling-cab-ver-17',
  },
  {
    id: 'package-cab-kickoff',
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-17',
    label: 'Verification 17 kickoff',
    title: 'Contract kickoff package',
    mode: 'setup',
    status: 'Processing',
    note: 'Executed contract and task order are being organized before monthly submissions start.',
    chainId: 'chain-atwell-kickoff',
    fileRecordIds: [
      'record-contract-atwell-msa',
      'record-task-atwell-f2',
      'record-change-rusin-co1',
    ],
    organizedRecordIds: [
      'record-contract-atwell-msa',
      'record-task-atwell-f2',
      'record-change-rusin-co1',
    ],
    watchItems: ['Kickoff chain ready', 'Monthly invoices not uploaded yet'],
    chainCompleteness:
      'Contract, task order, and early change order are attached for kickoff.',
    readOnly: false,
  },
  {
    id: 'package-md-finance',
    districtId: 'sterling-md',
    verificationId: 'sterling-md-ver-11',
    label: 'Verification 11 finance package',
    title: 'Metro finance package',
    mode: 'monthly',
    status: 'Ready for review',
    note: 'Pay application is present, but supporting proof is still open.',
    chainId: 'chain-metro-finance',
    fileRecordIds: ['record-payapp-classic-23', 'record-proof-conditional-blank-md'],
    organizedRecordIds: ['record-payapp-classic-23'],
    watchItems: ['Support pending', 'Finance review in progress'],
    chainCompleteness:
      'Pay application is attached; proof-of-payment support is still incomplete.',
    readOnly: false,
  },
  {
    id: 'package-md4-archived',
    districtId: 'ridgeview',
    verificationId: 'ridgeview-ver-9',
    label: 'Verification 9 archived package',
    title: 'MD4 archived package',
    mode: 'monthly',
    status: 'Available',
    note: 'Locked package remains available for audit and read-only review.',
    chainId: 'chain-md4-archived',
    fileRecordIds: ['record-payapp-classic-17', 'record-proof-md4-unconditional'],
    organizedRecordIds: ['record-payapp-classic-17', 'record-proof-md4-unconditional'],
    watchItems: ['Locked archive', 'Read-only package'],
    chainCompleteness:
      'Archived pay application and supporting waiver remain locked for audit.',
    readOnly: true,
  },
]

export const packageDrafts: Array<{
  districtId: string
  verificationId: string
  mode: PackageMode
  packageId: string
  draft: PackageDraftSummary
}> = [
  {
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-16',
    mode: 'monthly',
    packageId: 'package-cab-monthly-close',
    draft: {
      packageName: 'Sterling Ranch CAB - Verification 16 Monthly Close',
      packageLabel: 'PKG-SRCAB-V16-MONTHLY',
      districtId: 'sterling-cab',
      verificationId: 'sterling-cab-ver-16',
      submissionChannel: 'District upload folder',
      purpose: 'Monthly reimbursement support for Verification 16.',
      description:
        'Monthly invoice, pay application, and proof records are entering the verification inventory for CAB.',
      expectedClasses: [
        { documentClass: 'invoice', selected: true, note: 'Recurring monthly invoice' },
        {
          documentClass: 'pay_application',
          selected: true,
          note: 'Recurring monthly pay application',
        },
        {
          documentClass: 'proof_of_payment',
          selected: true,
          note: 'Required support record',
        },
      ],
      files: [
        {
          id: 'draft-cab-jds-3601',
          recordId: 'record-invoice-jds-3601',
          linkedExpectation: 'Task order -> invoice -> proof of payment',
          warningFlags: [],
          sourcePreserved: true,
        },
        {
          id: 'draft-cab-proof-3601',
          recordId: 'record-proof-jds-3601',
          linkedExpectation: 'Proof linked to invoice JDS 3601',
          warningFlags: [],
          sourcePreserved: true,
        },
        {
          id: 'draft-cab-sunflower-dup',
          recordId: 'record-invoice-sunflower-33032-dup',
          linkedExpectation: 'Duplicate watch before package review',
          warningFlags: ['duplicate_file'],
          sourcePreserved: true,
        },
      ],
      startingState: 'incoming',
      linkedEvidenceChain: [
        'Task order attached',
        'Invoice / pay application attached',
        'Proof of payment attached',
      ],
      outcomes: [
        'Uploaded records stay visible with original filenames retained.',
        'Renamed inventory and proposed classes appear before review.',
        'Duplicate watch stays inline on the package inventory.',
      ],
      warnings: [
        {
          id: 'draft-warning-cab-duplicate',
          flag: 'duplicate_file',
          title: 'Duplicate watch',
          note: 'A second Sunflower invoice copy is still visible and should be confirmed before submission.',
          severity: 'warning',
        },
      ],
    },
  },
  {
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-17',
    mode: 'monthly',
    packageId: 'package-cab-rollover',
    draft: {
      packageName: 'Sterling Ranch CAB - Verification 17 Rollover',
      packageLabel: 'PKG-SRCAB-V17-ROLLOVER',
      districtId: 'sterling-cab',
      verificationId: 'sterling-cab-ver-17',
      submissionChannel: 'District upload folder',
      purpose: 'Late monthly reimbursement records rolled from Verification 16.',
      description:
        'Late files are preserved, renamed, and assigned to the next verification window.',
      expectedClasses: [
        { documentClass: 'invoice', selected: true, note: 'Recurring monthly invoice' },
        {
          documentClass: 'pay_application',
          selected: true,
          note: 'Monthly support if present',
        },
        {
          documentClass: 'proof_of_payment',
          selected: true,
          note: 'Support should follow rollover records',
        },
      ],
      files: [
        {
          id: 'draft-rollover-invoice',
          recordId: 'record-invoice-jds-3645',
          linkedExpectation: 'Missed Verification 16 cutoff; now tracked in Verification 17',
          warningFlags: [],
          sourcePreserved: true,
        },
        {
          id: 'draft-rollover-proof',
          recordId: 'record-proof-conditional-blank',
          linkedExpectation: 'Proof should be confirmed before package review',
          warningFlags: ['missing_support'],
          sourcePreserved: true,
        },
      ],
      startingState: 'incoming',
      linkedEvidenceChain: [
        'Task order carried forward',
        'Late invoice rolled to next verification',
        'Proof of payment still needs confirmation',
      ],
      outcomes: [
        'Late uploads are visible in the next verification immediately.',
        'Original filenames stay visible for rollover review.',
        'Package stays ready for review until support is confirmed.',
      ],
      warnings: [
        {
          id: 'draft-warning-rollover-cutoff',
          flag: 'missing_support',
          title: 'Support pending',
          note: 'The invoice rolled forward, but proof-of-payment is still incomplete for this submission.',
          severity: 'attention',
        },
      ],
    },
  },
  {
    districtId: 'sterling-cab',
    verificationId: 'sterling-cab-ver-17',
    mode: 'setup',
    packageId: 'package-cab-kickoff',
    draft: {
      packageName: 'Sterling Ranch CAB - Contract Kickoff',
      packageLabel: 'PKG-SRCAB-KICKOFF',
      districtId: 'sterling-cab',
      verificationId: 'sterling-cab-ver-17',
      submissionChannel: 'Client custody submission',
      purpose: 'Contract kickoff package before recurring monthly intake starts.',
      description:
        'Executed contract and task-order records are entering custody so downstream invoices have an attached authorization chain.',
      expectedClasses: [
        { documentClass: 'contract', selected: true, note: 'Executed contract' },
        {
          documentClass: 'task_order',
          selected: true,
          note: 'Initial work authorization',
        },
        {
          documentClass: 'change_order',
          selected: true,
          note: 'Optional early scope change',
        },
      ],
      files: [
        {
          id: 'draft-setup-contract',
          recordId: 'record-contract-atwell-msa',
          linkedExpectation: 'Contract anchors the kickoff package',
          warningFlags: [],
          sourcePreserved: true,
        },
        {
          id: 'draft-setup-task-order',
          recordId: 'record-task-atwell-f2',
          linkedExpectation: 'Task order links the first scope package',
          warningFlags: [],
          sourcePreserved: true,
        },
        {
          id: 'draft-setup-change-order',
          recordId: 'record-change-rusin-co1',
          linkedExpectation: 'Early scope change stays visible for kickoff review',
          warningFlags: [],
          sourcePreserved: true,
        },
      ],
      startingState: 'incoming',
      linkedEvidenceChain: [
        'Contract on file',
        'Task order on file',
        'Change order attached for kickoff review',
      ],
      outcomes: [
        'Kickoff records enter custody before monthly reimbursements begin.',
        'Downstream invoice chains can reference this setup package once approved.',
        'Original source files remain visible beside renamed outputs.',
      ],
      warnings: [],
    },
  },
  {
    districtId: 'sterling-md',
    verificationId: 'sterling-md-ver-11',
    mode: 'monthly',
    packageId: 'package-md-finance',
    draft: {
      packageName: 'Sterling Ranch Metro District - Finance Intake',
      packageLabel: 'PKG-SRMD-V11-FINANCE',
      districtId: 'sterling-md',
      verificationId: 'sterling-md-ver-11',
      submissionChannel: 'Finance upload folder',
      purpose: 'Monthly finance package for Metro pay applications.',
      description:
        'Finance uploads focus on pay applications and supporting proof tied to the current verification.',
      expectedClasses: [
        {
          documentClass: 'pay_application',
          selected: true,
          note: 'Recurring finance package',
        },
        {
          documentClass: 'proof_of_payment',
          selected: true,
          note: 'Support should be attached when available',
        },
        {
          documentClass: 'invoice',
          selected: false,
          note: 'Optional supporting invoice',
        },
      ],
      files: [
        {
          id: 'draft-md-payapp',
          recordId: 'record-payapp-classic-23',
          linkedExpectation: 'Pay application enters the verification inventory',
          warningFlags: ['missing_support'],
          sourcePreserved: true,
        },
        {
          id: 'draft-md-proof',
          recordId: 'record-proof-conditional-blank-md',
          linkedExpectation: 'Support record still needs confirmation',
          warningFlags: ['missing_support'],
          sourcePreserved: true,
        },
      ],
      startingState: 'incoming',
      linkedEvidenceChain: [
        'Pay application attached',
        'Proof of payment expected',
      ],
      outcomes: [
        'Finance package remains visible while support is gathered.',
        'Original filenames stay visible to catch support gaps quickly.',
        'Package is ready for review once proof is linked.',
      ],
      warnings: [
        {
          id: 'draft-warning-md-support',
          flag: 'missing_support',
          title: 'Missing supporting proof',
          note: 'Finance package still needs a confirmed proof-of-payment record.',
          severity: 'attention',
        },
      ],
    },
  },
]

export const reviewFieldConfirmations: Record<string, FieldConfirmation[]> = {
  'review-payapp-pages-20': [
    {
      id: 'field-payapp-vendor',
      label: 'Vendor name',
      extractedValue: 'Classic',
      sourceRegion: 'Header block, page 1',
      note: 'Header matches the neighboring Classic pay app examples.',
      status: 'Confirmed',
    },
    {
      id: 'field-payapp-project',
      label: 'Project identifier',
      extractedValue: 'SRD Pay App 20',
      sourceRegion: 'Title line, page 1',
      note: 'Origin file was split from the invoice set and needs context confirmation.',
      status: 'Needs confirmation',
    },
    {
      id: 'field-payapp-amount',
      label: 'Submitted amount',
      extractedValue: 'Amount not parsed',
      sourceRegion: 'Amount block, page 1',
      note: 'Analyst should confirm the amount before the draft advances.',
      status: 'Needs confirmation',
    },
  ],
  'review-mcdonal-7981': [
    {
      id: 'field-mcdonal-vendor',
      label: 'Vendor name',
      extractedValue: 'McDonal Paving',
      sourceRegion: 'Header block, page 1',
      note: 'Vendor text is clear in the invoice body.',
      status: 'Confirmed',
    },
    {
      id: 'field-mcdonal-invoice',
      label: 'Invoice number',
      extractedValue: '7981',
      sourceRegion: 'Invoice number block, page 1',
      note: 'Invoice number is readable even though the filename amount token is malformed.',
      status: 'Confirmed',
    },
    {
      id: 'field-mcdonal-amount',
      label: 'Submitted amount',
      extractedValue: 'Needs analyst confirmation',
      sourceRegion: 'Amount line, page 1',
      note: 'Source amount still needs to be recovered from the PDF body.',
      status: 'Needs confirmation',
    },
  ],
  'review-jds-3645-rollover': [
    {
      id: 'field-rollover-vendor',
      label: 'Vendor name',
      extractedValue: 'JDS',
      sourceRegion: 'Invoice header, page 1',
      note: 'Matches the existing JDS naming pattern in CAB.',
      status: 'Confirmed',
    },
    {
      id: 'field-rollover-invoice',
      label: 'Invoice number',
      extractedValue: '3645',
      sourceRegion: 'Invoice number block, page 1',
      note: 'Rollover package keeps the same invoice identifier.',
      status: 'Confirmed',
    },
    {
      id: 'field-rollover-project',
      label: 'Verification destination',
      extractedValue: 'Verification 17',
      sourceRegion: 'Cutoff assignment panel',
      note: 'Late invoice must stay in the next verification window.',
      status: 'Needs confirmation',
    },
  ],
  'review-contract-atwell-kickoff': [
    {
      id: 'field-atwell-vendor',
      label: 'Vendor name',
      extractedValue: 'Atwell LLC',
      sourceRegion: 'Signature block, executed agreement',
      note: 'Executed contract matches the kickoff vendor profile.',
      status: 'Confirmed',
    },
    {
      id: 'field-atwell-project',
      label: 'Project identifier',
      extractedValue: 'Sterling Ranch F2 Townhome',
      sourceRegion: 'Work order title, page 1',
      note: 'Project area should stay linked to the kickoff package.',
      status: 'Confirmed',
    },
    {
      id: 'field-atwell-scope',
      label: 'Scope description',
      extractedValue: 'Advanced Concrete Work Order',
      sourceRegion: 'Work order heading',
      note: 'Drafting should confirm the work-order label before approval.',
      status: 'Needs confirmation',
    },
  ],
  'review-payapp-classic-23': [
    {
      id: 'field-classic-vendor',
      label: 'Vendor name',
      extractedValue: 'Classic',
      sourceRegion: 'Header block, page 1',
      note: 'Vendor is clear in the pay application.',
      status: 'Confirmed',
    },
    {
      id: 'field-classic-payapp',
      label: 'Pay application number',
      extractedValue: '23',
      sourceRegion: 'Title line, page 1',
      note: 'Pay application number aligns with the archive filename.',
      status: 'Confirmed',
    },
    {
      id: 'field-classic-support',
      label: 'Proof-of-payment support',
      extractedValue: 'Pending',
      sourceRegion: 'Support link',
      note: 'Finance package still needs a confirmed proof record.',
      status: 'Needs confirmation',
    },
  ],
}
