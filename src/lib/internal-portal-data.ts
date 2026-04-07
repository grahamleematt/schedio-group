import type {
  DocumentRecord as BaseDocumentRecord,
  ReviewItem as BaseReviewItem,
  UploadBatch as BaseUploadBatch,
  VerificationRecord as BaseVerificationRecord,
} from './mock-data'
import {
  documents,
  getDistrict,
  getDocumentById,
  getSubmittedAmountTotal,
  reviewItems,
  uploadBatches,
  verifications,
} from './mock-data'

export type WorkflowType = 'developer_reimbursement' | 'district_direct_pay'

export type Role =
  | 'sg_admin'
  | 'sg_pm'
  | 'entity_owner'
  | 'client_manager'
  | 'client_viewer'

export type Entity = {
  id: string
  districtId: string
  name: string
  shortCode: string
  workflowType: WorkflowType
  ownerName: string
  ownerEmail: string
  status: 'Active' | 'Pending onboarding' | 'Archived'
  competitorSet?: string
  contact: string
  region: string
}

export type EntityMembership = {
  id: string
  entityId: string
  userName: string
  email: string
  role: Role
  status: 'Active' | 'Pending approval' | 'Disabled'
  scopeLabel: string
  lastActive: string
}

export type AccessRequest = {
  id: string
  entityId: string
  requesterName: string
  requesterEmail: string
  requestedRole: Role
  status: 'Pending approval' | 'Approved' | 'Denied' | 'Expired'
  requestedAt: string
  expiresAt: string
  approverName?: string
  note: string
}

export type SubmissionQueueState =
  | 'New'
  | 'Processing'
  | 'Needs drafting'
  | 'Ready for approval'
  | 'Blocked'
  | 'Approved'
  | 'Superseded'

export type DuplicateState = 'Clear' | 'Flagged' | 'Escalated' | 'Resolved'

export type Submission = BaseUploadBatch & {
  entityId: string
  workflowType: WorkflowType
  queueState: SubmissionQueueState
  duplicateState: DuplicateState
  queueAge: string
  ownerLabel: string
  blockedReason?: string
  attentionNote: string
}

export type SubmissionDocument = BaseDocumentRecord & {
  submissionId: string
  entityId: string
  workflowType: WorkflowType
}

export type DuplicateMatch = {
  id: string
  submissionId: string
  documentId: string
  matchedDocumentId: string
  matchType: 'Exact duplicate' | 'Likely duplicate'
  status: 'Flagged' | 'Escalated' | 'Resolved'
  previousVerificationId: string
  note: string
  clientDecision?: 'Keep it' | 'Remove it'
  sgDecision?: 'Suppress duplicate' | 'Keep both' | 'Escalate'
}

export type DraftTask = BaseReviewItem & {
  submissionId: string
  entityId: string
  workflowType: WorkflowType
  queueAge: string
  handoffStatus: string
  verificationLabel: string
}

export type ApprovalTask = BaseReviewItem & {
  submissionId: string
  entityId: string
  workflowType: WorkflowType
  queueAge: string
  verifiedAmountTarget?: number
  duplicateDecisionRequired: boolean
  contractImpactId?: string
}

export type VerifiedAmountEntry = {
  id: string
  verificationId: string
  sourceDocumentId?: string
  enteredBy: string
  amount: number
  method: 'Manual entry'
  status: 'Draft' | 'Confirmed'
  note: string
}

export type ContractBudget = {
  id: string
  entityId: string
  vendorCode: string
  vendorName: string
  authorizedAmount: number
  spentAmount: number
  remainingAmount: number
  utilizationPercent: number
  health: 'Healthy' | 'Monitor' | 'Watch'
}

export type AuditEvent = {
  id: string
  entityId?: string
  category: 'Access' | 'Verification' | 'Duplicate' | 'Approval'
  actor: string
  occurredAt: string
  message: string
}

export type Verification = BaseVerificationRecord & {
  entityId: string
  workflowType: WorkflowType
}

const districtWorkflowTypeMap: Record<string, WorkflowType> = {
  'sterling-cab': 'developer_reimbursement',
  'sterling-md': 'district_direct_pay',
  ridgeview: 'district_direct_pay',
}

