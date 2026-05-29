import { AlertTriangle, ChevronRight, FileText } from 'lucide-react'
import {
  computeVendorUtilization,
  formatCurrency,
  formatPercent,
  groupTaskOrdersByPhase,
  sumChangeOrders,
  sumTaskOrders,
} from '#/lib/sg-dream'
import type { Vendor } from '#/lib/sg-dream'
import { cn } from '#/lib/utils'

type ContractTrackingTableProps = {
  vendors: ReadonlyArray<Vendor>
  summary: {
    authorized: number
    spent: number
    remaining: number
    pct: number
  }
  expandedVendor?: string
  onToggleVendor: (vendorId: string) => void
}

export function ContractTrackingTable({
  vendors,
  summary,
  expandedVendor,
  onToggleVendor,
}: ContractTrackingTableProps) {
  const summaryTiles = [
    { label: 'Authorized', value: formatCurrency(summary.authorized) },
    { label: 'Spent to date', value: formatCurrency(summary.spent) },
    { label: 'Remaining', value: formatCurrency(summary.remaining) },
    { label: '% Utilized', value: formatPercent(summary.pct, 1) },
  ]

  return (
    <section
      className="brand-panel overflow-hidden rounded-2xl"
      style={{ borderColor: 'var(--color-border-base)' }}
    >
      <header
        className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"
        style={{
          borderColor: 'var(--color-border-base)',
          background:
            'linear-gradient(180deg, var(--wf-softer), rgba(255,255,255,0.95))',
        }}
      >
        <div>
          <p className="font-mono text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[color:var(--wf-strong)]">
            Contract tracking
          </p>
          <h2 className="font-ops text-base font-semibold text-text-strong">
            Per-vendor authorization, task orders, and change orders
          </h2>
        </div>
        <p className="text-xs text-text-muted">
          Healthy &lt; 70% · Monitor 70–89% · Amendment likely ≥ 90%
        </p>
      </header>

      <dl
        className="grid grid-cols-2 gap-px border-b bg-[color:var(--color-border-base)] sm:grid-cols-4"
        style={{ borderColor: 'var(--color-border-base)' }}
      >
        {summaryTiles.map((tile) => (
          <div key={tile.label} className="bg-white px-5 py-4">
            <dt className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-text-muted">
              {tile.label}
            </dt>
            <dd className="mt-1 font-ops text-lg font-semibold text-text-strong">
              {tile.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="data-table-frame">
        <table className="data-table-min w-full border-collapse text-sm">
          <thead className="text-left">
            <tr
              className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-text-muted"
              style={{ background: 'var(--color-surface-muted)' }}
            >
              <th className="px-5 py-3">Vendor</th>
              <th className="px-5 py-3">Authorized</th>
              <th className="px-5 py-3">Spent</th>
              <th className="px-5 py-3">Remaining</th>
              <th className="px-5 py-3">Utilization</th>
              <th className="px-5 py-3 text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((v) => {
              const { pct, remaining, band } = computeVendorUtilization(v)
              const isOpen = expandedVendor === v.id
              const hasDetails = Boolean(
                v.contract || v.taskOrders?.length || v.changeOrders?.length,
              )
              return (
                <VendorRows
                  key={v.id}
                  vendor={v}
                  isOpen={isOpen}
                  hasDetails={hasDetails}
                  band={band}
                  pct={pct}
                  remaining={remaining}
                  onToggle={() => onToggleVendor(v.id)}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function VendorRows({
  vendor,
  isOpen,
  hasDetails,
  band,
  pct,
  remaining,
  onToggle,
}: {
  vendor: Vendor
  isOpen: boolean
  hasDetails: boolean
  band: 'healthy' | 'monitor' | 'amend'
  pct: number
  remaining: number
  onToggle: () => void
}) {
  const isAmend = band === 'amend'
  const taskOrderTotal = sumTaskOrders(vendor.taskOrders)
  const changeOrderTotal = sumChangeOrders(vendor.changeOrders)
  const phaseGroups = vendor.taskOrders
    ? groupTaskOrdersByPhase(vendor.taskOrders)
    : []

  return (
    <>
      <tr
        className={cn(
          'border-t bg-white',
          hasDetails &&
            'cursor-pointer hover:bg-[color:var(--color-surface-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring)]',
        )}
        style={{ borderColor: 'var(--color-border-base)' }}
        onClick={hasDetails ? onToggle : undefined}
        tabIndex={hasDetails ? 0 : -1}
        role={hasDetails ? 'button' : undefined}
        aria-expanded={hasDetails ? isOpen : undefined}
        onKeyDown={
          hasDetails
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onToggle()
                }
              }
            : undefined
        }
      >
        <td className="px-5 py-3">
          <div className="flex items-center gap-3">
            {hasDetails ? (
              <ChevronRight
                aria-hidden
                className={cn(
                  'size-4 text-text-muted transition-transform',
                  isOpen && 'rotate-90',
                )}
              />
            ) : (
              <span aria-hidden className="inline-block size-4" />
            )}
            <div className="flex flex-col">
              <span className="font-ops font-semibold text-text-strong">
                {vendor.name}
              </span>
              <span className="font-mono text-[0.72rem] text-text-muted">
                {vendor.code}
                {vendor.taskOrders?.length
                  ? ` · ${vendor.taskOrders.length} task order${
                      vendor.taskOrders.length === 1 ? '' : 's'
                    }`
                  : ''}
                {vendor.changeOrders?.length
                  ? ` · ${vendor.changeOrders.length} change order${
                      vendor.changeOrders.length === 1 ? '' : 's'
                    }`
                  : ''}
              </span>
            </div>
          </div>
        </td>
        <td className="px-5 py-3 font-mono text-text-strong">
          {formatCurrency(vendor.authorized)}
        </td>
        <td className="px-5 py-3 font-mono text-text-strong">
          {formatCurrency(vendor.spent)}
        </td>
        <td className="px-5 py-3 font-mono text-text-strong">
          {formatCurrency(remaining)}
        </td>
        <td className="min-w-[180px] px-5 py-3">
          <div className="util-bar">
            <div
              className="util-bar-fill"
              data-band={band}
              style={{ width: `${Math.min(100, pct).toFixed(1)}%` }}
            />
          </div>
        </td>
        <td className="px-5 py-3 text-right">
          <span
            className="util-pct font-mono text-sm font-semibold"
            data-band={band}
          >
            {formatPercent(pct, 1)}
          </span>
        </td>
      </tr>

      {isAmend ? (
        <tr style={{ borderColor: 'var(--color-border-base)' }}>
          <td colSpan={6} className="border-t-0 px-5 pb-3">
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm"
              style={{
                background: 'var(--color-util-amend-soft)',
                borderColor:
                  'color-mix(in oklab, var(--color-util-amend) 40%, transparent)',
                color: 'var(--color-util-amend)',
              }}
            >
              <span className="inline-flex items-center gap-2 font-semibold">
                <AlertTriangle className="size-4" />
                Amendment recommended — request a change order before the next
                task order.
              </span>
              <a
                href={`mailto:?subject=${encodeURIComponent(`Change order request: ${vendor.name}`)}&body=${encodeURIComponent(`${vendor.name} is in amendment territory. Please review a change order before the next task order.`)}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-semibold no-underline"
                style={{
                  color: 'var(--color-util-amend)',
                  border:
                    '1px solid color-mix(in oklab, var(--color-util-amend) 60%, transparent)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                Request change order
              </a>
            </div>
          </td>
        </tr>
      ) : null}

      {isOpen && hasDetails ? (
        <tr style={{ borderColor: 'var(--color-border-base)' }}>
          <td
            colSpan={6}
            className="px-5 pb-5 pt-0"
            style={{ background: 'var(--color-surface-muted)' }}
          >
            <div className="flex flex-col gap-5 pt-4">
              {vendor.contract ? (
                <div
                  className="rounded-xl border bg-white px-4 py-3 text-sm"
                  style={{ borderColor: 'var(--color-border-base)' }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <FileText className="mt-0.5 size-4 text-[color:var(--wf-strong)]" />
                      <div>
                        <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-text-muted">
                          Master Service Agreement
                        </p>
                        <p className="font-ops text-sm font-semibold text-text-strong">
                          {vendor.contract.refName}
                        </p>
                        <p className="text-xs text-text-muted">
                          Executed {vendor.contract.executedOn}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-text-muted">
                        MSA value
                      </p>
                      <p className="font-mono text-sm font-semibold text-text-strong">
                        {formatCurrency(vendor.contract.value)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {phaseGroups.length > 0 ? (
                <div
                  className="rounded-xl border bg-white"
                  style={{ borderColor: 'var(--color-border-base)' }}
                >
                  <header
                    className="flex items-center justify-between border-b px-4 py-2.5"
                    style={{ borderColor: 'var(--color-border-base)' }}
                  >
                    <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-text-muted">
                      Task orders by phase
                    </p>
                    <p className="font-mono text-xs text-text-muted">
                      Total{' '}
                      <span className="text-text-strong">
                        {formatCurrency(taskOrderTotal)}
                      </span>
                    </p>
                  </header>
                  <ul
                    className="divide-y"
                    style={{ borderColor: 'var(--color-border-base)' }}
                  >
                    {phaseGroups.map((group) => (
                      <li key={group.phase} className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="inline-flex h-6 min-w-9 items-center justify-center rounded-full px-2 font-mono text-[0.7rem] font-semibold"
                              style={{
                                background: 'var(--wf-soft)',
                                color: 'var(--wf-strong)',
                              }}
                            >
                              {group.phase}
                            </span>
                            <span className="text-xs text-text-muted">
                              {group.taskOrders.length} order
                              {group.taskOrders.length === 1 ? '' : 's'} ·{' '}
                              <span className="font-mono text-text-strong">
                                {formatCurrency(group.total)}
                              </span>
                            </span>
                          </span>
                        </div>
                        <ul className="mt-2 space-y-1.5">
                          {group.taskOrders.map((to) => (
                            <li
                              key={to.id}
                              className="flex flex-wrap items-center justify-between gap-2 text-xs"
                            >
                              <span className="font-mono text-text-strong">
                                {to.number}
                                {to.referencedByInvoice ? (
                                  <span className="ml-2 rounded-full bg-[color:var(--color-surface-muted)] px-2 py-0.5 text-[0.64rem] uppercase tracking-[0.08em] text-text-muted">
                                    Referenced by invoice
                                  </span>
                                ) : null}
                              </span>
                              <span className="font-mono text-text-strong">
                                {formatCurrency(to.value)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {vendor.changeOrders && vendor.changeOrders.length > 0 ? (
                <div
                  className="rounded-xl border bg-white"
                  style={{ borderColor: 'var(--color-border-base)' }}
                >
                  <header
                    className="flex items-center justify-between border-b px-4 py-2.5"
                    style={{ borderColor: 'var(--color-border-base)' }}
                  >
                    <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-text-muted">
                      Change orders
                    </p>
                    <p className="font-mono text-xs text-text-muted">
                      Total{' '}
                      <span className="text-text-strong">
                        {formatCurrency(changeOrderTotal)}
                      </span>
                    </p>
                  </header>
                  <ul
                    className="divide-y"
                    style={{ borderColor: 'var(--color-border-base)' }}
                  >
                    {vendor.changeOrders.map((co) => (
                      <li
                        key={co.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs"
                      >
                        <span className="font-mono text-text-strong">
                          {co.number}
                        </span>
                        <span className="font-mono text-text-strong">
                          {formatCurrency(co.value)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}
