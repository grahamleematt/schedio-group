import { Link, createFileRoute } from '@tanstack/react-router'
import type {
  CreatePackageSourceContext,
  CreatePackageStep,
} from '#/lib/mock-data'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  FileStack,
  FolderTree,
  Link2,
  ShieldCheck,
} from 'lucide-react'
import { MetricCard } from '#/components/metric-card'
import { MockupShell } from '#/components/mockup-shell'
import { StatusBadge } from '#/components/status-badge'
import { UploadDropzone } from '#/components/upload-dropzone'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Progress } from '#/components/ui/progress'
import { Separator } from '#/components/ui/separator'
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
  createPackageDraft,
  createPackageSteps,
  districts,
  getCreatePackageSourceLabel,
  getCreatePackageStepLabel,
  getCustodyStateLabel,
  getDistrict,
  getDocumentById,
  getDocumentClassLabel,
  getExceptionFlagLabel,
  getLinkedRecordSummary,
} from '#/lib/mock-data'
import { cn } from '#/lib/utils'

const stepSet = new Set<CreatePackageStep>(createPackageSteps)
const sourceSet = new Set<CreatePackageSourceContext>(['trust', 'operations'])

export const Route = createFileRoute('/create-package')({
  validateSearch: (search: Record<string, unknown>) => ({
    source:
      typeof search.source === 'string' &&
      sourceSet.has(search.source as CreatePackageSourceContext)
        ? (search.source as CreatePackageSourceContext)
        : undefined,
    step:
      typeof search.step === 'string' &&
      stepSet.has(search.step as CreatePackageStep)
        ? (search.step as CreatePackageStep)
        : undefined,
  }),
  head: () => ({
    meta: [{ title: 'Create Package | Schedio Group' }],
  }),
  component: CreatePackagePage,
})

const sourceProfiles: Record<
  CreatePackageSourceContext,
  {
    tone: 'trust' | 'operations'
    meta: string
    description: string
    asideTitle: string
    asideCopy: string
    backTo: '/portal-trust' | '/portal-operations'
    backLabel: string
  }
> = {
  trust: {
    tone: 'trust',
    meta: 'Client Intake launch • guided custody submission',
    description:
      'Start a new evidence package with calm, client-safe guidance. SG DREAM preserves every source file in Egnyte first, then recognizes classes, linked evidence expectations, and engineering review needs around that preserved package.',
    asideTitle: 'Client-safe intake',
    asideCopy:
      'This version favors reassurance and clarity. The client sees what is being submitted, how it will be preserved, and what signals they can expect once the package enters custody.',
    backTo: '/portal-trust',
    backLabel: 'Back to Client Intake',
  },
  operations: {
    tone: 'operations',
    meta: 'Client Operations launch • visibility-first package setup',
    description:
      'Start a new evidence package with class, linked evidence, and engineering review expectations visible from the first step. The flow is still client-facing, but it shows more operational posture from the start.',
    asideTitle: 'Operations visibility',
    asideCopy:
      'This version emphasizes package completeness, linked evidence expectations, and the client-safe status signals that will appear once the package is in motion.',
    backTo: '/portal-operations',
    backLabel: 'Back to Client Operations',
  },
}

