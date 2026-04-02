import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowUpRight, History, Link2, Search, Siren } from 'lucide-react'
import { MockupShell } from '#/components/mockup-shell'
import { PdfPreviewPanel } from '#/components/pdf-preview-panel'
import { StatusBadge } from '#/components/status-badge'
import { WorkflowStageStrip } from '#/components/workflow-stage-strip'
import { Button, buttonVariants } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import {
  districts,
  getCustodyStateLabel,
  getDistrict,
  getDocumentById,
  getExceptionFlagLabel,
  getManifestStateLabel,
  getReviewItemById,
  getUserCapabilityLabel,
  reviewItems,
} from '#/lib/mock-data'
import { cn } from '#/lib/utils'

const queue = reviewItems.filter((item) => item.capability === 'approval')
const defaultReviewId =
  queue.find((item) => item.id === 'review-sunflower-duplicate')?.id ??
  queue[0]?.id

export const Route = createFileRoute('/review-console')({
  validateSearch: (search: Record<string, unknown>) => ({
    reviewId: typeof search.reviewId === 'string' ? search.reviewId : undefined,
    q: typeof search.q === 'string' ? search.q : undefined,
    districtId:
      typeof search.districtId === 'string' ? search.districtId : undefined,
  }),
  head: () => ({
    meta: [{ title: 'Approval Console | Schedio Group' }],
  }),
  component: ReviewConsolePage,
})

