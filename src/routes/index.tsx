import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { MockupShell } from '#/components/mockup-shell'
import { DashboardStatsBar } from '#/components/dashboard/stats-bar'
import { CustodyPipeline } from '#/components/dashboard/custody-pipeline'
import { PackageSelector } from '#/components/dashboard/package-selector'
import { PackageDetail } from '#/components/dashboard/package-detail'
import { InventorySection } from '#/components/dashboard/inventory-section'
import {
  clientDocumentClassOrder,
  getClientWorkspaceSession,
  getClientDocumentsByDistrict,
  getActiveVerificationByDistrict,
  getClientFacingRecordStatus,
  getDistrictProfile,
  getDocumentById,
  getDocumentClassLabel,
  getDocumentsByPackageId,
  getPermittedDistrictOptions,
  getNextVerificationAfter,
  getRelationshipChainsByDistrict,
  getSubmittedAmountTotal,
  getVerificationPackages,
  getVerificationTimingLabel,
  getVerification,
  getVerificationsByDistrict,
} from '#/lib/mock-data'
import { getPackageStageSummary } from '#/lib/workflow-stage'

const defaultDistrictId = 'sterling-cab'

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>) => ({
    account: typeof search.account === 'string' ? search.account : undefined,
    district: typeof search.district === 'string' ? search.district : undefined,
    verification:
      typeof search.verification === 'string' ? search.verification : undefined,
    package: typeof search.package === 'string' ? search.package : undefined,
  }),
  head: () => ({
    meta: [{ title: 'Dashboard | Schedio Group' }],
  }),
  component: DashboardPage,
})

