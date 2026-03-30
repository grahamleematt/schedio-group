export type DistrictOption = {
  id: string
  name: string
  region: string
  programLabel: string
  contact: string
}

export type ProcessingStage =
  | 'Received'
  | 'Classifying'
  | 'Organizing'
  | 'Ready for review'
  | 'Published to Ignite'

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
}

export type DocumentRecord = {
  id: string
  batchId: string
  districtId: string
  originalName: string
  organizedName: string
  type: string
  pageCount: number
  status: 'Needs review' | 'Indexed' | 'Published'
  source: string
  igniteUrl: string
  updatedAt: string
}

export type ReviewStatus =
  | 'Needs review'
  | 'Rename suggested'
  | 'Ready to publish'
  | 'Published'

export type ReviewItem = {
  id: string
  recordId: string
  districtId: string
  reason: string
  confidence: number
  reviewer: string
  status: ReviewStatus
}

export type PortalMetric = {
  label: string
  value: string
  note: string
}

export const districts: DistrictOption[] = [
  {
    id: 'north-county',
    name: 'North County Utility District',
    region: 'Texas Gulf Region',
    programLabel: 'FEMA + Infrastructure intake',
    contact: 'Marta Alvarez',
  },
  {
    id: 'brazos-basin',
    name: 'Brazos Basin Drainage District',
    region: 'Central Texas',
    programLabel: 'Grant reimbursement intake',
    contact: 'Derrick Poole',
  },
  {
    id: 'gulf-harbor',
    name: 'Gulf Harbor School Facilities',
    region: 'Coastal Louisiana',
    programLabel: 'Facilities record intake',
    contact: 'Anne Webster',
  },
]

export const uploadBatches: UploadBatch[] = [
  {
    id: 'batch-247',
    districtId: 'north-county',
    name: 'PW 247 county scans',
    submittedBy: 'Marta Alvarez',
    submittedAt: 'March 28, 2026 at 9:42 AM',
    documentCount: 46,
    status: 'Organizing',
    progress: 72,
    channel: 'Portal upload',
  },
  {
    id: 'batch-251',
    districtId: 'north-county',
    name: 'Vendor invoices addendum',
    submittedBy: 'Chris Tully',
    submittedAt: 'March 29, 2026 at 8:18 AM',
    documentCount: 18,
    status: 'Ready for review',
    progress: 91,
    channel: 'Shared district login',
  },
  {
    id: 'batch-188',
    districtId: 'brazos-basin',
    name: 'Drainage easement archive',
    submittedBy: 'Derrick Poole',
    submittedAt: 'March 27, 2026 at 3:05 PM',
    documentCount: 63,
    status: 'Classifying',
    progress: 44,
    channel: 'Portal upload',
  },
  {
    id: 'batch-309',
    districtId: 'gulf-harbor',
    name: 'Building repairs package',
    submittedBy: 'Anne Webster',
    submittedAt: 'March 26, 2026 at 4:36 PM',
    documentCount: 29,
    status: 'Published to Ignite',
    progress: 100,
    channel: 'Email handoff',
  },
]

export const documents: DocumentRecord[] = [
  {
    id: 'doc-1',
    batchId: 'batch-247',
    districtId: 'north-county',
    originalName: 'scan_0087.pdf',
    organizedName: 'NCUD_PW247_Invoice_Set_A.pdf',
    type: 'Invoice packet',
    pageCount: 11,
    status: 'Indexed',
    source: 'County recorded scan',
    igniteUrl: 'https://example.com/ignite/north-county/pw247/invoice-set-a',
    updatedAt: '12 minutes ago',
  },
  {
    id: 'doc-2',
    batchId: 'batch-247',
    districtId: 'north-county',
    originalName: 'IMG_3499.PDF',
    organizedName: 'NCUD_PW247_Contractor_Agreement.pdf',
    type: 'Contract',
    pageCount: 6,
    status: 'Needs review',
    source: 'Phone capture',
    igniteUrl: 'https://example.com/ignite/north-county/pw247/contractor-agreement',
    updatedAt: '8 minutes ago',
  },
  {
    id: 'doc-3',
    batchId: 'batch-251',
    districtId: 'north-county',
    originalName: 'vendor-set-march.xlsx',
    organizedName: 'NCUD_Vendor_Invoices_March.xlsx',
    type: 'Workbook',
    pageCount: 1,
    status: 'Published',
    source: 'Direct export',
    igniteUrl: 'https://example.com/ignite/north-county/vendors/march',
    updatedAt: '4 minutes ago',
  },
  {
    id: 'doc-4',
    batchId: 'batch-188',
    districtId: 'brazos-basin',
    originalName: 'county-scan-final.pdf',
    organizedName: 'BBDD_Recorded_Easements_2009_2011.pdf',
    type: 'Recorded easements',
    pageCount: 19,
    status: 'Indexed',
    source: 'Recorded county scan',
    igniteUrl: 'https://example.com/ignite/brazos-basin/easements/2009-2011',
    updatedAt: '39 minutes ago',
  },
  {
    id: 'doc-5',
    batchId: 'batch-309',
    districtId: 'gulf-harbor',
    originalName: 'repair-estimate-2026.pdf',
    organizedName: 'GHSF_Building_Repair_Estimate.pdf',
    type: 'Estimate',
    pageCount: 14,
    status: 'Published',
    source: 'Vendor PDF',
    igniteUrl: 'https://example.com/ignite/gulf-harbor/building-repair-estimate',
    updatedAt: '1 day ago',
  },
]

export const reviewItems: ReviewItem[] = [
  {
    id: 'review-1',
    recordId: 'doc-2',
    districtId: 'north-county',
    reason: 'Low OCR certainty on contractor signature page',
    confidence: 0.68,
    reviewer: 'Assign engineer',
    status: 'Needs review',
  },
  {
    id: 'review-2',
    recordId: 'doc-1',
    districtId: 'north-county',
    reason: 'Rename suggestion matches naming convention',
    confidence: 0.89,
    reviewer: 'Ops reviewer',
    status: 'Rename suggested',
  },
  {
    id: 'review-3',
    recordId: 'doc-4',
    districtId: 'brazos-basin',
    reason: 'Batch spans multiple recorded years',
    confidence: 0.81,
    reviewer: 'Ops reviewer',
    status: 'Ready to publish',
  },
  {
    id: 'review-4',
    recordId: 'doc-5',
    districtId: 'gulf-harbor',
    reason: 'Published to Ignite with preserved original',
    confidence: 0.97,
    reviewer: 'Audit complete',
    status: 'Published',
  },
]

export const processingStages: ProcessingStage[] = [
  'Received',
  'Classifying',
  'Organizing',
  'Ready for review',
  'Published to Ignite',
]

export function getDistrict(districtId: string) {
  return districts.find((district) => district.id === districtId) ?? districts[0]
}

export function getBatchesByDistrict(districtId: string) {
  return uploadBatches.filter((batch) => batch.districtId === districtId)
}

export function getDocumentsByDistrict(districtId: string) {
  return documents.filter((document) => document.districtId === districtId)
}

export function getReviewItemsByDistrict(districtId: string) {
  return reviewItems.filter((item) => item.districtId === districtId)
}