function ReviewConsolePage() {
  const { reviewId, q, districtId } = Route.useSearch()
  const navigate = useNavigate()

  const filteredQueue = queue.filter((item) => {
    if (districtId && item.districtId !== districtId) return false
    if (q) {
      const term = q.toLowerCase()
      const record = getDocumentById(item.recordId)
      const haystack = [
        record?.organizedName,
        record?.originalName,
        item.reasonCode,
        item.reason,
        getDistrict(item.districtId).name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(term)) return false
    }
    return true
  })

  const requestedReview = getReviewItemById(reviewId ?? defaultReviewId)
  const activeReview =
    filteredQueue.find((item) => item.id === requestedReview?.id) ??
    filteredQueue.at(0)
  const activeDocument = activeReview
    ? getDocumentById(activeReview.recordId)
    : undefined
  const activeDistrict = activeReview
    ? getDistrict(activeReview.districtId)
    : undefined
  const approvalCount = filteredQueue.length
  const lockedCount = filteredQueue.filter(
    (item) => item.targetCustodyState === 'locked',
  ).length
  const supersededCount = filteredQueue.filter(
    (item) => item.adjustmentHistory.length > 0,
  ).length
  const blockedCount = filteredQueue.filter(
    (item) => item.publishReadiness === 'Blocked',
  ).length

  const metrics = [
    {
      label: 'Approval candidates',
      value: String(approvalCount),
      helper: 'Waiting on engineer sign-off',
    },
    {
      label: 'Locked transitions',
      value: String(lockedCount),
      helper: 'Authority state finalized',
    },
    {
      label: 'Superseded history',
      value: String(supersededCount),
      helper: 'Prior decisions on file',
    },
    {
      label: 'Blocked by governance',
      value: String(blockedCount),
      helper: 'Needs explicit decision',
    },
  ]

  const approvalBuckets = [
    {
      label: 'Duplicate disposition',
      count: filteredQueue.filter(
        (item) => item.reasonCode === 'Duplicate file',
      ).length,
    },
    {
      label: 'Missing support',
      count: filteredQueue.filter(
        (item) => item.reasonCode === 'Missing payment proof',
      ).length,
    },
    {
      label: 'Placeholder source',
      count: filteredQueue.filter(
        (item) => item.reasonCode === 'Placeholder source',
      ).length,
    },
    {
      label: 'Ready for authority',
      count: filteredQueue.filter(
        (item) => item.reasonCode === 'Governance clear',
      ).length,
    },
  ].filter((bucket) => bucket.count > 0)

  const authorityState = activeReview
    ? [
        {
          label: 'Engineer sign-off required',
          value: `${approvalCount} packages`,
        },
      ]
    : []

  return (
    <MockupShell
      tone="review"
      meta={`${activeDistrict?.name ?? 'All districts'} • approval capability`}
      title="Approval console"
    >
      <WorkflowStageStrip stage="approval" />

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

      <div className="grid min-h-[760px] grid-cols-1 overflow-hidden rounded-2xl border border-border-strong bg-surface-panel shadow-sm xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="flex flex-col border-b border-border-base bg-surface-muted/30 xl:border-r xl:border-b-0">
          <div className="flex flex-col gap-3 border-b border-border-base px-4 py-3">
            <div className="flex items-center justify-between">
              <h2 className="font-ops text-sm font-semibold text-text-strong">
                Approval queue
              </h2>
              <span className="text-xs font-medium text-text-muted">
                {approvalCount} items
              </span>
            </div>
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
              <Input
                defaultValue={q ?? ''}
                placeholder="Search approval queue"
                className="h-10 w-full rounded-full border-border-base bg-surface-panel pl-9 text-sm"
                onChange={(event) => {
                  const value = event.currentTarget.value
                  void navigate({
                    to: '/review-console',
                    search: {
                      reviewId,
                      districtId,
                      q: value || undefined,
                    },
                    replace: true,
                    resetScroll: false,
                  })
                }}
              />
            </div>
            <Select
              value={districtId ?? 'all'}
              onValueChange={(value) => {
                void navigate({
                  to: '/review-console',
                  search: {
                    reviewId,
                    q,
                    districtId: value === 'all' ? undefined : value,
                  },
                  resetScroll: false,
                })
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-full border-border-base bg-surface-panel text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All districts</SelectItem>
                {districts.map((district) => (
                  <SelectItem key={district.id} value={district.id}>
                    {district.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredQueue.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                <Search className="mb-3 size-5 text-text-muted" />
                <p className="text-sm font-semibold text-text-strong">
                  No matching items
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Try adjusting your search or district filter.
                </p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border-base">
                {filteredQueue.map((item) => {
                  const record = getDocumentById(item.recordId)
                  const itemDistrict = getDistrict(item.districtId)
                  const isFocused = item.id === activeReview?.id

                  return (
                    <Link
                      key={item.id}
                      to="/review-console"
                      search={{ reviewId: item.id, q, districtId }}
                      resetScroll={false}
                      className={cn(
                        'block px-4 py-4 no-underline transition-colors',
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
                          <p className="font-mono text-[0.7rem] text-text-muted">
                            {itemDistrict.name} • {item.reasonCode}
                          </p>
                        </div>
                        <StatusBadge
                          label={getCustodyStateLabel(item.targetCustodyState)}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <StatusBadge
                          label={getUserCapabilityLabel(item.capability)}
                        />
                        <span className="font-mono text-[0.7rem] font-semibold text-text-muted">
                          {Math.round(item.confidence * 100)}%
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 bg-surface-panel">
          {activeReview ? (
            <>
              <div className="flex items-center justify-between border-b border-border-base px-4 py-3">
                <h2 className="font-ops text-sm font-semibold text-text-strong">
                  Approval decision
                </h2>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge
                    label={getUserCapabilityLabel(activeReview.capability)}
                  />
                  <StatusBadge
                    label={getCustodyStateLabel(
                      activeReview.targetCustodyState,
                    )}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="flex flex-col gap-6 p-4 xl:p-5">
                  <div className="grid gap-6 2xl:grid-cols-[minmax(320px,0.42fr)_minmax(0,1fr)]">
                    <div className="workflow-panel-approval space-y-4 rounded-3xl border px-4 py-4">
                      <div>
                        <p className="ops-label text-text-accent">
                          Authority posture
                        </p>
                        <p className="mt-2 text-lg font-semibold text-text-strong">
                          {activeReview.reasonCode}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-text-base">
                          {activeReview.reason}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        {authorityState.map((item) => (
                          <div key={item.label} className="space-y-1">
                            <p className="ops-label text-text-accent">
                              {item.label}
                            </p>
                            <p className="text-sm font-semibold text-text-strong">
                              {item.value}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <StatusBadge
                          label={getManifestStateLabel(
                            activeReview.rationale.approvalStatus,
                          )}
                        />
                        <span className="rounded-full border border-border-base bg-surface-panel px-3 py-1 text-[0.72rem] font-semibold text-text-strong">
                          {Math.round(activeReview.confidence * 100)}%
                          confidence
                        </span>
                      </div>
                    </div>

                    <PdfPreviewPanel
                      title="Source record"
                      description="Original file for this approval."
                      document={activeDocument}
                      compact
                      maxWidth={860}
                      tone="light"
                    />
                  </div>

                  <Tabs defaultValue="authority" className="w-full">
                    <TabsList className="workflow-tabs-approval grid h-auto w-full grid-cols-2 rounded-full p-1 lg:grid-cols-4">
                      <TabsTrigger
                        value="rationale"
                        className="rounded-full text-xs"
                      >
                        Rationale
                      </TabsTrigger>
                      <TabsTrigger
                        value="checks"
                        className="rounded-full text-xs"
                      >
                        Checks
                      </TabsTrigger>
                      <TabsTrigger
                        value="history"
                        className="rounded-full text-xs"
                      >
                        History
                      </TabsTrigger>
                      <TabsTrigger
                        value="authority"
                        className="rounded-full text-xs"
                      >
                        Authority
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="rationale" className="pt-5">
                      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="rounded-3xl border border-border-strong bg-surface-panel px-4 py-4">
                          <div className="space-y-4">
                            <DetailField
                              label="Summary"
                              value={activeReview.rationale.summary}
                            />
                            <DetailField
                              label="Source basis"
                              value={activeReview.rationale.sourceBasis}
                            />
                            <DetailField
                              label="Reason for change"
                              value={activeReview.rationale.changeReason}
                            />
                          </div>
                        </div>

                        <div className="workflow-panel-approval rounded-3xl border px-4 py-4">
                          <div className="mb-4 flex items-center gap-2">
                            <Link2 className="size-4 text-text-accent" />
                            <p className="font-ops text-sm font-semibold text-text-strong">
                              Evidence hierarchy used
                            </p>
                          </div>
                          <div className="space-y-3">
                            {activeReview.evidenceHierarchy.map(
                              (entry, index) => (
                                <div key={entry} className="space-y-1">
                                  <p className="font-ops text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                                    Source {index + 1}
                                  </p>
                                  <p className="text-sm leading-6 text-text-strong">
                                    {entry}
                                  </p>
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="checks" className="pt-5">
                      <div className="workflow-panel-approval rounded-3xl border px-4 py-4">
                        <div className="space-y-4">
                          {activeReview.governanceChecks.map((check) => (
                            <div
                              key={check.id}
                              className="space-y-2 border-b border-border-base pb-4 last:border-0 last:pb-0"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-ops text-sm font-semibold text-text-strong">
                                  {check.label}
                                </p>
                                <StatusBadge
                                  label={
                                    check.result === 'pass'
                                      ? 'Approved'
                                      : check.result === 'warning'
                                        ? 'Needs review'
                                        : 'Blocked'
                                  }
                                />
                              </div>
                              <p className="text-sm leading-6 text-text-muted">
                                {check.note}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="history" className="pt-5">
                      <div className="rounded-3xl border border-border-strong bg-surface-panel px-4 py-4">
                        <div className="space-y-4">
                          {activeReview.adjustmentHistory.length > 0 ? (
                            activeReview.adjustmentHistory.map((adjustment) => (
                              <div
                                key={adjustment.id}
                                className="space-y-2 border-b border-border-base pb-4 last:border-0 last:pb-0"
                              >
                                <div className="flex items-center gap-2">
                                  <History className="size-4 text-text-accent" />
                                  <p className="font-ops text-sm font-semibold text-text-strong">
                                    {adjustment.priorState} →{' '}
                                    {adjustment.newState}
                                  </p>
                                </div>
                                <p className="text-sm leading-6 text-text-base">
                                  {adjustment.reason}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {adjustment.affectedOutputs.map((output) => (
                                    <span
                                      key={output}
                                      className="rounded-full bg-surface-hover px-3 py-1 text-xs font-semibold text-text-accent"
                                    >
                                      {output}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="font-ops text-sm font-semibold text-text-strong">
                              No prior adjustments recorded
                            </p>
                          )}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="authority" className="pt-5">
                      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="workflow-panel-approval rounded-3xl border px-4 py-4">
                          <p className="ops-label text-text-accent mb-4">
                            Exception flags
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {activeReview.exceptionFlags.length > 0 ? (
                              activeReview.exceptionFlags.map((flag) => (
                                <span
                                  key={flag}
                                  className="rounded-full bg-status-error-bg px-3 py-1 text-xs font-semibold text-status-error-text"
                                >
                                  {getExceptionFlagLabel(flag)}
                                </span>
                              ))
                            ) : (
                              <span className="rounded-full bg-status-success-bg px-3 py-1 text-xs font-semibold text-status-success-text">
                                No active exception flags
                              </span>
                            )}
                          </div>

                          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            <DetailField
                              label="Current custody"
                              value={
                                activeDocument
                                  ? getCustodyStateLabel(
                                      activeDocument.custodyState,
                                    )
                                  : 'Unknown'
                              }
                            />
                            <DetailField
                              label="Target state"
                              value={getCustodyStateLabel(
                                activeReview.targetCustodyState,
                              )}
                            />
                            <DetailField
                              label="Capability"
                              value={getUserCapabilityLabel(
                                activeReview.capability,
                              )}
                            />
                          </div>
                        </div>

                        <div className="workflow-panel-approval rounded-3xl border px-4 py-4">
                          <p className="ops-label text-text-accent mb-4">
                            Approval buckets
                          </p>
                          <div className="space-y-4">
                            {approvalBuckets.map((bucket) => (
                              <div
                                key={bucket.label}
                                className="border-b border-border-base pb-4 last:border-b-0 last:pb-0"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <Siren className="size-4 text-text-accent" />
                                    <p className="font-ops text-sm font-semibold text-text-strong">
                                      {bucket.label}
                                    </p>
                                  </div>
                                  <span className="font-mono text-xs font-semibold text-text-accent">
                                    {bucket.count}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>

              <div className="workflow-action-bar-approval border-t px-4 py-4 xl:px-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Button className="rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary-hover">
                    Approve to{' '}
                    {getCustodyStateLabel(activeReview.targetCustodyState)}
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="rounded-full border-border-base bg-surface-panel text-text-strong"
                  >
                    <Link
                      to="/review-workbench"
                      search={{ reviewId: activeReview.id }}
                      resetScroll={false}
                    >
                      Open drafting workspace
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-full border-border-base bg-surface-panel text-text-strong"
                  >
                    Request drafting revision
                  </Button>
                  <a
                    href={activeDocument?.igniteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      buttonVariants({ variant: 'outline' }),
                      'rounded-full border-border-base bg-surface-panel text-text-strong no-underline',
                    )}
                  >
                    Open source in Egnyte <ArrowUpRight className="size-4" />
                  </a>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <Search className="mb-4 size-6 text-text-muted" />
              <p className="text-sm font-semibold text-text-strong">
                No item selected
              </p>
              <p className="mt-1 max-w-xs text-xs leading-5 text-text-muted">
                Adjust the search or district filter to find approval items,
                then select one from the queue.
              </p>
            </div>
          )}
        </div>
      </div>
    </MockupShell>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="font-ops text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
        {label}
      </p>
      <p className="text-sm leading-6 text-text-strong">{value}</p>
    </div>
  )
}
