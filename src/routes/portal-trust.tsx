import { createFileRoute } from '@tanstack/react-router'
import { ArrowUpRight, Building2 } from 'lucide-react'
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '#/components/ui/tabs'
import {
  districts,
  getBatchesByDistrict,
  getDistrict,
  getDocumentsByDistrict,
  processingStages,
} from '#/lib/mock-data'
import { cn } from '#/lib/utils'

const districtId = 'north-county'
const district = getDistrict(districtId)
const batches = getBatchesByDistrict(districtId)
const docs = getDocumentsByDistrict(districtId)

export const Route = createFileRoute('/portal-trust')({
  head: () => ({
    meta: [{ title: 'Portal Trust | Schedio Group AI' }],
  }),
  component: PortalTrustPage,
})

function PortalTrustPage() {
  const metrics = [
    {
      label: 'Active batches',
      value: String(batches.length),
      note: 'Each upload package stays tied to the right district and original source files.',
    },
    {
      label: 'Documents in motion',
      value: String(docs.length),
      note: 'Clients can understand what has been received, organized, or handed off to Ignite.',
    },
    {
      label: 'Publishing confidence',
      value: '91%',
      note: 'The UI makes it clear where review is still needed before anything looks final.',
    },
  ]

  return (
    <MockupShell
      tone="trust"
      label="Client-facing concept one"
      title="Trust-first upload portal for district clients and shared operator logins."
      description="This direction is the calmest and most guided. It leans into confidence, plain-language intake, visible status, and an obvious handoff back to Ignite once documents are organized."
      badges={[
        'Portal intake',
        'Multi-district routing',
        'Ignite handoff',
      ]}
      sidebar={
        <div className="space-y-4">
          <div>
            <p className="eyebrow">Default district context</p>
            <h2 className="mt-3 font-heading text-2xl font-bold text-[var(--brand-slate)]">
              {district.name}
            </h2>
          </div>
          <p className="text-sm leading-6 text-[var(--brand-muted)]">
            Users can upload for multiple entities, but the experience keeps the
            selected district in view at all times so routing mistakes feel hard
            to make.
          </p>
          <div className="rounded-2xl border border-[var(--brand-border)] bg-white px-4 py-4">
            <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[var(--brand-blue)]">
              Program
            </p>
            <p className="mt-2 text-sm font-semibold text-[var(--brand-slate)]">
              {district.programLabel}
            </p>
            <p className="mt-1 text-sm text-[var(--brand-muted)]">
              Contact: {district.contact}
            </p>
          </div>
        </div>
      }
    >
      <section className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_380px]">
        <UploadDropzone
          title="Upload everything you have without decoding the filing structure first."
          subtitle="The portal frames intake around district context, drag-and-drop simplicity, and the promise that originals stay preserved while the system organizes downstream."
          points={[
            'District stays locked in at upload time, even for shared multi-client users.',
            'Original files remain traceable as the system suggests organized names.',
            'Clients can see progress without needing to understand the back-office workflow.',
          ]}
        />

        <Card className="brand-panel rounded-[1.75rem] border-[var(--brand-border)] shadow-none">
          <CardHeader className="space-y-4">
            <CardTitle className="font-heading text-2xl text-[var(--brand-slate)]">
              Intake context
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
                  <Building2 className="size-4 text-[var(--brand-blue)]" />
                  <p className="text-sm font-semibold text-[var(--brand-slate)]">
                    Routing protections
                  </p>
                </div>
                <ul className="space-y-2 text-sm leading-6 text-[var(--brand-text)]">
                  <li>Selected district is shown above every upload interaction.</li>
                  <li>Multi-district users can switch context intentionally, not implicitly.</li>
                  <li>Portal copy keeps original-file preservation visible.</li>
                </ul>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_420px]">
        <Card className="brand-panel rounded-[1.75rem] border-[var(--brand-border)] shadow-none">
          <CardHeader>
            <CardTitle className="font-heading text-2xl text-[var(--brand-slate)]">
              Submission visibility
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="batches" className="w-full">
              <TabsList className="mb-5 grid h-auto w-full grid-cols-2 rounded-full bg-[rgba(0,61,166,0.05)] p-1">
                <TabsTrigger value="batches" className="rounded-full">
                  Recent batches
                </TabsTrigger>
                <TabsTrigger value="documents" className="rounded-full">
                  Organized documents
                </TabsTrigger>
              </TabsList>

              <TabsContent value="batches" className="space-y-4">
                {batches.map((batch) => (
                  <article
                    key={batch.id}
                    className="rounded-[1.5rem] border border-[var(--brand-border)] bg-white px-4 py-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-[var(--brand-slate)]">
                          {batch.name}
                        </p>
                        <p className="text-sm text-[var(--brand-muted)]">
                          {batch.documentCount} documents uploaded by {batch.submittedBy}
                        </p>
                      </div>
                      <StatusBadge label={batch.status} />
                    </div>
                    <div className="mt-4 space-y-2">
                      <Progress value={batch.progress} className="h-2.5 rounded-full" />
                      <div className="flex items-center justify-between text-xs text-[var(--brand-muted)]">
                        <span>{batch.channel}</span>
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
                    className="rounded-[1.5rem] border border-[var(--brand-border)] bg-white px-4 py-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-[var(--brand-slate)]">
                          {document.organizedName}
                        </p>
                        <p className="text-xs text-[var(--brand-muted)]">
                          Original: {document.originalName}
                        </p>
                      </div>
                      <StatusBadge label={document.status} />
                    </div>
                    <Separator className="my-4 bg-[var(--brand-border)]" />
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1 text-xs text-[var(--brand-muted)]">
                        <p>{document.type}</p>
                        <p>
                          {document.pageCount} pages · {document.source}
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
                        Open in Ignite
                        <ArrowUpRight className="size-4" />
                      </a>
                    </div>
                  </article>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="brand-panel rounded-[1.75rem] border-[var(--brand-border)] shadow-none">
          <CardHeader className="space-y-4">
            <CardTitle className="font-heading text-2xl text-[var(--brand-slate)]">
              Processing narrative
            </CardTitle>
            <p className="text-sm leading-6 text-[var(--brand-muted)]">
              Instead of showing raw system internals, this concept translates
              pipeline stages into a calm status story clients can follow.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {processingStages.map((stage, index) => (
              <div
                key={stage}
                className="flex items-start gap-4 rounded-2xl border border-[var(--brand-border)] bg-white px-4 py-4"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[rgba(0,61,166,0.08)] font-semibold text-[var(--brand-blue)]">
                  {index + 1}
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm font-semibold text-[var(--brand-slate)]">
                      {stage}
                    </p>
                    <StatusBadge
                      label={
                        stage === 'Organizing'
                          ? 'Organizing'
                          : stage === 'Published to Ignite'
                            ? 'Published to Ignite'
                            : 'Indexed'
                      }
                    />
                  </div>
                  <p className="text-sm leading-6 text-[var(--brand-muted)]">
                    {stage === 'Received' &&
                      'Original files land in the right district context before any naming or filing logic runs.'}
                    {stage === 'Classifying' &&
                      'The system identifies document types, flags low-certainty items, and preserves traceability.'}
                    {stage === 'Organizing' &&
                      'Suggested naming, metadata capture, and folder mapping are staged before client access.'}
                    {stage === 'Ready for review' &&
                      'Human review remains visible when something needs confirmation before publish.'}
                    {stage === 'Published to Ignite' &&
                      'Clients can open their organized records in Ignite without losing the portal’s intake visibility.'}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </MockupShell>
  )
}
