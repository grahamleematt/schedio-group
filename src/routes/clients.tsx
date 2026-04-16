import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowRight, Building2, Check, Clock3 } from 'lucide-react'
import {
  clients,
  getOpenVerification,
  ghostDeveloperEntities,
  mockUser,
  workflowConfigs,
} from '#/lib/sg-dream'

type ClientsSearch = {
  selected?: string
}

export const Route = createFileRoute('/clients')({
  validateSearch: (s: Record<string, unknown>): ClientsSearch => ({
    selected:
      typeof s.selected === 'string' && s.selected.length > 0
        ? s.selected
        : undefined,
  }),
  head: () => ({ meta: [{ title: 'Select entity | SG DREAM' }] }),
  component: ClientsPage,
})

function ClientsPage() {
  const { selected } = Route.useSearch()
  const navigate = useNavigate()

  // Only entities the logged-in user is granted access to (doc §2 isolation rule).
  const permitted = clients.filter((c) =>
    mockUser.permittedClientIds.includes(c.id),
  )

  const selectedClient = permitted.find((c) => c.id === selected)
  const canContinue = Boolean(selectedClient)

  const continueSearch = selectedClient
    ? {
        client: selectedClient.id,
        verification: getOpenVerification(selectedClient.id).id,
      }
    : undefined

  return (
    <main className="page-wrap page-frame" data-workflow="district_dp">
      <div className="mx-auto flex max-w-[720px] flex-col gap-6">
        <header>
          <p className="ops-label">Step 1 · Choose an entity</p>
          <h1 className="mt-2 font-ops text-2xl font-semibold tracking-[-0.02em] text-text-strong">
            Welcome back, {mockUser.name.split(' ')[0]}
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            You have been granted access to the following entities. Selecting
            one locks in the workflow for this session — no manual workflow
            selection needed.
          </p>
        </header>

        <ul className="flex flex-col gap-3">
          {permitted.map((c) => {
            const workflow = workflowConfigs[c.workflow]
            const isSelected = selected === c.id
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() =>
                    void navigate({
                      to: '/clients',
                      search: { selected: c.id },
                      resetScroll: false,
                    })
                  }
                  data-workflow={c.workflow}
                  className="group flex w-full items-center gap-4 rounded-2xl border bg-white px-5 py-4 text-left transition-colors hover:border-[color:var(--wf-border)] hover:bg-[color:var(--wf-softer)]"
                  style={{
                    borderColor: isSelected
                      ? 'var(--wf-border)'
                      : 'var(--color-border-base)',
                    background: isSelected
                      ? 'var(--wf-soft)'
                      : 'var(--color-surface-panel)',
                    boxShadow: isSelected
                      ? 'inset 0 0 0 1px var(--wf-border)'
                      : undefined,
                  }}
                >
                  <span
                    aria-hidden
                    className="inline-flex size-12 items-center justify-center rounded-xl"
                    style={{
                      background: 'var(--wf-soft)',
                      color: 'var(--wf-strong)',
                    }}
                  >
                    <Building2 className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-ops text-base font-semibold text-text-strong">
                        {c.name}
                      </p>
                      <span className="workflow-pill">{workflow.label}</span>
                    </div>
                    <p className="text-xs text-text-muted">
                      {c.region} · Entity Owner: {c.entityOwnerName}
                    </p>
                  </div>
                  <span
                    aria-hidden
                    className="inline-flex size-7 items-center justify-center rounded-full border"
                    style={{
                      background: isSelected
                        ? 'var(--wf-base)'
                        : 'transparent',
                      borderColor: isSelected
                        ? 'var(--wf-base)'
                        : 'var(--color-border-strong)',
                      color: 'var(--color-brand-white)',
                    }}
                  >
                    {isSelected ? <Check className="size-3.5" /> : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <section className="flex flex-col gap-3">
          <header>
            <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-text-muted">
              Developer Reimbursement entities (coming in phase 2)
            </p>
            <p className="mt-1 text-xs text-text-muted">
              These blue-flow entities are telegraphed here so the eventual
              mixed-workflow experience is visible, but they are not yet
              active.
            </p>
          </header>
          <ul className="flex flex-col gap-3" aria-label="Phase 2 entities">
            {ghostDeveloperEntities.map((g) => {
              const workflow = workflowConfigs[g.workflow]
              return (
                <li key={g.id}>
                  <div
                    aria-disabled="true"
                    role="button"
                    tabIndex={-1}
                    data-workflow={g.workflow}
                    className="flex w-full cursor-not-allowed items-center gap-4 rounded-2xl border bg-white px-5 py-4 text-left opacity-70"
                    style={{
                      borderColor: 'var(--color-border-base)',
                      background: 'var(--color-surface-muted)',
                    }}
                  >
                    <span
                      aria-hidden
                      className="inline-flex size-12 items-center justify-center rounded-xl"
                      style={{
                        background: 'var(--wf-soft)',
                        color: 'var(--wf-strong)',
                      }}
                    >
                      <Building2 className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-ops text-base font-semibold text-text-muted">
                          {g.name}
                        </p>
                        <span className="workflow-pill">{workflow.label}</span>
                      </div>
                      <p className="text-xs text-text-muted">{g.region}</p>
                    </div>
                    <span
                      aria-hidden
                      className="inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-0.5 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-text-muted"
                      style={{ borderColor: 'var(--color-border-base)' }}
                    >
                      <Clock3 className="size-3" />
                      Phase 2
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-xs text-text-muted">
            Competing entities are fully isolated. You will never see
            workspaces that conflict with your other assignments.
          </p>
          {canContinue && continueSearch ? (
            <Link
              to="/verifications"
              search={continueSearch}
              className="wf-button-primary"
              data-workflow={selectedClient?.workflow}
            >
              Continue
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <button type="button" className="wf-button-primary" disabled>
              Continue
              <ArrowRight className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