function CreatePackagePage() {
  const search = Route.useSearch()
  const source = search.source ?? 'trust'
  const step = search.step ?? 'context'
  const profile = sourceProfiles[source]
  const district = getDistrict(createPackageDraft.districtId)
  const selectedClasses = createPackageDraft.expectedClasses.filter(
    (item) => item.selected
  )
  const draftedFiles = createPackageDraft.files.flatMap((file) => {
    const record = getDocumentById(file.recordId)

    return record ? [{ file, record }] : []
  })
  const currentStepIndex = createPackageSteps.indexOf(step)
  const progressValue =
    ((currentStepIndex + 1) / createPackageSteps.length) * 100
  const metrics = [
    {
      label: 'Expected classes',
      value: String(selectedClasses.length),
      note: 'This package intentionally spans multiple SG DREAM evidence classes from the start.',
    },
    {
      label: 'Uploaded files',
      value: String(draftedFiles.length),
      note: 'Real SG DREAM-style source files are staged here to make the walkthrough feel like a live intake flow.',
    },
    {
      label: 'Package watchlist',
      value: String(createPackageDraft.warnings.length),
      note: 'Anomalies are surfaced as client-safe warnings without exposing internal drafting or approval controls.',
    },
    {
      label: 'Starting custody',
      value: getCustodyStateLabel(createPackageDraft.startingState),
      note: 'The package is confirmed as Incoming once the source files are preserved in Egnyte.',
    },
  ]

  return (
    <MockupShell
      tone={profile.tone}
      meta={`${district.name} • ${profile.meta}`}
      title="Create a package"
      description={profile.description}
      actions={
        <Button
          asChild
          variant="outline"
          className="rounded-full border-border-base bg-surface-panel text-text-strong"
        >
          <Link to={profile.backTo}>
            <ArrowLeft className="size-4" />
            {profile.backLabel}
          </Link>
        </Button>
      }
      aside={
        <div className="space-y-4">
          <div>
            <p className={profile.tone === 'operations' ? 'ops-label' : 'eyebrow'}>
              Launched from {getCreatePackageSourceLabel(source)}
            </p>
            <h2
              className={cn(
                'mt-3 text-2xl font-bold text-text-strong',
                profile.tone === 'operations' ? 'font-ops' : 'font-heading'
              )}
            >
              {profile.asideTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              {profile.asideCopy}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl border border-border-base bg-surface-panel px-4 py-4">
              <p className="text-xs font-semibold tracking-[0.14em] uppercase text-text-accent">
                District
              </p>
              <p className="mt-2 text-sm font-semibold text-text-strong">
                {district.name}
              </p>
            </div>
            <div className="rounded-2xl border border-border-base bg-surface-panel px-4 py-4">
              <p className="text-xs font-semibold tracking-[0.14em] uppercase text-text-accent">
                Custody promise
              </p>
              <p className="mt-2 text-sm font-semibold text-text-strong">
                Originals preserved in Egnyte
              </p>
            </div>
          </div>
        </div>
      }
    >
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} tone={profile.tone} {...metric} />
        ))}
      </section>

      <Card className="brand-panel rounded-[1.75rem] border-border-base shadow-none">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle
                className={cn(
                  'text-[1.7rem] font-semibold tracking-[-0.04em] text-text-strong',
                  profile.tone === 'operations' ? 'font-ops' : 'font-heading'
                )}
              >
                4-step package flow
              </CardTitle>
              <p className="mt-2 text-sm leading-6 text-text-base">
                Step {currentStepIndex + 1} of {createPackageSteps.length}:{' '}
                {getCreatePackageStepLabel(step)}
              </p>
            </div>
            <StatusBadge label={getCustodyStateLabel(createPackageDraft.startingState)} />
          </div>
          <Progress value={progressValue} className="h-2.5 rounded-full" />
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {createPackageSteps.map((wizardStep, index) => {
            const isCurrent = wizardStep === step
            const isComplete = index < currentStepIndex

            return (
              <Link
                key={wizardStep}
                to="/create-package"
                search={{ source, step: wizardStep }}
                className={cn(
                  'rounded-[1.35rem] border px-4 py-4 no-underline transition-colors',
                  isCurrent
                    ? 'border-border-focus bg-surface-active text-text-accent'
                    : isComplete
                      ? 'border-border-strong bg-surface-muted text-text-strong'
                      : 'border-border-base bg-surface-panel text-text-muted hover:border-border-strong hover:bg-surface-hover'
                )}
              >
                <p className="text-xs font-semibold tracking-[0.14em] uppercase">
                  Step {index + 1}
                </p>
                <p className="mt-2 text-sm font-semibold">
                  {getCreatePackageStepLabel(wizardStep)}
                </p>
              </Link>
            )
          })}
        </CardContent>
      </Card>

      {step === 'context' ? (
        <PackageContextStep source={source} />
      ) : step === 'files' ? (
        <PackageFilesStep source={source} draftedFiles={draftedFiles} />
      ) : step === 'review' ? (
        <PackageReviewStep source={source} draftedFiles={draftedFiles} />
      ) : (
        <PackageConfirmStep source={source} />
      )}
    </MockupShell>
  )
}

