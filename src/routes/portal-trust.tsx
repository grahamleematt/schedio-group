import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowUpRight,
  ArrowRight,
  Building2,
  FolderTree,
  ShieldCheck,
  Waypoints,
} from 'lucide-react'
import { MetricCard } from '#/components/metric-card'
import { MockupShell } from '#/components/mockup-shell'
import { StatusBadge } from '#/components/status-badge'
import { UploadDropzone } from '#/components/upload-dropzone'
import { buttonVariants } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Progress } from '#/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Separator } from '#/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import {
  clientDocumentClassOrder,
  clientFacingStages,
  districts,
  getBatchesByDistrict,
  getClientFacingBatchStatus,
  getClientFacingRecordStatus,
  getCategoryCountsByDistrict,
  getClientDocumentsByDistrict,
  getDistrict,
  getDocumentClassLabel,
  getLinkedRecordSummary,
  getManifestStateLabel,
} from '#/lib/mock-data'
import { cn } from '#/lib/utils'

const districtId = 'sterling-cab'
const district = getDistrict(districtId)
const batches = getBatchesByDistrict(districtId)
const docs = getClientDocumentsByDistrict(districtId)
const categoryCounts = getCategoryCountsByDistrict(districtId)

export const Route = createFileRoute('/portal-trust')({
  head: () => ({
    meta: [{ title: 'Client Intake | Schedio Group' }],
  }),
  component: PortalTrustPage,
})

