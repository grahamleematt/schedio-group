import { createFileRoute } from '@tanstack/react-router'
import { ArrowUpRight, Bot, Search, Shield, Waypoints } from 'lucide-react'
import { MetricCard } from '#/components/metric-card'
import { MockupShell } from '#/components/mockup-shell'
import { StatusBadge } from '#/components/status-badge'
import { Button, buttonVariants } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { ScrollArea } from '#/components/ui/scroll-area'
import { Separator } from '#/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { documents, getDistrict, reviewItems } from '#/lib/mock-data'
import { cn } from '#/lib/utils'

const activeReview = reviewItems[0]
const activeDocument = documents.find(
  (document) => document.id === activeReview.recordId
)
const activeDistrict = getDistrict(activeReview.districtId)

export const Route = createFileRoute('/review-console')({
  head: () => ({
    meta: [{ title: 'Review Console | Schedio Group AI' }],
  }),
  component: ReviewConsolePage,
})

function ReviewConsolePage() {
  const metrics = [
    {
      label: 'Queue requiring attention',
      value: '4',
      note: 'Low-confidence scans and rename suggestions stay visible to the people signing off.',
    },
    {
      label: 'Traceability retained',
      value: '100%',
      note: 'Original filenames, organized names, and Ignite publish paths remain connected.',
    },
    {
      label: 'Published today',
      value: '12',
      note: 'Review is shown as a controlled checkpoint, not something hidden inside the automation.',
    },
  ]

  return (
    <MockupShell
      tone="review"
      label="Internal concept"
      title="Review console for audit-friendly human oversight before publish."
      description="This route shows the internal side Tim alluded to: not an opaque black box, but a reviewable queue where suggested naming, traceability, and Ignite handoff remain legible."
      badges={['Internal only', 'Human review', 'Traceability first']}
      sidebar={
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-[0.12em] uppercase text-white">
            <Shield className="size-3.5" />
            PE-safe framing
          </div>
          <p className="text-sm leading-6 text-white/78">
            The UI makes it clear that automation proposes, but people still
            confirm anything low-confidence before it reads as final.
          </p>
        </div>
      }
    >
      <section className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} tone="operations" {...metric} />
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_380px]">
        <Card className="rounded-[1.75rem] border-white/10 bg-white/95 shadow-none">
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="font-heading text-2xl text-[var(--brand-slate)]">
                Review queue
              </CardTitle>
              <p className="mt-2 text-sm leading-6 text-[var(--brand-muted)]">
                Suggested naming, confidence, and publish readiness in one place.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
              <div className="relative w-full sm:min-w-[220px] sm:flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--brand-muted)]" />
                <Input
                  defaultValue=""
                  placeholder="Search document queue"
                  className="h-11 w-full rounded-full border-[var(--brand-border)] bg-white pl-9"
                />
              </div>
              <Select defaultValue={activeDistrict.id}>
                <SelectTrigger className="h-11 w-full rounded-full border-[var(--brand-border)] bg-white sm:min-w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={activeDistrict.id}>{activeDistrict.name}</SelectItem>
                  <SelectItem value="brazos-basin">Brazos Basin Drainage District</SelectItem>
                  <SelectItem value="gulf-harbor">Gulf Harbor School Facilities</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="data-table-frame overflow-hidden rounded-[1.5rem] border border-[var(--brand-border)]">
              <Table className="data-table-min font-ops">
                <TableHeader>
                  <TableRow className="bg-[rgba(0,61,166,0.04)]">
                    <TableHead>Document</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviewItems.map((item) => {
                    const record = documents.find((document) => document.id === item.recordId)

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <p className="font-semibold text-[var(--brand-slate)]">
                              {record?.organizedName}
                            </p>
                            <p className="text-xs text-[var(--brand-muted)]">
                              {record?.originalName}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{Math.round(item.confidence * 100)}%</TableCell>
                        <TableCell>
                          <StatusBadge label={item.status} />
                        </TableCell>
                        <TableCell className="max-w-[280px] text-[var(--brand-muted)]">
                          {item.reason}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border-white/12 bg-white/8 text-white shadow-none">
          <CardHeader className="space-y-3">
            <CardTitle className="font-heading text-2xl text-white">
              Review principles
            </CardTitle>
            <p className="text-sm leading-6 text-white/72">
              The console explains why something is waiting, not just that it is waiting.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-white/82">
            <div className="rounded-2xl border border-white/12 bg-white/6 px-4 py-4">
              <div className="flex items-center gap-3">
                <Bot className="size-4 text-white" />
                Suggestions are drafts until someone approves them.
              </div>
            </div>
            <div className="rounded-2xl border border-white/12 bg-white/6 px-4 py-4">
              <div className="flex items-center gap-3">
                <Waypoints className="size-4 text-white" />
                Original and organized records remain linked for audit purposes.
              </div>
            </div>
            <div className="rounded-2xl border border-white/12 bg-white/6 px-4 py-4">
              <div className="flex items-center gap-3">
                <Shield className="size-4 text-white" />
                Publish to Ignite should be visible as a deliberate last step.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="rounded-[1.75rem] border-[var(--brand-border)] bg-white shadow-none">
          <CardHeader>
            <CardTitle className="font-heading text-2xl text-[var(--brand-slate)]">
              Active review item
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-[1.5rem] border border-[var(--brand-border)] bg-[rgba(0,61,166,0.04)] px-4 py-4">
              <p className="text-xs font-semibold tracking-[0.12em] uppercase text-[var(--brand-blue)]">
                District
              </p>
              <p className="mt-2 text-sm font-semibold text-[var(--brand-slate)]">
                {activeDistrict.name}
              </p>
              <p className="mt-1 text-sm text-[var(--brand-muted)]">
                {activeDistrict.programLabel}
              </p>
            </div>

            <ScrollArea className="h-[320px] rounded-[1.5rem] border border-[var(--brand-border)] bg-white">
              <div className="space-y-4 p-4">
                <div>
                  <p className="text-xs font-semibold tracking-[0.12em] uppercase text-[var(--brand-blue)]">
                    Original filename
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--brand-slate)]">
                    {activeDocument?.originalName}
                  </p>
                </div>
                <Separator className="bg-[var(--brand-border)]" />
                <div>
                  <p className="text-xs font-semibold tracking-[0.12em] uppercase text-[var(--brand-blue)]">
                    Suggested organized name
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--brand-slate)]">
                    {activeDocument?.organizedName}
                  </p>
                </div>
                <Separator className="bg-[var(--brand-border)]" />
                <div>
                  <p className="text-xs font-semibold tracking-[0.12em] uppercase text-[var(--brand-blue)]">
                    Review reason
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--brand-text)]">
                    {activeReview.reason}
                  </p>
                </div>
              </div>
            </ScrollArea>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button className="rounded-full bg-[var(--brand-blue)] text-white hover:bg-[color-mix(in_oklab,var(--brand-blue)_86%,black_14%)]">
                Mark ready
              </Button>
              <a
                href={activeDocument?.igniteUrl}
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
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border-[var(--brand-border)] bg-white shadow-none">
          <CardHeader>
            <CardTitle className="font-heading text-2xl text-[var(--brand-slate)]">
              Traceability detail
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="metadata" className="w-full">
              <TabsList className="mb-5 grid h-auto w-full grid-cols-2 rounded-full bg-[rgba(0,61,166,0.05)] p-1">
                <TabsTrigger value="metadata" className="rounded-full">
                  Metadata
                </TabsTrigger>
                <TabsTrigger value="audit" className="rounded-full">
                  Audit chain
                </TabsTrigger>
              </TabsList>

              <TabsContent value="metadata">
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    ['Document type', activeDocument?.type ?? 'Unknown'],
                    ['Source', activeDocument?.source ?? 'Unknown'],
                    ['Page count', `${activeDocument?.pageCount ?? 0}`],
                    ['Reviewer', activeReview.reviewer],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-[1.5rem] border border-[var(--brand-border)] bg-white px-4 py-4"
                    >
                      <p className="text-xs font-semibold tracking-[0.12em] uppercase text-[var(--brand-blue)]">
                        {label}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-[var(--brand-slate)]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="audit">
                <div className="space-y-4">
                  {[
                    'Original upload retained as uploaded by client.',
                    'Suggested rename generated and held for review.',
                    'Reviewer confirms low-certainty signature page handling.',
                    'Publish event hands off organized record to Ignite.',
                  ].map((step, index) => (
                    <div
                      key={step}
                      className="flex items-start gap-4 rounded-[1.5rem] border border-[var(--brand-border)] bg-white px-4 py-4"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[rgba(0,61,166,0.08)] font-semibold text-[var(--brand-blue)]">
                        {index + 1}
                      </div>
                      <p className="text-sm leading-6 text-[var(--brand-text)]">{step}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </MockupShell>
  )
}
