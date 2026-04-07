import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  FileSearch,
  FolderKanban,
  Link2,
  ScrollText,
  Sparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { MockupShell } from '#/components/mockup-shell'
import { PdfPreviewPanel } from '#/components/pdf-preview-panel'
import { StatusBadge } from '#/components/status-badge'
import { WorkflowStageStrip } from '#/components/workflow-stage-strip'
import { Button, buttonVariants } from '#/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import {
  getCustodyStateLabel,
  getDeterminationMethodLabel,
  getDistrict,
  getDocumentById,
  getEvidenceMaturityStageLabel,
  getExceptionFlagLabel,
  getManifestStateLabel,
  getRelationshipLabel,
  getReviewFieldConfirmations,
  getReviewItemById,
  getUserCapabilityLabel,
  reviewItems,
} from '#/lib/mock-data'
import {
  getDraftTaskByReviewId,
  getEntityById,
  getSubmissionById,
  getWorkflowTypeLabel,
} from '#/lib/internal-portal-data'
import type { DocumentRecord, ReviewItem } from '#/lib/mock-data'
import { cn } from '#/lib/utils'

const openQueue = reviewItems
const draftingQueue = openQueue.filter((item) => item.capability === 'drafting')
const defaultReview =
  draftingQueue.find((item) => item.id === 'review-jds-3645-rollover') ||
  draftingQueue[0] ||
  openQueue[0]
const defaultReviewId = defaultReview.id

const activity = [
  'Verification 17 rollover is waiting on support confirmation.',
  'Atwell kickoff package is still drafting the setup rationale.',
  'Metro finance package is blocked by a support gap.',
  'Sunflower duplicate is already in the approval queue.',
]

export const Route = createFileRoute('/review-workbench')({
  validateSearch: (search: Record<string, unknown>) => ({
    reviewId: typeof search.reviewId === 'string' ? search.reviewId : undefined,
  }),
  head: () => ({
    meta: [{ title: 'Drafting Workbench | Schedio Group' }],
  }),
  component: ReviewWorkbenchPage,
})

