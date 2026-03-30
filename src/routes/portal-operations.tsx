import { createFileRoute } from '@tanstack/react-router'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Clock3,
  Link2,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { MetricCard } from '#/components/metric-card'
import { MockupShell } from '#/components/mockup-shell'
import { StatusBadge } from '#/components/status-badge'
import { UploadDropzone } from '#/components/upload-dropzone'
import { Button, buttonVariants } from '#/components/ui/button'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import {
  getBatchesByDistrict,
  getCategoryCountsByDistrict,
  getClientFacingBatchStatus,
  getClientFacingRecordStatus,
  getClientDocumentsByDistrict,
  getDistrict,
  getDocumentClassLabel,
  getExceptionCountsByDistrict,
  getLinkedRecordSummary,
  getManifestStateLabel,
} from '#/lib/mock-data'
import { cn } from '#/lib/utils'

const districtId = 'sterling-cab'
const district = getDistrict(districtId)
const batches = getBatchesByDistrict(districtId)
const docs = getClientDocumentsByDistrict(districtId)
const categoryCounts = getCategoryCountsByDistrict(districtId)
const exceptionCounts = getExceptionCountsByDistrict(districtId)

export const Route = createFileRoute('/portal-operations')({
  head: () => ({
    meta: [{ title: 'Client Operations | Schedio Group' }],
  }),
  component: PortalOperationsPage,
})

