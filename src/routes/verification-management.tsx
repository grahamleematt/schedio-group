import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { CalendarRange, ArrowRight } from 'lucide-react'
import { MockupShell } from '#/components/mockup-shell'
import { StatusBadge } from '#/components/status-badge'
import { Button } from '#/components/ui/button'
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
import {
  contractBudgets,
  formatCurrency,
  getWorkflowTypeLabel,
  getVerificationManagementRows,
} from '#/lib/internal-portal-data'

export const Route = createFileRoute('/verification-management')({
  validateSearch: (search: Record<string, unknown>) => ({
    workflow:
      typeof search.workflow === 'string' ? search.workflow : undefined,
    status: typeof search.status === 'string' ? search.status : undefined,
  }),
  head: () => ({
    meta: [{ title: 'Verification Management | Schedio Group' }],
  }),
  component: VerificationManagementPage,
})

function VerificationManagementPage() {
  const { workflow, status } = Route.useSearch()
  const navigate = useNavigate()
  const rows = getVerificationManagementRows()
  const filteredRows = rows.filter((row) => {
    const lifecycleStatus = getLifecycleStatus(row)
    if (workflow && row.verification.workflowType !== workflow) return false
    if (status && lifecycleStatus !== status) return false
    return true
  })

  const openCount = rows.filter((row) => getLifecycleStatus(row) === 'Open').length
  const underReviewCount = rows.filter(
    (row) => getLifecycleStatus(row) === 'Under review',
  ).length
  const approvedCount = rows.filter(
    (row) => getLifecycleStatus(row) === 'Approved',
  ).length
  const cutoffCount = rows.filter(
    (row) => row.verification.timing === 'Approaching cutoff',
  ).length

  return (
    <MockupShell
      tone="operations"
      meta="Schedio Group engineering • verification management"
      title="Verification management"
      description="Monitor open windows, cutoff pressure, verification totals, and downstream budget exposure without leaving the internal portal."
      actions={
        <>
          <Button className="rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary-hover">
            Create verification
          </Button>
          <Button
            asChild
            variant="outline"
            className="rounded-full border-border-base bg-surface-panel text-text-strong"
          >
            <Link to="/submission-inbox" search={{ submissionId: undefined, entityId: undefined, workflow: undefined, state: undefined, duplicate: undefined, q: undefined }}>
              Open inbox
            </Link>
          </Button>
        </>
      }
      aside={
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CalendarRange className="size-4 text-text-accent" />
            <p className="font-ops text-sm font-semibold text-text-strong">
              Calendar pressure
            </p>
          </div>
          <p className="text-sm leading-6 text-text-base">
            Two active verification windows need close monitoring. CAB is near
            cutoff, while Metro remains under review because finance support is
            still incomplete.
          </p>
        </div>
      }
    >
      <section className="grid grid-cols-1 divide-y overflow-hidden rounded-2xl border border-border-strong bg-surface-panel sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
        <MetricCard
          label="Open windows"
          value={String(openCount)}
          helper="Currently accepting or routing submissions"
        />
        <MetricCard
          label="Under review"
          value={String(underReviewCount)}
          helper="Verification totals still being finalized"
        />
        <MetricCard
          label="Approved"
          value={String(approvedCount)}
          helper="Verified totals already locked"
        />
        <MetricCard
          label="Approaching cutoff"
          value={String(cutoffCount)}
          helper="Needs active PM and approval coverage"
        />
      </section>

      <section className="rounded-3xl border border-border-strong bg-surface-panel px-4 py-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="ops-label">Verification register</p>
            <h2 className="mt-2 font-ops text-lg font-semibold text-text-strong">
              Open, under-review, and approved windows
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              value={workflow ?? 'all'}
              onValueChange={(value) => {
                void navigate({
                  to: '/verification-management',
                  search: {
                    workflow: value === 'all' ? undefined : value,
                    status,
                  },
                  resetScroll: false,
                })
              }}
            >
              <SelectTrigger className="h-10 rounded-full border-border-base bg-surface-panel text-sm">
                <SelectValue placeholder="All workflows" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All workflows</SelectItem>
                <SelectItem value="developer_reimbursement">
                  Developer reimbursement
                </SelectItem>
                <SelectItem value="district_direct_pay">
                  District direct pay
                </SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={status ?? 'all'}
              onValueChange={(value) => {
                void navigate({
                  to: '/verification-management',
                  search: {
                    workflow,
                    status: value === 'all' ? undefined : value,
                  },
                  resetScroll: false,
                })
              }}
            >
              <SelectTrigger className="h-10 rounded-full border-border-base bg-surface-panel text-sm">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="Under review">Under review</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="data-table-frame">
          <Table className="data-table-min font-ops">
            <TableHeader>
              <TableRow className="bg-surface-muted">
                <TableHead>Verification</TableHead>
                <TableHead>Workflow</TableHead>
                <TableHead>Timing</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={row.verification.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-text-strong">
                        {row.verification.label}
                      </p>
                      <p className="text-xs text-text-muted">
                        {row.entity?.name} • {row.verification.cutoffDate}
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
                        {row.submissionCount} submissions • {row.duplicateCount}{' '}
                        duplicate watch
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{formatCurrency(row.submittedAmount)}</TableCell>
                  <TableCell>{formatCurrency(row.verifiedAmount)}</TableCell>
                  <TableCell>
                    <StatusBadge label={getLifecycleStatus(row)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="workflow-panel-approval rounded-3xl border px-4 py-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="ops-label text-text-accent">District direct pay</p>
              <h2 className="mt-2 font-ops text-lg font-semibold text-text-strong">
                Budget exposure by vendor
              </h2>
            </div>
            <Button
              asChild
              variant="outline"
              className="rounded-full border-border-base bg-surface-panel text-text-strong"
            >
              <Link to="/review-console" search={{ reviewId: undefined, q: undefined, districtId: 'sterling-md' }}>
                Open approval
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <div className="data-table-frame">
            <Table className="data-table-min font-ops">
              <TableHeader>
                <TableRow className="bg-surface-muted">
                  <TableHead>Vendor</TableHead>
                  <TableHead>Authorized</TableHead>
                  <TableHead>Spent</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Health</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contractBudgets.map((budget) => (
                  <TableRow key={budget.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-text-strong">
                          {budget.vendorName}
                        </p>
                        <p className="text-xs text-text-muted">
                          {budget.vendorCode}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(budget.authorizedAmount)}</TableCell>
                    <TableCell>{formatCurrency(budget.spentAmount)}</TableCell>
                    <TableCell>{formatCurrency(budget.remainingAmount)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge label={budget.health} />
                        <span className="text-xs font-semibold text-text-muted">
                          {budget.utilizationPercent}% used
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-3xl border border-border-strong bg-surface-panel px-4 py-4">
            <p className="ops-label text-text-accent mb-4">Create / close rhythm</p>
            <div className="space-y-4">
              <LifecycleCard
                label="Create new verification"
                copy="Assign the next verification number, set the due date, and attach the default workflow rules."
              />
              <LifecycleCard
                label="Close cutoff window"
                copy="Stop new intake, preserve any late-rollover routing, and alert approval that the package set is stable."
              />
              <LifecycleCard
                label="Publish verified totals"
                copy="Once approved, roll verified dollars into the client-facing summaries without exposing internal rationale."
              />
            </div>
          </div>
        </section>
      </div>
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

function LifecycleCard({ label, copy }: { label: string; copy: string }) {
  return (
    <div className="rounded-[1.15rem] border border-border-base bg-surface-muted px-4 py-4">
      <p className="text-sm font-semibold text-text-strong">{label}</p>
      <p className="mt-2 text-sm leading-6 text-text-muted">{copy}</p>
    </div>
  )
}

function getLifecycleStatus(row: ReturnType<typeof getVerificationManagementRows>[number]) {
  if (row.verifiedAmount > 0 && row.blockedCount === 0) {
    return 'Approved'
  }

  if (row.blockedCount > 0 || row.verification.timing === 'Past cutoff') {
    return 'Under review'
  }

  return 'Open'
}
