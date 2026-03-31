import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowUpRight,
  History,
  Link2,
  Search,
  Shield,
  Siren,
} from 'lucide-react'
import { MockupShell } from '#/components/mockup-shell'
import { PdfPreviewPanel } from '#/components/pdf-preview-panel'
import { ScrollArea } from '#/components/ui/scroll-area'
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
  getCustodyStateLabel,
  getDistrict,
  getDocumentById,
  getExceptionFlagLabel,
  getManifestStateLabel,
  getReviewItemById,
  getReviewItemsByDistrict,
  getUserCapabilityLabel,
} from '#/lib/mock-data'
import { cn } from '#/lib/utils'

const districtId = 'sterling-cab'
const queue = getReviewItemsByDistrict(districtId).filter(
  (item) => item.capability === 'approval',
)
const defaultReviewId =
  queue.find((item) => item.id === 'review-sunflower-duplicate')?.id ??
  queue[0]?.id

export const Route = createFileRoute('/review-console')({
  validateSearch: (search: Record<string, unknown>) => ({
    reviewId: typeof search.reviewId === 'string' ? search.reviewId : undefined,
  }),
  head: () => ({
    meta: [{ title: 'Approval Console | Schedio Group' }],
  }),
  component: ReviewConsolePage,
})

function ReviewConsolePage() {
  const { reviewId } = Route.useSearch()
  const requestedReview = getReviewItemById(reviewId ?? defaultReviewId)
  const activeReview =
    queue.find((item) => item.id === requestedReview?.id) ?? queue[0]
  const activeDocument = getDocumentById(activeReview.recordId)
  const activeDistrict = getDistrict(activeReview.districtId)
  const approvalCount = queue.length
  const lockedCount = queue.filter(
    (item) => item.targetCustodyState === 'locked',
  ).length
  const supersededCount = queue.filter(
    (item) => item.adjustmentHistory.length > 0,
  ).length
  const blockedCount = queue.filter(
    (item) => item.publishReadiness === 'Blocked',
  ).length

  const metrics = [
    {
      label: 'Approval candidates',
      value: String(approvalCount),
      note: 'These packages have crossed out of drafting and are now waiting on governed approval authority.',
    },
    {
      label: 'Locked transitions',
      value: String(lockedCount),
      note: 'A locked record is not just reviewed. Its authority state has changed and the audit posture is final.',
    },
    {
      label: 'Superseded history',
      value: String(supersededCount),
      note: 'Approval must keep prior decisions visible whenever a record is superseded or adjusted.',
    },
    {
      label: 'Blocked by governance',
      value: String(blockedCount),
      note: 'These items still need an explicit decision before they can move into relied or locked custody.',
    },
  ]

  const approvalBuckets = [
    {
      label: 'Duplicate disposition',
      count: queue.filter((item) => item.reasonCode === 'Duplicate file')
        .length,
    },
    {
      label: 'Missing support',
      count: queue.filter((item) => item.reasonCode === 'Missing payment proof')
        .length,
    },
    {
      label: 'Placeholder source',
      count: queue.filter((item) => item.reasonCode === 'Placeholder source')
        .length,
    },
    {
      label: 'Ready for authority',
      count: queue.filter((item) => item.reasonCode === 'Governance clear')
        .length,
    },
  ].filter((bucket) => bucket.count > 0)

  const authorityState = [
    {
      label: 'Engineer sign-off required',
      value: `${approvalCount} packages`,
      note: 'Drafting may prepare the package, but only approval changes authority state.',
    },
    {
      label: 'Current custody',
      value: activeDocument
        ? getCustodyStateLabel(activeDocument.custodyState)
        : 'Unknown',
      note: 'The approval screen makes custody state explicit before any transition is approved.',
    },
    {
      label: 'Target state',
      value: getCustodyStateLabel(activeReview.targetCustodyState),
      note: 'Approval is deciding whether the package can become relied or locked without breaking audit discipline.',
    },
  ]

  return (
    <MockupShell
      tone="operations"
      meta={`${activeDistrict.name} • governance and approval`}
      title="Approval console"
      description="Verify governed drafting packages, confirm capability separation, and approve the authority transition that moves a record into relied or locked state."
      actions={
        <>
          <Button className="rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary-hover">
            Approve to {getCustodyStateLabel(activeReview.targetCustodyState)}
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
            Open source in Egnyte
            <ArrowUpRight className="size-4" />
          </a>
        </>
      }
      aside={
        <div className="space-y-4">
          <div className="rounded-2xl border border-border-strong bg-surface-panel px-4 py-4">
            <p className="ops-label text-text-accent">Authority layer</p>
            <div className="mt-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-[0.72rem] font-semibold text-text-accent">
                <Shield className="size-3.5" />
                Engineer approval required
              </div>
            </div>
            <p className="mt-3 text-sm text-text-muted">
              Approval happens here. The analyst drafts meaning and rationale,
              but authority state only changes after approval.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-xl border border-border-strong bg-surface-muted px-3 py-3">
              <p className="ops-label text-text-accent">Current custody</p>
              <p className="mt-2 font-ops text-sm font-medium text-text-strong">
                {activeDocument
                  ? getCustodyStateLabel(activeDocument.custodyState)
                  : 'Unknown'}
              </p>
            </div>
            <div className="rounded-xl border border-border-strong bg-surface-muted px-3 py-3">
              <p className="ops-label text-text-accent">Proposed state</p>
              <p className="mt-2 font-ops text-sm font-medium text-text-strong">
                {getCustodyStateLabel(activeReview.targetCustodyState)}
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
        <div className="w-full xl:w-[380px] shrink-0 flex flex-col border-b xl:border-b-0 xl:border-r border-border-base bg-surface-muted/30">
          <div className="px-4 py-3 border-b border-border-base flex flex-col gap-3">
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
                defaultValue=""
                placeholder="Search approval queue"
                className="h-10 w-full rounded-full border-border-base bg-surface-panel pl-9 text-sm"
              />
            </div>
            <Select defaultValue={activeDistrict.id}>
              <SelectTrigger className="h-10 w-full rounded-full border-border-base bg-surface-panel text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={activeDistrict.id}>
                  {activeDistrict.name}
                </SelectItem>
                <SelectItem value="sterling-md">
                  Sterling Ranch Metro District
                </SelectItem>
                <SelectItem value="ridgeview">Sterling Ranch MD4</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col divide-y divide-border-base">
              {queue.map((item) => {
                const record = getDocumentById(item.recordId)
                const isFocused = item.id === activeReview.id

                return (
                  <Link
                    key={item.id}
                    to="/review-console"
                    search={{ reviewId: item.id }}
                    resetScroll={false}
                    className={cn(
                      'block no-underline px-4 py-4 transition-colors',
                      isFocused ? 'bg-surface-hover relative before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary' : 'hover:bg-surface-subtle'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className={cn("font-ops text-sm font-semibold", isFocused ? "text-primary" : "text-text-strong")}>
                          {record?.organizedName}
                        </p>
                        <p className="font-mono text-[0.7rem] text-text-muted">
                          {item.reasonCode}
                        </p>
                      </div>
                      <StatusBadge label={getCustodyStateLabel(item.targetCustodyState)} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StatusBadge label={getUserCapabilityLabel(item.capability)} />
                      <span className="font-mono text-[0.7rem] font-semibold text-text-muted">
                        {Math.round(item.confidence * 100)}%
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        {/* Center Pane: Active Item Detail */}
        <div className="flex-1 min-w-0 flex flex-col border-b xl:border-b-0 xl:border-r border-border-base bg-surface-panel">
          <div className="px-4 py-3 border-b border-border-base flex items-center justify-between">
            <h2 className="font-ops text-sm font-semibold text-text-strong">
              Selected approval
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button className="h-8 rounded-full bg-primary px-4 text-xs text-primary-foreground hover:bg-primary-hover">
                Approve to{' '}
                {getCustodyStateLabel(activeReview.targetCustodyState)}
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="p-5 xl:p-6 flex flex-col gap-8">
              {/* Top Section of Center Pane (The PDF and Tabs) */}
              <div className="space-y-8 flex flex-col min-w-0">
                <Dialog>
                  <PdfPreviewPanel
                    title="Source evidence spot-check"
                    description="Click to open the preserved source for verification after the governance decision has been framed."
                    document={activeDocument}
                    compact
                    maxWidth={420}
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
                    <DialogHeader className="px-6 py-4 border-b border-border-base bg-surface-panel shrink-0">
                      <DialogTitle className="font-ops text-lg text-text-strong">Source Evidence Verification</DialogTitle>
                      <DialogDescription className="text-text-muted">
                        Reviewing {activeDocument?.originalName} for the governance transition.
                      </DialogDescription>
                    </DialogHeader>
                  <div className="flex-1 min-h-0 bg-surface-muted overflow-y-auto p-6">
                    <PdfPreviewPanel
                      title="Source evidence spot-check"
                      description="Verify the original artifact before confirming the final capability and state change."
                      document={activeDocument}
                      maxWidth={3000}
                      tone="light"
                    />
                  </div>
                  </DialogContent>
                </Dialog>

                <div>
                  <Tabs defaultValue="rationale" className="w-full">
                    <TabsList className="mb-5 grid h-auto w-full grid-cols-3 rounded-full bg-surface-hover p-1">
                      <TabsTrigger
                        value="rationale"
                        className="rounded-full text-xs"
                      >
                        Draft rationale
                      </TabsTrigger>
                      <TabsTrigger
                        value="checks"
                        className="rounded-full text-xs"
                      >
                        Governance checks
                      </TabsTrigger>
                      <TabsTrigger
                        value="history"
                        className="rounded-full text-xs"
                      >
                        Adjustment history
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="rationale" className="space-y-6">
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
                        <StatusBadge
                          label={getManifestStateLabel(
                            activeReview.rationale.approvalStatus,
                          )}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-4">
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
                    </TabsContent>
                    <TabsContent value="checks" className="space-y-4">
                      {activeReview.governanceChecks.map((check) => (
                        <div
                          key={check.id}
                          className="space-y-2 pb-4 border-b border-border-base last:border-0 last:pb-0"
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
                    </TabsContent>
                    <TabsContent value="history" className="space-y-4">
                      {activeReview.adjustmentHistory.length > 0 ? (
                        activeReview.adjustmentHistory.map((adjustment) => (
                          <div
                            key={adjustment.id}
                            className="space-y-2 pb-4 border-b border-border-base last:border-0 last:pb-0"
                          >
                            <div className="flex items-center gap-2">
                              <History className="size-4 text-text-accent" />
                              <p className="font-ops text-sm font-semibold text-text-strong">
                                {adjustment.priorState} → {adjustment.newState}
                              </p>
                            </div>
                            <p className="text-sm leading-6 text-text-base">
                              {adjustment.reason}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2">
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
                        <div className="space-y-2">
                          <p className="font-ops text-sm font-semibold text-text-strong">
                            No prior adjustments recorded
                          </p>
                          <p className="text-sm leading-6 text-text-muted">
                            This package is being approved without any
                            superseded or adjustment history yet.
                          </p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </div>

              {/* Bottom Section of Center Pane (Stats, Reason, Flags) */}
              <div className="space-y-8 pt-6 border-t border-border-base">
                <div>
                  <p className="ops-label text-text-accent mb-4">Reason code</p>
                  <p className="text-sm font-semibold text-text-strong">
                    {activeReview.reasonCode}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-text-base">
                    {activeReview.reason}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <DetailField
                    label="Current custody"
                    value={
                      activeDocument
                        ? getCustodyStateLabel(activeDocument.custodyState)
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
                    value={getUserCapabilityLabel(activeReview.capability)}
                  />
                </div>

                <div>
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
                </div>

                <div>
                  <p className="ops-label text-text-accent mb-4">Actions</p>
                  <div className="grid gap-3">
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
              </div>
            </div>
          </div>
        </div>

        {/* Right Pane: Context */}
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
                  Authority posture
                </p>
                <div className="space-y-4">
                  {authorityState.map((item) => (
                    <div
                      key={item.label}
                      className="pb-4 border-b border-border-base last:border-b-0 last:pb-0"
                    >
                      <p className="ops-label text-text-muted">{item.label}</p>
                      <p className="mt-2 text-sm font-semibold text-text-strong">
                        {item.value}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-text-base">
                        {item.note}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="ops-label text-text-accent mb-4">
                  Approval buckets
                </p>
                <div className="space-y-4">
                  {approvalBuckets.map((bucket) => (
                    <div
                      key={bucket.label}
                      className="pb-4 border-b border-border-base last:border-b-0 last:pb-0"
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
          </div>
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