const entityByDistrictId: Record<string, string> = {
  'sterling-cab': 'entity-sterling-cab',
  'sterling-md': 'entity-sterling-md',
  ridgeview: 'entity-ridgeview-md4',
}

const submissionMetaByBatchId: Record<
  string,
  {
    queueState: SubmissionQueueState
    duplicateState: DuplicateState
    queueAge: string
    ownerLabel: string
    blockedReason?: string
    attentionNote: string
  }
> = {
  'batch-ver5': {
    queueState: 'Processing',
    duplicateState: 'Flagged',
    queueAge: '1d in intake',
    ownerLabel: 'Mia Chen',
    attentionNote:
      'Monthly close set is still reconciling duplicate watch and proof coverage before it can route cleanly.',
  },
  'batch-agw': {
    queueState: 'Ready for approval',
    duplicateState: 'Clear',
    queueAge: '2d in queue',
    ownerLabel: 'Nina Patel',
    attentionNote:
      'Support records are assembled and can move into authority review after a final spot-check.',
  },
  'batch-payapp': {
    queueState: 'Blocked',
    duplicateState: 'Escalated',
    queueAge: '3d waiting on support',
    ownerLabel: 'Jordan Lee',
    blockedReason: 'Missing payment proof still blocks publish readiness.',
    attentionNote:
      'Finance package is complete enough for review, but cannot publish until proof is attached or waived.',
  },
  'batch-ridgeview': {
    queueState: 'Superseded',
    duplicateState: 'Resolved',
    queueAge: 'Archived',
    ownerLabel: 'Archive desk',
    attentionNote:
      'Archived package remains available for read-only audit and lineage tracing.',
  },
  'batch-rollover-cab': {
    queueState: 'Needs drafting',
    duplicateState: 'Clear',
    queueAge: 'Today',
    ownerLabel: 'Priya Nair',
    blockedReason: 'Late rollover rationale and support posture are still being drafted.',
    attentionNote:
      'Rollover package needs analyst interpretation before it can be routed to approval.',
  },
  'batch-kickoff-cab': {
    queueState: 'New',
    duplicateState: 'Clear',
    queueAge: '6h in intake',
    ownerLabel: 'Mia Chen',
    attentionNote:
      'Kickoff contract package just entered intake and still needs first-pass classification.',
  },
}

const approvalTaskMetaByReviewId: Partial<
  Record<
    string,
    {
      verifiedAmountTarget?: number
      contractImpactId?: string
    }
  >
> = {
  'review-sunflower-duplicate': {
    verifiedAmountTarget: 0,
  },
  'review-classic-payapp-23': {
    verifiedAmountTarget: 775000,
    contractImpactId: 'budget-meridian-md',
  },
  'review-md4-archive-lock': {
    verifiedAmountTarget: 865464.69,
    contractImpactId: 'budget-delta-md4',
  },
}

export const workflowTypeLabels: Record<WorkflowType, string> = {
  developer_reimbursement: 'Developer reimbursement',
  district_direct_pay: 'District direct pay',
}

export const roleLabels: Record<Role, string> = {
  sg_admin: 'SG admin',
  sg_pm: 'SG project manager',
  entity_owner: 'Entity owner',
  client_manager: 'Client manager',
  client_viewer: 'Client viewer',
}

export const entities: Entity[] = [
  {
    id: 'entity-sterling-cab',
    districtId: 'sterling-cab',
    name: 'Sterling Ranch CAB',
    shortCode: 'SRC',
    workflowType: 'developer_reimbursement',
    ownerName: 'Tim Case',
    ownerEmail: 'tim.case@schediogroup.com',
    status: 'Active',
    competitorSet: 'sterling-homebuilders',
    contact: getDistrict('sterling-cab').contact,
    region: getDistrict('sterling-cab').region,
  },
  {
    id: 'entity-sterling-md',
    districtId: 'sterling-md',
    name: 'Sterling Ranch Metro District',
    shortCode: 'SRM',
    workflowType: 'district_direct_pay',
    ownerName: 'Amy Lee',
    ownerEmail: 'amy.lee@srmetro.gov',
    status: 'Active',
    contact: getDistrict('sterling-md').contact,
    region: getDistrict('sterling-md').region,
  },
  {
    id: 'entity-ridgeview-md4',
    districtId: 'ridgeview',
    name: 'Sterling Ranch MD4',
    shortCode: 'MD4',
    workflowType: 'district_direct_pay',
    ownerName: 'Finance coordinator',
    ownerEmail: 'finance@ridgeviewmd4.org',
    status: 'Archived',
    contact: getDistrict('ridgeview').contact,
    region: getDistrict('ridgeview').region,
  },
]

