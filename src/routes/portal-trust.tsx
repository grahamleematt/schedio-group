import { createFileRoute } from '@tanstack/react-router'
import {
  ArrowUpRight,
  Building2,
  FolderTree,
  ShieldCheck,
  Waypoints,
} from 'lucide-react'
import { MetricCard } from '#/components/metric-card'
import { MockupShell } from '#/components/mockup-shell'
import { StatusBadge } from '#/components/status-badge'
import { UploadDropzone } from '#/components/upload-dropzone'
import { Button, buttonVariants } from '#/components/ui/button'
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
      document.custodyState === 'locked'
  ).length
  const linkedCount = docs.filter((document) => document.linkedRecords.length > 0).length
  const preservedCount = docs.filter((document) => document.sourcePreserved).length

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
          <Button className="rounded-full bg-[var(--brand-blue)] px-5 text-white hover:bg-[color-mix(in_oklab,var(--brand-blue)_86%,black_14%)]">
            New package
          </Button>
          <a
            href={docs[0]?.igniteUrl ?? '#'}
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
          <div>
            <p className="eyebrow">Signed in as</p>
            <h2 className="mt-3 font-heading text-2xl font-bold text-[var(--brand-slate)]">
              Shared client access
            </h2>
            <p className="mt-1 text-sm text-[var(--brand-muted)]">
              3 districts available • immutable source custody
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(0,61,166,0.08)] px-3 py-1 text-xs font-semibold text-[var(--brand-blue)]">
            <ShieldCheck className="size-3.5" />
            Originals preserved in Egnyte
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl border border-[var(--brand-border)] bg-white px-4 py-4">
              <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[var(--brand-blue)]">
                Current district
              </p>
              <p className="mt-2 text-sm font-semibold text-[var(--brand-slate)]">
                {district.name}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--brand-border)] bg-white px-4 py-4">
              <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[var(--brand-blue)]">
                Primary contact
              </p>
              <p className="mt-2 text-sm font-semibold text-[var(--brand-slate)]">
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
          primaryActionLabel="Add package"
          secondaryActionLabel="Custody rules"
          points={[
            'Every upload stays anchored to the selected district before any interpretation or automation happens.',
            'Clients see package progress, class recognition, and evidence-chain visibility without stepping into drafting or approval authority.',
            'Documents remain immutable evidence while governed records and manifests are prepared around them.',
          ]}
        />

        <Card className="brand-panel rounded-[1.75rem] border-[var(--brand-border)] shadow-none">
          <CardHeader className="space-y-4">
            <CardTitle className="font-heading text-2xl text-[var(--brand-slate)]">
              Submission settings
            </CardTitle>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[var(--brand-blue)]">
                  Client or district
                </p>
                <Select defaultValue={district.id}>
                  <SelectTrigger className="mt-2 h-12 rounded-2xl border-[var(--brand-border)] bg-white">
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

              <div className="space-y-3 rounded-2xl border border-[var(--brand-border)] bg-[rgba(0,61,166,0.04)] px-4 py-4">
                <div className="flex items-center gap-3">
                  <FolderTree className="size-4 text-[var(--brand-blue)]" />
                  <p className="text-sm font-semibold text-[var(--brand-slate)]">
                    Submission classes
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {clientDocumentClassOrder.map((documentClass) => (
                    <span
                      key={documentClass}
                      className="rounded-full border border-[rgba(0,61,166,0.12)] bg-white px-3 py-1 text-xs font-semibold text-[var(--brand-slate)]"
                    >
                      {getDocumentClassLabel(documentClass)}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-[var(--brand-border)] bg-white px-4 py-4">
                <div className="flex items-center gap-3">
                  <Building2 className="size-4 text-[var(--brand-blue)]" />
                  <p className="text-sm font-semibold text-[var(--brand-slate)]">
                    Custody lifecycle
                  </p>
                </div>
                <ul className="space-y-2 text-sm leading-6 text-[var(--brand-text)]">
                  <li>Incoming: source record lands in Egnyte custody with the district attached.</li>
                  <li>Processing: SG DREAM drafts manifests, naming, and related record links around the preserved original.</li>
                  <li>Classified: clients can see the package organized by document class while engineering review continues internally when needed.</li>
                </ul>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_380px]">
        <Card className="brand-panel rounded-[1.75rem] border-[var(--brand-border)] shadow-none">
          <CardHeader>
            <CardTitle className="font-heading text-2xl text-[var(--brand-slate)]">
              Recent packages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="batches" className="w-full">
              <TabsList className="mb-5 grid h-auto w-full grid-cols-2 rounded-full bg-[rgba(0,61,166,0.05)] p-1">
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
                    className="rounded-[1.5rem] border border-[var(--brand-border)] bg-white px-4 py-4 sm:px-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-[var(--brand-slate)]">
                          {batch.name}
                        </p>
                        <p className="text-sm text-[var(--brand-muted)]">
                          {batch.documentCount} records uploaded by {batch.submittedBy}
                        </p>
                        <p className="text-sm leading-6 text-[var(--brand-text)]">
                          {batch.note}
                        </p>
                      </div>
                      <StatusBadge label={getClientFacingBatchStatus(batch)} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {batch.documentClasses.map((documentClass) => (
                        <span
                          key={`${batch.id}-${documentClass}`}
                          className="rounded-full bg-[rgba(0,61,166,0.06)] px-3 py-1 text-xs font-semibold text-[var(--brand-blue)]"
                        >
                          {getDocumentClassLabel(documentClass)}
                        </span>
                      ))}
                      <span className="rounded-full bg-[rgba(0,61,166,0.06)] px-3 py-1 text-xs font-semibold text-[var(--brand-blue)]">
                        Manifest {getManifestStateLabel(batch.manifestState)}
                      </span>
                    </div>
                    <div className="mt-4 space-y-2">
                      <Progress value={batch.progress} className="h-2.5 rounded-full" />
                      <div className="flex flex-col gap-1 text-xs text-[var(--brand-muted)] sm:flex-row sm:items-center sm:justify-between">
                        <span>
                          {batch.linkedChains} linked evidence chains • {batch.exceptionCount} issues
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
                    className="rounded-[1.5rem] border border-[var(--brand-border)] bg-white px-4 py-4 sm:px-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-[var(--brand-slate)]">
                            {document.organizedName}
                          </p>
                          <span className="rounded-full bg-[rgba(0,61,166,0.07)] px-2.5 py-1 text-[0.72rem] font-semibold text-[var(--brand-blue)]">
                            {getDocumentClassLabel(document.documentClass)}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--brand-muted)]">
                          Original: {document.originalName}
                        </p>
                      </div>
                      <StatusBadge label={getClientFacingRecordStatus(document)} />
                    </div>
                    <Separator className="my-4 bg-[var(--brand-border)]" />
                    <div className="space-y-3">
                      <p className="text-sm leading-6 text-[var(--brand-text)]">
                        {document.clientOutcome}
                      </p>
                      <div className="flex items-start gap-2 rounded-2xl bg-[rgba(0,61,166,0.04)] px-4 py-3 text-sm text-[var(--brand-text)]">
                        <Waypoints className="mt-0.5 size-4 shrink-0 text-[var(--brand-blue)]" />
                        <p>{getLinkedRecordSummary(document)}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--brand-muted)]">
                      <span className="rounded-full bg-[rgba(0,61,166,0.04)] px-3 py-1">
                        Manifest {getManifestStateLabel(document.documentManifestState)}
                      </span>
                      <span className="rounded-full bg-[rgba(0,61,166,0.04)] px-3 py-1">
                        Source preserved in Egnyte
                      </span>
                    </div>
                    <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1 text-xs text-[var(--brand-muted)]">
                        <p>
                          {document.pageCount} pages • {document.source}
                        </p>
                        <p className="font-mono text-[0.7rem] leading-5">{document.custodyPath}</p>
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
          <Card className="brand-panel rounded-[1.75rem] border-[var(--brand-border)] shadow-none">
            <CardHeader className="space-y-4">
              <CardTitle className="font-heading text-2xl text-[var(--brand-slate)]">
                Records organized by category
              </CardTitle>
              <p className="text-sm leading-6 text-[var(--brand-muted)]">
                Client-safe visibility into what SG DREAM has recognized inside the custody package so far.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {categoryCounts
                .filter((item) => item.count > 0)
                .map((item) => (
                  <div
                    key={item.documentClass}
                    className="flex items-center justify-between rounded-2xl border border-[var(--brand-border)] bg-white px-4 py-4"
                  >
                    <p className="text-sm font-semibold text-[var(--brand-slate)]">
                      {item.label}
                    </p>
                    <span className="rounded-full bg-[rgba(0,61,166,0.08)] px-3 py-1 text-xs font-semibold text-[var(--brand-blue)]">
                      {item.count}
                    </span>
                  </div>
                ))}
            </CardContent>
          </Card>

          <Card className="brand-panel rounded-[1.75rem] border-[var(--brand-border)] shadow-none">
            <CardHeader className="space-y-4">
              <CardTitle className="font-heading text-2xl text-[var(--brand-slate)]">
                Custody visibility
              </CardTitle>
              <p className="text-sm leading-6 text-[var(--brand-muted)]">
                Follow each package from incoming custody through classified records and Egnyte availability.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {clientFacingStages.map((stage, index) => (
                <div
                  key={stage}
                  className="flex items-start gap-4 rounded-2xl border border-[var(--brand-border)] bg-white px-4 py-4 sm:px-5"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[rgba(0,61,166,0.08)] font-semibold text-[var(--brand-blue)]">
                    {index + 1}
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-sm font-semibold text-[var(--brand-slate)]">
                        {stage}
                      </p>
                      <StatusBadge label={stage} />
                    </div>
                    <p className="text-sm leading-6 text-[var(--brand-muted)]">
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
