import type { ReactNode } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { MockupShell } from '#/components/mockup-shell'
import { StatusBadge } from '#/components/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
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
  auditEvents,
  entities,
  entityMemberships,
  getEntityById,
  getRoleLabel,
  getWorkflowTypeLabel,
} from '#/lib/internal-portal-data'

const adminTabs = ['entities', 'users', 'requests', 'owners', 'audit'] as const
type AdminTab = (typeof adminTabs)[number]

export const Route = createFileRoute('/entity-admin')({
  validateSearch: (search: Record<string, unknown>) => ({
    tab:
      typeof search.tab === 'string' && adminTabs.includes(search.tab as AdminTab)
        ? (search.tab as AdminTab)
        : undefined,
  }),
  head: () => ({
    meta: [{ title: 'Entity Admin | Schedio Group' }],
  }),
  component: EntityAdminPage,
})

function EntityAdminPage() {
  const { tab } = Route.useSearch()
  const navigate = useNavigate()
  const activeTab = tab ?? 'entities'

  return (
    <MockupShell
      tone="operations"
      meta="Schedio Group engineering • governance and access"
      title="Entity administration"
      description="Manage entities, memberships, owner approvals, and audit-visible governance actions without leaving the static mockup context."
    >
      <section className="grid grid-cols-1 divide-y overflow-hidden rounded-2xl border border-border-strong bg-surface-panel sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
        <MetricCard
          label="Entities"
          value={String(entities.length)}
          helper="Active and archived SG DREAM relationships"
        />
        <MetricCard
          label="Memberships"
          value={String(entityMemberships.length)}
          helper="Current invited and approved users"
        />
        <MetricCard
          label="Pending requests"
          value={String(
            accessRequests.filter((request) => request.status === 'Pending approval')
              .length,
          )}
          helper="Owner decisions still outstanding"
        />
        <MetricCard
          label="Audit events"
          value={String(auditEvents.length)}
          helper="Recent governance-visible actions"
        />
      </section>

      <section className="rounded-3xl border border-border-strong bg-surface-panel px-4 py-4">
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            void navigate({
              to: '/entity-admin',
              search: {
                tab: value as AdminTab,
              },
              resetScroll: false,
            })
          }}
          className="w-full"
        >
          <TabsList className="workflow-tabs-approval grid h-auto w-full grid-cols-2 rounded-full p-1 lg:grid-cols-5">
            <TabsTrigger value="entities" className="rounded-full text-xs">
              Entities
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-full text-xs">
              Users
            </TabsTrigger>
            <TabsTrigger value="requests" className="rounded-full text-xs">
              Access Requests
            </TabsTrigger>
            <TabsTrigger value="owners" className="rounded-full text-xs">
              Owners
            </TabsTrigger>
            <TabsTrigger value="audit" className="rounded-full text-xs">
              Audit
            </TabsTrigger>
          </TabsList>

          <TabsContent value="entities" className="pt-5">
            <DataCard>
              <Table className="data-table-min font-ops">
                <TableHeader>
                  <TableRow className="bg-surface-muted">
                    <TableHead>Entity</TableHead>
                    <TableHead>Workflow</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Owner</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entities.map((entity) => (
                    <TableRow key={entity.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-text-strong">
                            {entity.name}
                          </p>
                          <p className="text-xs text-text-muted">
                            {entity.region}
                            {entity.competitorSet
                              ? ` • competitor set ${entity.competitorSet}`
                              : ''}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          label={getWorkflowTypeLabel(entity.workflowType)}
                        />
                      </TableCell>
                      <TableCell>
                        <StatusBadge label={entity.status} />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-text-strong">
                            {entity.ownerName}
                          </p>
                          <p className="text-xs text-text-muted">
                            {entity.ownerEmail}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataCard>
          </TabsContent>

          <TabsContent value="users" className="pt-5">
            <DataCard>
              <Table className="data-table-min font-ops">
                <TableHeader>
                  <TableRow className="bg-surface-muted">
                    <TableHead>User</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entityMemberships.map((membership) => (
                    <TableRow key={membership.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-text-strong">
                            {membership.userName}
                          </p>
                          <p className="text-xs text-text-muted">
                            {membership.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getEntityById(membership.entityId)?.name}
                      </TableCell>
                      <TableCell>{getRoleLabel(membership.role)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <StatusBadge label={membership.status} />
                          <p className="text-xs text-text-muted">
                            {membership.lastActive}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataCard>
          </TabsContent>

          <TabsContent value="requests" className="pt-5">
            <DataCard>
              <Table className="data-table-min font-ops">
                <TableHeader>
                  <TableRow className="bg-surface-muted">
                    <TableHead>Requester</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Requested role</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accessRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-text-strong">
                            {request.requesterName}
                          </p>
                          <p className="text-xs text-text-muted">
                            {request.requesterEmail}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{getEntityById(request.entityId)?.name}</TableCell>
                      <TableCell>{getRoleLabel(request.requestedRole)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <StatusBadge label={request.status} />
                          <p className="text-xs text-text-muted">
                            Expires {request.expiresAt}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataCard>
          </TabsContent>

          <TabsContent value="owners" className="pt-5">
            <div className="grid gap-4 xl:grid-cols-3">
              {entities.map((entity) => (
                <div
                  key={entity.id}
                  className="workflow-panel-approval rounded-3xl border px-4 py-4"
                >
                  <p className="ops-label text-text-accent">Owner posture</p>
                  <p className="mt-2 text-lg font-semibold text-text-strong">
                    {entity.ownerName}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-text-base">
                    Primary authority for {entity.name}. Responsible for access
                    approvals, membership posture, and escalation response.
                  </p>
                  <div className="mt-4 grid gap-3">
                    <OwnerField label="Entity" value={entity.name} />
                    <OwnerField
                      label="Workflow"
                      value={getWorkflowTypeLabel(entity.workflowType)}
                    />
                    <OwnerField label="Contact" value={entity.ownerEmail} />
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="audit" className="pt-5">
            <div className="space-y-4">
              {auditEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-[1.35rem] border border-border-strong bg-surface-panel px-4 py-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-text-strong">
                        {event.message}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        {event.actor} • {event.occurredAt}
                      </p>
                    </div>
                    <StatusBadge label={event.category} />
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
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

function DataCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-border-strong bg-surface-panel px-4 py-4">
      <div className="data-table-frame">{children}</div>
    </div>
  )
}

function OwnerField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="ops-label text-text-muted">{label}</p>
      <p className="text-sm font-semibold text-text-strong">{value}</p>
    </div>
  )
}