export const entityMemberships: EntityMembership[] = [
  {
    id: 'membership-tim-cab-owner',
    entityId: 'entity-sterling-cab',
    userName: 'Tim Case',
    email: 'tim.case@schediogroup.com',
    role: 'entity_owner',
    status: 'Active',
    scopeLabel: 'All CAB submissions and users',
    lastActive: 'Today at 8:43 AM',
  },
  {
    id: 'membership-mia-cab-manager',
    entityId: 'entity-sterling-cab',
    userName: 'Mia Chen',
    email: 'mia.chen@sterlingranch.com',
    role: 'client_manager',
    status: 'Active',
    scopeLabel: 'Monthly close and kickoff packages',
    lastActive: 'Today at 9:15 AM',
  },
  {
    id: 'membership-amy-md-owner',
    entityId: 'entity-sterling-md',
    userName: 'Amy Lee',
    email: 'amy.lee@srmetro.gov',
    role: 'entity_owner',
    status: 'Active',
    scopeLabel: 'All district direct pay submissions',
    lastActive: 'Yesterday at 4:12 PM',
  },
  {
    id: 'membership-jordan-md-manager',
    entityId: 'entity-sterling-md',
    userName: 'Jordan Lee',
    email: 'jordan.lee@srmetro.gov',
    role: 'client_manager',
    status: 'Active',
    scopeLabel: 'Finance package intake and document follow-up',
    lastActive: 'Yesterday at 1:08 PM',
  },
  {
    id: 'membership-riley-md-viewer',
    entityId: 'entity-sterling-md',
    userName: 'Riley Brooks',
    email: 'riley.brooks@srmetro.gov',
    role: 'client_viewer',
    status: 'Pending approval',
    scopeLabel: 'View own submissions after owner approval',
    lastActive: 'Pending first access',
  },
  {
    id: 'membership-archive-md4-viewer',
    entityId: 'entity-ridgeview-md4',
    userName: 'Carla Ruiz',
    email: 'carla.ruiz@ridgeviewmd4.org',
    role: 'client_viewer',
    status: 'Disabled',
    scopeLabel: 'Archived audit-only visibility',
    lastActive: 'February 18, 2026',
  },
]

export const accessRequests: AccessRequest[] = [
  {
    id: 'access-riley-md',
    entityId: 'entity-sterling-md',
    requesterName: 'Riley Brooks',
    requesterEmail: 'riley.brooks@srmetro.gov',
    requestedRole: 'client_viewer',
    status: 'Pending approval',
    requestedAt: 'Today at 7:52 AM',
    expiresAt: 'April 10, 2026 at 7:52 AM',
    note: 'Requested visibility into finance packages before April board review.',
  },
  {
    id: 'access-owen-cab',
    entityId: 'entity-sterling-cab',
    requesterName: 'Owen Hart',
    requesterEmail: 'owen.hart@sterlingranch.com',
    requestedRole: 'client_manager',
    status: 'Approved',
    requestedAt: 'April 5, 2026 at 10:14 AM',
    expiresAt: 'April 8, 2026 at 10:14 AM',
    approverName: 'Tim Case',
    note: 'Approved for closeout support during Verification 17 rollover.',
  },
  {
    id: 'access-nina-md4',
    entityId: 'entity-ridgeview-md4',
    requesterName: 'Nina Patel',
    requesterEmail: 'nina.patel@consulting.example',
    requestedRole: 'client_viewer',
    status: 'Denied',
    requestedAt: 'April 2, 2026 at 4:21 PM',
    expiresAt: 'April 5, 2026 at 4:21 PM',
    approverName: 'Finance coordinator',
    note: 'Denied because archived packages stay limited to district finance staff.',
  },
  {
    id: 'access-ella-cab',
    entityId: 'entity-sterling-cab',
    requesterName: 'Ella Monroe',
    requesterEmail: 'ella.monroe@lennar.example',
    requestedRole: 'client_viewer',
    status: 'Expired',
    requestedAt: 'March 30, 2026 at 3:03 PM',
    expiresAt: 'April 2, 2026 at 3:03 PM',
    note: 'Expired without owner action because competitor isolation required SG follow-up.',
  },
]

