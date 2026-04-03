import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { StatusBadge } from '#/components/status-badge'
import type { PackageStageSummary } from '#/lib/workflow-stage'
import { cn } from '#/lib/utils'

type WatchItem = string
type RolloverInfo = { fromLabel: string; intoLabel: string }

type ChainStep = {
  recordId: string
  label: string
  status: string
  organizedName: string | undefined
  originalName: string | undefined
  igniteUrl: string | undefined
}

type ChainData = {
  title: string
  note: string
  steps: ChainStep[]
}

type PackageDetailProps = {
  title: string
  status: string
  chainCompleteness: string
  recordAccess: string
  stageSummary: PackageStageSummary | null
  watchItems: WatchItem[]
  rollover: RolloverInfo | null
  chain: ChainData | null
}

export function PackageDetail({
  title,
  status,
  chainCompleteness,
  recordAccess,
  stageSummary,
  watchItems,
  rollover,
  chain,
}: PackageDetailProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border-strong bg-surface-panel">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {/* Left column: package info + watch */}
        <div className="min-w-0 border-b border-border-base p-5 xl:border-b-0 xl:border-r">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="ops-label text-text-accent">Selected package</p>
              <p className="text-lg font-semibold text-text-strong">{title}</p>
              <p className="text-sm leading-6 text-text-base">
                {chainCompleteness}
              </p>
            </div>
            <StatusBadge label={status} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge label={recordAccess} />
          </div>

          {stageSummary ? (
            <div className="package-stage-bridge mt-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="ops-label text-text-accent">Package stage</p>
                  <p className="text-sm font-semibold text-text-strong">
                    {stageSummary.currentLabel}
                  </p>
                  <p className="text-sm leading-6 text-text-muted">
                    {stageSummary.note}
                  </p>
                </div>
                {stageSummary.nextLabel ? (
                  <span className="package-stage-next">
                    {stageSummary.nextLabel}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="mt-5 border-t border-border-base pt-5">
            <p className="ops-label text-text-accent">Package watch</p>
            <div className="mt-4 max-h-[240px] space-y-3 overflow-y-auto pr-1">
              {watchItems.map((item) => (
                <WatchCard key={item}>{item}</WatchCard>
              ))}
              {rollover ? (
                <WatchCard>
                  Rolled from {rollover.fromLabel} into {rollover.intoLabel}
                </WatchCard>
              ) : null}
            </div>
          </div>
        </div>

        {/* Right column: relationship chain */}
        <div className="min-w-0 p-5">
          {chain ? (
            <RelationshipChain title={title} status={status} chain={chain} />
          ) : (
            <p className="text-sm text-text-muted">
              No linked chain is attached to this district yet.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function WatchCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[1.1rem] border border-border-base bg-surface-muted px-3 py-3 text-sm text-text-strong">
      {children}
    </div>
  )
}

function RelationshipChain({
  title,
  status,
  chain,
}: {
  title: string
  status: string
  chain: ChainData
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="ops-label text-text-accent">CONTRACT TO PROOF CHAIN</p>
          <p className="mt-1 text-lg font-semibold text-text-strong">
            {chain.title}
          </p>
          <p className="mt-2 text-sm leading-6 text-text-muted">{chain.note}</p>
        </div>
        <StatusBadge label={status} />
      </div>

      <div className="mt-2 max-h-[520px] space-y-5 overflow-y-auto pr-2">
        {chain.steps.map((step, index) => (
          <div
            key={step.recordId}
            className="grid grid-cols-[40px_minmax(0,1fr)] gap-4"
          >
            <div className="flex flex-col items-center pl-2">
              <div className="flex size-11 items-center justify-center rounded-2xl border-2 border-border-focus bg-surface-active font-ops text-sm font-semibold text-text-accent shadow-sm">
                {index + 1}
              </div>
              {index < chain.steps.length - 1 && (
                <div className="mt-4 h-8 w-px bg-gradient-to-b from-border-focus to-border-base" />
              )}
            </div>

            <div className="pb-4 last:pb-0">
              <a
                href={step.igniteUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  'group block min-w-0 rounded-2xl border border-border-base bg-surface-panel px-5 py-5 no-underline transition-all hover:shadow-md',
                  step.igniteUrl
                    ? 'hover:border-border-focus hover:bg-surface-hover'
                    : 'pointer-events-none opacity-75',
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-surface-panel px-2.5 py-1 text-[0.68rem] font-semibold text-text-accent">
                    {step.label}
                  </span>
                  <ArrowRight className="size-3.5 text-text-accent" />
                  <span className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-text-muted">
                    Step {index + 1}
                  </span>
                  {step.igniteUrl ? (
                    <ArrowUpRight className="ml-auto size-3.5 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                  ) : null}
                </div>
                <p className="mt-3 break-words text-sm font-semibold leading-5 text-text-strong">
                  {step.organizedName ?? 'Not attached yet'}
                </p>
                {step.originalName &&
                step.originalName !== step.organizedName ? (
                  <p className="mt-2 break-all font-mono text-[0.7rem] leading-5 text-text-muted">
                    {step.originalName}
                  </p>
                ) : null}
                <p className="mt-3 text-xs leading-5 text-text-base">
                  {step.status}
                </p>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
