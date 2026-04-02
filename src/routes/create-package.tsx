import type { ReactNode } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import type {
  CreatePackageStep,
  DocumentClass,
  PackageDraftFile,
  PackageDraftSummary,
  PackageMode,
} from '#/lib/mock-data'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  FileStack,
  Link2,
  ShieldCheck,
} from 'lucide-react'
import { MockupShell } from '#/components/mockup-shell'
import { StatusBadge } from '#/components/status-badge'
import { UploadDropzone } from '#/components/upload-dropzone'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Progress } from '#/components/ui/progress'
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
  getAllowedCreatePackageDistrictId,
  createPackageSteps,
  getActiveVerificationByDistrict,
  getAvailablePackageModes,
  getClientWorkspaceSession,
  getCreatePackageDraftByContext,
  getCustodyStateLabel,
  getDocumentById,
  getDocumentClassLabel,
  getDistrict,
  getDistrictProfile,
  getPermittedDistrictOptions,
  getNextVerificationAfter,
  getSubmittedAmountTotal,
  getVerification,
  getVerificationPackages,
  getVerificationsByDistrict,
} from '#/lib/mock-data'
import { cn } from '#/lib/utils'

const stepSet = new Set<CreatePackageStep>(createPackageSteps)
const modeSet = new Set<PackageMode>(['monthly', 'setup'])
const monthlyExpectedClasses: DocumentClass[] = [
  'invoice',
  'pay_application',
  'proof_of_payment',
]

type DraftedFileEntry = {
  file: PackageDraftFile
  record: NonNullable<ReturnType<typeof getDocumentById>>
}

const clientExceptionLabels: Record<string, string> = {
  duplicate_file: 'Duplicate watch',
  missing_support: 'Support pending',
  placeholder_contract: 'Pending contract',
  malformed_amount: 'Amount under review',
  pay_app_variant: 'Format variance',
}

export const Route = createFileRoute('/create-package')({
  validateSearch: (search: Record<string, unknown>) => ({
    step:
      typeof search.step === 'string' &&
      stepSet.has(search.step as CreatePackageStep)
        ? (search.step as CreatePackageStep)
        : undefined,
    account: typeof search.account === 'string' ? search.account : undefined,
    district: typeof search.district === 'string' ? search.district : undefined,
    verification:
      typeof search.verification === 'string' ? search.verification : undefined,
    mode:
      typeof search.mode === 'string' && modeSet.has(search.mode as PackageMode)
        ? (search.mode as PackageMode)
        : undefined,
  }),
  head: () => ({
    meta: [{ title: 'Create Package | Schedio Group' }],
  }),
  component: CreatePackagePage,
})