function ReviewWorkbenchPage() {
  const { reviewId } = Route.useSearch()
  const focusedReview =
    getReviewItemById(reviewId ?? defaultReviewId) ?? defaultReview
  const focusedDistrict = getDistrict(focusedReview.districtId)
  const draftingCount = draftingQueue.length
  const evidenceGapCount = draftingQueue.filter((item) =>
    item.exceptionFlags.includes('missing_support'),
  ).length
  const reviewedDrafts = draftingQueue.filter(
    (item) => item.rationale.approvalStatus === 'reviewed',
  ).length

  const metrics = [
    {
      label: 'Draft packages',
      value: String(draftingCount),
      helper: 'Waiting on analyst drafting',
    },
    {
      label: 'Evidence gaps',
      value: String(evidenceGapCount),
      helper: 'Missing linked support',
    },
    {
      label: 'Reviewed drafts',
      value: String(reviewedDrafts),
      helper: 'Ready for approval handoff',
    },
    {
      label: 'Focused method',
      value: getDeterminationMethodLabel(focusedReview.determinationMethod),
      helper: 'Active determination method',
    },
  ]

  return (
    <MockupShell
      tone="review"
      meta={`${focusedDistrict.name} • drafting capability`}
      title="Drafting workbench"
    >
      <WorkflowStageStrip stage="drafting" />

      <section className="mb-5 grid grid-cols-1 divide-y overflow-hidden rounded-2xl border border-border-strong bg-surface-panel sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="p-4">
            <p className="ops-label text-text-muted mb-2">{metric.label}</p>
            <p className="font-ops text-[2rem] font-semibold leading-none tracking-tight text-text-strong mb-2">
              {metric.value}
            </p>
            <p className="text-xs text-text-muted">{metric.helper}</p>
          </div>
        ))}
      </section>

      <div className="grid min-h-[760px] grid-cols-1 overflow-hidden rounded-2xl border border-border-strong bg-surface-panel shadow-sm xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="flex flex-col border-b border-border-base bg-surface-muted/30 xl:border-r xl:border-b-0">
          <div className="flex items-center justify-between border-b border-border-base px-4 py-3">
            <h2 className="font-ops text-sm font-semibold text-text-strong">
              Drafting queue
            </h2>
            <span className="text-xs font-medium text-text-muted">
              {draftingCount} items
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col divide-y divide-border-base">
              {draftingQueue.map((item) => {
                const record = getDocumentById(item.recordId)
                const itemDistrict = getDistrict(item.districtId)
                const isFocused = item.id === focusedReview.id

                return (
                  <Link
                    key={item.id}
                    to="/review-workbench"
                    search={{ reviewId: item.id }}
                    resetScroll={false}
                    className={cn(
                      'block no-underline px-4 py-4 transition-colors',
                      isFocused
                        ? 'relative bg-surface-hover before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary'
                        : 'hover:bg-surface-subtle',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p
                          className={cn(
                            'font-ops text-sm font-semibold',
                            isFocused ? 'text-primary' : 'text-text-strong',
                          )}
                        >
                          {record?.organizedName}
                        </p>
                        <p className="font-mono text-[0.7rem] truncate text-text-muted">
                          {itemDistrict.name} • {record?.originalName}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusBadge label={item.status} />
                      <span className="font-mono text-[0.7rem] font-semibold text-text-muted">
                        {Math.round(item.confidence * 100)}%
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-text-base">
                      {item.reason}
                    </p>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        <div className="min-w-0 bg-surface-panel">
          <WorkbenchDetail
            key={focusedReview.id}
            focusedReview={focusedReview}
            focusedDocument={getDocumentById(focusedReview.recordId)}
            inDraftingQueue={draftingQueue.some(
              (item) => item.id === focusedReview.id,
            )}
          />
        </div>
      </div>
    </MockupShell>
  )
}

function WorkbenchDetail({
  focusedReview,
  focusedDocument,
  inDraftingQueue,
}: {
  focusedReview: ReviewItem
  focusedDocument?: DocumentRecord
  inDraftingQueue: boolean
}) {
  const [previewRecordId, setPreviewRecordId] = useState(
    focusedDocument?.id ?? '',
  )
  const previewDocument = getDocumentById(previewRecordId) ?? focusedDocument
  const isApprovalHandoff = focusedReview.capability === 'approval'
  const fieldConfirmations = getReviewFieldConfirmations(focusedReview.id)
  const draftTask = getDraftTaskByReviewId(focusedReview.id)
  const submission = draftTask
    ? getSubmissionById(draftTask.submissionId)
    : undefined
  const entity = draftTask ? getEntityById(draftTask.entityId) : undefined

  const fieldRows = [
    [
      'Determination method',
      getDeterminationMethodLabel(focusedReview.determinationMethod),
    ],
    [
      'Evidence maturity',
      getEvidenceMaturityStageLabel(focusedReview.evidenceMaturityStage),
    ],
    ['Open flags', String(focusedReview.exceptionFlags.length)],
  ]

  return (
    <div className="flex h-full min-w-0 flex-col bg-surface-panel">
      <div className="flex items-center justify-between border-b border-border-base bg-surface-panel px-4 py-3">
        <h2 className="font-ops text-sm font-semibold text-text-strong">
          Drafting canvas
        </h2>
        <div className="flex flex-wrap gap-2">
          <StatusBadge
            label={getUserCapabilityLabel(focusedReview.capability)}
          />
          <StatusBadge
            label={getEvidenceMaturityStageLabel(
              focusedReview.evidenceMaturityStage,
            )}
          />
          <StatusBadge label={focusedReview.status} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-6 p-5 xl:p-6">
          <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.32fr)_360px]">
            <PdfPreviewPanel
              title={
                previewDocument?.id === focusedDocument?.id
                  ? 'Source record'
                  : 'Linked record'
              }
              description={
                previewDocument?.id === focusedDocument?.id
                  ? 'Original file for this draft.'
                  : 'Related file for comparison.'
              }
              document={previewDocument}
              maxWidth={980}
              allowReset
              tone="light"
              actions={
                previewDocument?.id !== focusedDocument?.id ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 rounded-full border-border-base bg-surface-panel px-4 text-xs text-text-strong"
                    onClick={() =>
                      setPreviewRecordId(focusedDocument?.id ?? '')
                    }
                  >
                    Return to source record
                  </Button>
                ) : undefined
              }
            />

            <div className="workflow-panel-drafting space-y-4 rounded-3xl border px-4 py-4">
              {!inDraftingQueue ? (
                <div className="rounded-[1.15rem] border border-border-strong bg-surface-panel px-4 py-4">
                  <p className="ops-label text-text-accent">Approval handoff</p>
                  <p className="mt-2 text-sm text-text-base">
                    This draft is already in approval review.
                  </p>
                </div>
              ) : null}

              <div>
                <p className="ops-label text-text-accent">
                  Packet under assembly
                </p>
                <p className="mt-2 text-lg font-semibold text-text-strong">
                  {focusedDocument?.organizedName ?? 'Selected record'}
                </p>
                <p className="mt-2 text-sm leading-6 text-text-base">
                  {focusedReview.reason}
                </p>
              </div>

              {draftTask && submission ? (
                <div className="rounded-[1.15rem] border border-border-base bg-surface-panel px-4 py-4">
                  <p className="ops-label text-text-accent">Submission context</p>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <ContextField
                      label="Entity"
                      value={entity?.name ?? 'Unknown entity'}
                    />
                    <ContextField
                      label="Workflow"
                      value={getWorkflowTypeLabel(draftTask.workflowType)}
                    />
                    <ContextField
                      label="Verification"
                      value={draftTask.verificationLabel}
                    />
                    <ContextField
                      label="Queue age"
                      value={draftTask.queueAge}
                    />
                    <ContextField
                      label="Handoff"
                      value={draftTask.handoffStatus}
                    />
                    <ContextField
                      label="Submission state"
                      value={submission.queueState}
                    />
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {fieldRows.map(([label, value]) => (
                  <div key={label} className="space-y-1">
                    <p className="ops-label text-text-accent">{label}</p>
                    <p className="text-sm font-semibold text-text-strong">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <StatusBadge
                  label={getManifestStateLabel(
                    focusedReview.rationale.approvalStatus,
                  )}
                />
                <span className="rounded-full border border-border-base bg-surface-panel px-3 py-1 text-[0.72rem] font-semibold text-text-strong">
                  {Math.round(focusedReview.confidence * 100)}% confidence
                </span>
              </div>
            </div>
          </div>

          <Tabs defaultValue="rationale" className="w-full">
            <TabsList className="workflow-tabs-drafting grid h-auto w-full grid-cols-2 rounded-full p-1 lg:grid-cols-4">
              <TabsTrigger value="rationale" className="rounded-full text-xs">
                Rationale
              </TabsTrigger>
              <TabsTrigger value="evidence" className="rounded-full text-xs">
                Evidence
              </TabsTrigger>
              <TabsTrigger
                value="confirmation"
                className="rounded-full text-xs"
              >
                Confirmation
              </TabsTrigger>
              <TabsTrigger value="governance" className="rounded-full text-xs">
                Governance
              </TabsTrigger>
            </TabsList>

            <TabsContent value="rationale" className="pt-5">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_320px]">
                <div className="rounded-3xl border border-border-strong bg-surface-panel px-4 py-4">
                  <p className="ops-label text-text-accent mb-4">
                    Draft rationale
                  </p>
                  <div className="space-y-4">
                    <DraftField
                      label="Summary"
                      value={focusedReview.rationale.summary}
                    />
                    <DraftField
                      label="Source basis"
                      value={focusedReview.rationale.sourceBasis}
                    />
                    <DraftField
                      label="Reason for change"
                      value={focusedReview.rationale.changeReason}
                    />
                  </div>
                </div>

                <div className="workflow-panel-drafting rounded-3xl border px-4 py-4">
                  <p className="ops-label text-text-accent mb-4">
                    Drafting notes
                  </p>
                  <div className="space-y-3">
                    {focusedReview.notes.map((note) => (
                      <p
                        key={note}
                        className="text-sm leading-6 text-text-base"
                      >
                        {note}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="evidence" className="pt-5">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="workflow-panel-drafting rounded-3xl border px-4 py-4">
                  <p className="ops-label text-text-accent">
                    Evidence hierarchy used
                  </p>
                  <div className="mt-4 space-y-4">
                    {focusedReview.evidenceHierarchy.map((entry, index) => (
                      <div key={entry} className="space-y-1">
                        <p className="font-ops text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                          Source {index + 1}
                        </p>
                        <p className="text-sm leading-6 text-text-strong">
                          {entry}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-border-strong bg-surface-panel px-4 py-4">
                  <p className="ops-label text-text-accent mb-4">
                    Related records
                  </p>
                  <div className="space-y-4">
                    {focusedDocument?.linkedRecords.length ? (
                      focusedDocument.linkedRecords.map((linkedRecord) => {
                        const relatedDocument = getDocumentById(
                          linkedRecord.recordId,
                        )

                        return (
                          <div
                            key={linkedRecord.recordId}
                            className="rounded-[1.15rem] border border-border-base bg-surface-muted/80 px-4 py-4"
                          >
                            <div className="flex items-center gap-2">
                              <Link2 className="size-4 text-text-accent" />
                              <p className="font-ops text-sm font-semibold text-text-strong">
                                {getRelationshipLabel(linkedRecord.relation)}
                              </p>
                            </div>
                            <p className="mt-3 text-sm font-semibold text-text-strong">
                              {linkedRecord.label}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-text-muted">
                              {linkedRecord.status}
                            </p>
                            {relatedDocument?.previewAsset ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-3 rounded-full border-border-base bg-surface-panel text-text-strong"
                                onClick={() =>
                                  setPreviewRecordId(relatedDocument.id)
                                }
                              >
                                View linked record
                              </Button>
                            ) : null}
                          </div>
                        )
                      })
                    ) : (
                      <div className="rounded-[1.15rem] border border-border-base bg-surface-muted px-4 py-4">
                        <p className="font-ops text-sm font-semibold text-text-strong">
                          Support chain not linked
                        </p>
                        <p className="mt-2 text-sm text-text-muted">
                          One or more related records are still missing.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="confirmation" className="pt-5">
              {fieldConfirmations.length > 0 ? (
                <div className="workflow-panel-drafting rounded-3xl border px-4 py-4">
                  <p className="ops-label text-text-accent">
                    Field confirmation
                  </p>
                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    {fieldConfirmations.map((field) => (
                      <div
                        key={field.id}
                        className="rounded-[1.15rem] border border-border-base bg-surface-panel px-4 py-4"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-text-strong">
                              {field.label}
                            </p>
                            <p className="mt-1 text-sm text-text-base">
                              {field.extractedValue}
                            </p>
                          </div>
                          <StatusBadge label={field.status} />
                        </div>
                        <p className="mt-3 font-mono text-[0.72rem] text-text-muted">
                          {field.sourceRegion}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-text-muted">
                          {field.note}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="workflow-panel-drafting rounded-3xl border px-4 py-5">
                  <p className="font-ops text-sm font-semibold text-text-strong">
                    No field confirmation required
                  </p>
                  <p className="mt-2 text-sm leading-6 text-text-muted">
                    This draft can move forward without reviewer confirmation on
                    extracted fields.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="governance" className="pt-5">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-3xl border border-border-strong bg-surface-panel px-4 py-4">
                  <p className="ops-label text-text-accent mb-4">
                    Drafting checklist
                  </p>
                  <div className="space-y-4">
                    {focusedReview.governanceChecks.map((check) => (
                      <div key={check.id} className="flex items-start gap-3">
                        {check.result === 'pass' ? (
                          <CheckCircle2 className="mt-0.5 size-4 text-text-accent" />
                        ) : (
                          <CircleAlert className="mt-0.5 size-4 text-status-warning-text" />
                        )}
                        <div>
                          <p className="text-sm font-semibold text-text-strong">
                            {check.label}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-text-muted">
                            {check.note}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="workflow-panel-drafting rounded-3xl border px-4 py-4">
                    <p className="ops-label text-text-accent mb-4">
                      Package status
                    </p>
                    <div className="space-y-0">
                      <ReadinessCard
                        icon={ScrollText}
                        title="Document manifest"
                        copy={getManifestStateLabel(
                          focusedReview.documentManifestState,
                        )}
                      />
                      <ReadinessCard
                        icon={FolderKanban}
                        title="Run manifest"
                        copy={getManifestStateLabel(
                          focusedReview.runManifestState,
                        )}
                      />
                      <ReadinessCard
                        icon={FileSearch}
                        title="Target custody state"
                        copy={getCustodyStateLabel(
                          focusedReview.targetCustodyState,
                        )}
                      />
                      <ReadinessCard
                        icon={Sparkles}
                        title="Active flags"
                        copy={
                          focusedReview.exceptionFlags.length
                            ? focusedReview.exceptionFlags
                                .map((flag) => getExceptionFlagLabel(flag))
                                .join(' • ')
                            : 'No active exception flags'
                        }
                      />
                    </div>
                  </div>

                  <div className="workflow-panel-drafting rounded-3xl border px-4 py-4">
                    <p className="ops-label text-text-accent mb-4">
                      Queue watch
                    </p>
                    <div className="space-y-4">
                      {activity.map((entry) => (
                        <div
                          key={entry}
                          className="border-b border-border-base pb-3 font-ops text-sm text-text-base last:border-b-0 last:pb-0"
                        >
                          {entry}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <div className="workflow-action-bar-drafting border-t px-5 py-4 xl:px-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Button className="rounded-full bg-primary text-primary-foreground hover:bg-primary-hover">
            {isApprovalHandoff
              ? 'Update draft rationale'
              : 'Save draft rationale'}
          </Button>
          {isApprovalHandoff ? (
            <Button
              asChild
              variant="outline"
              className="rounded-full border-border-base bg-surface-panel text-text-strong"
            >
              <Link
                to="/review-console"
                search={{
                  reviewId: focusedReview.id,
                  q: undefined,
                  districtId: undefined,
                }}
                resetScroll={false}
              >
                Return to approval
              </Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              className="rounded-full border-border-base bg-surface-panel text-text-strong"
            >
              Submit to approval
            </Button>
          )}
          <a
            href={focusedDocument?.igniteUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'rounded-full border-border-base bg-surface-panel text-text-strong no-underline',
            )}
          >
            Open in Egnyte
            <ArrowUpRight className="size-4" />
          </a>
        </div>
      </div>
    </div>
  )
}

function DraftField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="ops-label text-text-accent">{label}</p>
      <p className="text-sm leading-6 text-text-base">{value}</p>
    </div>
  )
}

function ContextField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="ops-label text-text-muted">{label}</p>
      <p className="text-sm font-semibold text-text-strong">{value}</p>
    </div>
  )
}

function ReadinessCard({
  icon: Icon,
  title,
  copy,
}: {
  icon: LucideIcon
  title: string
  copy: string
}) {
  return (
    <div className="space-y-2 border-b border-border-base py-3 last:border-b-0 last:pb-0">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-text-accent" />
        <p className="font-ops text-sm font-semibold text-text-strong">
          {title}
        </p>
      </div>
      <p className="text-sm leading-6 text-text-base">{copy}</p>
    </div>
  )
}
