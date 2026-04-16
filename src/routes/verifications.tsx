import { Link, createFileRoute } from '@tanstack/react-router'
import { WorkflowChrome } from '#/components/sg-dream/WorkflowChrome'
import { WorkflowBanner } from '#/components/sg-dream/WorkflowBanner'
import { VerificationPill } from '#/components/sg-dream/VerificationPill'
import { StorytellerGate } from '#/components/sg-dream/StorytellerGate'
import {
  formatCurrency,
  getClientById,
  getOpenVerification,
  getStatusLabel,
  getVerificationsByClient,
  mockUser,
} from '#/lib/sg-dream'

type VerificationsSearch = {
  client: string
}

export const Route = createFileRoute('/verifications')({
  validateSearch: (s: Record<string, unknown>): VerificationsSearch => ({
    client: typeof s.client === 'string' ? s.client : 'srcab',
  }),
  head: () => ({ meta: [{ title: 'Verifications | SG DREAM' }] }),
  component: VerificationsPage,
})

function VerificationsPage() {
  const { client: clientId } = Route.useSearch()
  const client = getClientById(clientId)
  const all = getVerificationsByClient(client.id)
  const open = getOpenVerification(client.id)
  const previous = all.filter((v) => v.id !== open.id)

  return (
    <WorkflowChrome
      workflow={client.workflow}
      entityName={client.name}
      eyebrow="Step 2 · Verifications"
      title={`${client.name} · Verifications`}
      description="The verification currently open for submission is shown first. Past verifications are listed below with their status and totals."
    >
      <WorkflowBanner workflow={client.workflow} />

      <StorytellerGate
        user={mockUser}
        client={client}
        verification={open}
        workflow={client.workflow}
      />

      <section
        className="brand-panel overflow-hidden rounded-2xl p-6"
        style={{
          background:
            'linear-gradient(180deg, var(--wf-softer), rgba(255,255,255,0.96))',
          borderColor: 'var(--wf-border)',
        }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <VerificationPill number={open.number} period={open.period} />
              <span className="status-pill-open">Currently open</span>
            </div>
            <h2 className="font-ops text-xl font-semibold tracking-[-0.02em] text-text-strong">
              Verification No. {open.number} · {open.period}
            </h2>
            <p className="text-sm text-text-muted">
              Totals so far for V{open.number}. Schedio Group assigns a
              reference number when this submission finalizes.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile label="Documents so far" value={`${open.docsCount}`} />
            <StatTile
              label="Costs submitted"
              value={formatCurrency(open.costsSubmitted)}
            />
            <StatTile
              label="Work authorization"
              value={formatCurrency(open.workAuthValue)}
            />
          </dl>
        </div>
      </section>

      <section
        className="brand-panel overflow-hidden rounded-2xl"
        style={{ borderColor: 'var(--color-border-base)' }}
      >
        <header
          className="border-b px-5 py-4"
          style={{ borderColor: 'var(--color-border-base)' }}
        >
          <p className="ops-label m-0">Previous verifications</p>
          <p className="text-sm text-text-muted">
            Amounts and status are assigned by Schedio Group as each
            verification is reviewed.
          </p>
        </header>
        <ul
          className="divide-y"
          style={{ borderColor: 'var(--color-border-base)' }}
        >
          {previous.map((v) => (
            <li
              key={v.id}
              className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-wrap items-center gap-2">
                <VerificationPill
                  number={v.number}
                  period={v.period}
                  tone="neutral"
                />
                {v.status === 'approved' ? (
                  <span className="status-pill-approved">
                    {getStatusLabel(v.status)}
                  </span>
                ) : v.status === 'under_review' ? (
                  <span className="status-pill-review">
                    {getStatusLabel(v.status)}
                  </span>
                ) : (
                  <span className="status-pill-open">
                    {getStatusLabel(v.status)}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-right">
                <div>
                  <p className="font-mono text-[0.68rem] uppercase tracking-[0.08em] text-text-muted">
                    Submitted
                  </p>
                  <p className="font-mono text-sm text-text-strong">
                    {formatCurrency(v.costsSubmitted)}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[0.68rem] uppercase tracking-[0.08em] text-text-muted">
                    Verified
                  </p>
                  <p className="font-mono text-sm text-text-strong">
                    {v.status === 'approved'
                      ? formatCurrency(v.costsVerified)
                      : 'Pending'}
                  </p>
                </div>
              </div>
            </li>
          ))}
          {previous.length === 0 ? (
            <li className="px-5 py-8 text-center text-sm text-text-muted">
              No previous verifications yet for this entity.
            </li>
          ) : null}
        </ul>
      </section>
    </WorkflowChrome>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl border bg-white/95 px-3 py-2"
      style={{ borderColor: 'var(--color-border-base)' }}
    >
      <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-text-muted">
        {label}
      </p>
      <p className="mt-0.5 font-ops text-base font-semibold text-text-strong">
        {value}
      </p>
    </div>
  )
}