function CreatePackagePage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const step = search.step ?? 'context'
  const clientSession = getClientWorkspaceSession(search.account)
  const permittedDistricts = getPermittedDistrictOptions(
    clientSession.permittedDistrictIds,
  )
  const districtId = getAllowedCreatePackageDistrictId(
    clientSession.permittedDistrictIds,
    search.district,
  )
  const district = getDistrict(districtId)
  const verificationOptions = getVerificationsByDistrict(district.id)
  const verification =
    verificationOptions.find((item) => item.id === search.verification) ??
    getActiveVerificationByDistrict(district.id)
  const nextVerification = getNextVerificationAfter(verification.id)
  const availableModes = getAvailablePackageModes(district.id)
  const mode =
    search.mode && availableModes.includes(search.mode)
      ? search.mode
      : 'monthly'
  const draft = getCreatePackageDraftByContext(
    district.id,
    verification.id,
    mode,
  )
  const selectedPackage =
    getVerificationPackages(district.id, verification.id).find(
      (item) => item.mode === mode,
    ) ?? getVerificationPackages(district.id, verification.id).at(0)
  const draftedFiles: DraftedFileEntry[] = draft.files.flatMap((file) => {
    const record = getDocumentById(file.recordId)
    return record ? [{ file, record }] : []
  })
  const currentStepIndex = createPackageSteps.indexOf(step)
  const progressValue =
    ((currentStepIndex + 1) / createPackageSteps.length) * 100
  const districtProfile = getDistrictProfile(district.id)

  return (
    <MockupShell
      tone="operations"
      meta={`${clientSession.organizationName} • ${district.name}`}
      title="Create a package"
      actions={
        <Button
          asChild
          variant="outline"
          className="rounded-full border-border-base bg-surface-panel text-text-strong"
        >
          <Link
            to="/"
            search={{
              account: clientSession.id,
              district: district.id,
              verification: verification.id,
              package: selectedPackage?.id,
            }}
          >
            <ArrowLeft className="size-4" />
            Back to dashboard
          </Link>
        </Button>
      }
    >
      <Card className="brand-panel rounded-[1.75rem] border-border-base shadow-none">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="font-ops text-[1.8rem] font-semibold tracking-[-0.05em] text-text-strong">
                Package intake
              </CardTitle>
              <p className="mt-2 text-sm text-text-muted">
                Step {currentStepIndex + 1} of {createPackageSteps.length}:{' '}
                {getStepLabel(step)}
              </p>
            </div>
            <StatusBadge label={getCustodyStateLabel(draft.startingState)} />
          </div>
          <Progress value={progressValue} className="h-2.5 rounded-full" />
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {createPackageSteps.map((wizardStep, index) => {
            const isCurrent = wizardStep === step
            const isComplete = index < currentStepIndex

            if (isCurrent) {
              return (
                <div
                  key={wizardStep}
                  className="rounded-[1.35rem] border border-border-focus bg-surface-active px-4 py-4 text-text-accent"
                >
                  <p className="text-xs font-semibold tracking-[0.14em] uppercase">
                    Step {index + 1}
                  </p>
                  <p className="mt-2 text-sm font-semibold">
                    {getStepLabel(wizardStep)}
                  </p>
                </div>
              )
            }

            return (
              <Link
                key={wizardStep}
                to="/create-package"
                search={{
                  step: wizardStep,
                  account: clientSession.id,
                  district: district.id,
                  verification: verification.id,
                  mode,
                }}
                className={cn(
                  'rounded-[1.35rem] border px-4 py-4 no-underline transition-colors',
                  isComplete
                    ? 'border-border-strong bg-surface-muted text-text-strong'
                    : 'border-border-base bg-surface-panel text-text-muted hover:border-border-strong hover:bg-surface-hover',
                )}
              >
                <p className="text-xs font-semibold tracking-[0.14em] uppercase">
                  Step {index + 1}
                </p>
                <p className="mt-2 text-sm font-semibold">
                  {getStepLabel(wizardStep)}
                </p>
              </Link>
            )
          })}
        </CardContent>
      </Card>

      {step === 'context' ? (
        <PackageContextStep
          clientSessionId={clientSession.id}
          permittedDistricts={permittedDistricts}
          districtId={district.id}
          verificationId={verification.id}
          verificationOptions={verificationOptions}
          nextVerificationId={nextVerification?.id}
          mode={mode}
          availableModes={availableModes}
          draft={draft}
          districtProfile={districtProfile}
          onDistrictChange={(nextDistrictId) => {
            const nextDistrict = getDistrict(nextDistrictId)
            const fallbackVerification = getActiveVerificationByDistrict(
              nextDistrict.id,
            )
            const nextModes = getAvailablePackageModes(nextDistrict.id)
            const nextMode = nextModes.includes(mode) ? mode : 'monthly'

            void navigate({
              to: '/create-package',
              search: {
                step,
                account: clientSession.id,
                district: nextDistrict.id,
                verification: fallbackVerification.id,
                mode: nextMode,
              },
              resetScroll: false,
            })
          }}
          onVerificationChange={(nextVerificationId) => {
            void navigate({
              to: '/create-package',
              search: {
                step,
                account: clientSession.id,
                district: district.id,
                verification: nextVerificationId,
                mode,
              },
              resetScroll: false,
            })
          }}
        />
      ) : step === 'files' ? (
        <PackageFilesStep
          draftedFiles={draftedFiles}
          draft={draft}
          mode={mode}
        />
      ) : step === 'review' ? (
        <PackageReviewStep
          draftedFiles={draftedFiles}
          draft={draft}
          mode={mode}
        />
      ) : (
        <PackageConfirmStep
          clientSessionId={clientSession.id}
          districtId={district.id}
          verificationId={verification.id}
          draftedFiles={draftedFiles}
          draft={draft}
          packageId={selectedPackage?.id}
          mode={mode}
        />
      )}
    </MockupShell>
  )
}

