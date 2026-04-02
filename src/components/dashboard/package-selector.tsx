import { Link } from '@tanstack/react-router'
import { StatusBadge } from '#/components/status-badge'
import { cn } from '#/lib/utils'

type VerificationOption = { id: string; label: string }

type PackageCard = {
  id: string
  title: string
  label: string
  status: string
  note: string
  mode: string
  fileCount: number
  amount: string
}

type PackageSelectorProps = {
  verificationOptions: VerificationOption[]
  activeVerificationId: string
  accountId: string
  districtId: string
  packages: PackageCard[]
  selectedPackageId: string | undefined
}

export function PackageSelector({
  verificationOptions,
  activeVerificationId,
  accountId,
  districtId,
  packages,
  selectedPackageId,
}: PackageSelectorProps) {
  return (
    <>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <h2 className="font-ops text-[1.7rem] font-semibold tracking-[-0.05em] text-text-strong">
          Verification packages
        </h2>
        <div className="flex flex-wrap gap-2">
          {verificationOptions.map((v) => (
            <Link
              key={v.id}
              to="/"
              search={{
                account: accountId,
                district: districtId,
                verification: v.id,
                package: undefined,
              }}
              resetScroll={false}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-semibold no-underline transition-colors',
                v.id === activeVerificationId
                  ? 'border-border-focus bg-surface-active text-text-accent'
                  : 'border-border-base bg-surface-panel text-text-strong hover:border-border-strong hover:bg-surface-hover',
              )}
            >
              {v.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {packages.map((pkg) => (
          <Link
            key={pkg.id}
            to="/"
            search={{
              account: accountId,
              district: districtId,
              verification: activeVerificationId,
              package: pkg.id,
            }}
            resetScroll={false}
            className={cn(
              'min-w-0 rounded-[1.35rem] border px-4 py-4 no-underline transition-colors',
              pkg.id === selectedPackageId
                ? 'border-border-focus bg-surface-active'
                : 'border-border-base bg-surface-panel hover:border-border-strong hover:bg-surface-hover',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="truncate text-sm font-semibold text-text-strong">
                  {pkg.title}
                </p>
                <p className="truncate text-xs text-text-muted">{pkg.label}</p>
              </div>
              <StatusBadge label={pkg.status} />
            </div>
            <p className="mt-3 text-sm leading-6 text-text-base">{pkg.note}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Pill>{pkg.fileCount} files</Pill>
              <Pill>{pkg.amount}</Pill>
              <Pill>
                {pkg.mode === 'setup' ? 'Contract kickoff' : 'Monthly intake'}
              </Pill>
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-surface-muted px-3 py-1 text-[0.72rem] font-semibold text-text-strong">
      {children}
    </span>
  )
}