export const duplicateMatches: DuplicateMatch[] = [
  {
    id: 'dup-sunflower-exact',
    submissionId: 'batch-ver5',
    documentId: 'record-invoice-sunflower-33032-dup',
    matchedDocumentId: 'record-invoice-sunflower-33032',
    matchType: 'Exact duplicate',
    status: 'Escalated',
    previousVerificationId: 'sterling-cab-ver-16',
    note:
      'Second copy of the same Sunflower invoice needs authority-level suppression before lock.',
    clientDecision: 'Keep it',
    sgDecision: 'Escalate',
  },
  {
    id: 'dup-blank-waiver-likely',
    submissionId: 'batch-payapp',
    documentId: 'record-proof-conditional-blank-md',
    matchedDocumentId: 'record-proof-conditional-blank',
    matchType: 'Likely duplicate',
    status: 'Flagged',
    previousVerificationId: 'sterling-cab-ver-17',
    note:
      'Blank conditional waiver template appears identical to another district template and still needs human routing.',
  },
]

export const verifiedAmountEntries: VerifiedAmountEntry[] = [
  {
    id: 'verified-cab-16',
    verificationId: 'sterling-cab-ver-16',
    sourceDocumentId: 'record-invoice-jds-3601',
    enteredBy: 'Harper Stone',
    amount: 52276.18,
    method: 'Manual entry',
    status: 'Confirmed',
    note: 'Entered after source spot-check and support chain confirmation.',
  },
  {
    id: 'verified-md-11',
    verificationId: 'sterling-md-ver-11',
    sourceDocumentId: 'record-payapp-classic-23',
    enteredBy: 'Harper Stone',
    amount: 775000,
    method: 'Manual entry',
    status: 'Draft',
    note: 'Draft verification total pending support-gap disposition.',
  },
  {
    id: 'verified-ridgeview-9',
    verificationId: 'ridgeview-ver-9',
    sourceDocumentId: 'record-payapp-classic-17',
    enteredBy: 'Harper Stone',
    amount: 865464.69,
    method: 'Manual entry',
    status: 'Confirmed',
    note: 'Archived package remains the relied source for audit history.',
  },
]

export const contractBudgets: ContractBudget[] = [
  {
    id: 'budget-meridian-md',
    entityId: 'entity-sterling-md',
    vendorCode: 'MERI',
    vendorName: 'Meridian Constructors',
    authorizedAmount: 5425000,
    spentAmount: 4280000,
    remainingAmount: 1145000,
    utilizationPercent: 79,
    health: 'Monitor',
  },
  {
    id: 'budget-delta-md4',
    entityId: 'entity-ridgeview-md4',
    vendorCode: 'DLTA',
    vendorName: 'Delta Land Surveying',
    authorizedAmount: 812500,
    spentAmount: 487500,
    remainingAmount: 325000,
    utilizationPercent: 60,
    health: 'Healthy',
  },
  {
    id: 'budget-apex-cab',
    entityId: 'entity-sterling-cab',
    vendorCode: 'APEX',
    vendorName: 'Apex Engineering Inc.',
    authorizedAmount: 4850000,
    spentAmount: 3120000,
    remainingAmount: 1730000,
    utilizationPercent: 64,
    health: 'Healthy',
  },
]