function PackageContextStep({
  clientSessionId,
  permittedDistricts,
  districtId,
  verificationId,
  verificationOptions,
  nextVerificationId,
  mode,
  availableModes,
  draft,
  districtProfile,
  onDistrictChange,
  onVerificationChange,
}: {
  clientSessionId: string
  permittedDistricts: ReturnType<typeof getPermittedDistrictOptions>
  districtId: string
  verificationId: string
  verificationOptions: ReturnType<typeof getVerificationsByDistrict>
  nextVerificationId?: string
  mode: PackageMode
  availableModes: PackageMode[]
  draft: PackageDraftSummary
  districtProfile: ReturnType<typeof getDistrictProfile>
  onDistrictChange: (districtId: string) => void
  onVerificationChange: (verificationId: string) => void
}) {
  const district = getDistrict(districtId)
  const verification = getVerification(verificationId)
  const nextVerification = nextVerificationId
    ? getVerification(nextVerificationId)
    : undefined
  const monthlyClassSet = new Set<DocumentClass>([
    'invoice',
    'pay_application',
    'proof_of_payment',
  ])
  const setupClassSet = new Set<DocumentClass>([
    'contract',
    'task_order',
    'change_order',
  ])
  const highlightedClasses =
    mode === 'setup'
      ? draft.expectedClasses.filter((item) =>
          setupClassSet.has(item.documentClass),
        )
      : draft.expectedClasses.filter((item) =>
          monthlyClassSet.has(item.documentClass),
        )

  return (
    <>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_380px]">
        <Card className="brand-panel rounded-[1.75rem] border-border-base shadow-none">
          <CardHeader>
            <CardTitle className="font-heading text-[2rem] font-bold tracking-[-0.05em] text-text-strong">
              Package context
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <LabeledField label="Package name">
              <Input
                defaultValue={draft.packageName}
                className="h-12 rounded-[1.15rem] border-border-base bg-surface-panel"
              />
            </LabeledField>

            <LabeledField label="District">
              <Select
                defaultValue={district.id}
                onValueChange={onDistrictChange}
              >
                <SelectTrigger className="h-12 rounded-[1.15rem] border-border-base bg-surface-panel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {permittedDistricts.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </LabeledField>

            <LabeledField label="Verification">
              <Select
                defaultValue={verification.id}
                onValueChange={onVerificationChange}
              >
                <SelectTrigger className="h-12 rounded-[1.15rem] border-border-base bg-surface-panel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {verificationOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </LabeledField>

            <LabeledField label="Submission channel">
              <Select defaultValue={draft.submissionChannel}>
                <SelectTrigger className="h-12 rounded-[1.15rem] border-border-base bg-surface-panel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="District upload folder">
                    District upload folder
                  </SelectItem>
                  <SelectItem value="Client custody submission">
                    Client custody submission
                  </SelectItem>
                  <SelectItem value="Shared client upload">
                    Shared client upload
                  </SelectItem>
                </SelectContent>
              </Select>
            </LabeledField>

            <LabeledField
              label={
                mode === 'setup'
                  ? 'Expected classes for contract kickoff'
                  : 'Expected classes for monthly intake'
              }
              className="md:col-span-2"
            >
              <div className="flex flex-wrap gap-2">
                {highlightedClasses.map((item) => (
                  <span
                    key={item.documentClass}
                    className="rounded-full border border-border-base bg-surface-panel px-3 py-1 text-xs font-semibold text-text-strong"
                  >
                    {getDocumentClassLabel(item.documentClass)}
                  </span>
                ))}
              </div>
            </LabeledField>

            <LabeledField label="Package mode" className="md:col-span-2">
              <div className="flex flex-wrap gap-2">
                {(['monthly', 'setup'] as PackageMode[]).map((modeOption) => {
                  const isAvailable = availableModes.includes(modeOption)

                  return (
                    <Link
                      key={modeOption}
                      to="/create-package"
                      search={{
                        step: 'context',
                        account: clientSessionId,
                        district: district.id,
                        verification: verification.id,
                        mode: isAvailable ? modeOption : mode,
                      }}
                      resetScroll={false}
                      className={cn(
                        'rounded-full border px-4 py-2 text-xs font-semibold no-underline transition-colors',
                        modeOption === mode
                          ? 'border-border-focus bg-surface-active text-text-accent'
                          : isAvailable
                            ? 'border-border-base bg-surface-panel text-text-strong hover:border-border-strong hover:bg-surface-hover'
                            : 'border-border-base bg-surface-muted text-text-muted pointer-events-none opacity-60',
                      )}
                    >
                      {modeOption === 'setup'
                        ? 'Contract kickoff'
                        : 'Monthly intake'}
                    </Link>
                  )
                })}
              </div>
            </LabeledField>

            <LabeledField label="Package purpose" className="md:col-span-2">
              <Input
                defaultValue={draft.purpose}
                className="h-12 rounded-[1.15rem] border-border-base bg-surface-panel"
              />
            </LabeledField>

            <LabeledField label="Package description" className="md:col-span-2">
              <textarea
                defaultValue={draft.description}
                className="min-h-32 w-full rounded-[1.15rem] border border-border-base bg-surface-panel px-4 py-3 text-sm leading-6 text-text-base outline-none transition focus:border-border-focus focus:ring-4 focus:ring-ring/30"
              />
            </LabeledField>

            <LabeledField
              label="Verification context"
              className="md:col-span-2"
            >
              <div className="rounded-[1.15rem] border border-border-base bg-surface-panel px-4 py-3">
                <p className="text-sm font-semibold text-text-strong">
                  {verification.label}
                </p>
                <p className="mt-1 text-sm leading-6 text-text-base">
                  Cutoff {verification.cutoffDate} • late uploads roll to{' '}
                  {nextVerification?.label ?? 'the next verification'}
                </p>
                {districtProfile === 'finance' ? (
                  <p className="mt-2 text-xs text-text-muted">
                    Finance packages stay reviewable while support is still
                    being gathered.
                  </p>
                ) : null}
              </div>
            </LabeledField>

            <LabeledField
              label="What happens after upload"
              className="md:col-span-2"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-[1.15rem] border border-border-base bg-surface-panel px-4 py-3">
                  <p className="text-xs font-semibold tracking-[0.14em] uppercase text-text-accent">
                    Incoming
                  </p>
                  <p className="mt-2 text-sm leading-6 text-text-base">
                    Files land in custody with the district and verification
                    attached.
                  </p>
                </div>
                <div className="rounded-[1.15rem] border border-border-base bg-surface-panel px-4 py-3">
                  <p className="text-xs font-semibold tracking-[0.14em] uppercase text-text-accent">
                    Processing
                  </p>
                  <p className="mt-2 text-sm leading-6 text-text-base">
                    Files are renamed, classified, and linked to the
                    verification chain.
                  </p>
                </div>
                <div className="rounded-[1.15rem] border border-border-base bg-surface-panel px-4 py-3">
                  <p className="text-xs font-semibold tracking-[0.14em] uppercase text-text-accent">
                    Available
                  </p>
                  <p className="mt-2 text-sm leading-6 text-text-base">
                    Organized records are ready to view with original filenames
                    retained.
                  </p>
                </div>
              </div>
            </LabeledField>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="brand-panel rounded-[1.75rem] border-border-base shadow-none">
            <CardHeader>
              <CardTitle className="font-ops text-[1.7rem] font-semibold tracking-[-0.05em] text-text-strong">
                {mode === 'setup'
                  ? 'Kickoff package'
                  : 'Expected submission classes'}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {draft.expectedClasses.map((item) => (
                <span
                  key={item.documentClass}
                  className={cn(
                    'inline-flex items-center rounded-full border px-3 py-2 text-xs font-semibold',
                    item.selected
                      ? 'border-border-focus bg-surface-active text-text-accent'
                      : 'border-border-base bg-surface-panel text-text-strong',
                  )}
                >
                  {getDocumentClassLabel(item.documentClass)}
                </span>
              ))}
            </CardContent>
          </Card>

          <Card className="brand-panel rounded-[1.75rem] border-border-base shadow-none">
            <CardHeader>
              <CardTitle className="font-ops text-[1.7rem] font-semibold tracking-[-0.05em] text-text-strong">
                Custody stages
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  stage: 'Incoming',
                  note: 'Files preserved with district and verification context.',
                },
                {
                  stage: 'Processing',
                  note: 'Inventory shows renamed files and proposed classes.',
                },
                {
                  stage: 'Available',
                  note: 'Organized records stay visible with original filenames retained.',
                },
              ].map((item) => (
                <div
                  key={item.stage}
                  className="rounded-[1.15rem] border border-border-base bg-surface-muted px-4 py-4"
                >
                  <StatusBadge label={item.stage} />
                  <p className="mt-3 text-sm leading-6 text-text-base">
                    {item.note}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <WizardFooter step="context" nextLabel="Continue to source files" />
    </>
  )
}

