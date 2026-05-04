import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQueries } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import {
  clients,
  getOpenVerification,
  ghostDeveloperEntities,
  mockUser,
  workflowConfigs,
} from '#/lib/sg-dream'
import type { Client } from '#/lib/sg-dream'
import { verificationSnapshotQuery } from '#/lib/queries'
import { liveVerificationTotals } from '#/lib/sg-dream-adapter'

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
  loader: ({ context }) => {
    // Warm the open-verification snapshot for every entity the user can see,
    // so each entity card can render its real (live) "Docs in queue" count
    // instead of the seeded mock fixture.
    const permitted = clients.filter((c) =>
      mockUser.permittedClientIds.includes(c.id),
    )
    return Promise.all(
      permitted.map((c) =>
        context.queryClient.ensureQueryData(
          verificationSnapshotQuery(getOpenVerification(c.id).id),
        ),
      ),
    )
  },
  head: () => ({ meta: [{ title: 'Select entity | SG DREAM' }] }),
  component: ClientsPage,
})

function workflowDataAttr(workflow: Client['workflow']): Client['workflow'] {
  return workflow
}

function ClientsPage() {
  const { selected } = Route.useSearch()
  const navigate = useNavigate()

  // Only entities the logged-in user is granted access to (doc §2 isolation rule).
  const permitted = clients.filter((c) =>
    mockUser.permittedClientIds.includes(c.id),
  )

  // Read the live snapshot for each entity's open verification so we can show
  // real queue depth on every card (Downtown BID, etc.), not just the seed.
  const opens = permitted.map((c) => getOpenVerification(c.id))
  const snapshotResults = useQueries({
    queries: opens.map((open) => verificationSnapshotQuery(open.id)),
  })
  const liveByClient = new Map(
    permitted.map((c, idx) => {
      const open = opens[idx]
      const snapshot = snapshotResults[idx]?.data ?? null
      return [
        c.id,
        liveVerificationTotals({
          snapshot,
          mockDocsCount: open.docsCount,
          mockCostsSubmitted: open.costsSubmitted,
        }),
      ]
    }),
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
    <main
      className="stage"
      style={{ alignItems: 'flex-start', paddingTop: '72px' }}
      data-workflow={
        selectedClient ? workflowDataAttr(selectedClient.workflow) : 'district_dp'
      }
    >
      <div className="w-full max-w-[720px]">
        <div className="flex items-center gap-2.5">
          <div className="sigma">Σ</div>
          <div>
            <div className="text-[14px] font-semibold tracking-[-0.01em] text-ink">
              Schedio Group · SG DREAM
            </div>
            <p className="ops-label m-0 mt-px">Step 1 · Choose an entity</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="chip">
              <span
                aria-hidden
                className="bg-paper-2 grid place-items-center rounded-full text-[10px] font-semibold"
                style={{ width: '22px', height: '22px' }}
              >
                {mockUser.initials}
              </span>
              {mockUser.name}
            </span>
          </div>
        </div>

        <h1 className="v2-h1 mt-4">
          Welcome back, {mockUser.name.split(' ')[0]}
        </h1>
        <p className="v2-lede">
          You have been granted access to the following entities. Selecting one
          locks in the workflow for this session.
        </p>

        <div className="ent-grid mt-4">
          {permitted.map((c) => {
            const workflow = workflowConfigs[c.workflow]
            const open = getOpenVerification(c.id)
            const live = liveByClient.get(c.id)
            const isSelected = selected === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() =>
                  void navigate({
                    to: '/clients',
                    search: { selected: c.id },
                    resetScroll: false,
                  })
                }
                data-workflow={workflowDataAttr(c.workflow)}
                className={`ent-card${isSelected ? ' selected' : ''}`}
                aria-pressed={isSelected}
              >
                <div className="flex items-center gap-2.5">
                  <div className="emb">{c.code}</div>
                  <div className="min-w-0">
                    <h4 className="m-0 font-ops text-[15px] font-semibold tracking-[-0.01em] text-ink">
                      {c.name}
                    </h4>
                    <div className="text-muted-1 text-[12px]">{c.region}</div>
                  </div>
                  <div className="ml-auto">
                    <span className="pill pill-wf">
                      <span className="dot" />
                      {workflow.shortLabel}
                    </span>
                  </div>
                </div>
                <div className="mt-3.5 grid grid-cols-3 gap-2.5">
                  <div>
                    <p className="ops-label m-0">Open Verif.</p>
                    <p className="m-0 mt-0.5 font-mono text-[13px] font-semibold text-ink">
                      V{open.number} · {open.period}
                    </p>
                  </div>
                  <div>
                    <p className="ops-label m-0">Cutoff</p>
                    <p className="m-0 mt-0.5 font-mono text-[13px] font-semibold text-ink">
                      {open.cutoffDate}
                    </p>
                  </div>
                  <div>
                    <p className="ops-label m-0">Docs in queue</p>
                    <p className="m-0 mt-0.5 font-mono text-[13px] font-semibold text-ink">
                      {live?.docsCount ?? open.docsCount}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}

          {ghostDeveloperEntities.map((g) => {
            const workflow = workflowConfigs[g.workflow]
            return (
              <div
                key={g.id}
                className="ent-card ghost"
                data-workflow={workflowDataAttr(g.workflow)}
                aria-disabled="true"
                role="button"
                tabIndex={-1}
              >
                <div className="flex items-center gap-2.5">
                  <div className="emb">{g.code}</div>
                  <div className="min-w-0">
                    <h4 className="m-0 font-ops text-[15px] font-semibold tracking-[-0.01em] text-ink">
                      {g.name}
                    </h4>
                    <div className="text-muted-1 text-[12px]">
                      Phase 2 · {workflow.label}
                    </div>
                  </div>
                  <div className="ml-auto">
                    <span className="pill pill-brand">
                      <span className="dot" />
                      Coming soon
                    </span>
                  </div>
                </div>
                <p className="text-muted-1 m-0 mt-3 text-[12px]">
                  Blue workflow entities are telegraphed so you see the
                  mixed-workspace experience before Phase 2 ships.
                </p>
              </div>
            )
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <p className="text-muted-1 m-0 max-w-[31rem] text-[11.5px]">
            Competing entities are fully isolated. You will never see
            workspaces that conflict with your other assignments.
          </p>
          {canContinue && continueSearch ? (
            <Link
              to="/dashboard"
              search={continueSearch}
              className="v2-btn primary lg shrink-0"
              data-workflow={
                selectedClient
                  ? workflowDataAttr(selectedClient.workflow)
                  : 'district_dp'
              }
            >
              Continue to workspace
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <button
              type="button"
              className="v2-btn primary lg shrink-0"
              disabled
              aria-disabled="true"
            >
              Continue to workspace
              <ArrowRight className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