export const auditEvents: AuditEvent[] = [
  {
    id: 'audit-access-riley',
    entityId: 'entity-sterling-md',
    category: 'Access',
    actor: 'SG Admin',
    occurredAt: 'Today at 8:02 AM',
    message: 'Pending viewer access request routed to Amy Lee for owner approval.',
  },
  {
    id: 'audit-dup-sunflower',
    entityId: 'entity-sterling-cab',
    category: 'Duplicate',
    actor: 'Approval queue',
    occurredAt: 'Yesterday at 3:40 PM',
    message: 'Sunflower duplicate escalated because the client kept both files in confirmation.',
  },
  {
    id: 'audit-verification-open',
    entityId: 'entity-sterling-cab',
    category: 'Verification',
    actor: 'SG PM',
    occurredAt: 'April 3, 2026 at 8:00 AM',
    message: 'Verification 17 opened for late rollover and setup intake.',
  },
  {
    id: 'audit-approval-md4',
    entityId: 'entity-ridgeview-md4',
    category: 'Approval',
    actor: 'Approval engineer',
    occurredAt: 'March 26, 2026 at 12:31 PM',
    message: 'Archived MD4 package locked and retained for read-only audit review.',
  },
]

export const internalSubmissions: Submission[] = uploadBatches.map((batch) => {
  const entityId = entityByDistrictId[batch.districtId]
  const meta = submissionMetaByBatchId[batch.id]

  return {
    ...batch,
    entityId,
    workflowType: getWorkflowTypeForDistrict(batch.districtId),
    queueState: meta.queueState,
    duplicateState: meta.duplicateState,
    queueAge: meta.queueAge,
    ownerLabel: meta.ownerLabel,
    blockedReason: meta.blockedReason,
    attentionNote: meta.attentionNote,
  }
})

export const internalVerifications: Verification[] = verifications.map(
  (verification) => ({
    ...verification,
    entityId: entityByDistrictId[verification.districtId],
    workflowType: getWorkflowTypeForDistrict(verification.districtId),
  }),
)

export const draftTasks: DraftTask[] = reviewItems
  .filter((item) => item.capability === 'drafting')
  .map((item) => {
    const record = getDocumentById(item.recordId)
    const submissionId = record?.batchId ?? internalSubmissions[0].id
    const submission = getSubmissionById(submissionId) ?? internalSubmissions[0]

    return {
      ...item,
      submissionId,
      entityId: submission.entityId,
      workflowType: submission.workflowType,
      queueAge: submission.queueAge,
      handoffStatus:
        item.rationale.approvalStatus === 'reviewed'
          ? 'Ready for approval handoff'
          : 'Draft rationale still in progress',
      verificationLabel: getVerificationLabel(submission.verificationId),
    }
  })

export const approvalTasks: ApprovalTask[] = reviewItems
  .filter((item) => item.capability === 'approval')
  .map((item) => {
    const record = getDocumentById(item.recordId)
    const submissionId = record?.batchId ?? internalSubmissions[0].id
    const submission = getSubmissionById(submissionId) ?? internalSubmissions[0]
    const meta = approvalTaskMetaByReviewId[item.id]

    return {
      ...item,
      submissionId,
      entityId: submission.entityId,
      workflowType: submission.workflowType,
      queueAge: submission.queueAge,
      verifiedAmountTarget: meta?.verifiedAmountTarget,
      duplicateDecisionRequired: item.exceptionFlags.includes('duplicate_file'),
      contractImpactId: meta?.contractImpactId,
    }
  })

export function getWorkflowTypeForDistrict(districtId: string): WorkflowType {
  return districtWorkflowTypeMap[districtId] ?? 'developer_reimbursement'
}

export function getWorkflowTypeLabel(workflowType: WorkflowType) {
  return workflowTypeLabels[workflowType]
}

export function getRoleLabel(role: Role) {
  return roleLabels[role]
}

export function getEntityById(entityId: string) {
  return entities.find((entity) => entity.id === entityId)
}

export function getSubmissionById(submissionId: string) {
  return internalSubmissions.find((submission) => submission.id === submissionId)
}

export function getSubmissionDocuments(submissionId: string): SubmissionDocument[] {
  const submission = getSubmissionById(submissionId)

  if (!submission) {
    return []
  }

  return documents
    .filter((document) => document.batchId === submissionId)
    .map((document) => ({
      ...document,
      submissionId,
      entityId: submission.entityId,
      workflowType: submission.workflowType,
    }))
}

export function getDuplicateMatchesBySubmission(submissionId: string) {
  return duplicateMatches.filter((match) => match.submissionId === submissionId)
}

export function getDraftTaskByReviewId(reviewId: string) {
  return draftTasks.find((task) => task.id === reviewId)
}

