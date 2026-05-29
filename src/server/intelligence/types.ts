/**
 * JSON-serializable value. Used for the free-form `metadata`, `extractedFacts`,
 * and `evidence` bags so they survive the TanStack Start server-fn serializer
 * (which maps a bare `unknown` to `{}` and then fails the assignability check).
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ReadonlyArray<JsonValue>
  | { [key: string]: JsonValue }

export type JsonRecord = Record<string, JsonValue>

export type IntelligenceCategoryId =
  | 'contract'
  | 'work_authorization'
  | 'task_order'
  | 'change_order'
  | 'plat'
  | 'pdp'
  | 'invoice'
  | 'pay_application'
  | 'proof_of_payment'
  | 'report'
  | 'governance'
  | 'workbook'
  | 'construction_drawing'
  | 'unknown'

export type IntelligenceSourceKind =
  | 'egnyte_import'
  | 'egnyte_export'
  | 'docupipe_ingest'

export type IntelligenceImportStatus =
  | 'imported'
  | 'processing'
  | 'needs_review'
  | 'failed'

export type SegmentType =
  | 'document_summary'
  | 'scope_item'
  | 'plat_ppp'
  | 'workbook_row'
  | 'governance_rule'

export type LearningDetermination =
  | 'ppp'
  | 'not_ppp'
  | 'conditional'
  | 'needs_review'

export type LearningApplicability =
  | 'filing'
  | 'project'
  | 'district'
  | 'client'
  | 'organization'

export type LearningConfidence = 'high' | 'medium' | 'low'

export type FindingAnchorType = 'point' | 'rect' | 'text' | 'page' | 'document'

export type FindingType =
  | 'ppp'
  | 'not_ppp'
  | 'conditional'
  | 'needs_review'
  | 'question'
  | 'source_evidence'

export type FindingStatus = 'open' | 'promoted' | 'resolved' | 'dismissed'

export type IntelligenceWorkflowKind =
  | 'district_direct_pay'
  | 'developer_reimbursement'

export type RelationshipType =
  | 'same_vendor'
  | 'same_filing'
  | 'similar_ppp'
  | 'same_source'
  | 'same_category'
  | 'shared_identifier'
  | 'manual'

export type RelationshipStatus = 'suggested' | 'accepted' | 'rejected'

export type FindingRect = {
  x: number
  y: number
  width: number
  height: number
}

export type IntelligenceCategory = {
  id: IntelligenceCategoryId
  label: string
  description: string
  sortOrder: number
}

export type IntelligenceClient = {
  id: string
  organizationId: string
  code: string
  name: string
  workflowKind: IntelligenceWorkflowKind
  egnyteRootPath?: string
  docupipeWorkflowId?: string
  createdAt: string
}

export type IntelligenceImport = {
  id: string
  organizationId: string
  clientId: string
  districtId?: string
  projectId?: string
  sourceKind: IntelligenceSourceKind
  sourceLabel: string
  sourceUri: string
  status: IntelligenceImportStatus
  documentCount: number
  segmentCount: number
  importedBy: string
  importedAt: string
}

export type IntelligenceDocument = {
  id: string
  organizationId: string
  clientId: string
  districtId?: string
  projectId?: string
  importId?: string
  categoryId: IntelligenceCategoryId
  sourceDocumentId?: string
  canonicalFileUri: string
  fileName: string
  mimeType: string
  title: string
  vendorName?: string
  filingLabel?: string
  pppPercent?: number
  metadata: JsonRecord
  createdAt: string
  updatedAt: string
}

export type IntelligenceSegment = {
  id: string
  organizationId: string
  documentId: string
  categoryId: IntelligenceCategoryId
  segmentType: SegmentType
  title: string
  summary: string
  pageStart?: number
  pageEnd?: number
  extractedFacts: JsonRecord
  createdAt: string
}

export type IntelligenceLearning = {
  id: string
  organizationId: string
  clientId?: string
  districtId?: string
  projectId?: string
  documentId?: string
  segmentId?: string
  categoryId: IntelligenceCategoryId
  label: string
  determination: LearningDetermination
  pppValue?: number
  applicability: LearningApplicability
  confidence: LearningConfidence
  rationale: string
  reasonTags: ReadonlyArray<string>
  evidence: JsonRecord
  createdBy: string
  createdAt: string
  supersedesId?: string
}

export type IntelligenceFinding = {
  id: string
  organizationId: string
  clientId?: string
  districtId?: string
  projectId?: string
  documentId: string
  segmentId?: string
  categoryId: IntelligenceCategoryId
  pageNumber: number
  anchorType: FindingAnchorType
  normalizedRects: ReadonlyArray<FindingRect>
  selectedText?: string
  findingType: FindingType
  status: FindingStatus
  confidence: LearningConfidence
  label: string
  rationale: string
  reasonTags: ReadonlyArray<string>
  createdBy: string
  createdAt: string
  linkedLearningId?: string
}

export type IntelligenceFindingUpdate = Partial<
  Pick<
    IntelligenceFinding,
    | 'findingType'
    | 'status'
    | 'confidence'
    | 'label'
    | 'rationale'
    | 'reasonTags'
    | 'linkedLearningId'
  >
>

export type IntelligenceRecommendation = {
  id: string
  targetSegmentId: string
  learningId: string
  recommendation: LearningDetermination
  score: number
  rationale: string
  status: 'suggested' | 'accepted' | 'rejected'
  createdAt: string
}

export type IntelligenceDocumentRelationship = {
  id: string
  organizationId: string
  sourceDocumentId: string
  targetDocumentId: string
  relationshipType: RelationshipType
  score: number
  reason: string
  evidence: JsonRecord
  status: RelationshipStatus
  createdBy: string
  createdAt: string
  reviewedBy?: string
  reviewedAt?: string
}

export type IntelligenceWorkspace = {
  mode: 'postgres' | 'local'
  isDatabaseConfigured: boolean
  clients: ReadonlyArray<IntelligenceClient>
  categories: ReadonlyArray<IntelligenceCategory>
  imports: ReadonlyArray<IntelligenceImport>
  documents: ReadonlyArray<IntelligenceDocument>
  segments: ReadonlyArray<IntelligenceSegment>
  findings: ReadonlyArray<IntelligenceFinding>
  learnings: ReadonlyArray<IntelligenceLearning>
  relationships: ReadonlyArray<IntelligenceDocumentRelationship>
  recommendations: ReadonlyArray<IntelligenceRecommendation>
  sourceWarnings: ReadonlyArray<string>
}

export type IntelligencePackage = {
  importRow: IntelligenceImport
  documents: ReadonlyArray<IntelligenceDocument>
  segments: ReadonlyArray<IntelligenceSegment>
}