function PortalOperationsPage() {
  const manifestReviewed = docs.filter(
    (document) => document.documentManifestState === 'reviewed'
  ).length
  const linkedTotal = docs.filter((document) => document.linkedRecords.length > 0).length
  const availableCount = docs.filter(
    (document) => getClientFacingRecordStatus(document) === 'Available in Egnyte'
  ).length
  const sourcePreservedCount = docs.filter((document) => document.sourcePreserved).length
  const stagePressure = [
    {
      stage: 'Incoming',
      count: docs.filter((document) => document.custodyState === 'incoming').length,
      note: 'Source records have landed in Egnyte custody and are waiting for package drafting.',
    },
    {
      stage: 'Processing',
      count: docs.filter((document) => document.custodyState === 'processing').length,
      note: 'Document and run manifests are still being drafted around the preserved originals.',
    },
    {
      stage: 'Classified',
      count: docs.filter((document) => document.custodyState === 'classified').length,
      note: 'Records are organized into formal classes and can be tracked as one evidence package.',
    },
    {
      stage: 'Engineering review',
      count: docs.filter((document) => getClientFacingRecordStatus(document) === 'Engineering review').length,
      note: 'Linked evidence gaps or governed drafting questions are still under engineering review.',
    },
    {
      stage: 'Available in Egnyte',
      count: availableCount,
      note: 'Approved records can be opened directly from Egnyte with custody traceability intact.',
    },
  ].map((item) => ({
    ...item,
    value: docs.length === 0 ? 0 : Math.round((item.count / docs.length) * 100),
  }))

  const metrics = [
    {
      label: 'Records in custody',
      value: String(docs.length),
      note: 'This view keeps class, manifest progress, linked evidence, and custody visibility in one client-safe workspace.',
    },
    {
      label: 'Manifests under review',
      value: String(manifestReviewed),
      note: 'These records are past basic classification and are waiting on governed engineering review.',
    },
    {
      label: 'Linked evidence chains',
      value: String(linkedTotal),
      note: 'Task orders, invoices, change orders, and supporting proof are tracked as one package instead of isolated files.',
    },
    {
      label: 'Available in Egnyte',
      value: String(availableCount),
      note: 'Only governed records with completed authority steps are shown as available in the source repository.',
    },
  ]

  return (
    <MockupShell
      tone="operations"
      meta={`${district.name} • client operations transparency`}
      title="Operational custody view"
      description="Monitor package completeness, manifest progress, linked evidence coverage, and Egnyte readiness without stepping into drafting or approval authority."
      actions={
        <>
          <Button className="rounded-full bg-[var(--brand-blue)] px-5 text-white hover:bg-[color-mix(in_oklab,var(--brand-blue)_86%,black_14%)]">
            Create package
          </Button>
          <a
            href={docs[0]?.igniteUrl}
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
        </>
      }
      aside={
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-[rgba(0,61,166,0.14)] bg-white px-4 py-4">
            <Activity className="size-4 text-[var(--brand-blue)]" />
            <div>
              <p className="ops-label text-[var(--brand-blue)]">Active district</p>
              <p className="font-ops mt-1 text-sm font-semibold text-[var(--brand-slate)]">
                {district.name}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[rgba(0,61,166,0.14)] bg-[rgba(0,61,166,0.04)] px-3 py-3">
              <p className="ops-label text-[var(--brand-blue)]">Preserved</p>
              <p className="mt-2 font-ops text-sm font-medium text-[var(--brand-slate)]">
                {sourcePreservedCount} records
              </p>
            </div>
            <div className="rounded-xl border border-[rgba(0,61,166,0.14)] bg-[rgba(0,61,166,0.04)] px-3 py-3">
              <p className="ops-label text-[var(--brand-blue)]">Engineering review</p>
              <p className="mt-2 font-ops text-sm font-medium text-[var(--brand-slate)]">
                {manifestReviewed} active
              </p>
            </div>
          </div>
          <p className="font-ops text-sm leading-6 text-[var(--brand-text)]">
            This concept is still client-facing, but it exposes more of the governed
            package mechanics: manifest progress, linked evidence coverage, and
            source preservation in Egnyte.
          </p>
        </div>
      }
    >
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} tone="operations" {...metric} />
        ))}
      </section>

      <UploadDropzone
        tone="operations"
        kicker="Governed package intake"
        title="Create a custody-aware evidence package"
        subtitle="Start a new submission package with class visibility, manifest progress, linked evidence expectations, and Egnyte custody posture visible from the first step."
        primaryActionLabel="Create package"
        secondaryActionLabel="View custody rules"
        points={[
          'Source records land in Egnyte first, then SG DREAM drafts meaning through document and run manifests.',
          'Linked evidence, missing support, and engineering review stay visible without exposing approval actions to clients.',
          'The final client-facing signal is Egnyte availability, not opaque internal processing jargon.',
        ]}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_400px]">
        <Card className="brand-panel rounded-[1.75rem] border-[rgba(0,61,166,0.14)] shadow-none">
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="font-ops text-[2rem] font-semibold tracking-[-0.05em] text-[var(--brand-slate)]">
                Package command center
              </CardTitle>
              <p className="mt-2 font-ops text-sm leading-6 text-[var(--brand-text)]">
                Track custody state, manifest progress, linked evidence, and engineering review in one client-safe table.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
              <div className="relative w-full sm:min-w-[220px] sm:flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--brand-muted)]" />
                <Input
                  defaultValue=""
                  placeholder="Search packages"
                  className="h-11 w-full rounded-full border-[var(--brand-border)] bg-white pl-9"
                />
              </div>
              <Select defaultValue={district.id}>
                <SelectTrigger className="h-11 w-full rounded-full border-[var(--brand-border)] bg-white sm:min-w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={district.id}>{district.name}</SelectItem>
                  <SelectItem value="sterling-md">Sterling Ranch Metro District</SelectItem>
                  <SelectItem value="ridgeview">Sterling Ranch MD4</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="data-table-frame overflow-x-auto overflow-y-hidden rounded-[1.5rem] border border-[var(--brand-border)] bg-white">
              <Table className="data-table-min font-ops">
                <TableHeader>
                  <TableRow className="bg-[rgba(0,61,166,0.04)]">
                    <TableHead>Package</TableHead>
                    <TableHead>Custody</TableHead>
                    <TableHead>Manifest</TableHead>
                    <TableHead>Linked evidence</TableHead>
                    <TableHead>Engineering review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-semibold text-[var(--brand-slate)]">
                            {batch.name}
                          </p>
                          <p className="text-xs text-[var(--brand-muted)]">
                            {batch.documentCount} records via {batch.channel}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge label={getClientFacingBatchStatus(batch)} />
                      </TableCell>
                      <TableCell className="text-[var(--brand-text)]">
                        {getManifestStateLabel(batch.manifestState)}
                      </TableCell>
                      <TableCell className="text-[var(--brand-text)]">
                        {batch.linkedChains} connected chains
                      </TableCell>
                      <TableCell className="text-[var(--brand-muted)]">
                        {batch.exceptionCount === 0 ? 'Clear' : `${batch.exceptionCount} active`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="brand-panel rounded-[1.75rem] border-[rgba(0,61,166,0.14)] shadow-none">
            <CardHeader>
              <CardTitle className="font-ops text-[2rem] font-semibold tracking-[-0.05em] text-[var(--brand-slate)]">
                Document classes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {categoryCounts
                .filter((item) => item.count > 0)
                .map((item) => (
                  <div
                    key={item.documentClass}
                    className="flex items-center justify-between rounded-[1.35rem] border border-[rgba(0,61,166,0.14)] bg-white px-4 py-4"
                  >
                    <p className="font-ops text-sm font-semibold text-[var(--brand-slate)]">
                      {item.label}
                    </p>
                    <span className="font-mono text-xs font-semibold text-[var(--brand-blue)]">
                      {item.count}
                    </span>
                  </div>
                ))}
            </CardContent>
          </Card>

          <Card className="brand-panel rounded-[1.75rem] border-[rgba(0,61,166,0.14)] shadow-none">
            <CardHeader>
              <CardTitle className="font-ops text-[2rem] font-semibold tracking-[-0.05em] text-[var(--brand-slate)]">
                Exception watch
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {exceptionCounts.map((item) => (
                <div
                  key={item.flag}
                  className="flex items-center justify-between rounded-[1.35rem] border border-[rgba(0,61,166,0.14)] bg-[rgba(0,61,166,0.03)] px-4 py-4"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="size-4 text-[var(--brand-blue)]" />
                    <p className="font-ops text-sm font-semibold text-[var(--brand-slate)]">
                      {item.label}
                    </p>
                  </div>
                  <span className="font-mono text-xs font-semibold text-[var(--brand-blue)]">
                    {item.count}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="brand-panel rounded-[1.75rem] border-[rgba(0,61,166,0.14)] shadow-none">
          <CardHeader>
            <CardTitle className="font-ops text-[2rem] font-semibold tracking-[-0.05em] text-[var(--brand-slate)]">
              Client-visible stages
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
            {stagePressure.map((item) => {
              const icon =
                item.stage === 'Engineering review' ? (
                  <ShieldCheck className="size-4 text-[var(--brand-blue)]" />
                ) : item.stage === 'Available in Egnyte' ? (
                  <Link2 className="size-4 text-[var(--brand-blue)]" />
                ) : (
                  <Clock3 className="size-4 text-[var(--brand-blue)]" />
                )

              return (
                <div
                  key={item.stage}
                  className="rounded-[1.35rem] border border-[rgba(0,61,166,0.14)] bg-white px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {icon}
                      <p className="font-ops text-sm font-semibold text-[var(--brand-slate)]">
                        {item.stage}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-semibold text-[var(--brand-muted)]">
                      {item.count} records
                    </span>
                  </div>
                  <Progress value={item.value} className="mt-3 h-2.5 rounded-full" />
                  <p className="mt-3 text-sm leading-6 text-[var(--brand-text)]">
                    {item.note}
                  </p>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card className="brand-panel rounded-[1.75rem] border-[rgba(0,61,166,0.14)] shadow-none">
          <CardHeader>
            <CardTitle className="font-ops text-[2rem] font-semibold tracking-[-0.05em] text-[var(--brand-slate)]">
              Record register
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {docs.map((document) => (
              <article
                key={document.id}
                className="grid grid-cols-1 gap-4 rounded-[1.35rem] border border-[rgba(0,61,166,0.14)] bg-white px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-ops text-sm font-semibold text-[var(--brand-slate)]">
                      {document.organizedName}
                    </p>
                    <StatusBadge label={getClientFacingRecordStatus(document)} />
                    <span className="rounded-full bg-[rgba(0,61,166,0.07)] px-2.5 py-1 text-[0.72rem] font-semibold text-[var(--brand-blue)]">
                      {getDocumentClassLabel(document.documentClass)}
                    </span>
                  </div>
                  <p className="font-mono text-[0.72rem] leading-5 text-[var(--brand-muted)]">
                    Original: {document.originalName} • {document.pageCount} pages • {document.updatedAt}
                  </p>
                  <p className="text-sm leading-6 text-[var(--brand-text)]">
                    {getLinkedRecordSummary(document)}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs text-[var(--brand-muted)]">
                    <span className="rounded-full bg-[rgba(0,61,166,0.04)] px-3 py-1">
                      Manifest {getManifestStateLabel(document.documentManifestState)}
                    </span>
                    <span className="rounded-full bg-[rgba(0,61,166,0.04)] px-3 py-1">
                      Custody path retained
                    </span>
                    {document.linkedRecords.length > 0 ? (
                      <span className="rounded-full bg-[rgba(0,61,166,0.04)] px-3 py-1">
                        {document.linkedRecords.length} linked
                        {document.linkedRecords.length > 1 ? ' records' : ' record'}
                      </span>
                    ) : null}
                  </div>
                  <p className="font-mono text-[0.7rem] leading-5 text-[var(--brand-muted)]">
                    {document.custodyPath}
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
                  Egnyte
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
