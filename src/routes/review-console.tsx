import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowUpRight,
  History,
  Link2,
  Search,
  Shield,
  ShieldCheck,
  Siren,
} from 'lucide-react'
import { MetricCard } from '#/components/metric-card'
import { MockupShell } from '#/components/mockup-shell'
import { PdfPreviewPanel } from '#/components/pdf-preview-panel'
import { ReviewPanel } from '#/components/review-panel'
import { StatusBadge } from '#/components/status-badge'
import { Button, buttonVariants } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Separator } from '#/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import {
  getCustodyStateLabel,
  getDistrict,
  getDocumentById,
  getDocumentClassLabel,
  getExceptionFlagLabel,
  getManifestStateLabel,
  getReviewItemById,
  getReviewItemsByDistrict,
  getUserCapabilityLabel,
} from '#/lib/mock-data'
import { cn } from '#/lib/utils'

const districtId = 'sterling-cab'
const queue = getReviewItemsByDistrict(districtId).filter(
  (item) => item.capability === 'approval'
)
const defaultReviewId =
  queue.find((item) => item.id === 'review-sunflower-duplicate')?.id ?? queue[0]?.id

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
  const activeReview = queue.find((item) => item.id === requestedReview?.id) ?? queue[0]
  const activeDocument = getDocumentById(activeReview.recordId)
  const activeDistrict = getDistrict(activeReview.districtId)
  const approvalCount = queue.length
  const lockedCount = queue.filter((item) => item.targetCustodyState === 'locked').length
  const supersededCount = queue.filter((item) => item.adjustmentHistory.length > 0).length
  const blockedCount = queue.filter((item) => item.publishReadiness === 'Blocked').length

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
    { label: 'Duplicate disposition', count: queue.filter((item) => item.reasonCode === 'Duplicate file').length },
    { label: 'Missing support', count: queue.filter((item) => item.reasonCode === 'Missing payment proof').length },
    { label: 'Placeholder source', count: queue.filter((item) => item.reasonCode === 'Placeholder source').length },
    { label: 'Ready for authority', count: queue.filter((item) => item.reasonCode === 'Governance clear').length },
  ].filter((bucket) => bucket.count > 0)

  const authorityState = [
    {
      label: 'Engineer sign-off required',
      value: `${approvalCount} packages`,
      note: 'Drafting may prepare the package, but only approval changes authority state.',
    },
    {
      label: 'Current custody',
      value: activeDocument ? getCustodyStateLabel(activeDocument.custodyState) : 'Unknown',
      note: 'The approval screen makes custody state explicit before any transition is approved.',
    },
    {
      label: 'Target state',
      value: getCustodyStateLabel(activeReview.targetCustodyState),
      note: 'Approval is deciding whether the package can become relied or locked without breaking audit discipline.',
    },
  ]

  const metadataFields = [
    ['Current custody', activeDocument ? getCustodyStateLabel(activeDocument.custodyState) : 'Unknown'],
    ['Target custody', getCustodyStateLabel(activeReview.targetCustodyState)],
    ['Document manifest', getManifestStateLabel(activeReview.documentManifestState)],
    ['Run manifest', getManifestStateLabel(activeReview.runManifestState)],
    ['Capability', getUserCapabilityLabel(activeReview.capability)],
  ]

  return (
    <MockupShell
      tone="review"
      meta={`${activeDistrict.name} • governance and approval`}
      title="Approval console"
      description="Verify governed drafting packages, confirm capability separation, and approve the authority transition that moves a record into relied or locked state."
      actions={
        <>
          <Button className="rounded-full bg-white text-[var(--brand-slate)] hover:bg-white/90">
            Approve to {getCustodyStateLabel(activeReview.targetCustodyState)}
          </Button>
          <a
            href={activeDocument?.igniteUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'rounded-full border-white/18 bg-white/8 text-white no-underline hover:bg-white/12'
            )}
          >
            Open source in Egnyte
            <ArrowUpRight className="size-4" />
          </a>
        </>
      }
      aside={
        <div className="space-y-4">
          <div>
            <p className="eyebrow text-white/70">Authority layer</p>
            <h2 className="mt-3 font-heading text-2xl font-bold text-white">
              Approval queue
            </h2>
            <p className="mt-1 text-sm text-white/64">{activeDistrict.name}</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-[0.12em] uppercase text-white">
            <Shield className="size-3.5" />
            Engineer approval required
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl border border-white/12 bg-white/6 px-4 py-4">
              <p className="text-xs font-semibold tracking-[0.14em] uppercase text-white/62">
                Current custody
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                {activeDocument ? getCustodyStateLabel(activeDocument.custodyState) : 'Unknown'}
              </p>
            </div>
            <div className="rounded-2xl border border-white/12 bg-white/6 px-4 py-4">
              <p className="text-xs font-semibold tracking-[0.14em] uppercase text-white/62">
                Proposed state
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                {getCustodyStateLabel(activeReview.targetCustodyState)}
              </p>
            </div>
          </div>
        </div>
      }
    >
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} tone="review" {...metric} />
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
        <ReviewPanel
          title="Approval queue"
          description="Each row is a governed package, not just a file: capability, custody state, target state, and confidence stay visible in one queue."
          actions={
            <>
              <div className="relative w-full sm:min-w-[220px] sm:flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--brand-muted)]" />
                <Input
                  defaultValue=""
                  placeholder="Search approval queue"
                  className="h-11 w-full rounded-full border-[var(--brand-border)] bg-white pl-9"
                />
              </div>
              <Select defaultValue={activeDistrict.id}>
                <SelectTrigger className="h-11 w-full rounded-full border-[var(--brand-border)] bg-white sm:min-w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={activeDistrict.id}>{activeDistrict.name}</SelectItem>
                  <SelectItem value="sterling-md">Sterling Ranch Metro District</SelectItem>
                  <SelectItem value="ridgeview">Sterling Ranch MD4</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
        >
          <div className="data-table-frame overflow-x-auto overflow-y-hidden rounded-[1.5rem] border border-[var(--brand-border)]">
            <Table className="data-table-min font-ops">
              <TableHeader>
                <TableRow className="bg-[rgba(0,61,166,0.04)]">
                  <TableHead>Package</TableHead>
                  <TableHead>Capability</TableHead>
                  <TableHead>Current custody</TableHead>
                  <TableHead>Target state</TableHead>
                  <TableHead>Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.map((item) => {
                  const record = getDocumentById(item.recordId)

                  return (
                    <TableRow
                      key={item.id}
                      className={cn(
                        item.id === activeReview.id && 'bg-[rgba(0,61,166,0.04)]'
                      )}
                    >
                      <TableCell>
                        <Link
                          to="/review-console"
                          search={{ reviewId: item.id }}
                          resetScroll={false}
                          className="block no-underline"
                        >
                          <p className="font-semibold text-[var(--brand-slate)]">
                            {record?.organizedName}
                          </p>
                          <p className="text-xs text-[var(--brand-muted)]">
                            {item.reasonCode}
                          </p>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge label={getUserCapabilityLabel(item.capability)} />
                      </TableCell>
                      <TableCell className="text-[var(--brand-text)]">
                        {record ? getCustodyStateLabel(record.custodyState) : 'Unknown'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge label={getCustodyStateLabel(item.targetCustodyState)} />
                      </TableCell>
                      <TableCell>{Math.round(item.confidence * 100)}%</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </ReviewPanel>

        <div className="grid gap-6">
          <ReviewPanel
            tone="dark"
            title="Approval buckets"
            description="The governance queue groups packages by the approval decision they still need."
            contentClassName="space-y-4"
          >
            {approvalBuckets.map((bucket) => (
              <div
                key={bucket.label}
                className="rounded-2xl border border-white/12 bg-white/8 px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Siren className="size-4 text-white" />
                    <p className="text-sm font-semibold text-white">{bucket.label}</p>
                  </div>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                    {bucket.count}
                  </span>
                </div>
              </div>
            ))}
          </ReviewPanel>

          <ReviewPanel
            title="Authority posture"
            description="Approval sees the exact custody transition and governance posture before sign-off."
            contentClassName="grid gap-3"
          >
            {authorityState.map((item) => (
              <div
                key={item.label}
                className="rounded-[1.5rem] border border-[rgba(0,61,166,0.12)] bg-[rgba(0,61,166,0.04)] px-4 py-4"
              >
                <p className="text-xs font-semibold tracking-[0.12em] uppercase text-[var(--brand-blue)]">
                  {item.label}
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--brand-slate)]">{item.value}</p>
                <p className="mt-1 text-sm leading-6 text-[var(--brand-muted)]">{item.note}</p>
              </div>
            ))}
          </ReviewPanel>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <ReviewPanel
          title="Selected approval"
          description="Approval confirms draft rationale, capability separation, and the exact state change attached to the preserved source record."
          contentClassName="space-y-4"
        >
          <div className="rounded-[1.5rem] border border-[var(--brand-border)] bg-[rgba(0,61,166,0.04)] px-4 py-4">
            <p className="text-xs font-semibold tracking-[0.12em] uppercase text-[var(--brand-blue)]">
              Reason code
            </p>
            <p className="mt-2 text-sm font-semibold text-[var(--brand-slate)]">
              {activeReview.reasonCode}
            </p>
            <p className="mt-1 text-sm text-[var(--brand-muted)]">{activeReview.reason}</p>
          </div>

          <div className="rounded-[1.5rem] border border-[var(--brand-border)] bg-white px-4 py-4">
            <DetailField label="Current custody" value={activeDocument ? getCustodyStateLabel(activeDocument.custodyState) : 'Unknown'} />
            <Separator className="my-4 bg-[var(--brand-border)]" />
            <DetailField label="Target state" value={getCustodyStateLabel(activeReview.targetCustodyState)} />
            <Separator className="my-4 bg-[var(--brand-border)]" />
            <DetailField label="Capability" value={getUserCapabilityLabel(activeReview.capability)} />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-[0.12em] uppercase text-[var(--brand-blue)]">
              Exception flags
            </p>
            <div className="flex flex-wrap gap-2">
              {activeReview.exceptionFlags.length > 0 ? (
                activeReview.exceptionFlags.map((flag) => (
                  <span
                    key={flag}
                    className="rounded-full bg-[rgba(148,64,64,0.08)] px-3 py-1 text-xs font-semibold text-[#8b2c2c]"
                  >
                    {getExceptionFlagLabel(flag)}
                  </span>
                ))
              ) : (
                <span className="rounded-full bg-[rgba(0,61,166,0.06)] px-3 py-1 text-xs font-semibold text-[var(--brand-blue)]">
                  No active exception flags
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button asChild variant="outline" className="rounded-full border-[var(--brand-border)] bg-white text-[var(--brand-slate)]">
              <Link
                to="/review-workbench"
                search={{ reviewId: activeReview.id }}
                resetScroll={false}
              >
                Open drafting workspace
              </Link>
            </Button>
            <Button className="rounded-full bg-[var(--brand-blue)] text-white hover:bg-[color-mix(in_oklab,var(--brand-blue)_86%,black_14%)]">
              Approve to {getCustodyStateLabel(activeReview.targetCustodyState)}
            </Button>
            <Button
              variant="outline"
              className="rounded-full border-[var(--brand-border)] bg-white text-[var(--brand-slate)]"
            >
              Request drafting revision
            </Button>
          </div>
        </ReviewPanel>

        <ReviewPanel
          title="Approval review"
          description="Approval starts with rationale, manifest state, and authority transition. The source file stays available as a secondary spot-check."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {metadataFields.map(([label, value]) => (
              <div
                key={label}
                className="rounded-[1.35rem] border border-[var(--brand-border)] bg-white px-4 py-4"
              >
                <DetailField label={label} value={value} />
              </div>
            ))}
          </div>

          <Tabs defaultValue="rationale" className="mt-6 w-full">
            <TabsList className="mb-5 grid h-auto w-full grid-cols-3 rounded-full bg-[rgba(0,61,166,0.05)] p-1">
              <TabsTrigger value="rationale" className="rounded-full">
                Draft rationale
              </TabsTrigger>
              <TabsTrigger value="checks" className="rounded-full">
                Governance checks
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-full">
                Adjustment history
              </TabsTrigger>
            </TabsList>

            <TabsContent value="rationale" className="space-y-4">
              <div className="rounded-[1.35rem] border border-[var(--brand-border)] bg-white px-4 py-4">
                <DetailField label="Summary" value={activeReview.rationale.summary} />
                <Separator className="my-4 bg-[var(--brand-border)]" />
                <DetailField label="Source basis" value={activeReview.rationale.sourceBasis} />
                <Separator className="my-4 bg-[var(--brand-border)]" />
                <DetailField label="Reason for change" value={activeReview.rationale.changeReason} />
                <div className="mt-4">
                  <StatusBadge label={getManifestStateLabel(activeReview.rationale.approvalStatus)} />
                </div>
              </div>

              <div className="rounded-[1.35rem] border border-[var(--brand-border)] bg-white px-4 py-4">
                <div className="flex items-center gap-3">
                  <Link2 className="size-4 text-[var(--brand-blue)]" />
                  <p className="text-sm font-semibold text-[var(--brand-slate)]">
                    Evidence hierarchy used
                  </p>
                </div>
                <div className="mt-4 space-y-3">
                  {activeReview.evidenceHierarchy.map((entry, index) => (
                    <div
                      key={entry}
                      className="rounded-[1.15rem] border border-[var(--brand-border)] bg-[rgba(0,61,166,0.03)] px-4 py-4"
                    >
                      <p className="text-xs font-semibold tracking-[0.12em] uppercase text-[var(--brand-blue)]">
                        Source {index + 1}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[var(--brand-text)]">{entry}</p>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="checks" className="space-y-4">
              {activeReview.governanceChecks.map((check) => (
                <div
                  key={check.id}
                  className="rounded-[1.35rem] border border-[var(--brand-border)] bg-white px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--brand-slate)]">
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
                  <p className="mt-2 text-sm leading-6 text-[var(--brand-muted)]">
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
                    className="rounded-[1.35rem] border border-[var(--brand-border)] bg-white px-4 py-4"
                  >
                    <div className="flex items-center gap-3">
                      <History className="size-4 text-[var(--brand-blue)]" />
                      <p className="text-sm font-semibold text-[var(--brand-slate)]">
                        {adjustment.priorState} → {adjustment.newState}
                      </p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--brand-text)]">
                      {adjustment.reason}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {adjustment.affectedOutputs.map((output) => (
                        <span
                          key={output}
                          className="rounded-full bg-[rgba(0,61,166,0.06)] px-3 py-1 text-xs font-semibold text-[var(--brand-blue)]"
                        >
                          {output}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.35rem] border border-[var(--brand-border)] bg-white px-4 py-4">
                  <p className="text-sm font-semibold text-[var(--brand-slate)]">
                    No prior adjustments recorded
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--brand-muted)]">
                    This package is being approved without any superseded or adjustment history yet.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <PdfPreviewPanel
            title="Source evidence spot-check"
            description="Approval keeps the preserved source visible for verification after the governance decision has been framed."
            document={activeDocument}
            compact
            maxWidth={420}
            tone="light"
          />
        </ReviewPanel>
      </div>
    </MockupShell>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.12em] uppercase text-[var(--brand-blue)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-[var(--brand-slate)]">{value}</p>
    </div>
  )
}
