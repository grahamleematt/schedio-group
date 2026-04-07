import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, ShieldCheck, TimerReset } from 'lucide-react'
import { MockupShell } from '#/components/mockup-shell'
import { StatusBadge } from '#/components/status-badge'
import { Button } from '#/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import {
  accessRequests,
  approvalTasks,
  formatCurrency,
  getEntityById,
  getInternalDashboardMetrics,
  getVerificationManagementRows,
  getWorkflowTypeLabel,
  getWorkflowTypeSummaries,
  internalSubmissions,
} from '#/lib/internal-portal-data'
import { getDocumentById } from '#/lib/mock-data'

export const Route = createFileRoute('/internal-dashboard')({
  head: () => ({
    meta: [{ title: 'Internal Dashboard | Schedio Group' }],
  }),
  component: InternalDashboardPage,
})

function InternalDashboardPage() {
  const metrics = getInternalDashboardMetrics()
  const workflowSummaries = getWorkflowTypeSummaries()
  const verificationRows = getVerificationManagementRows().filter(
    (row) => row.verification.timing !== 'Past cutoff',
  )
  const needsAttention = internalSubmissions.filter(
    (submission) =>
      submission.queueState === 'New' ||
      submission.queueState === 'Needs drafting' ||
      submission.queueState === 'Blocked' ||
      submission.duplicateState === 'Escalated',
  )
  const pendingRequests = accessRequests.filter(
    (request) => request.status === 'Pending approval',
  )

  return (
    <MockupShell
      tone="operations"
      meta="Schedio Group engineering • internal operations"
      title="Internal dashboard"
      description="Command surface for new submissions, queue bottlenecks, approaching cutoffs, and access governance across SG DREAM."
      actions={
        <>
          <Button
            asChild
            className="rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary-hover"
          >
            <Link
              to="/submission-inbox"
              search={{
                submissionId: undefined,
                entityId: undefined,
                workflow: undefined,
                state: 'New',
                duplicate: undefined,
                q: undefined,
              }}
            >
              Open inbox
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="rounded-full border-border-base bg-surface-panel text-text-strong"
          >
            <Link
              to="/verification-management"
              search={{ workflow: undefined, status: 'Open' }}
            >
              Review verifications
            </Link>
          </Button>
        </>
      }
      aside={
        <div className="space-y-4">
          <div>
            <p className="ops-label">Today&apos;s posture</p>
            <p className="mt-2 text-sm leading-6 text-text-base">
              Duplicate resolution, finance-package support gaps, and two cutoff
              windows are the main drivers of internal workload today.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <CompactMetric
              label="Pending access"
              value={String(metrics.pendingAccessRequests)}
            />
            <CompactMetric
              label="Approaching cutoff"
              value={String(metrics.approachingCutoff)}
            />
          </div>
        </div>
      }
    >
      <section className="grid grid-cols-1 divide-y overflow-hidden rounded-2xl border border-border-strong bg-surface-panel sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-6">
        <MetricCard
          label="New submissions"
          value={String(metrics.newSubmissions)}
          helper="Fresh intake needing first-pass routing"
        />
        <MetricCard
          label="Needs drafting"
          value={String(metrics.draftingNeeded)}
          helper="Human interpretation still required"
        />
        <MetricCard
          label="Approvals waiting"
          value={String(metrics.approvalsWaiting)}
          helper="Authority decisions queued"
        />
        <MetricCard
          label="Duplicate escalations"
          value={String(metrics.duplicateEscalations)}
          helper="Client keep/remove needs SG override"
        />
        <MetricCard
          label="Approaching cutoff"
          value={String(metrics.approachingCutoff)}
          helper="Verification windows nearing close"
        />
        <MetricCard
          label="Pending access"
          value={String(metrics.pendingAccessRequests)}
          helper="Owner approval still required"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
        <section className="rounded-3xl border border-border-strong bg-surface-panel px-4 py-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="ops-label">Needs attention</p>
              <h2 className="mt-2 font-ops text-lg font-semibold text-text-strong">
                Queue items that should move first
              </h2>
            </div>
            <StatusBadge label={`${needsAttention.length} items`} />
          </div>
          <div className="data-table-frame">
            <Table className="data-table-min font-ops">
              <TableHeader>
                <TableRow className="bg-surface-muted">
                  <TableHead>Submission</TableHead>
                  <TableHead>Workflow</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Owner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {needsAttention.map((submission) => {
                  const entity = getEntityById(submission.entityId)
                  return (
                    <TableRow key={submission.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-text-strong">
                            {submission.name}
                          </p>
                          <p className="text-xs text-text-muted">
                            {entity?.name} • {submission.queueAge}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          label={getWorkflowTypeLabel(submission.workflowType)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge label={submission.queueState} />
                          {submission.duplicateState !== 'Clear' ? (
                            <StatusBadge label={submission.duplicateState} />
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-text-strong">
                            {submission.ownerLabel}
                          </p>
                          <p className="text-xs text-text-muted">
                            {submission.blockedReason ?? submission.attentionNote}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="space-y-4">
          <div className="workflow-panel-approval rounded-3xl border px-4 py-4">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="size-4 text-text-accent" />
              <p className="font-ops text-sm font-semibold text-text-strong">
                Workflow posture
              </p>
            </div>
            <div className="space-y-4">
              {workflowSummaries.map((summary) => (
                <div
                  key={summary.workflowType}
                  className="rounded-[1.15rem] border border-border-base bg-surface-panel px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-text-strong">
                      {summary.label}
                    </p>
                    <StatusBadge label={summary.label} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <CompactMetric
                      label="Submissions"
                      value={String(summary.submissionCount)}
                    />
                    <CompactMetric
                      label="Blocked"
                      value={String(summary.blockedCount)}
                    />
                    <CompactMetric
                      label="Submitted"
                      value={formatCurrency(summary.submittedAmount)}
                    />
                    <CompactMetric
                      label="Verified"
                      value={formatCurrency(summary.verifiedAmount)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="workflow-panel-approval rounded-3xl border px-4 py-4">
            <div className="mb-4 flex items-center gap-2">
              <TimerReset className="size-4 text-text-accent" />
              <p className="font-ops text-sm font-semibold text-text-strong">
                Pending approvals and access
              </p>
            </div>
            <div className="space-y-4">
              {approvalTasks.slice(0, 3).map((task) => (
                <div
                  key={task.id}
                  className="border-b border-border-base pb-4 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-text-strong">
                      {getDocumentByLabel(task.recordId)}
                    </p>
                    <StatusBadge label={task.publishReadiness} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-text-muted">
                    {task.reason}
                  </p>
                </div>
              ))}
              {pendingRequests.map((request) => {
                const entity = getEntityById(request.entityId)
                return (
                  <div
                    key={request.id}
                    className="rounded-[1.15rem] border border-border-base bg-surface-panel px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-text-strong">
                        {request.requesterName}
                      </p>
                      <StatusBadge label={request.status} />
                    </div>
                    <p className="mt-2 text-sm text-text-muted">
                      {entity?.name} • expires {request.expiresAt}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-border-strong bg-surface-panel px-4 py-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="ops-label">Approaching cutoff</p>
            <h2 className="mt-2 font-ops text-lg font-semibold text-text-strong">
              Verification windows needing active oversight
            </h2>
          </div>
          <Button
            asChild
            variant="outline"
            className="rounded-full border-border-base bg-surface-panel text-text-strong"
          >
            <Link
              to="/verification-management"
              search={{ workflow: undefined, status: undefined }}
            >
              Open verification manager
            </Link>
          </Button>
        </div>
        <div className="data-table-frame">
          <Table className="data-table-min font-ops">
            <TableHeader>
              <TableRow className="bg-surface-muted">
                <TableHead>Verification</TableHead>
                <TableHead>Workflow</TableHead>
                <TableHead>Cutoff</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Verified</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {verificationRows.map((row) => (
                <TableRow key={row.verification.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-text-strong">
                        {row.verification.label}
                      </p>
                      <p className="text-xs text-text-muted">
                        {row.entity?.name}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      label={getWorkflowTypeLabel(row.verification.workflowType)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <StatusBadge label={row.verification.timing} />
                      <p className="text-xs text-text-muted">
                        {row.verification.cutoffDate}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{formatCurrency(row.submittedAmount)}</TableCell>
                  <TableCell>{formatCurrency(row.verifiedAmount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </MockupShell>
  )
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper: string
}) {
  return (
    <div className="p-4">
      <p className="ops-label text-text-muted mb-2">{label}</p>
      <p className="font-ops text-[2rem] font-semibold leading-none tracking-tight text-text-strong mb-2">
        {value}
      </p>
      <p className="text-xs text-text-muted">{helper}</p>
    </div>
  )
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="ops-label text-text-muted">{label}</p>
      <p className="text-sm font-semibold text-text-strong">{value}</p>
    </div>
  )
}

function getDocumentByLabel(recordId: string) {
  const document = getDocumentById(recordId)
  return document?.organizedName ?? 'Selected record'
}
