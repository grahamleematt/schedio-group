import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowRight, Search } from 'lucide-react'
import { MockupShell } from '#/components/mockup-shell'
import { StatusBadge } from '#/components/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
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
  formatCurrency,
  getApprovalTasksBySubmission,
  getDraftTasksBySubmission,
  getDuplicateMatchesBySubmission,
  getEntityById,
  getSubmissionById,
  getSubmissionDocuments,
  getWorkflowTypeLabel,
  internalSubmissions,
} from '#/lib/internal-portal-data'
import { getDocumentClassLabel, getExceptionFlagLabel } from '#/lib/mock-data'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/submission-inbox')({
  validateSearch: (search: Record<string, unknown>) => ({
    submissionId:
      typeof search.submissionId === 'string' ? search.submissionId : undefined,
    entityId: typeof search.entityId === 'string' ? search.entityId : undefined,
    workflow:
      typeof search.workflow === 'string' ? search.workflow : undefined,
    state: typeof search.state === 'string' ? search.state : undefined,
    duplicate:
      typeof search.duplicate === 'string' ? search.duplicate : undefined,
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
  head: () => ({
    meta: [{ title: 'Submission Inbox | Schedio Group' }],
  }),
  component: SubmissionInboxPage,
})

function SubmissionInboxPage() {
  const { submissionId, entityId, workflow, state, duplicate, q } =
    Route.useSearch()
  const navigate = useNavigate()

  const filteredSubmissions = internalSubmissions.filter((submission) => {
    if (entityId && submission.entityId !== entityId) return false
    if (workflow && submission.workflowType !== workflow) return false
    if (state && submission.queueState !== state) return false
    if (duplicate && submission.duplicateState !== duplicate) return false
    if (q) {
      const term = q.toLowerCase()
      const entity = getEntityById(submission.entityId)
      const haystack = [
        submission.name,
        entity?.name,
        submission.ownerLabel,
        submission.attentionNote,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      if (!haystack.includes(term)) return false
    }
    return true
  })

  const activeSubmission =
    filteredSubmissions.find((submission) => submission.id === submissionId) ??
    filteredSubmissions.at(0)
  const activeEntity = activeSubmission
    ? getEntityById(activeSubmission.entityId)
    : undefined
  const submissionDocuments = activeSubmission
    ? getSubmissionDocuments(activeSubmission.id)
    : []
  const duplicateMatches = activeSubmission
    ? getDuplicateMatchesBySubmission(activeSubmission.id)
    : []
  const draftTasks = activeSubmission
    ? getDraftTasksBySubmission(activeSubmission.id)
    : []
  const approvalTasks = activeSubmission
    ? getApprovalTasksBySubmission(activeSubmission.id)
    : []

  return (
    <MockupShell
      tone="operations"
      meta="Schedio Group engineering • submission inbox"
      title="Submission inbox"
      description="Triage new and in-flight submissions, route ambiguous packets into drafting, and prepare clean packages for approval."
      actions={
        <>
          <Button
            asChild
            variant="outline"
            className="rounded-full border-border-base bg-surface-panel text-text-strong"
          >
            <Link to="/internal-dashboard">Back to dashboard</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="rounded-full border-border-base bg-surface-panel text-text-strong"
          >
            <Link
              to="/review-workbench"
              search={{ reviewId: draftTasks[0]?.id }}
            >
              Open drafting queue
            </Link>
          </Button>
        </>
      }
    >
      <div className="grid min-h-[760px] grid-cols-1 overflow-hidden rounded-2xl border border-border-strong bg-surface-panel shadow-sm xl:grid-cols-[400px_minmax(0,1fr)]">
        <div className="flex flex-col border-b border-border-base bg-surface-muted/30 xl:border-r xl:border-b-0">
          <div className="flex flex-col gap-3 border-b border-border-base px-4 py-3">
            <div className="flex items-center justify-between">
              <h2 className="font-ops text-sm font-semibold text-text-strong">
                Submission queue
              </h2>
              <span className="text-xs font-medium text-text-muted">
                {filteredSubmissions.length} items
              </span>
            </div>
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
              <Input
                value={q ?? ''}
                placeholder="Search submissions"
                className="h-10 w-full rounded-full border-border-base bg-surface-panel pl-9 text-sm"
                onChange={(event) => {
                  const value = event.currentTarget.value
                  void navigate({
                    to: '/submission-inbox',
                    search: {
                      submissionId,
                      entityId,
                      workflow,
                      state,
                      duplicate,
                      q: value || undefined,
                    },
                    replace: true,
                    resetScroll: false,
                  })
                }}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                value={entityId ?? 'all'}
                onValueChange={(value) => {
                  void navigate({
                    to: '/submission-inbox',
                    search: {
                      submissionId,
                      entityId: value === 'all' ? undefined : value,
                      workflow,
                      state,
                      duplicate,
                      q,
                    },
                    resetScroll: false,
                  })
                }}
              >
                <SelectTrigger className="h-10 rounded-full border-border-base bg-surface-panel text-sm">
                  <SelectValue placeholder="All entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All entities</SelectItem>
                  {Array.from(
                    new Map(
                      internalSubmissions.map((submission) => [
                        submission.entityId,
                        getEntityById(submission.entityId),
                      ]),
                    ).values(),
                  ).map((entity) =>
                    entity ? (
                      <SelectItem key={entity.id} value={entity.id}>
                        {entity.name}
                      </SelectItem>
                    ) : null,
                  )}
                </SelectContent>
              </Select>
              <Select
                value={workflow ?? 'all'}
                onValueChange={(value) => {
                  void navigate({
                    to: '/submission-inbox',
                    search: {
                      submissionId,
                      entityId,
                      workflow: value === 'all' ? undefined : value,
                      state,
                      duplicate,
                      q,
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
                value={state ?? 'all'}
                onValueChange={(value) => {
                  void navigate({
                    to: '/submission-inbox',
                    search: {
                      submissionId,
                      entityId,
                      workflow,
                      state: value === 'all' ? undefined : value,
                      duplicate,
                      q,
                    },
                    resetScroll: false,
                  })
                }}
              >
                <SelectTrigger className="h-10 rounded-full border-border-base bg-surface-panel text-sm">
                  <SelectValue placeholder="All states" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All states</SelectItem>
                  {[
                    'New',
                    'Processing',
                    'Needs drafting',
                    'Ready for approval',
                    'Blocked',
                    'Superseded',
                  ].map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={duplicate ?? 'all'}
                onValueChange={(value) => {
                  void navigate({
                    to: '/submission-inbox',
                    search: {
                      submissionId,
                      entityId,
                      workflow,
                      state,
                      duplicate: value === 'all' ? undefined : value,
                      q,
                    },
                    resetScroll: false,
                  })
                }}
              >
                <SelectTrigger className="h-10 rounded-full border-border-base bg-surface-panel text-sm">
                  <SelectValue placeholder="All duplicate states" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All duplicate states</SelectItem>
                  {['Clear', 'Flagged', 'Escalated', 'Resolved'].map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredSubmissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                <Search className="mb-3 size-5 text-text-muted" />
                <p className="text-sm font-semibold text-text-strong">
                  No matching submissions
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Try widening the entity or queue filters.
                </p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border-base">
                {filteredSubmissions.map((submission) => {
                  const entity = getEntityById(submission.entityId)
                  const isFocused = submission.id === activeSubmission?.id

                  return (
                    <Link
                      key={submission.id}
                      to="/submission-inbox"
                      search={{
                        submissionId: submission.id,
                        entityId,
                        workflow,
                        state,
                        duplicate,
                        q,
                      }}
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
                            {submission.name}
                          </p>
                          <p className="font-mono text-[0.7rem] text-text-muted">
                            {entity?.name} • {submission.queueAge}
                          </p>
                        </div>
                        <StatusBadge label={submission.queueState} />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <StatusBadge
                          label={getWorkflowTypeLabel(submission.workflowType)}
                        />
                        <StatusBadge label={submission.duplicateState} />
                      </div>
                      <p className="mt-3 text-sm leading-6 text-text-base">
                        {submission.attentionNote}
                      </p>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 bg-surface-panel">
          {activeSubmission ? (
            <div className="flex h-full min-w-0 flex-col bg-surface-panel">
              <div className="flex items-center justify-between border-b border-border-base px-4 py-3">
                <h2 className="font-ops text-sm font-semibold text-text-strong">
                  Submission detail
                </h2>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge label={activeSubmission.queueState} />
                  <StatusBadge label={activeSubmission.duplicateState} />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="flex flex-col gap-6 p-4 xl:p-5">
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_320px]">
                    <div className="workflow-panel-approval rounded-3xl border px-4 py-4">
                      <p className="ops-label text-text-accent">
                        Intake posture
                      </p>
                      <p className="mt-2 text-lg font-semibold text-text-strong">
                        {activeSubmission.name}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-text-base">
                        {activeSubmission.attentionNote}
                      </p>
                      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <DetailField
                          label="Entity"
                          value={activeEntity?.name ?? 'Unknown'}
                        />
                        <DetailField
                          label="Workflow"
                          value={getWorkflowTypeLabel(
                            activeSubmission.workflowType,
                          )}
                        />
                        <DetailField
                          label="Verification"
                          value={activeSubmission.verificationId}
                        />
                        <DetailField
                          label="Queue owner"
                          value={activeSubmission.ownerLabel}
                        />
                      </div>
                    </div>

                    <div className="rounded-3xl border border-border-strong bg-surface-panel px-4 py-4">
                      <p className="ops-label text-text-accent mb-4">
                        Routing summary
                      </p>
                      <div className="space-y-4">
                        <CompactDetail
                          label="Documents"
                          value={String(submissionDocuments.length)}
                        />
                        <CompactDetail
                          label="Draft tasks"
                          value={String(draftTasks.length)}
                        />
                        <CompactDetail
                          label="Approval tasks"
                          value={String(approvalTasks.length)}
                        />
                        <CompactDetail
                          label="Submitted amount"
                          value={formatCurrency(
                            submissionDocuments.reduce(
                              (sum, document) =>
                                sum + (document.submittedAmount ?? 0),
                              0,
                            ),
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  <Tabs defaultValue="inventory" className="w-full">
                    <TabsList className="workflow-tabs-approval grid h-auto w-full grid-cols-3 rounded-full p-1">
                      <TabsTrigger value="inventory" className="rounded-full text-xs">
                        Inventory
                      </TabsTrigger>
                      <TabsTrigger value="routing" className="rounded-full text-xs">
                        Routing
                      </TabsTrigger>
                      <TabsTrigger value="history" className="rounded-full text-xs">
                        History
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="inventory" className="pt-5">
                      <div className="rounded-3xl border border-border-strong bg-surface-panel px-4 py-4">
                        <div className="data-table-frame">
                          <Table className="data-table-min font-ops">
                            <TableHeader>
                              <TableRow className="bg-surface-muted">
                                <TableHead>Original filename</TableHead>
                                <TableHead>Governed name</TableHead>
                                <TableHead>Class</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {submissionDocuments.map((document) => (
                                <TableRow key={document.id}>
                                  <TableCell>
                                    <div className="space-y-1">
                                      <p className="text-sm font-semibold text-text-strong">
                                        {document.originalName}
                                      </p>
                                      <p className="text-xs text-text-muted">
                                        Original retained for audit and duplicate
                                        review
                                      </p>
                                    </div>
                                  </TableCell>
                                  <TableCell>{document.organizedName}</TableCell>
                                  <TableCell>
                                    {getDocumentClassLabel(document.documentClass)}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap gap-2">
                                      {document.exceptionFlags.length > 0 ? (
                                        document.exceptionFlags.map((flag) => (
                                          <StatusBadge
                                            key={flag}
                                            label={getExceptionFlagLabel(flag)}
                                          />
                                        ))
                                      ) : (
                                        <StatusBadge label="Ready" />
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="routing" className="pt-5">
                      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                        <div className="workflow-panel-approval rounded-3xl border px-4 py-4">
                          <p className="ops-label text-text-accent mb-4">
                            Duplicate posture and routing
                          </p>
                          <div className="space-y-4">
                            {duplicateMatches.length > 0 ? (
                              duplicateMatches.map((match) => (
                                <div
                                  key={match.id}
                                  className="rounded-[1.15rem] border border-border-base bg-surface-panel px-4 py-4"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-semibold text-text-strong">
                                      {match.matchType}
                                    </p>
                                    <StatusBadge label={match.status} />
                                  </div>
                                  <p className="mt-2 text-sm leading-6 text-text-base">
                                    {match.note}
                                  </p>
                                  <p className="mt-2 text-xs text-text-muted">
                                    Previous verification {match.previousVerificationId}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm leading-6 text-text-muted">
                                No duplicate flags are currently blocking this
                                submission.
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="rounded-3xl border border-border-strong bg-surface-panel px-4 py-4">
                            <p className="ops-label text-text-accent mb-4">
                              Drafting handoff
                            </p>
                            <div className="space-y-3">
                              {draftTasks.length > 0 ? (
                                draftTasks.map((task) => (
                                  <div
                                    key={task.id}
                                    className="rounded-[1.15rem] border border-border-base bg-surface-muted px-4 py-4"
                                  >
                                    <p className="text-sm font-semibold text-text-strong">
                                      {task.reasonCode}
                                    </p>
                                    <p className="mt-2 text-sm leading-6 text-text-muted">
                                      {task.handoffStatus}
                                    </p>
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-text-muted">
                                  No drafting intervention needed.
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="rounded-3xl border border-border-strong bg-surface-panel px-4 py-4">
                            <p className="ops-label text-text-accent mb-4">
                              Approval readiness
                            </p>
                            <div className="space-y-3">
                              {approvalTasks.length > 0 ? (
                                approvalTasks.map((task) => (
                                  <div
                                    key={task.id}
                                    className="rounded-[1.15rem] border border-border-base bg-surface-muted px-4 py-4"
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="text-sm font-semibold text-text-strong">
                                        {task.reasonCode}
                                      </p>
                                      <StatusBadge label={task.publishReadiness} />
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-text-muted">
                                      {task.reason}
                                    </p>
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-text-muted">
                                  Not yet ready for approval routing.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="history" className="pt-5">
                      <div className="rounded-3xl border border-border-strong bg-surface-panel px-4 py-4">
                        <div className="space-y-4">
                          <HistoryRow
                            label="Submission received"
                            copy={`${activeSubmission.submittedAt} via ${activeSubmission.channel}.`}
                          />
                          <HistoryRow
                            label="Queue owner assigned"
                            copy={`${activeSubmission.ownerLabel} is driving the next decision point for this package.`}
                          />
                          <HistoryRow
                            label="Current posture"
                            copy={
                              activeSubmission.blockedReason ??
                              activeSubmission.attentionNote
                            }
                          />
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>

              <div className="workflow-action-bar-approval border-t px-4 py-4 xl:px-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Button className="rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary-hover">
                    Route to drafting
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-full border-border-base bg-surface-panel text-text-strong"
                  >
                    Send to approval
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="rounded-full border-border-base bg-surface-panel text-text-strong"
                  >
                    <Link
                      to="/review-console"
                      search={{ reviewId: approvalTasks[0]?.id, q: undefined, districtId: undefined }}
                    >
                      Open approval
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </MockupShell>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="ops-label text-text-accent">{label}</p>
      <p className="text-sm font-semibold text-text-strong">{value}</p>
    </div>
  )
}

function CompactDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="ops-label text-text-muted">{label}</p>
      <p className="text-sm font-semibold text-text-strong">{value}</p>
    </div>
  )
}

function HistoryRow({ label, copy }: { label: string; copy: string }) {
  return (
    <div className="border-b border-border-base pb-4 last:border-b-0 last:pb-0">
      <p className="text-sm font-semibold text-text-strong">{label}</p>
      <p className="mt-2 text-sm leading-6 text-text-muted">{copy}</p>
    </div>
  )
}
