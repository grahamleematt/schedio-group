import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Mail } from 'lucide-react'
import { AppShell } from '#/components/sg-dream/AppShell'
import {
  clients,
  computeContractSummary,
  computeVendorUtilization,
  formatCurrency,
  getClientById,
  getOpenVerification,
  getVendorsByClient,
} from '#/lib/sg-dream'
import type { Vendor } from '#/lib/sg-dream'
import { verificationSnapshotQuery } from '#/lib/queries'

type ContractsSearch = {
  client: string
}

export const Route = createFileRoute('/contracts')({
  validateSearch: (s: Record<string, unknown>): ContractsSearch => ({
    client: typeof s.client === 'string' ? s.client : 'srcab',
  }),
  loader: ({ context, location }) => {
    const search = location.search as ContractsSearch
    const requested =
      typeof search.client === 'string' ? search.client : 'srcab'
    const known = clients.find((c) => c.id === requested)
    if (!known) {
      throw redirect({ to: '/contracts', search: { client: 'srcab' } })
    }
    const open = getOpenVerification(known.id)
    return context.queryClient.ensureQueryData(
      verificationSnapshotQuery(open.id),
    )
  },
  head: () => ({ meta: [{ title: 'Contract tracking | SG DREAM' }] }),
  component: ContractsPage,
})

function bandLabel(band: 'healthy' | 'monitor' | 'amend'): string {
  if (band === 'amend') return 'Amend likely'
  if (band === 'monitor') return 'Monitor'
  return 'Healthy'
}

function bandPill(band: 'healthy' | 'monitor' | 'amend'): string {
  if (band === 'amend') return 'pill pill-red'
  if (band === 'monitor') return 'pill pill-amber'
  return 'pill pill-green'
}