function PortalTrustPage() {
  const custodyCount = docs.filter(
    (document) =>
      document.custodyState === 'classified' ||
      document.custodyState === 'relied' ||
      document.custodyState === 'locked',
  ).length
  const linkedCount = docs.filter(
    (document) => document.linkedRecords.length > 0,
  ).length
  const preservedCount = docs.filter(
    (document) => document.sourcePreserved,
  ).length

  const metrics = [
    {
      label: 'Packages in custody',
      value: String(batches.length),
      note: 'Each submission package enters SG DREAM as preserved evidence in Egnyte before meaning is drafted anywhere else.',
    },
    {
      label: 'Classified records',
      value: String(custodyCount),
      note: 'These records have already moved from incoming custody into recognizable document classes.',
    },
    {
      label: 'Preserved originals',
      value: String(preservedCount),
      note: 'Original filenames and custody paths stay attached even after governed names are drafted.',
    },
    {
      label: 'Linked evidence chains',
      value: String(linkedCount),
      note: 'Invoices, task orders, pay applications, and proof records are already being connected into complete packages.',
    },
  ]

  return (
    <MockupShell
      tone="trust"
      meta={`${district.name} • ${district.programLabel}`}
      title="Custody and intake"
      description="Submit evidence packages, preserve originals in Egnyte, and track movement from incoming custody to classified records without exposing internal authority controls."
      actions={
        <>
          <Link
            to="/create-package"
            search={{ source: 'trust', step: 'context' }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground no-underline shadow-sm transition-colors hover:bg-primary-hover"
          >
            <span className="text-primary-foreground">New package</span>
          </Link>
          <a
            href={docs[0]?.igniteUrl ?? '#'}
            target="_blank"
            rel="noreferrer"
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'rounded-full border-border-base bg-surface-panel text-text-strong no-underline',
            )}
          >
            Open in Egnyte
            <ArrowUpRight className="size-4" />
          </a>
        </>
      }
      aside={
        <div className="space-y-4">
          <div>
            <p className="eyebrow">Signed in as</p>
            <h2 className="mt-3 font-heading text-2xl font-bold text-text-strong">
              Shared client access
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              3 districts available • immutable source custody
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-text-accent">
            <ShieldCheck className="size-3.5" />
            Originals preserved in Egnyte
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl border border-border-base bg-surface-panel px-4 py-4">
              <p className="text-xs font-semibold tracking-[0.14em] uppercase text-text-accent">
                Current district
              </p>
              <p className="mt-2 text-sm font-semibold text-text-strong">
                {district.name}
              </p>
            </div>
            <div className="rounded-2xl border border-border-base bg-surface-panel px-4 py-4">
              <p className="text-xs font-semibold tracking-[0.14em] uppercase text-text-accent">
                Primary contact
              </p>
              <p className="mt-2 text-sm font-semibold text-text-strong">
                {district.contact}
              </p>
            </div>
          </div>
        </div>
      }
    >
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} tone="trust" {...metric} />
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_380px]">
        <UploadDropzone
          tone="trust"
          kicker="Guided custody submission"
          title="Add a governed evidence package"
          subtitle="Upload PDFs, scans, spreadsheets, or image exports. SG DREAM preserves the source file in Egnyte first, then drafts document meaning, linked evidence, and governed naming around that preserved record."
          primaryAction={
            <Link
              to="/create-package"
              search={{ source: 'trust', step: 'context' }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground no-underline shadow-sm transition-colors hover:bg-primary-hover"
            >
              <span className="text-primary-foreground">Add package</span>
              <ArrowRight className="size-4 text-primary-foreground" />
            </Link>
          }
          secondaryActionLabel="Custody rules"
          points={[
            'Every upload stays anchored to the selected district before any interpretation or automation happens.',
            'Clients see package progress, class recognition, and evidence-chain visibility without stepping into drafting or approval authority.',
            'Documents remain immutable evidence while governed records and manifests are prepared around them.',
          ]}
        />

        <Card className="brand-panel rounded-[1.75rem] border-border-base shadow-none">
          <CardHeader className="space-y-4">
            <CardTitle className="font-heading text-2xl text-text-strong">
              Submission settings
            </CardTitle>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] uppercase text-text-accent">
                  Client or district
                </p>
                <Select defaultValue={district.id}>
                  <SelectTrigger className="mt-2 h-12 rounded-2xl border-border-base bg-surface-panel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {districts.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 rounded-2xl border border-border-base bg-surface-muted px-4 py-4">
                <div className="flex items-center gap-3">
                  <FolderTree className="size-4 text-text-accent" />
                  <p className="text-sm font-semibold text-text-strong">
                    Submission classes
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {clientDocumentClassOrder.map((documentClass) => (
                    <span
                      key={documentClass}
                      className="rounded-full border border-border-strong bg-surface-panel px-3 py-1 text-xs font-semibold text-text-strong"
                    >
                      {getDocumentClassLabel(documentClass)}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-border-base bg-surface-panel px-4 py-4">
                <div className="flex items-center gap-3">
                  <Building2 className="size-4 text-text-accent" />
                  <p className="text-sm font-semibold text-text-strong">
                    Custody lifecycle
                  </p>
                </div>
                <ul className="space-y-2 text-sm leading-6 text-text-base">
                  <li>
                    Incoming: source record lands in Egnyte custody with the
                    district attached.
                  </li>
                  <li>
                    Processing: SG DREAM drafts manifests, naming, and related
                    record links around the preserved original.
                  </li>
                  <li>
                    Classified: clients can see the package organized by
                    document class while engineering review continues internally
                    when needed.
                  </li>
                </ul>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_380px]">
        <Card className="brand-panel rounded-[1.75rem] border-border-base shadow-none">
          <CardHeader>
            <CardTitle className="font-heading text-2xl text-text-strong">
              Recent packages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="batches" className="w-full">
              <TabsList className="mb-5 grid h-auto w-full grid-cols-2 rounded-full bg-surface-hover p-1">
                <TabsTrigger value="batches" className="rounded-full">
                  Submission packages
                </TabsTrigger>
                <TabsTrigger value="documents" className="rounded-full">
                  Governed records
                </TabsTrigger>
              </TabsList>

              <TabsContent value="batches" className="space-y-4">
                {batches.map((batch) => (
                  <article
                    key={batch.id}
                    className="rounded-[1.5rem] border border-border-base bg-surface-panel px-4 py-4 sm:px-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-text-strong">
                          {batch.name}
                        </p>
                        <p className="text-sm text-text-muted">
                          {batch.documentCount} records uploaded by{' '}
                          {batch.submittedBy}
                        </p>
                        <p className="text-sm leading-6 text-text-base">
                          {batch.note}
                        </p>
                      </div>
                      <StatusBadge label={getClientFacingBatchStatus(batch)} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {batch.documentClasses.map((documentClass) => (
                        <span
                          key={`${batch.id}-${documentClass}`}
                          className="rounded-full bg-status-success-bg px-3 py-1 text-xs font-semibold text-text-accent"
                        >
                          {getDocumentClassLabel(documentClass)}
                        </span>
                      ))}
                      <span className="rounded-full bg-status-success-bg px-3 py-1 text-xs font-semibold text-text-accent">
                        Manifest {getManifestStateLabel(batch.manifestState)}
                      </span>
                    </div>
                    <div className="mt-4 space-y-2">
                      <Progress
                        value={batch.progress}
                        className="h-2.5 rounded-full"
                      />
                      <div className="flex flex-col gap-1 text-xs text-text-muted sm:flex-row sm:items-center sm:justify-between">
                        <span>
                          {batch.linkedChains} linked evidence chains •{' '}
                          {batch.exceptionCount} issues
                        </span>
                        <span>{batch.submittedAt}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </TabsContent>

              <TabsContent value="documents" className="space-y-4">
                {docs.map((document) => (
                  <article
                    key={document.id}
                    className="rounded-[1.5rem] border border-border-base bg-surface-panel px-4 py-4 sm:px-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-text-strong">
                            {document.organizedName}
                          </p>
                          <span className="rounded-full bg-primary-softer px-2.5 py-1 text-[0.72rem] font-semibold text-text-accent">
                            {getDocumentClassLabel(document.documentClass)}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted">
                          Original: {document.originalName}
                        </p>
                      </div>
                      <StatusBadge
                        label={getClientFacingRecordStatus(document)}
                      />
                    </div>
                    <Separator className="my-4 bg-border-base" />
                    <div className="space-y-3">
                      <p className="text-sm leading-6 text-text-base">
                        {document.clientOutcome}
                      </p>
                      <div className="flex items-start gap-2 rounded-2xl bg-surface-muted px-4 py-3 text-sm text-text-base">
                        <Waypoints className="mt-0.5 size-4 shrink-0 text-text-accent" />
                        <p>{getLinkedRecordSummary(document)}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-text-muted">
                      <span className="rounded-full bg-surface-muted px-3 py-1">
                        Manifest{' '}
                        {getManifestStateLabel(document.documentManifestState)}
                      </span>
                      <span className="rounded-full bg-surface-muted px-3 py-1">
                        Source preserved in Egnyte
                      </span>
                    </div>
                    <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1 text-xs text-text-muted">
                        <p>
                          {document.pageCount} pages • {document.source}
                        </p>
                        <p className="font-mono text-[0.7rem] leading-5">
                          {document.custodyPath}
                        </p>
                      </div>
                      <a
                        href={document.igniteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          buttonVariants({ variant: 'outline' }),
                          'rounded-full border-border-base bg-surface-panel text-text-strong no-underline',
                        )}
                      >
                        Open in Egnyte
                        <ArrowUpRight className="size-4" />
                      </a>
                    </div>
                  </article>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="brand-panel rounded-[1.75rem] border-border-base shadow-none">
            <CardHeader className="space-y-4">
              <CardTitle className="font-heading text-2xl text-text-strong">
                Records organized by category
              </CardTitle>
              <p className="text-sm leading-6 text-text-muted">
                Client-safe visibility into what SG DREAM has recognized inside
                the custody package so far.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {categoryCounts
                .filter((item) => item.count > 0)
                .map((item) => (
                  <div
                    key={item.documentClass}
                    className="flex items-center justify-between rounded-2xl border border-border-base bg-surface-panel px-4 py-4"
                  >
                    <p className="text-sm font-semibold text-text-strong">
                      {item.label}
                    </p>
                    <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-text-accent">
                      {item.count}
                    </span>
                  </div>
                ))}
            </CardContent>
          </Card>

          <Card className="brand-panel rounded-[1.75rem] border-border-base shadow-none">
            <CardHeader className="space-y-4">
              <CardTitle className="font-heading text-2xl text-text-strong">
                Custody visibility
              </CardTitle>
              <p className="text-sm leading-6 text-text-muted">
                Follow each package from incoming custody through classified
                records and Egnyte availability.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {clientFacingStages.map((stage, index) => (
                <div
                  key={stage}
                  className="flex items-start gap-4 rounded-2xl border border-border-base bg-surface-panel px-4 py-4 sm:px-5"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-text-accent">
                    {index + 1}
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-sm font-semibold text-text-strong">
                        {stage}
                      </p>
                      <StatusBadge label={stage} />
                    </div>
                    <p className="text-sm leading-6 text-text-muted">
                      {stage === 'Incoming' &&
                        'The source package lands in Egnyte custody with district context attached and originals preserved exactly as submitted.'}
                      {stage === 'Processing' &&
                        'SG DREAM drafts manifests, linked evidence chains, and governed names around the preserved source files.'}
                      {stage === 'Classified' &&
                        'Records are recognizable by document class and visible in the package without exposing internal drafting details.'}
                      {stage === 'Engineering review' &&
                        'A client can see that the package is still under governed engineering review for missing support, rationale, or authority checks.'}
                      {stage === 'Available in Egnyte' &&
                        'The governed record is ready to open from Egnyte with its source path, original filename, and evidence chain preserved.'}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </MockupShell>
  )
}