function DashboardPage() {
  const navigate = useNavigate()
  const {
    account,
    district: requestedDistrictId,
    verification: requestedVerificationId,
    package: requestedPackageId,
  } = Route.useSearch()

  const clientSession = getClientWorkspaceSession(account)
  const permittedDistricts = getPermittedDistrictOptions(
    clientSession.permittedDistrictIds,
  )
  const district =
    permittedDistricts.find((o) => o.id === requestedDistrictId) ??
    permittedDistricts.find((o) => o.id === defaultDistrictId) ??
    permittedDistricts[0]
  const verificationOptions = getVerificationsByDistrict(district.id)
  const activeVerification =
    verificationOptions.find((v) => v.id === requestedVerificationId) ??
    getActiveVerificationByDistrict(district.id)
  const nextVerification = getNextVerificationAfter(activeVerification.id)
  const packages = getVerificationPackages(district.id, activeVerification.id)
  const selectedPackage =
    packages.find((p) => p.id === requestedPackageId) ?? packages.at(0)
  const docs = selectedPackage
    ? getDocumentsByPackageId(selectedPackage.id)
    : getClientDocumentsByDistrict(district.id, activeVerification.id)
  const submittedAmount = getSubmittedAmountTotal(docs)
  const districtProfile = getDistrictProfile(district.id)
  const canCreatePackage = districtProfile !== 'archived'

  const classCounts = clientDocumentClassOrder
    .map((dc) => ({
      key: dc,
      label: getDocumentClassLabel(dc),
      count: docs.filter((d) => d.documentClass === dc).length,
    }))
    .filter((c) => c.count > 0)

  const duplicateCount = docs.filter((d) =>
    d.exceptionFlags.includes('duplicate_file'),
  ).length
  const supportPendingCount = docs.filter((d) =>
    d.exceptionFlags.includes('missing_support'),
  ).length

  const custodyItems = [
    {
      label: 'Incoming',
      count: docs.filter((d) => d.custodyState === 'incoming').length,
    },
    {
      label: 'Processing',
      count: docs.filter((d) => d.custodyState === 'processing').length,
    },
    {
      label: 'Classified',
      count: docs.filter((d) => d.custodyState === 'classified').length,
    },
    {
      label: 'Ready for review',
      count: docs.filter(
        (d) => getClientFacingRecordStatus(d) === 'Ready for review',
      ).length,
    },
    {
      label: 'Available',
      count: docs.filter((d) => getClientFacingRecordStatus(d) === 'Available')
        .length,
    },
  ] as const

  const packageCards = packages.map((p) => {
    const pDocs = getDocumentsByPackageId(p.id)
    return {
      id: p.id,
      title: p.title,
      label: p.label,
      status: p.status,
      note: p.note,
      mode: p.mode,
      fileCount: pDocs.length,
      amount: formatCurrency(getSubmittedAmountTotal(pDocs)),
    }
  })

  const chainRaw = selectedPackage?.chainId
    ? getRelationshipChainsByDistrict(district.id, activeVerification.id).find(
        (c) => c.id === selectedPackage.chainId,
      )
    : undefined
  const chain =
    chainRaw ??
    getRelationshipChainsByDistrict(district.id, activeVerification.id).at(0)

  const chainData = chain
    ? {
        title: chain.title,
        note: chain.note,
        steps: chain.steps.map((step) => {
          const record = getDocumentById(step.recordId)
          return {
            recordId: step.recordId,
            label: step.label,
            status: step.status,
            organizedName: record?.organizedName,
            originalName: record?.originalName,
            igniteUrl: record?.igniteUrl,
          }
        }),
      }
    : null

  const packageStageSummary = selectedPackage
    ? getPackageStageSummary(selectedPackage)
    : null

  const rollover = selectedPackage?.rolloverFromVerificationId
    ? {
        fromLabel: getVerification(selectedPackage.rolloverFromVerificationId)
          .label,
        intoLabel: getVerification(
          selectedPackage.rolloverToVerificationId ?? activeVerification.id,
        ).label,
      }
    : null

  const nextLine = nextVerification
    ? `Next: ${nextVerification.label} • ${nextVerification.cutoffDate}`
    : 'No next verification scheduled'

  return (
    <MockupShell
      tone="operations"
      meta={`${clientSession.organizationName} • ${district.name}`}
      title={`${activeVerification.label} dashboard`}
      actions={
        canCreatePackage ? (
          <Link
            to="/create-package"
            search={{
              step: 'context',
              account: clientSession.id,
              district: district.id,
              verification: activeVerification.id,
              mode: 'monthly',
            }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground no-underline shadow-sm transition-colors hover:bg-primary-hover"
          >
            <span className="text-primary-foreground">Create package</span>
            <ArrowRight className="size-4 text-primary-foreground" />
          </Link>
        ) : (
          <span className="inline-flex h-10 items-center justify-center rounded-full border border-border-base bg-surface-panel px-5 text-sm font-semibold text-text-muted">
            Archived read-only district
          </span>
        )
      }
    >
      <DashboardStatsBar
        districts={permittedDistricts}
        activeDistrictId={district.id}
        onDistrictChange={(nextDistrictId) => {
          const fallback = getActiveVerificationByDistrict(nextDistrictId)
          void navigate({
            to: '/',
            search: {
              account: clientSession.id,
              district: nextDistrictId,
              verification: fallback.id,
              package: undefined,
            },
            resetScroll: false,
          })
        }}
        verificationLabel={activeVerification.label}
        timingBadge={getVerificationTimingLabel(activeVerification.timing)}
        cutoffDate={activeVerification.cutoffDate}
        nextLine={nextLine}
        submittedAmount={formatCurrency(submittedAmount)}
        districtRegion={district.region}
      />

      <CustodyPipeline items={custodyItems} />

      <section className="min-w-0 space-y-5">
        <PackageSelector
          verificationOptions={verificationOptions}
          activeVerificationId={activeVerification.id}
          accountId={clientSession.id}
          districtId={district.id}
          packages={packageCards}
          selectedPackageId={selectedPackage?.id}
        />

        {selectedPackage ? (
          <>
            <hr className="border-border-base" />
            <PackageDetail
              title={selectedPackage.title}
              status={selectedPackage.status}
              chainCompleteness={selectedPackage.chainCompleteness}
              recordAccess={selectedPackage.readOnly ? 'Read-only' : 'Active'}
              stageSummary={packageStageSummary}
              watchItems={selectedPackage.watchItems}
              rollover={rollover}
              chain={chainData}
            />
          </>
        ) : null}
      </section>

      <InventorySection
        docs={docs}
        submittedAmount={formatCurrency(submittedAmount)}
        classCounts={classCounts}
        duplicateCount={duplicateCount}
        supportPendingCount={supportPendingCount}
        verificationLabel={activeVerification.label}
        formatCurrency={formatCurrency}
        getExceptionLabel={getClientFacingExceptionLabel}
      />
    </MockupShell>
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

const clientExceptionLabels: Record<string, string> = {
  duplicate_file: 'Duplicate watch',
  missing_support: 'Support pending',
  placeholder_contract: 'Pending contract',
  malformed_amount: 'Amount under review',
  pay_app_variant: 'Format variance',
}

function getClientFacingExceptionLabel(flag: string) {
  return clientExceptionLabels[flag] ?? flag
}