function ContractsPage() {
  const { client: clientId } = Route.useSearch()
  const client = getClientById(clientId)
  const vendors = getVendorsByClient(client.id)
  const summary = computeContractSummary(client.id)
  const open = getOpenVerification(client.id)
  // Keep the snapshot query warm for the AppShell sidebar counts.
  useQuery(verificationSnapshotQuery(open.id))

  const ranked: ReadonlyArray<
    Vendor & ReturnType<typeof computeVendorUtilization>
  > = vendors
    .map((v) => ({ ...v, ...computeVendorUtilization(v) }))
    .slice()
    .sort((a, b) => b.pct - a.pct)

  const amendVendors = ranked.filter((v) => v.band === 'amend')
  const monitorVendors = ranked.filter((v) => v.band === 'monitor')

  const rail = (
    <section className="v2-card">
      <header className="v2-card-head">
        <h3>Health bands</h3>
      </header>
      <div className="v2-card-body">
        <BandRow label="Healthy" range="< 70%" band="healthy" sample={50} />
        <BandRow label="Monitor" range="70–89%" band="monitor" sample={75} />
        <BandRow label="Amend" range="≥ 90%" band="amend" sample={95} />
        <p className="text-muted-1 mt-3 m-0 text-[12px]">
          Bands are derived from spent ÷ authorized across every approved
          verification, plus open-verification estimates.
        </p>
      </div>
    </section>
  )

  return (
    <AppShell
      active="contracts"
      crumbs={[{ label: 'Contract tracking' }]}
      rail={rail}
    >
      <header className="mb-3">
        <p className="v2-eyebrow">Entity workspace</p>
        <h1 className="v2-h1">Contract tracking · {client.name}</h1>
        <p className="v2-lede">
          Per-vendor contract authorizations, spend, and amendment risk.
          Numbers reflect every approved verification through V
          {Math.max(open.number - 1, 1)}, plus open V{open.number} estimates.
        </p>
      </header>

      <div className="v2-stats mb-3">
        <div className="v2-stat">
          <div className="k">Authorized total</div>
          <div className="v mono">{formatCurrency(summary.authorized)}</div>
          <div className="d">across {vendors.length} active vendors</div>
        </div>
        <div className="v2-stat">
          <div className="k">Spent to date</div>
          <div className="v mono">{formatCurrency(summary.spent)}</div>
          <div className="d">{Math.round(summary.pct)}% of authorized</div>
        </div>
        <div className="v2-stat">
          <div className="k">Remaining</div>
          <div className="v mono">{formatCurrency(summary.remaining)}</div>
          <div className="d">runway against open authorizations</div>
        </div>
        <div className="v2-stat">
          <div className="k">Amendments likely</div>
          <div
            className="v"
            style={{
              color:
                amendVendors.length > 0
                  ? 'var(--color-red-base)'
                  : 'var(--color-ink)',
            }}
          >
            {amendVendors.length}
          </div>
          <div className="d">
            {amendVendors.length === 0
              ? 'no vendors above 90%'
              : amendVendors.map((v) => v.name).join(' · ')}
          </div>
        </div>
      </div>

      {amendVendors.length > 0 ? (
        <div className="errbar amber mb-3" role="status">
          <div className="icn" aria-hidden>
            <AlertTriangle className="size-3.5" />
          </div>
          <div>
            <div className="font-semibold">
              {amendVendors[0].name} is at {Math.round(amendVendors[0].pct)}%
              of authorized — request a contract amendment now
            </div>
            <div className="text-[11.5px] opacity-85">
              At current spend velocity, the contract caps within the next
              verification window. Amendment processing takes 10–14 business
              days through the district board.
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <a
              href={`mailto:?subject=${encodeURIComponent(`Contract amendment request: ${amendVendors[0].name}`)}&body=${encodeURIComponent(`${amendVendors[0].name} is at ${Math.round(amendVendors[0].pct)}% utilization. Please review amendment timing for ${client.name}.`)}`}
              className="v2-btn"
            >
              <Mail className="size-4" aria-hidden />
              Request amendment
            </a>
            <a
              href={`mailto:?subject=${encodeURIComponent(`Notify SG: ${amendVendors[0].name} utilization`)}&body=${encodeURIComponent(`${amendVendors[0].name} requires review in ${client.name}.`)}`}
              className="v2-btn"
            >
              <Mail className="size-4" aria-hidden />
              Notify SG
            </a>
          </div>
        </div>
      ) : monitorVendors.length > 0 ? (
        <p className="text-muted-1 mb-3 text-[12.5px]">
          No vendors are above the amendment threshold. {monitorVendors.length}{' '}
          vendor{monitorVendors.length === 1 ? '' : 's'} in the monitor band.
        </p>
      ) : null}

      <section className="v2-card">
        <header className="v2-card-head">
          <h3>Vendors</h3>
          <span className="sub">Sorted by utilization (highest first)</span>
        </header>
        <div className="v2-table-scroll">
          <table className="v2-tbl">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Contract</th>
                <th className="num">Authorized</th>
                <th className="num">Spent</th>
                <th className="num">Remaining</th>
                <th style={{ width: '28%' }}>Utilization</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((v) => {
                const pctRound = Math.round(v.pct)
                const pctColor =
                  v.band === 'amend'
                    ? 'var(--color-red-base)'
                    : v.band === 'monitor'
                      ? 'var(--color-amber-base)'
                      : 'var(--color-green-base)'
                return (
                  <tr key={v.id}>
                    <td>
                      <strong>{v.name}</strong>
                      <div className="text-muted-1 mono mt-0.5 text-[11px]">
                        {v.code}
                        {v.contract ? ` · ${v.contract.refName}` : ''}
                      </div>
                    </td>
                    <td className="mono">
                      {v.contract?.refName ?? '—'}
                      {v.contract ? (
                        <div className="text-muted-1 text-[11px]">
                          Executed {v.contract.executedOn}
                        </div>
                      ) : null}
                    </td>
                    <td className="num mono">
                      {formatCurrency(v.authorized)}
                    </td>
                    <td className="num mono">{formatCurrency(v.spent)}</td>
                    <td className="num mono">
                      {formatCurrency(v.remaining)}
                    </td>
                    <td>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="mono font-semibold"
                          style={{ color: pctColor }}
                        >
                          {pctRound}%
                        </span>
                        <span className={bandPill(v.band)}>
                          <span className="dot" />
                          {bandLabel(v.band)}
                        </span>
                      </div>
                      <div className={`ubar ${v.band}`}>
                        <span style={{ width: `${pctRound}%` }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  )
}

function BandRow({
  label,
  range,
  band,
  sample,
}: {
  label: string
  range: string
  band: 'healthy' | 'monitor' | 'amend'
  sample: number
}) {
  return (
    <div className="kv">
      <span className="k flex items-center gap-2">
        <span
          className={`ubar ${band} inline-block`}
          style={{ width: '60px' }}
        >
          <span style={{ width: `${sample}%` }} />
        </span>
        {label}
      </span>
      <span className="v mono">{range}</span>
    </div>
  )
}
