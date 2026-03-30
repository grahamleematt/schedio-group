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
import { MetricCard } from '#/components/metric-card'
import { MockupShell } from '#/components/mockup-shell'
import { PdfPreviewPanel } from '#/components/pdf-preview-panel'
import { StatusBadge } from '#/components/status-badge'
import { Button, buttonVariants } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { ScrollArea } from '#/components/ui/scroll-area'
import {
  getCustodyStateLabel,
  getDeterminationMethodLabel,
  getDocumentById,
  getDocumentClassLabel,
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
  (item) => item.status !== 'Published'
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
  const focusedReview = getReviewItemById(reviewId ?? defaultReviewId) ?? defaultReview
  const focusedDocument = getDocumentById(focusedReview.recordId)
  const focusedDistrict = getDistrict(focusedReview.districtId)
  const isApprovalHandoff = focusedReview.capability === 'approval'
  const draftingCount = draftingQueue.length
  const evidenceGapCount = draftingQueue.filter((item) =>
    item.exceptionFlags.includes('missing_support')
  ).length
  const reviewedDrafts = draftingQueue.filter(
    (item) => item.rationale.approvalStatus === 'reviewed'
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
          <Button className="rounded-full bg-[var(--brand-blue)] px-5 text-white hover:bg-[color-mix(in_oklab,var(--brand-blue)_86%,black_14%)]">
            {isApprovalHandoff ? 'Update draft rationale' : 'Save draft rationale'}
          </Button>
          {isApprovalHandoff ? (
            <Button
              asChild
              variant="outline"
              className="rounded-full border-[var(--brand-border)] bg-white text-[var(--brand-slate)]"
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
              className="rounded-full border-[var(--brand-border)] bg-white text-[var(--brand-slate)]"
            >
              Submit to approval
            </Button>
          )}
        </>
      }
      aside={
        <div className="space-y-4">
          <div className="rounded-2xl border border-[rgba(0,61,166,0.14)] bg-white px-4 py-4">
            <p className="ops-label text-[var(--brand-blue)]">Active role</p>
            <div className="mt-2">
              <StatusBadge label={getUserCapabilityLabel(focusedReview.capability)} />
            </div>
            <p className="mt-3 text-sm text-[var(--brand-muted)]">
              Drafting prepares meaning, rationale, and manifests. Approval happens on the next screen.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-xl border border-[rgba(0,61,166,0.14)] bg-[rgba(0,61,166,0.04)] px-3 py-3">
              <p className="ops-label text-[var(--brand-blue)]">Document manifest</p>
              <p className="mt-2 font-ops text-sm font-medium text-[var(--brand-slate)]">
                {getManifestStateLabel(focusedReview.documentManifestState)}
              </p>
            </div>
            <div className="rounded-xl border border-[rgba(0,61,166,0.14)] bg-[rgba(0,61,166,0.04)] px-3 py-3">
              <p className="ops-label text-[var(--brand-blue)]">Run manifest</p>
              <p className="mt-2 font-ops text-sm font-medium text-[var(--brand-slate)]">
                {getManifestStateLabel(focusedReview.runManifestState)}
              </p>
            </div>
          </div>
        </div>
      }
    >
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} tone="operations" {...metric} />
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="brand-panel rounded-[1.75rem] border-[rgba(0,61,166,0.14)] shadow-none">
          <CardHeader>
            <CardTitle className="font-ops text-[2rem] font-semibold tracking-[-0.05em] text-[var(--brand-slate)]">
              Drafting queue
            </CardTitle>
            <p className="mt-2 font-ops text-sm leading-6 text-[var(--brand-text)]">
              Active drafting packages ordered by evidence gap, rationale maturity, and manifest readiness before handoff to approval.
            </p>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[560px] pr-1">
              <div className="space-y-3">
                {draftingQueue.map((item) => {
                  const record = getDocumentById(item.recordId)
                  const isFocused = item.id === focusedReview.id

                  return (
                    <Link
                      key={item.id}
                      to="/review-workbench"
                      search={{ reviewId: item.id }}
                      resetScroll={false}
                      className="block no-underline"
                    >
                      <article
                        className={cn(
                          'rounded-[1.35rem] border px-4 py-4 transition-colors',
                          isFocused
                            ? 'border-[rgba(0,61,166,0.24)] bg-[rgba(0,61,166,0.05)]'
                            : 'border-[rgba(0,61,166,0.12)] bg-white'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1.5">
                            <p className="font-ops text-sm font-semibold text-[var(--brand-slate)]">
                              {record?.organizedName}
                            </p>
                            <p className="font-mono text-[0.72rem] leading-5 text-[var(--brand-muted)]">
                              {record?.originalName}
                            </p>
                          </div>
                          <StatusBadge label={item.status} />
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <StatusBadge label={getUserCapabilityLabel(item.capability)} />
                          <span className="font-mono text-xs font-semibold text-[var(--brand-muted)]">
                            {Math.round(item.confidence * 100)}%
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[var(--brand-text)]">
                          {item.reason}
                        </p>
                      </article>
                    </Link>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <WorkbenchDetail
            key={focusedReview.id}
            focusedReview={focusedReview}
            focusedDocument={focusedDocument}
            inDraftingQueue={draftingQueue.some((item) => item.id === focusedReview.id)}
          />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Card className="brand-panel rounded-[1.75rem] border-[rgba(0,61,166,0.14)] shadow-none">
              <CardHeader>
                <CardTitle className="font-ops text-[2rem] font-semibold tracking-[-0.05em] text-[var(--brand-slate)]">
                  Drafting activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {activity.map((entry) => (
                  <div
                    key={entry}
                    className="rounded-[1.35rem] border border-[rgba(0,61,166,0.14)] bg-white px-4 py-4 font-ops text-sm leading-6 text-[var(--brand-text)]"
                  >
                    {entry}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="brand-panel rounded-[1.75rem] border-[rgba(0,61,166,0.14)] shadow-none">
              <CardHeader>
                <CardTitle className="font-ops text-[2rem] font-semibold tracking-[-0.05em] text-[var(--brand-slate)]">
                  Governance posture
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                      className="rounded-[1.35rem] border border-[rgba(0,61,166,0.14)] bg-white px-4 py-4"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="size-4 text-[var(--brand-blue)]" />
                        <p className="font-ops text-sm font-semibold text-[var(--brand-slate)]">
                          {item.title}
                        </p>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[var(--brand-text)]">
                        {item.copy}
                      </p>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
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
  const [previewRecordId, setPreviewRecordId] = useState(focusedDocument?.id ?? '')
  const previewDocument = getDocumentById(previewRecordId) ?? focusedDocument
  const isApprovalHandoff = focusedReview.capability === 'approval'

  const fieldRows = [
    ['Document manifest', getManifestStateLabel(focusedReview.documentManifestState)],
    ['Run manifest', getManifestStateLabel(focusedReview.runManifestState)],
    ['Determination method', getDeterminationMethodLabel(focusedReview.determinationMethod)],
    ['Evidence maturity', getEvidenceMaturityStageLabel(focusedReview.evidenceMaturityStage)],
  ]

  return (
    <Card className="brand-panel rounded-[1.75rem] border-[rgba(0,61,166,0.14)] shadow-none">
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle className="font-ops text-[2rem] font-semibold tracking-[-0.05em] text-[var(--brand-slate)]">
            Draft package
          </CardTitle>
          <p className="mt-2 font-ops text-sm leading-6 text-[var(--brand-text)]">
            Preview the source file first, then build the governed package through manifests, rationale, and linked evidence.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={getUserCapabilityLabel(focusedReview.capability)} />
          <StatusBadge label={getEvidenceMaturityStageLabel(focusedReview.evidenceMaturityStage)} />
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_340px]">
        <div className="space-y-6">
          {!inDraftingQueue ? (
            <div className="rounded-[1.35rem] border border-[rgba(0,61,166,0.14)] bg-[rgba(0,61,166,0.03)] px-4 py-4">
              <p className="ops-label text-[var(--brand-blue)]">Approval handoff</p>
              <p className="mt-2 text-sm leading-6 text-[var(--brand-text)]">
                This package has already left the active drafting queue. You are viewing the prepared draft that approval is evaluating so the full rationale and evidence package remain traceable.
              </p>
            </div>
          ) : null}

          <PdfPreviewPanel
            title={previewDocument?.id === focusedDocument?.id ? 'Source evidence preview' : 'Related evidence preview'}
            description={
              previewDocument?.id === focusedDocument?.id
                ? 'The source artifact stays visible while the analyst drafts meaning, rationale, and package structure.'
                : 'A linked artifact is temporarily in view so the analyst can compare relationships before returning to the selected record.'
            }
            document={previewDocument}
            maxWidth={680}
            allowReset
            tone="light"
            actions={
              previewDocument?.id !== focusedDocument?.id ? (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-[var(--brand-border)] bg-white text-[var(--brand-slate)]"
                  onClick={() => setPreviewRecordId(focusedDocument?.id ?? '')}
                >
                  Return to selected record
                </Button>
              ) : null
            }
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-[1.35rem] border border-[rgba(0,61,166,0.14)] bg-white px-4 py-4">
              <p className="ops-label text-[var(--brand-blue)]">Original filename</p>
              <p className="mt-2 text-sm font-semibold text-[var(--brand-slate)]">
                {focusedDocument?.originalName}
              </p>
            </div>
            <div className="rounded-[1.35rem] border border-[rgba(0,61,166,0.14)] bg-white px-4 py-4">
              <p className="ops-label text-[var(--brand-blue)]">Governed name</p>
              <p className="mt-2 text-sm font-semibold text-[var(--brand-slate)]">
                {focusedDocument?.organizedName}
              </p>
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-[rgba(0,61,166,0.14)] bg-white px-4 py-4">
            <p className="ops-label text-[var(--brand-blue)]">Draft rationale</p>
            <div className="mt-4 space-y-4">
              <DraftField label="Summary" value={focusedReview.rationale.summary} />
              <DraftField label="Source basis" value={focusedReview.rationale.sourceBasis} />
              <DraftField label="Reason for change" value={focusedReview.rationale.changeReason} />
            </div>
            <div className="mt-4">
              <StatusBadge label={getManifestStateLabel(focusedReview.rationale.approvalStatus)} />
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-[rgba(0,61,166,0.14)] bg-[rgba(0,61,166,0.03)] px-4 py-4">
            <p className="ops-label text-[var(--brand-blue)]">Evidence hierarchy used</p>
            <div className="mt-4 space-y-3">
              {focusedReview.evidenceHierarchy.map((entry, index) => (
                <div
                  key={entry}
                  className="rounded-[1.15rem] border border-[rgba(0,61,166,0.12)] bg-white px-4 py-4"
                >
                  <p className="font-ops text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand-blue)]">
                    Source {index + 1}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--brand-text)]">{entry}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-[rgba(0,61,166,0.14)] bg-white px-4 py-4">
            <p className="ops-label text-[var(--brand-blue)]">Related records</p>
            <div className="mt-4 space-y-3">
              {focusedDocument?.linkedRecords.length ? (
                focusedDocument.linkedRecords.map((linkedRecord) => {
                  const relatedDocument = getDocumentById(linkedRecord.recordId)

                  return (
                    <div
                      key={linkedRecord.recordId}
                      className="rounded-[1.15rem] border border-[rgba(0,61,166,0.12)] bg-[rgba(0,61,166,0.03)] px-4 py-4"
                    >
                      <div className="flex items-center gap-3">
                        <Link2 className="size-4 text-[var(--brand-blue)]" />
                        <p className="font-ops text-sm font-semibold text-[var(--brand-slate)]">
                          {getRelationshipLabel(linkedRecord.relation)}
                        </p>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-[var(--brand-slate)]">
                        {linkedRecord.label}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--brand-muted)]">
                        {linkedRecord.status}
                      </p>
                      {relatedDocument?.previewAsset ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-3 rounded-full border-[var(--brand-border)] bg-white text-[var(--brand-slate)]"
                          onClick={() => setPreviewRecordId(relatedDocument.id)}
                        >
                          Preview related file
                        </Button>
                      ) : null}
                    </div>
                  )
                })
              ) : (
                <div className="rounded-[1.15rem] border border-[rgba(0,61,166,0.12)] bg-[rgba(0,61,166,0.03)] px-4 py-4">
                  <p className="font-ops text-sm font-semibold text-[var(--brand-slate)]">
                    Expected support chain not found
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--brand-muted)]">
                    This governed package still needs one or more related records before the draft can advance to approval.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fieldRows.map(([label, value]) => (
              <div
                key={label}
                className="rounded-[1.35rem] border border-[rgba(0,61,166,0.14)] bg-white px-4 py-4"
              >
                <p className="ops-label text-[var(--brand-blue)]">{label}</p>
                <p className="mt-2 text-sm font-semibold text-[var(--brand-slate)]">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-[1.35rem] border border-[rgba(0,61,166,0.14)] bg-white px-4 py-4">
            <p className="ops-label text-[var(--brand-blue)]">Drafting notes</p>
            <div className="mt-4 space-y-3">
              {focusedReview.notes.map((note) => (
                <div
                  key={note}
                  className="rounded-[1.15rem] border border-[rgba(0,61,166,0.12)] bg-[rgba(0,61,166,0.03)] px-4 py-4 text-sm leading-6 text-[var(--brand-text)]"
                >
                  {note}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.5rem] border border-[rgba(0,61,166,0.14)] bg-white px-4 py-4">
            <p className="ops-label text-[var(--brand-blue)]">Drafting checklist</p>
            <div className="mt-4 space-y-3">
              {focusedReview.governanceChecks.map((check) => (
                <div key={check.id} className="flex items-start gap-3">
                  {check.result === 'pass' ? (
                    <CheckCircle2 className="mt-0.5 size-4 text-[var(--brand-blue)]" />
                  ) : (
                    <CircleAlert className="mt-0.5 size-4 text-[#c2410c]" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-[var(--brand-slate)]">
                      {check.label}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[var(--brand-muted)]">
                      {check.note}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[rgba(0,61,166,0.14)] bg-[rgba(0,61,166,0.03)] px-4 py-4">
            <p className="ops-label text-[var(--brand-blue)]">Draft package status</p>
            <div className="mt-4 space-y-3">
              <ReadinessCard
                icon={ScrollText}
                title="Document manifest"
                copy={getManifestStateLabel(focusedReview.documentManifestState)}
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

          <div className="rounded-[1.5rem] border border-[rgba(0,61,166,0.14)] bg-white px-4 py-4">
            <p className="ops-label text-[var(--brand-blue)]">Actions</p>
            <div className="mt-4 grid gap-3">
              <Button className="rounded-full bg-[var(--brand-blue)] text-white hover:bg-[color-mix(in_oklab,var(--brand-blue)_86%,black_14%)]">
                {isApprovalHandoff ? 'Update draft rationale' : 'Save draft rationale'}
              </Button>
              {isApprovalHandoff ? (
                <Button
                  asChild
                  variant="outline"
                  className="rounded-full border-[var(--brand-border)] bg-white text-[var(--brand-slate)]"
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
                  className="rounded-full border-[var(--brand-border)] bg-white text-[var(--brand-slate)]"
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
                  'rounded-full border-[var(--brand-border)] bg-white text-[var(--brand-slate)] no-underline'
                )}
              >
                Open in Egnyte
                <ArrowUpRight className="size-4" />
              </a>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function DraftField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="ops-label text-[var(--brand-blue)]">{label}</p>
      <p className="text-sm leading-6 text-[var(--brand-text)]">{value}</p>
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
    <div className="rounded-[1.15rem] border border-[rgba(0,61,166,0.14)] bg-white px-4 py-4">
      <div className="flex items-center gap-3">
        <Icon className="size-4 text-[var(--brand-blue)]" />
        <p className="font-ops text-sm font-semibold text-[var(--brand-slate)]">
          {title}
        </p>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--brand-text)]">{copy}</p>
    </div>
  )
}
