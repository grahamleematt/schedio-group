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
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { MockupShell } from '#/components/mockup-shell'
import { PdfPreviewPanel } from '#/components/pdf-preview-panel'
import { StatusBadge } from '#/components/status-badge'
import { Button, buttonVariants } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import { ScrollArea } from '#/components/ui/scroll-area'
import {
  getCustodyStateLabel,
  getDeterminationMethodLabel,
  getDocumentById,
  getEvidenceMaturityStageLabel,
  getExceptionFlagLabel,
  getManifestStateLabel,
  getRelationshipLabel,
  getReviewItemById,
  getReviewItemsByDistrict,
  getUserCapabilityLabel,
  getDistrict,
} from '#/lib/mock-data'
import type { DocumentRecord, ReviewItem } from '#/lib/mock-data'
import { cn } from '#/lib/utils'

const districtId = 'sterling-cab'
const openQueue = getReviewItemsByDistrict(districtId).filter(
  (item) => item.status !== 'Published',
)
const draftingQueue = openQueue.filter((item) => item.capability === 'drafting')
const defaultReview =
  draftingQueue.find((item) => item.id === 'review-payapp-pages-20') ||
  draftingQueue[0] ||
  openQueue[0]
const defaultReviewId = defaultReview.id

const activity = [
  'Pay application variant remains in drafting until its support relationship is attached and rationale is complete.',
  'Duplicate Sunflower invoice has already crossed into approval because the analyst recommendation is fully drafted.',
  'Malformed McDonal amount is still a drafting problem, not an approval problem.',
  'AGW placeholder contract continues to inform downstream task orders while the source meaning is normalized.',
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
  const focusedDocument = getDocumentById(focusedReview.recordId)
  const focusedDistrict = getDistrict(focusedReview.districtId)
  const isApprovalHandoff = focusedReview.capability === 'approval'
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
      note: 'These items still need analyst drafting before authority can change anywhere else in SG DREAM.',
    },
    {
      label: 'Evidence gaps',
      value: String(evidenceGapCount),
      note: 'Support relationships, package completeness, and source hierarchy remain the first drafting concern.',
    },
    {
      label: 'Reviewed drafts',
      value: String(reviewedDrafts),
      note: 'These packages are close to handoff because the rationale and manifest work are already in reviewed state.',
    },
    {
      label: 'Focused method',
      value: getDeterminationMethodLabel(focusedReview.determinationMethod),
      note: 'The active drafting problem is framed through the SG DREAM determination method selected for this record.',
    },
  ]

  return (
    <MockupShell
      tone="operations"
      meta={`${focusedDistrict.name} • analyst drafting workspace`}
      title="Drafting workbench"
      description="Inspect source evidence, draft meaning through manifests and rationale, and prepare the engineering position before it reaches approval authority."
      actions={
        <>
          <Button className="rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary-hover">
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
                search={{ reviewId: focusedReview.id }}
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
        </>
      }
      aside={
        <div className="space-y-4">
          <div className="rounded-2xl border border-border-strong bg-surface-panel px-4 py-4">
            <p className="ops-label text-text-accent">Active role</p>
            <div className="mt-2">
              <StatusBadge
                label={getUserCapabilityLabel(focusedReview.capability)}
              />
            </div>
            <p className="mt-3 text-sm text-text-muted">
              Drafting prepares meaning, rationale, and manifests. Approval
              happens on the next screen.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-xl border border-border-strong bg-surface-muted px-3 py-3">
              <p className="ops-label text-text-accent">Document manifest</p>
              <p className="mt-2 font-ops text-sm font-medium text-text-strong">
                {getManifestStateLabel(focusedReview.documentManifestState)}
              </p>
            </div>
            <div className="rounded-xl border border-border-strong bg-surface-muted px-3 py-3">
              <p className="ops-label text-text-accent">Run manifest</p>
              <p className="mt-2 font-ops text-sm font-medium text-text-strong">
                {getManifestStateLabel(focusedReview.runManifestState)}
              </p>
            </div>
          </div>
        </div>
      }
    >
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border-base border border-border-strong rounded-2xl mb-6 bg-surface-panel overflow-hidden">
        {metrics.map((metric) => (
          <div key={metric.label} className="p-4 sm:p-5">
            <p className="ops-label text-text-muted mb-2">{metric.label}</p>
            <p className="font-ops text-[2rem] font-semibold text-text-strong leading-none tracking-tight mb-2">
              {metric.value}
            </p>
            <p className="text-xs leading-5 text-text-base">{metric.note}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-col xl:flex-row border border-border-strong rounded-2xl overflow-hidden bg-surface-panel shadow-sm min-h-[800px]">
        {/* Left Pane: Queue */}
        <div className="w-full xl:w-[340px] shrink-0 flex flex-col border-b xl:border-b-0 xl:border-r border-border-base bg-surface-muted/30">
          <div className="px-4 py-3 border-b border-border-base flex items-center justify-between">
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
                        ? 'bg-surface-hover relative before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary'
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
                        <p className="font-mono text-[0.7rem] text-text-muted truncate">
                          {record?.originalName}
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

        {/* Center Pane: Workbench Detail */}
        <div className="flex-1 min-w-0 flex flex-col border-b xl:border-b-0 xl:border-r border-border-base bg-surface-panel">
          <WorkbenchDetail
            key={focusedReview.id}
            focusedReview={focusedReview}
            focusedDocument={focusedDocument}
            inDraftingQueue={draftingQueue.some(
              (item) => item.id === focusedReview.id,
            )}
          />
        </div>

        {/* Right Pane: Activity & Tools */}
        <div className="w-full xl:w-[320px] shrink-0 flex flex-col bg-surface-subtle/20">
          <div className="px-4 py-3 border-b border-border-base flex items-center justify-between">
            <h2 className="font-ops text-sm font-semibold text-text-strong">
              Governance tracking
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="p-5 space-y-8">
              <div>
                <p className="ops-label text-text-accent mb-4">
                  Drafting activity
                </p>
                <div className="space-y-4">
                  {activity.map((entry) => (
                    <div
                      key={entry}
                      className="pb-4 border-b border-border-base last:border-b-0 last:pb-0 font-ops text-sm leading-6 text-text-base"
                    >
                      {entry}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="ops-label text-text-accent mb-4">
                  Governance posture
                </p>
                <div className="space-y-4">
                  {[
                    {
                      icon: FolderKanban,
                      title: 'Meaning lives in manifests',
                      copy: 'The analyst does not alter source custody. Drafting attaches meaning through document and run manifests.',
                    },
                    {
                      icon: Link2,
                      title: 'Evidence hierarchy first',
                      copy: 'Drafting records the evidence hierarchy used so approval can see exactly what justified the position.',
                    },
                    {
                      icon: ShieldCheck,
                      title: 'Approval is separate',
                      copy: 'This workspace prepares the package. Authority changes only after the approval console signs off.',
                    },
                  ].map((item) => {
                    const Icon = item.icon

                    return (
                      <div
                        key={item.title}
                        className="pb-4 border-b border-border-base last:border-b-0 last:pb-0"
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="size-4 text-text-accent" />
                          <p className="font-ops text-sm font-semibold text-text-strong">
                            {item.title}
                          </p>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-text-base">
                          {item.copy}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
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

  const fieldRows = [
    [
      'Document manifest',
      getManifestStateLabel(focusedReview.documentManifestState),
    ],
    ['Run manifest', getManifestStateLabel(focusedReview.runManifestState)],
    [
      'Determination method',
      getDeterminationMethodLabel(focusedReview.determinationMethod),
    ],
    [
      'Evidence maturity',
      getEvidenceMaturityStageLabel(focusedReview.evidenceMaturityStage),
    ],
  ]

  return (
    <div className="flex flex-col h-full bg-surface-panel">
          <div className="px-4 py-3 border-b border-border-base bg-surface-panel flex items-center justify-between">
            <h2 className="font-ops text-sm font-semibold text-text-strong">
              Draft package
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
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="p-5 xl:p-6 flex flex-col gap-8">
          <div className="space-y-8 flex flex-col min-w-0">
            {!inDraftingQueue ? (
              <div className="rounded-[1.35rem] border border-border-strong bg-surface-subtle px-4 py-4">
                <p className="ops-label text-text-accent">Approval handoff</p>
                <p className="mt-2 text-sm leading-6 text-text-base">
                  This package has already left the active drafting queue. You
                  are viewing the prepared draft that approval is evaluating so
                  the full rationale and evidence package remain traceable.
                </p>
              </div>
            ) : null}

            <Dialog>
              <PdfPreviewPanel
                title={
                  previewDocument?.id === focusedDocument?.id
                    ? 'Source evidence preview'
                    : 'Related evidence preview'
                }
                description={
                  previewDocument?.id === focusedDocument?.id
                    ? 'Click to preview the source artifact while drafting meaning, rationale, and package structure.'
                    : 'Click to preview a linked artifact so you can compare relationships.'
                }
                document={previewDocument}
                maxWidth={680}
                allowReset
                tone="light"
                hideViewer
                actions={
                  <DialogTrigger asChild>
                    <Button className="h-8 rounded-full bg-primary px-4 text-xs text-primary-foreground hover:bg-primary-hover">
                      Preview document
                    </Button>
                  </DialogTrigger>
                }
              />
              <DialogContent className="max-w-[75vw] sm:max-w-[75vw] w-[75vw] h-[90vh] p-0 border-border-strong bg-surface-panel flex flex-col gap-0 rounded-2xl overflow-hidden [&>button]:right-4 [&>button]:top-4 [&>button]:text-text-muted [&>button]:opacity-100 hover:[&>button]:text-text-strong">
                <DialogHeader className="px-6 py-4 border-b border-border-base bg-surface-panel shrink-0 flex flex-row items-center justify-between">
                  <div>
                    <DialogTitle className="font-ops text-lg text-text-strong">
                      {previewDocument?.id === focusedDocument?.id
                        ? 'Source Evidence Preview'
                        : 'Related Evidence Preview'}
                    </DialogTitle>
                    <DialogDescription className="text-text-muted">
                      Reviewing {previewDocument?.originalName ?? 'document'}
                    </DialogDescription>
                  </div>
                  {previewDocument?.id !== focusedDocument?.id && (
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full border-border-base bg-surface-panel text-text-strong mr-8"
                      onClick={() =>
                        setPreviewRecordId(focusedDocument?.id ?? '')
                      }
                    >
                      Return to selected record
                    </Button>
                  )}
                </DialogHeader>
                <div className="flex-1 min-h-0 bg-surface-muted overflow-y-auto p-6">
                  <PdfPreviewPanel
                    title={
                      previewDocument?.id === focusedDocument?.id
                        ? 'Source evidence preview'
                        : 'Related evidence preview'
                    }
                    description="Detailed view of the artifact."
                    document={previewDocument}
                    maxWidth={3000}
                    allowReset
                    tone="light"
                  />
                </div>
              </DialogContent>
            </Dialog>

            <div>
              <p className="ops-label text-text-accent mb-4">Draft rationale</p>
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
              <div className="mt-4">
                <StatusBadge
                  label={getManifestStateLabel(
                    focusedReview.rationale.approvalStatus,
                  )}
                />
              </div>
            </div>

            <div className="rounded-3xl border border-border-strong bg-surface-subtle px-4 py-4">
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

            <div>
              <p className="ops-label text-text-accent mb-4">Related records</p>
              <div className="space-y-4">
                {focusedDocument?.linkedRecords.length ? (
                  focusedDocument.linkedRecords.map((linkedRecord) => {
                    const relatedDocument = getDocumentById(
                      linkedRecord.recordId,
                    )

                    return (
                      <div key={linkedRecord.recordId} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Link2 className="size-4 text-text-accent" />
                          <p className="font-ops text-sm font-semibold text-text-strong">
                            {getRelationshipLabel(linkedRecord.relation)}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-text-strong">
                          {linkedRecord.label}
                        </p>
                        <p className="text-sm leading-6 text-text-muted">
                          {linkedRecord.status}
                        </p>
                        {relatedDocument?.previewAsset ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2 rounded-full border-border-base bg-surface-panel text-text-strong"
                            onClick={() =>
                              setPreviewRecordId(relatedDocument.id)
                            }
                          >
                            Preview related file
                          </Button>
                        ) : null}
                      </div>
                    )
                  })
                ) : (
                  <div className="space-y-2">
                    <p className="font-ops text-sm font-semibold text-text-strong">
                      Expected support chain not found
                    </p>
                    <p className="text-sm leading-6 text-text-muted">
                      This governed package still needs one or more related
                      records before the draft can advance to approval.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {fieldRows.map(([label, value]) => (
                <div key={label} className="space-y-1">
                  <p className="ops-label text-text-accent">{label}</p>
                  <p className="text-sm font-semibold text-text-strong">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div>
              <p className="ops-label text-text-accent mb-4">Drafting notes</p>
              <div className="space-y-3">
                {focusedReview.notes.map((note) => (
                  <p key={note} className="text-sm leading-6 text-text-base">
                    {note}
                  </p>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-8 pt-6 border-t border-border-base">
            <div>
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

            <div>
              <p className="ops-label text-text-accent mb-4">
                Draft package status
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
                  copy={getManifestStateLabel(focusedReview.runManifestState)}
                />
                <ReadinessCard
                  icon={FileSearch}
                  title="Target custody state"
                  copy={getCustodyStateLabel(focusedReview.targetCustodyState)}
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

            <div>
              <p className="ops-label text-text-accent mb-4">Actions</p>
              <div className="grid gap-3">
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
                      search={{ reviewId: focusedReview.id }}
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

function ReadinessCard({
  icon: Icon,
  title,
  copy,
}: {
  icon: typeof ShieldCheck
  title: string
  copy: string
}) {
  return (
    <div className="space-y-2 py-3 border-b border-border-base last:border-b-0 last:pb-0">
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