function PackageFilesStep({
  draftedFiles,
  draft,
  mode,
}: {
  draftedFiles: DraftedFileEntry[]
  draft: PackageDraftSummary
  mode: PackageMode
}) {
  return (
    <>
      <UploadDropzone
        kicker="Package file intake"
        title="Source files"
        subtitle={
          mode === 'setup'
            ? 'Original contract and task-order files stay visible while kickoff records are organized.'
            : 'Original filenames stay visible. Renamed outputs and proposed classes appear immediately.'
        }
        primaryAction={
          <Button className="rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary-hover">
            Add more source files
          </Button>
        }
        secondaryAction={
          <Button
            variant="outline"
            className="rounded-full border-border-base bg-surface-panel px-5 text-text-strong"
          >
            Review upload rules
          </Button>
        }
        points={[
          'Original filename stays visible.',
          'Renamed output appears immediately.',
          'Use proposed class until review.',
        ]}
      />

      <Card className="brand-panel rounded-[1.75rem] border-border-base shadow-none">
        <CardHeader>
          <CardTitle className="font-ops text-[2rem] font-semibold tracking-[-0.05em] text-text-strong">
            Uploaded inventory
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="data-table-frame overflow-x-auto overflow-y-hidden rounded-[1.5rem] border border-border-base bg-surface-panel">
            <Table className="data-table-min">
              <TableHeader>
                <TableRow className="bg-surface-muted">
                  <TableHead>Original filename</TableHead>
                  <TableHead>Renamed inventory</TableHead>
                  <TableHead>Proposed class</TableHead>
                  <TableHead>Pages</TableHead>
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
                          Original retained for duplicate review
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-text-strong">
                          {record.organizedName}
                        </p>
                        <p className="text-xs text-text-muted">
                          Renamed output
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <span className="inline-flex rounded-full bg-surface-active px-3 py-1 text-xs font-semibold text-text-accent">
                          {getDocumentClassLabel(record.documentClass)}
                        </span>
                        <StatusBadge
                          label={
                            file.warningFlags.length > 0
                              ? 'Needs confirmation'
                              : 'Proposed class'
                          }
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-text-strong">
                      {record.pageCount}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {file.warningFlags.length > 0 ? (
                          file.warningFlags.map((flag) => (
                            <span
                              key={flag}
                              className="rounded-full border border-border-base bg-surface-muted px-3 py-1 text-[0.72rem] font-semibold text-text-strong"
                            >
                              {clientExceptionLabels[flag] ?? flag}
                            </span>
                          ))
                        ) : (
                          <StatusBadge label="Ready for review" />
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

      <WizardFooter step="files" nextLabel="Review package" />
    </>
  )
}

function PackageReviewStep({
  draftedFiles,
  draft,
  mode,
}: {
  draftedFiles: DraftedFileEntry[]
  draft: PackageDraftSummary
  mode: PackageMode
}) {
  const selectedClasses = draft.expectedClasses.filter((item) => item.selected)
  const submittedAmount = getSubmittedAmountTotal(
    draftedFiles.map(({ record }) => record),
  )

  return (
    <>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_380px]">
        <Card className="brand-panel rounded-[1.75rem] border-border-base shadow-none">
          <CardHeader>
            <CardTitle className="font-ops text-[2rem] font-semibold tracking-[-0.05em] text-text-strong">
              Package review
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SummaryCard
                label="Expected classes"
                value={String(selectedClasses.length)}
              />
              <SummaryCard
                label="Uploaded files"
                value={String(draftedFiles.length)}
              />
              <SummaryCard
                label="Submitted amount"
                value={formatCurrency(submittedAmount)}
              />
              <SummaryCard
                label="Needs confirmation"
                value={String(draft.warnings.length)}
              />
            </div>

            <div className="rounded-[1.35rem] border border-border-base bg-surface-panel px-4 py-4">
              <p className="ops-label text-text-accent">
                Linked chain expectation
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)_32px_minmax(0,1fr)]">
                {draft.linkedEvidenceChain.map((entry, index) => (
                  <div key={entry} className="contents">
                    <div className="rounded-[1.15rem] border border-border-base bg-surface-muted px-4 py-4">
                      <p className="text-xs font-semibold tracking-[0.12em] uppercase text-text-accent">
                        {mode === 'setup'
                          ? index === 0
                            ? 'Contract'
                            : index === 1
                              ? 'Task order'
                              : 'Change order'
                          : index === 0
                            ? 'Task order'
                            : index === 1
                              ? 'Invoice'
                              : 'Proof of payment'}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-text-strong">
                        {entry}
                      </p>
                    </div>
                    {index < draft.linkedEvidenceChain.length - 1 ? (
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
                Package status
              </p>
              {draft.outcomes.map((outcome) => (
                <div
                  key={outcome}
                  className="rounded-[1.15rem] border border-border-base bg-surface-muted px-4 py-4 text-sm text-text-base"
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
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="font-ops text-[1.7rem] font-semibold tracking-[-0.05em] text-text-strong">
                  Anomaly watch
                </CardTitle>
                <span className="rounded-full bg-surface-muted px-3 py-1 text-[0.72rem] font-semibold text-text-strong">
                  {draft.warnings.length} watch items
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {draft.warnings.map((warning) => (
                <div
                  key={warning.id}
                  className={cn(
                    'rounded-[1.25rem] border px-4 py-4',
                    warning.severity === 'attention'
                      ? 'border-status-warning-text/25 bg-status-warning-bg'
                      : 'border-border-base bg-surface-panel',
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {warning.severity === 'attention' ? (
                        <CircleAlert className="size-4 text-status-warning-text" />
                      ) : (
                        <ShieldCheck className="size-4 text-text-accent" />
                      )}
                      <p className="text-sm font-semibold text-text-strong">
                        {warning.title}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[0.68rem] font-semibold',
                        warning.severity === 'attention'
                          ? 'bg-status-warning-bg text-status-warning-text'
                          : 'bg-surface-active text-text-accent',
                      )}
                    >
                      {warning.severity === 'attention'
                        ? 'Needs confirmation'
                        : 'Ready for review'}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-text-base">
                    {warning.note}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="brand-panel rounded-[1.75rem] border-border-base shadow-none">
            <CardHeader>
              <CardTitle className="font-ops text-[1.7rem] font-semibold tracking-[-0.05em] text-text-strong">
                Confirmation snapshot
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
                  <p className="mt-2 break-all font-mono text-[0.72rem] text-text-muted">
                    {record.originalName}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusBadge
                      label={
                        record.exceptionFlags.length > 0
                          ? 'Needs confirmation'
                          : 'Ready for review'
                      }
                    />
                    <StatusBadge
                      label={getDocumentClassLabel(record.documentClass)}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <WizardFooter step="review" nextLabel="Create package" />
    </>
  )
}

function PackageConfirmStep({
  clientSessionId,
  districtId,
  verificationId,
  draftedFiles,
  draft,
  packageId,
  mode,
}: {
  clientSessionId: string
  districtId: string
  verificationId: string
  draftedFiles: DraftedFileEntry[]
  draft: PackageDraftSummary
  packageId?: string
  mode: PackageMode
}) {
  const district = getDistrict(districtId)
  const verification = getVerification(verificationId)
  const packageLabel = draft.packageLabel
  const submittedAmount = getSubmittedAmountTotal(
    draftedFiles.map(({ record }) => record),
  )
  const recognizedClasses = new Set(
    draftedFiles.map(({ record }) => record.documentClass),
  ).size

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_380px]">
      <Card className="brand-panel rounded-[1.75rem] border-border-base shadow-none">
        <CardHeader className="space-y-4">
          <div className="inline-flex size-12 items-center justify-center rounded-full bg-primary-soft text-text-accent">
            <CheckCircle2 className="size-6" />
          </div>
          <div>
            <CardTitle className="font-heading text-[2rem] font-bold tracking-[-0.05em] text-text-strong">
              Package created
            </CardTitle>
            <p className="mt-2 text-sm text-text-muted">
              The package is now registered as Incoming and visible on the
              dashboard.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ConfirmationField label="Package label" value={packageLabel} />
            <ConfirmationField label="District" value={district.name} />
            <ConfirmationField
              label="Submission channel"
              value={draft.submissionChannel}
            />
            <ConfirmationField
              label="Verification"
              value={verification.label}
            />
            <div className="rounded-[1.25rem] border border-border-base bg-surface-panel px-4 py-4">
              <p className="text-xs font-semibold tracking-[0.14em] uppercase text-text-accent">
                Starting stage
              </p>
              <div className="mt-2">
                <StatusBadge
                  label={getCustodyStateLabel(draft.startingState)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard
              label="Files uploaded"
              value={String(draftedFiles.length)}
            />
            <SummaryCard
              label="Classes represented"
              value={String(recognizedClasses)}
            />
            <SummaryCard
              label="Submitted amount"
              value={formatCurrency(submittedAmount)}
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-text-strong">Next steps</p>
            {[
              'Incoming: package registered.',
              'Processing: inventory visible on the dashboard.',
              'Classified: review team picks up flagged records.',
            ].map((entry) => (
              <div
                key={entry}
                className="rounded-[1.15rem] border border-border-base bg-surface-muted px-4 py-4 text-sm text-text-base"
              >
                {entry}
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Link
              to="/"
              search={{
                account: clientSessionId,
                district: district.id,
                verification: verification.id,
                package: packageId,
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground no-underline shadow-sm transition-colors hover:bg-primary-hover"
            >
              <span className="text-primary-foreground">
                Return to dashboard
              </span>
            </Link>
            <Button
              asChild
              variant="outline"
              className="rounded-full border-border-base bg-surface-panel text-text-strong"
            >
              <Link
                to="/"
                search={{
                  account: clientSessionId,
                  district: district.id,
                  verification: verification.id,
                  package: packageId,
                }}
              >
                View package status
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-full border-border-base bg-surface-panel text-text-strong"
            >
              <Link
                to="/create-package"
                search={{
                  step: 'context',
                  account: clientSessionId,
                  district: district.id,
                  verification: verification.id,
                  mode,
                }}
              >
                Start another package
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="brand-panel rounded-[1.75rem] border-border-base shadow-none">
        <CardHeader>
          <CardTitle className="font-ops text-[1.7rem] font-semibold tracking-[-0.05em] text-text-strong">
            Confirmation snapshot
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <SnapshotItem
            icon={<FileStack className="size-4 text-text-accent" />}
            title={`${draftedFiles.length} uploaded files`}
            body="Original filenames stay visible in the dashboard inventory."
          />
          <SnapshotItem
            icon={<Link2 className="size-4 text-text-accent" />}
            title="Linked chain expectation"
            body="Task order to invoice to proof stays attached to the package."
          />
        </CardContent>
      </Card>
    </div>
  )
}

function WizardFooter({
  step,
  nextLabel,
}: {
  step: CreatePackageStep
  nextLabel: string
}) {
  const { account, district, verification, mode } = Route.useSearch()
  const currentStepIndex = createPackageSteps.indexOf(step)
  const previousStep =
    currentStepIndex > 0 ? createPackageSteps[currentStepIndex - 1] : null
  const nextStep =
    currentStepIndex < createPackageSteps.length - 1
      ? createPackageSteps[currentStepIndex + 1]
      : null

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {previousStep ? (
        <Button
          asChild
          variant="outline"
          className="rounded-full border-border-base bg-surface-panel text-text-strong"
        >
          <Link
            to="/create-package"
            search={{
              step: previousStep,
              account,
              district,
              verification,
              mode,
            }}
          >
            <ArrowLeft className="size-4" />
            Back to {getStepLabel(previousStep)}
          </Link>
        </Button>
      ) : (
        <Button
          asChild
          variant="outline"
          className="rounded-full border-border-base bg-surface-panel text-text-strong"
        >
          <Link
            to="/"
            search={{ account, district, verification, package: undefined }}
          >
            <ArrowLeft className="size-4" />
            Back to dashboard
          </Link>
        </Button>
      )}

      {nextStep ? (
        <Link
          to="/create-package"
          search={{ step: nextStep, account, district, verification, mode }}
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
  children: ReactNode
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

function SummaryCard({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note?: string
}) {
  return (
    <div className="rounded-[1.25rem] border border-border-base bg-surface-panel px-4 py-4">
      <p className="ops-label text-text-muted">{label}</p>
      <p className="mt-2 font-ops text-[1.75rem] font-semibold leading-none text-text-strong">
        {value}
      </p>
      {note ? (
        <p className="mt-2 text-xs leading-5 text-text-base">{note}</p>
      ) : null}
    </div>
  )
}

function ConfirmationField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-border-base bg-surface-panel px-4 py-4">
      <p className="text-xs font-semibold tracking-[0.14em] uppercase text-text-accent">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-text-strong">{value}</p>
    </div>
  )
}

function SnapshotItem({
  icon,
  title,
  body,
}: {
  icon: ReactNode
  title: string
  body: string
}) {
  return (
    <div className="rounded-[1.25rem] border border-border-base bg-surface-panel px-4 py-4">
      <div className="flex items-center gap-3">
        {icon}
        <p className="text-sm font-semibold text-text-strong">{title}</p>
      </div>
      <p className="mt-2 text-sm leading-6 text-text-base">{body}</p>
    </div>
  )
}

function getStepLabel(step: CreatePackageStep) {
  return {
    context: 'Package context',
    files: 'Source files',
    review: 'Review package',
    confirm: 'Confirm',
  }[step]
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}
