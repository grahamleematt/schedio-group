import { createFileRoute } from '@tanstack/react-router'
import { Activity, ArrowUpRight, Clock3, Files, Search, TimerReset } from 'lucide-react'
import { MetricCard } from '#/components/metric-card'
import { MockupShell } from '#/components/mockup-shell'
import { StatusBadge } from '#/components/status-badge'
import { UploadDropzone } from '#/components/upload-dropzone'
import { buttonVariants } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Progress } from '#/components/ui/progress'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#/components/ui/table'
import { getBatchesByDistrict, getDistrict, getDocumentsByDistrict, processingStages, uploadBatches } from '#/lib/mock-data'
import { cn } from '#/lib/utils'

const districtId = 'north-county'
const district = getDistrict(districtId)
const batches = getBatchesByDistrict(districtId)
const docs = getDocumentsByDistrict(districtId)

export const Route = createFileRoute('/portal-operations')({
  head: () => ({
    meta: [{ title: 'Portal Operations | Schedio Group AI' }],
  }),
  component: PortalOperationsPage,
})

function PortalOperationsPage() {
  const metrics = [
    {
      label: 'Batches today',
      value: '6',
      note: 'High-visibility intake volume for shared client logins and district coordinators.',
    },
    {
      label: 'Active documents',
      value: String(docs.length),
      note: 'Same flow as the trust portal, but with more emphasis on operational load and stage detail.',
    },
    {
      label: 'Avg. first-pass time',
      value: '18 min',
      note: 'A performance-flavored metric to make workflow momentum more concrete.',
    },
    {
      label: 'Ready for handoff',
      value: '12',
      note: 'Shows when organized documents can move on to Ignite access and client follow-through.',
    },
  ]

  return (
    <MockupShell
      tone="operations"
      label="Client-facing concept two"
      title="Operations-forward portal with denser status visibility and batch-level control."
      description="This route keeps the same client-safe workflow as the trust portal, but it surfaces more timestamps, counts, and queue state for users who want to see more of the process."
      badges={[
        'Status-first',
        'Client-safe dashboard',
        district.region,
      ]}
      sidebar={
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--brand-border)] bg-white px-4 py-4">
            <Activity className="size-4 text-[var(--brand-blue)]" />
            <div>
              <p className="text-xs font-semibold tracking-[0.12em] uppercase text-[var(--brand-blue)]">
                Active district
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--brand-slate)]">
                {district.name}
              </p>
            </div>
          </div>
          <p className="text-sm leading-6 text-[var(--brand-muted)]">
            The emphasis here is less “gentle front door” and more “working
            command surface” while still staying appropriate for clients.
          </p>
        </div>
      }
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <UploadDropzone
        title="Status-heavy intake that still feels like one coherent client workflow."
        subtitle="Uploads, batch progress, and handoff cues live together here. This route is useful if Tim responds to a more operational dashboard posture without wanting to expose internal-only tools."
        points={[
          'Recent uploads, stage counts, and timestamps are visible near the intake surface.',
          'Status signals help clients understand where their package is without contacting the team.',
          'Ignite remains the final document destination, not something the portal tries to replace.',
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_400px]">
        <Card className="brand-panel rounded-[1.75rem] border-[var(--brand-border)] shadow-none">
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="font-heading text-2xl text-[var(--brand-slate)]">
                Batch command center
              </CardTitle>
              <p className="mt-2 text-sm leading-6 text-[var(--brand-muted)]">
                A more dashboard-like read on intake packages, still within a client-safe surface.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="relative min-w-[220px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--brand-muted)]" />
                <Input
                  defaultValue=""
                  placeholder="Search batches"
                  className="h-11 rounded-full border-[var(--brand-border)] bg-white pl-9"
                />
              </div>
              <Select defaultValue={district.id}>
                <SelectTrigger className="h-11 min-w-[220px] rounded-full border-[var(--brand-border)] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={district.id}>{district.name}</SelectItem>
                  <SelectItem value="brazos-basin">Brazos Basin Drainage District</SelectItem>
                  <SelectItem value="gulf-harbor">Gulf Harbor School Facilities</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-[1.5rem] border border-[var(--brand-border)] bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[rgba(0,61,166,0.04)]">
                    <TableHead>Batch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Docs</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploadBatches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell>
                        <div>
                          <p className="font-semibold text-[var(--brand-slate)]">
                            {batch.name}
                          </p>
                          <p className="text-xs text-[var(--brand-muted)]">
                            {batch.submittedBy}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge label={batch.status} />
                      </TableCell>
                      <TableCell>{batch.documentCount}</TableCell>
                      <TableCell>{batch.channel}</TableCell>
                      <TableCell className="text-[var(--brand-muted)]">
                        {batch.submittedAt}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="brand-panel rounded-[1.75rem] border-[var(--brand-border)] shadow-none">
          <CardHeader>
            <CardTitle className="font-heading text-2xl text-[var(--brand-slate)]">
              Stage pressure
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {processingStages.map((stage, index) => {
              const value = [14, 34, 72, 91, 100][index] ?? 0
              const icon =
                stage === 'Received' ? (
                  <Files className="size-4 text-[var(--brand-blue)]" />
                ) : stage === 'Ready for review' ? (
                  <TimerReset className="size-4 text-[var(--brand-blue)]" />
                ) : (
                  <Clock3 className="size-4 text-[var(--brand-blue)]" />
                )

              return (
                <div
                  key={stage}
                  className="rounded-[1.5rem] border border-[var(--brand-border)] bg-white px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {icon}
                      <p className="text-sm font-semibold text-[var(--brand-slate)]">
                        {stage}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-[var(--brand-muted)]">
                      {value}%
                    </span>
                  </div>
                  <Progress value={value} className="mt-3 h-2.5 rounded-full" />
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card className="brand-panel rounded-[1.75rem] border-[var(--brand-border)] shadow-none">
          <CardHeader>
            <CardTitle className="font-heading text-2xl text-[var(--brand-slate)]">
              Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              'Batch 251 reached ready-for-review with 18 files retained in original traceability order.',
              'District switch confirmed before upload for shared operator session.',
              'Three organized records published to Ignite with client-visible timestamps.',
              'One low-confidence scan flagged for human review before rename approval.',
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-[var(--brand-border)] bg-white px-4 py-4 text-sm leading-6 text-[var(--brand-text)]"
              >
                {item}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="brand-panel rounded-[1.75rem] border-[var(--brand-border)] shadow-none">
          <CardHeader>
            <CardTitle className="font-heading text-2xl text-[var(--brand-slate)]">
              Document register
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {docs.map((document) => (
              <article
                key={document.id}
                className="grid gap-4 rounded-[1.5rem] border border-[var(--brand-border)] bg-white px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm font-semibold text-[var(--brand-slate)]">
                      {document.organizedName}
                    </p>
                    <StatusBadge label={document.status} />
                  </div>
                  <p className="text-xs leading-5 text-[var(--brand-muted)]">
                    Original: {document.originalName} · {document.pageCount} pages · {document.updatedAt}
                  </p>
                </div>

                <a
                  href={document.igniteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    buttonVariants({ variant: 'outline' }),
                    'rounded-full border-[var(--brand-border)] bg-white text-[var(--brand-slate)] no-underline'
                  )}
                >
                  Ignite
                  <ArrowUpRight className="size-4" />
                </a>
              </article>
            ))}
          </CardContent>
        </Card>
      </div>
    </MockupShell>
  )
}
