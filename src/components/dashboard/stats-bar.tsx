import type { ReactNode } from 'react'
import { StatusBadge } from '#/components/status-badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'

type StatsBarProps = {
  districts: Array<{ id: string; name: string; region: string }>
  activeDistrictId: string
  onDistrictChange: (id: string) => void
  verificationLabel: string
  timingBadge: string
  cutoffDate: string
  nextLine: string
  submittedAmount: string
  districtRegion: string
}

export function DashboardStatsBar({
  districts,
  activeDistrictId,
  onDistrictChange,
  verificationLabel,
  timingBadge,
  cutoffDate,
  nextLine,
  submittedAmount,
  districtRegion,
}: StatsBarProps) {
  return (
    <section className="grid grid-cols-1 divide-y overflow-hidden rounded-2xl border border-border-strong bg-surface-panel sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
      <StatsCell>
        <CellLabel>Active district</CellLabel>
        <Select value={activeDistrictId} onValueChange={onDistrictChange}>
          <SelectTrigger className="h-10 rounded-full border-border-base bg-surface-panel font-ops text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {districts.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-2 text-xs font-medium text-text-muted">
          {districtRegion}
        </p>
      </StatsCell>

      <StatsCell>
        <CellLabel>Current verification</CellLabel>
        <p className="truncate font-ops text-sm font-semibold text-text-strong">
          {verificationLabel}
        </p>
      </StatsCell>

      <StatsCell>
        <CellLabel>Next cutoff</CellLabel>
        <StatusBadge label={timingBadge} />
        <p className="mt-2 truncate font-ops text-sm font-semibold text-text-strong">
          {cutoffDate}
        </p>
        <p className="mt-1 truncate text-xs text-text-muted">{nextLine}</p>
      </StatsCell>

      <StatsCell>
        <CellLabel>Submitted amount</CellLabel>
        <p className="truncate font-ops text-[1.8rem] font-semibold leading-none tracking-[-0.04em] text-text-strong">
          {submittedAmount}
        </p>
        <p className="mt-2 text-xs text-text-muted">
          Invoices + pay applications
        </p>
      </StatsCell>
    </section>
  )
}

function StatsCell({ children }: { children: ReactNode }) {
  return <div className="min-w-0 p-4">{children}</div>
}

function CellLabel({ children }: { children: ReactNode }) {
  return <p className="ops-label mb-2 text-text-muted">{children}</p>
}