function PackageContextStep({
  source,
}: {
  source: CreatePackageSourceContext
}) {
  const district = getDistrict(createPackageDraft.districtId)
  const tone = sourceProfiles[source].tone

  return (
    <>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_380px]">
        <Card className="brand-panel rounded-[1.75rem] border-border-base shadow-none">
          <CardHeader>
            <CardTitle
              className={cn(
                'text-[2rem] font-semibold tracking-[-0.05em] text-text-strong',
                tone === 'operations' ? 'font-ops' : 'font-heading'
              )}
            >
              Package context
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <LabeledField label="Package name">
              <Input
                defaultValue={createPackageDraft.packageName}
                className="h-12 rounded-[1.15rem] border-border-base bg-surface-panel"
              />
            </LabeledField>

            <LabeledField label="Client or district">
              <Select defaultValue={district.id}>
                <SelectTrigger className="h-12 rounded-[1.15rem] border-border-base bg-surface-panel">
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
            </LabeledField>

            <LabeledField label="Submission channel">
              <Select defaultValue={createPackageDraft.submissionChannel}>
                <SelectTrigger className="h-12 rounded-[1.15rem] border-border-base bg-surface-panel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Client custody submission">
                    Client custody submission
                  </SelectItem>
                  <SelectItem value="Egnyte intake folder">
                    Egnyte intake folder
                  </SelectItem>
                  <SelectItem value="Shared client upload">
                    Shared client upload
                  </SelectItem>
                </SelectContent>
              </Select>
            </LabeledField>

            <LabeledField label="Package label">
              <Input
                defaultValue={createPackageDraft.packageLabel}
                className="h-12 rounded-[1.15rem] border-border-base bg-surface-panel"
              />
            </LabeledField>

            <LabeledField label="Package purpose" className="md:col-span-2">
              <textarea
                defaultValue={createPackageDraft.purpose}
                className="min-h-28 w-full rounded-[1.15rem] border border-border-base bg-surface-panel px-4 py-3 text-sm leading-6 text-text-base outline-none transition focus:border-border-focus focus:ring-4 focus:ring-ring/30"
              />
            </LabeledField>

            <LabeledField label="Client-safe notes" className="md:col-span-2">
              <textarea
                defaultValue={createPackageDraft.description}
                className="min-h-32 w-full rounded-[1.15rem] border border-border-base bg-surface-panel px-4 py-3 text-sm leading-6 text-text-base outline-none transition focus:border-border-focus focus:ring-4 focus:ring-ring/30"
              />
            </LabeledField>
          </CardContent>
        </Card>

        <Card className="brand-panel rounded-[1.75rem] border-border-base shadow-none">
          <CardHeader>
            <CardTitle
              className={cn(
                'text-[2rem] font-semibold tracking-[-0.05em] text-text-strong',
                tone === 'operations' ? 'font-ops' : 'font-heading'
              )}
            >
              Expected classes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {createPackageDraft.expectedClasses.map((item) => (
              <button
                key={item.documentClass}
                type="button"
                className={cn(
                  'w-full rounded-[1.25rem] border px-4 py-4 text-left',
                  item.selected
                    ? 'border-border-focus bg-surface-active'
                    : 'border-border-base bg-surface-panel'
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-text-strong">
                    {getDocumentClassLabel(item.documentClass)}
                  </p>
                  {item.selected ? (
                    <StatusBadge label="Category recognized" />
                  ) : (
                    <span className="rounded-full border border-border-base bg-surface-muted px-3 py-1 text-xs font-semibold text-text-muted">
                      Optional
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-6 text-text-base">{item.note}</p>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <WizardFooter
        source={source}
        step="context"
        nextLabel="Continue to source files"
      />
    </>
  )
}

function PackageFilesStep({
  source,
  draftedFiles,
}: {
  source: CreatePackageSourceContext
  draftedFiles: Array<{
    file: (typeof createPackageDraft.files)[number]
    record: NonNullable<ReturnType<typeof getDocumentById>>
  }>
}) {
  return (
    <>
      <UploadDropzone
        tone={sourceProfiles[source].tone}
        kicker="Package file intake"
        title="Stage source files into custody"
        subtitle="This mock keeps the uploaded files static, but the flow should feel like a real package intake. Every source file lands in Egnyte custody first, then SG DREAM recognizes class, linked evidence expectations, and client-safe warnings."
        primaryAction={
          <Button className="rounded-full bg-primary text-primary-foreground px-5 hover:bg-primary-hover">
            Add more source files
          </Button>
        }
        secondaryAction={
          <Button
            variant="outline"
            className="rounded-full border-border-base bg-surface-panel px-5 text-text-strong"
          >
            Review package rules
          </Button>
        }
        points={[
          'Original filenames stay visible even when SG DREAM drafts governed meaning around them.',
          'Class recognition and light warnings appear before any internal drafting or approval work begins.',
          'Clients can see evidence-chain expectations without stepping into governance controls.',
        ]}
      />

      <Card className="brand-panel rounded-[1.75rem] border-border-base shadow-none">
        <CardHeader>
          <CardTitle
            className={cn(
              'text-[2rem] font-semibold tracking-[-0.05em] text-text-strong',
              sourceProfiles[source].tone === 'operations' ? 'font-ops' : 'font-heading'
            )}
          >
            Uploaded source files
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="data-table-frame overflow-x-auto overflow-y-hidden rounded-[1.5rem] border border-border-base bg-surface-panel">
            <Table className="data-table-min">
              <TableHeader>
                <TableRow className="bg-surface-muted">
                  <TableHead>Source file</TableHead>
                  <TableHead>Recognized class</TableHead>
                  <TableHead>Linked evidence expectation</TableHead>
                  <TableHead>Package watch</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draftedFiles.map(({ file, record }) => (
                  <TableRow key={file.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-text-strong">
                          {record.originalName}
                        </p>
                        <p className="font-mono text-[0.72rem] text-text-muted">
                          {record.pageCount} pages • preserved in Egnyte
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <span className="inline-flex rounded-full bg-surface-active px-3 py-1 text-xs font-semibold text-text-accent">
                          {getDocumentClassLabel(record.documentClass)}
                        </span>
                        <div>
                          <StatusBadge label="Category recognized" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm leading-6 text-text-base">
                      {file.linkedExpectation}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-border-base bg-surface-muted px-3 py-1 text-xs font-semibold text-text-strong">
                          Source preserved
                        </span>
                        {file.warningFlags.length > 0 ? (
                          file.warningFlags.map((flag) => (
                            <span
                              key={flag}
                              className="rounded-full bg-[rgba(194,65,12,0.08)] px-3 py-1 text-xs font-semibold text-[#c2410c]"
                            >
                              {getExceptionFlagLabel(flag)}
                            </span>
                          ))
                        ) : (
                          <StatusBadge label="Relationship identified" />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <WizardFooter
        source={source}
        step="files"
        nextLabel="Review package"
      />
    </>
  )
}

function PackageReviewStep({
  source,
  draftedFiles,
}: {
  source: CreatePackageSourceContext
  draftedFiles: Array<{
    file: (typeof createPackageDraft.files)[number]
    record: NonNullable<ReturnType<typeof getDocumentById>>
  }>
}) {
  const tone = sourceProfiles[source].tone

  return (
    <>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          tone={tone}
          label="Selected classes"
          value={String(
            createPackageDraft.expectedClasses.filter((item) => item.selected).length
          )}
          note="The package is intentionally broad enough to show SG DREAM class recognition and linked evidence expectations in one flow."
        />
        <MetricCard
          tone={tone}
          label="Uploaded files"
          value={String(draftedFiles.length)}
          note="This walkthrough uses archive-backed SG DREAM-style source files instead of generic placeholders."
        />
        <MetricCard
          tone={tone}
          label="Linked chain cue"
          value="1 ready"
          note="The task-order-to-invoice-to-proof example shows how SG DREAM connects records into a complete evidence chain."
        />
        <MetricCard
          tone={tone}
          label="Needs review watch"
          value={String(createPackageDraft.warnings.length)}
          note="These client-safe warnings signal what will likely remain in engineering review after the package enters custody."
        />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_380px]">
        <Card className="brand-panel rounded-[1.75rem] border-border-base shadow-none">
          <CardHeader>
            <CardTitle
              className={cn(
                'text-[2rem] font-semibold tracking-[-0.05em] text-text-strong',
                tone === 'operations' ? 'font-ops' : 'font-heading'
              )}
            >
              Package review
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-[1.35rem] border border-border-base bg-surface-panel px-4 py-4">
              <p className="text-xs font-semibold tracking-[0.14em] uppercase text-text-accent">
                Package summary
              </p>
              <p className="mt-2 text-sm font-semibold text-text-strong">
                {createPackageDraft.packageName}
              </p>
              <p className="mt-2 text-sm leading-6 text-text-base">
                {createPackageDraft.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusBadge label="Category recognized" />
                <StatusBadge label="Relationship identified" />
                <StatusBadge label="Engineering review" />
                <StatusBadge label={getCustodyStateLabel(createPackageDraft.startingState)} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Link2 className="size-4 text-text-accent" />
                <p className="text-sm font-semibold text-text-strong">
                  Linked evidence expectation
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)_32px_minmax(0,1fr)]">
                {createPackageDraft.linkedEvidenceChain.map((entry, index) => (
                  <div key={entry} className="contents">
                    <div className="rounded-[1.25rem] border border-border-base bg-surface-panel px-4 py-4">
                      <p className="text-xs font-semibold tracking-[0.12em] uppercase text-text-accent">
                        {index === 0
                          ? 'Task order'
                          : index === 1
                            ? 'Invoice'
                            : 'Proof'}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-text-strong">
                        {entry}
                      </p>
                    </div>
                    {index < createPackageDraft.linkedEvidenceChain.length - 1 ? (
                      <div className="hidden items-center justify-center md:flex">
                        <ArrowRight className="size-4 text-text-accent" />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-text-strong">
                Client-safe outcomes
              </p>
              {createPackageDraft.outcomes.map((outcome) => (
                <div
                  key={outcome}
                  className="rounded-[1.15rem] border border-border-base bg-surface-muted px-4 py-4 text-sm leading-6 text-text-base"
                >
                  {outcome}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="brand-panel rounded-[1.75rem] border-border-base shadow-none">
            <CardHeader>
              <CardTitle
                className={cn(
                  'text-[2rem] font-semibold tracking-[-0.05em] text-text-strong',
                  tone === 'operations' ? 'font-ops' : 'font-heading'
                )}
              >
                Anomaly watch
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {createPackageDraft.warnings.map((warning) => (
                <div
                  key={warning.id}
                  className={cn(
                    'rounded-[1.25rem] border px-4 py-4',
                    warning.severity === 'attention'
                      ? 'border-[rgba(194,65,12,0.18)] bg-[rgba(194,65,12,0.06)]'
                      : 'border-border-base bg-surface-panel'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {warning.severity === 'attention' ? (
                      <CircleAlert className="size-4 text-[#c2410c]" />
                    ) : (
                      <ShieldCheck className="size-4 text-text-accent" />
                    )}
                    <p className="text-sm font-semibold text-text-strong">
                      {warning.title}
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-text-base">
                    {warning.note}
                  </p>
                  <div className="mt-3">
                    <span className="rounded-full bg-surface-active px-3 py-1 text-xs font-semibold text-text-accent">
                      {getExceptionFlagLabel(warning.flag)}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="brand-panel rounded-[1.75rem] border-border-base shadow-none">
            <CardHeader>
              <CardTitle
                className={cn(
                  'text-[2rem] font-semibold tracking-[-0.05em] text-text-strong',
                  tone === 'operations' ? 'font-ops' : 'font-heading'
                )}
              >
                Package snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {draftedFiles.slice(0, 3).map(({ record }) => (
                <div
                  key={record.id}
                  className="rounded-[1.25rem] border border-border-base bg-surface-panel px-4 py-4"
                >
                  <p className="text-sm font-semibold text-text-strong">
                    {record.organizedName}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-text-base">
                    {getLinkedRecordSummary(record)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <WizardFooter
        source={source}
        step="review"
        nextLabel="Create package"
      />
    </>
  )
}

function PackageConfirmStep({
  source,
}: {
  source: CreatePackageSourceContext
}) {
  const profile = sourceProfiles[source]
  const district = getDistrict(createPackageDraft.districtId)

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_380px]">
      <Card className="brand-panel rounded-[1.75rem] border-border-base shadow-none">
        <CardHeader className="space-y-4">
          <div className="inline-flex size-12 items-center justify-center rounded-full bg-primary-soft text-text-accent">
            <CheckCircle2 className="size-6" />
          </div>
          <div>
            <CardTitle
              className={cn(
                'text-[2rem] font-semibold tracking-[-0.05em] text-text-strong',
                profile.tone === 'operations' ? 'font-ops' : 'font-heading'
              )}
            >
              Package created
            </CardTitle>
            <p className="mt-2 text-sm leading-6 text-text-base">
              SG DREAM has preserved the source files in Egnyte and registered the
              package as Incoming. The next visible steps will be processing,
              classification, and engineering review where needed.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ConfirmationField
              label="Package label"
              value={createPackageDraft.packageLabel}
            />
            <ConfirmationField label="District" value={district.name} />
            <ConfirmationField
              label="Submission channel"
              value={createPackageDraft.submissionChannel}
            />
            <div className="rounded-[1.25rem] border border-border-base bg-surface-panel px-4 py-4">
              <p className="text-xs font-semibold tracking-[0.14em] uppercase text-text-accent">
                Starting custody
              </p>
              <div className="mt-2">
                <StatusBadge label={getCustodyStateLabel(createPackageDraft.startingState)} />
              </div>
            </div>
          </div>

          <Separator className="bg-border-base" />

          <div className="space-y-3">
            <p className="text-sm font-semibold text-text-strong">What happens next</p>
            {[
              'Incoming: the package is registered with its district and original filenames intact.',
              'Processing: SG DREAM drafts class recognition, linked evidence expectations, and client-safe watch items.',
              'Classified: clients will see the package organized by evidence class while engineering review continues when needed.',
            ].map((entry) => (
              <div
                key={entry}
                className="rounded-[1.15rem] border border-border-base bg-surface-muted px-4 py-4 text-sm leading-6 text-text-base"
              >
                {entry}
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Link
              to={profile.backTo}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground no-underline shadow-sm transition-colors hover:bg-primary-hover"
            >
              <span className="text-primary-foreground">Return to origin</span>
            </Link>
            <Button
              asChild
              variant="outline"
              className="rounded-full border-border-base bg-surface-panel text-text-strong"
            >
              <Link to="/portal-operations">View in operations</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-full border-border-base bg-surface-panel text-text-strong"
            >
              <Link to="/create-package" search={{ source, step: 'context' }}>
                Start another package
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="brand-panel rounded-[1.75rem] border-border-base shadow-none">
        <CardHeader>
          <CardTitle
            className={cn(
              'text-[2rem] font-semibold tracking-[-0.05em] text-text-strong',
              profile.tone === 'operations' ? 'font-ops' : 'font-heading'
            )}
          >
            Confirmation snapshot
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-[1.25rem] border border-border-base bg-surface-panel px-4 py-4">
            <div className="flex items-center gap-3">
              <FileStack className="size-4 text-text-accent" />
              <p className="text-sm font-semibold text-text-strong">
                {createPackageDraft.files.length} source files preserved
              </p>
            </div>
            <p className="mt-2 text-sm leading-6 text-text-base">
              The package includes contract, task order, invoice, pay application,
              proof, and anomaly examples so the client can understand what enters
              custody from day one.
            </p>
          </div>

          <div className="rounded-[1.25rem] border border-border-base bg-surface-panel px-4 py-4">
            <div className="flex items-center gap-3">
              <FolderTree className="size-4 text-text-accent" />
              <p className="text-sm font-semibold text-text-strong">
                Linked evidence cue preserved
              </p>
            </div>
            <p className="mt-2 text-sm leading-6 text-text-base">
              The JDS task-order-to-invoice-to-proof chain remains the clearest
              client-facing example of how SG DREAM connects records after intake.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function WizardFooter({
  source,
  step,
  nextLabel,
}: {
  source: CreatePackageSourceContext
  step: CreatePackageStep
  nextLabel: string
}) {
  const currentStepIndex = createPackageSteps.indexOf(step)
  const previousStep = currentStepIndex > 0 ? createPackageSteps[currentStepIndex - 1] : null
  const nextStep =
    currentStepIndex < createPackageSteps.length - 1
      ? createPackageSteps[currentStepIndex + 1]
      : null
  const profile = sourceProfiles[source]

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {previousStep ? (
        <Button
          asChild
          variant="outline"
          className="rounded-full border-border-base bg-surface-panel text-text-strong"
        >
          <Link to="/create-package" search={{ source, step: previousStep }}>
            <ArrowLeft className="size-4" />
            Back to {getCreatePackageStepLabel(previousStep)}
          </Link>
        </Button>
      ) : (
        <Button
          asChild
          variant="outline"
          className="rounded-full border-border-base bg-surface-panel text-text-strong"
        >
          <Link to={profile.backTo}>
            <ArrowLeft className="size-4" />
            {profile.backLabel}
          </Link>
        </Button>
      )}

      {nextStep ? (
        <Link
          to="/create-package"
          search={{ source, step: nextStep }}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground no-underline shadow-sm transition-colors hover:bg-primary-hover"
        >
          <span className="text-primary-foreground">{nextLabel}</span>
          <ArrowRight className="size-4 text-primary-foreground" />
        </Link>
      ) : null}
    </div>
  )
}

function LabeledField({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <p className="mb-2 text-xs font-semibold tracking-[0.14em] uppercase text-text-accent">
        {label}
      </p>
      {children}
    </div>
  )
}

function ConfirmationField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-[1.25rem] border border-border-base bg-surface-panel px-4 py-4">
      <p className="text-xs font-semibold tracking-[0.14em] uppercase text-text-accent">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-text-strong">{value}</p>
    </div>
  )
}