export function getApprovalTaskByReviewId(reviewId: string) {
  return approvalTasks.find((task) => task.id === reviewId)
}

export function getDraftTasksBySubmission(submissionId: string) {
  return draftTasks.filter((task) => task.submissionId === submissionId)
}

export function getApprovalTasksBySubmission(submissionId: string) {
  return approvalTasks.filter((task) => task.submissionId === submissionId)
}

export function getVerifiedAmountsByVerification(verificationId: string) {
  return verifiedAmountEntries.filter(
    (entry) => entry.verificationId === verificationId,
  )
}

export function getVerifiedAmountTotalByVerification(verificationId: string) {
  return getVerifiedAmountsByVerification(verificationId).reduce(
    (sum, entry) => sum + entry.amount,
    0,
  )
}

export function getContractBudgetById(contractBudgetId: string) {
  return contractBudgets.find((budget) => budget.id === contractBudgetId)
}

export function getEntityMemberships(entityId?: string) {
  return entityId
    ? entityMemberships.filter((membership) => membership.entityId === entityId)
    : entityMemberships
}

export function getAccessRequests(entityId?: string) {
  return entityId
    ? accessRequests.filter((request) => request.entityId === entityId)
    : accessRequests
}

export function getAuditEvents(entityId?: string) {
  return entityId
    ? auditEvents.filter((event) => event.entityId === entityId)
    : auditEvents
}

export function getInternalDashboardMetrics() {
  return {
    newSubmissions: internalSubmissions.filter(
      (submission) => submission.queueState === 'New',
    ).length,
    draftingNeeded: internalSubmissions.filter(
      (submission) => submission.queueState === 'Needs drafting',
    ).length,
    approvalsWaiting: approvalTasks.length,
    duplicateEscalations: duplicateMatches.filter(
      (match) => match.status === 'Escalated',
    ).length,
    approachingCutoff: internalVerifications.filter(
      (verification) => verification.timing === 'Approaching cutoff',
    ).length,
    pendingAccessRequests: accessRequests.filter(
      (request) => request.status === 'Pending approval',
    ).length,
  }
}

export function getWorkflowTypeSummaries() {
  return (Object.keys(workflowTypeLabels) as WorkflowType[]).map(
    (workflowType) => {
      const workflowSubmissions = internalSubmissions.filter(
        (submission) => submission.workflowType === workflowType,
      )
      const workflowVerificationIds = internalVerifications
        .filter((verification) => verification.workflowType === workflowType)
        .map((verification) => verification.id)

      return {
        workflowType,
        label: getWorkflowTypeLabel(workflowType),
        submissionCount: workflowSubmissions.length,
        blockedCount: workflowSubmissions.filter(
          (submission) => submission.queueState === 'Blocked',
        ).length,
        submittedAmount: getSubmittedAmountTotal(
          workflowSubmissions.flatMap((submission) =>
            getSubmissionDocuments(submission.id),
          ),
        ),
        verifiedAmount: workflowVerificationIds.reduce(
          (sum, verificationId) =>
            sum + getVerifiedAmountTotalByVerification(verificationId),
          0,
        ),
      }
    },
  )
}

export function getVerificationManagementRows() {
  return internalVerifications.map((verification) => {
    const relatedSubmissions = internalSubmissions.filter(
      (submission) => submission.verificationId === verification.id,
    )
    const relatedDocuments = relatedSubmissions.flatMap((submission) =>
      getSubmissionDocuments(submission.id),
    )

    return {
      verification,
      entity: getEntityById(verification.entityId),
      submissionCount: relatedSubmissions.length,
      duplicateCount: relatedSubmissions.filter(
        (submission) => submission.duplicateState !== 'Clear',
      ).length,
      blockedCount: relatedSubmissions.filter(
        (submission) => submission.queueState === 'Blocked',
      ).length,
      submittedAmount: getSubmittedAmountTotal(relatedDocuments),
      verifiedAmount: getVerifiedAmountTotalByVerification(verification.id),
    }
  })
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100000 ? 0 : 2,
  }).format(value)
}

function getVerificationLabel(verificationId: string) {
  return (
    internalVerifications.find((verification) => verification.id === verificationId)
      ?.label ?? verificationId
  )
}
