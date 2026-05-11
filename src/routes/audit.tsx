import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { AppShell } from '#/components/sg-dream/AppShell'
import {
  clients,
  getClientById,
  getOpenVerification,
  pendingUsers,
} from '#/lib/sg-dream'
import { auditLogQuery, verificationSnapshotQuery } from '#/lib/queries'
import type { AuditLogEntry } from '#/server/fns/getAuditLog'

type AuditFilter = 'all' | AuditLogEntry['category']

const filterValues: ReadonlyArray<{ id: AuditFilter; label: string }> = [
  { id: 'all', label: 'All events' },
  { id: 'documents', label: 'Documents' },
  { id: 'verifications', label: 'Verifications' },
  { id: 'access', label: 'Access' },
  { id: 'auth', label: 'Auth' },
  { id: 'system', label: 'System' },
]

const filterIds = new Set<AuditFilter>([
  'all',
  'auth',
  'documents',
  'verifications',
  'access',
  'system',
])

const AUDIT_TIME_ZONE = 'America/Denver'
const AUDIT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: AUDIT_TIME_ZONE,
})

type AuditSearch = {
  client: string
  filter?: AuditFilter
}

export const Route = createFileRoute('/audit')({
  validateSearch: (s: Record<string, unknown>): AuditSearch => ({
    client: typeof s.client === 'string' ? s.client : 'srcab',
    filter:
      typeof s.filter === 'string' && filterIds.has(s.filter as AuditFilter)
        ? (s.filter as AuditFilter)
        : undefined,
  }),
  loader: ({ context, location }) => {
    const search = location.search as AuditSearch
    const requested =
      typeof search.client === 'string' ? search.client : 'srcab'
    const known = clients.find((c) => c.id === requested)
    if (!known) {
      throw redirect({ to: '/audit', search: { client: 'srcab' } })
    }
    const open = getOpenVerification(known.id)
    return Promise.all([
      context.queryClient.ensureQueryData(verificationSnapshotQuery(open.id)),
      context.queryClient.ensureQueryData(auditLogQuery(known.id)),
    ])
  },
  head: () => ({ meta: [{ title: 'Audit log | SG DREAM' }] }),
  component: AuditPage,
})

function resultPillClass(result: AuditLogEntry['result']): string {
  if (result === 'failed') return 'pill pill-red'
  if (result === 'override' || result === 'flagged' || result === 'pending')
    return 'pill pill-amber'
  return 'pill pill-green'
}

function resultLabel(result: AuditLogEntry['result']): string {
  switch (result) {
    case 'ok':
      return 'OK'
    case 'override':
      return 'Override'
    case 'flagged':
      return 'Flagged'
    case 'pending':
      return 'Pending'
    case 'failed':
      return 'Failed'
  }
}

function sourcePill(source: AuditLogEntry['source']): {
  label: string
  className: string
} {
  switch (source) {
    case 'docupipe':
      return { label: 'DocuPipe', className: 'pill pill-wf' }
    case 'egnyte':
      return { label: 'Egnyte', className: 'pill pill-amber' }
    case 'user':
      return { label: 'User', className: 'pill pill-gray' }
    case 'system':
      return { label: 'System', className: 'pill pill-gray' }
  }
}

function isToday(iso: string): boolean {
  const ts = new Date(iso)
  if (Number.isNaN(ts.getTime())) return false
  return AUDIT_DATE_FORMATTER.format(ts) ===
    AUDIT_DATE_FORMATTER.format(new Date())
}

function AuditPage() {
  const navigate = useNavigate()
  const { client: clientId, filter } = Route.useSearch()
  const client = getClientById(clientId)

  const auditQuery = useSuspenseQuery(auditLogQuery(client.id))
  const events = auditQuery.data

  const activeFilter: AuditFilter = filter ?? 'all'
  const filtered: ReadonlyArray<AuditLogEntry> =
    activeFilter === 'all'
      ? events
      : events.filter((e) => e.category === activeFilter)

  // "Today" metrics use only live events (which carry an ISO timestamp);
  // mock fixtures fall back to their textual time label and are excluded
  // from these counts.
  const liveEvents = events.filter((e) => e.source !== 'system')
  const todayEvents = liveEvents.filter((e) => isToday(e.ts))
  const todayActors = new Set(todayEvents.map((e) => e.actor)).size
  const todayFailures = todayEvents.filter((e) => e.result === 'failed').length
  const docupipeEventsToday = todayEvents.filter(
    (e) => e.source === 'docupipe',
  ).length
  const egnyteEventsToday = todayEvents.filter(
    (e) => e.source === 'egnyte',
  ).length

  const setFilter = (next: AuditFilter) => {
    void navigate({
      to: '/audit',
      search: { client: client.id, filter: next === 'all' ? undefined : next },
      resetScroll: false,
    })
  }

  const rail = (
    <>
      <section className="v2-card">
        <header className="v2-card-head">
          <h3>Today</h3>
        </header>
        <div className="v2-card-body">
          <div className="kv">
            <span className="k">Live events</span>
            <span className="v mono">{todayEvents.length}</span>
          </div>
          <div className="kv">
            <span className="k">Actors</span>
            <span className="v mono">{todayActors}</span>
          </div>
          <div className="kv">
            <span className="k">Failures</span>
            <span className="v">
              {todayFailures > 0 ? (
                <span className="pill pill-red">{todayFailures}</span>
              ) : (
                <span className="pill pill-green">0</span>
              )}
            </span>
          </div>
          <div className="kv">
            <span className="k">DocuPipe events</span>
            <span className="v mono">{docupipeEventsToday}</span>
          </div>
          <div className="kv">
            <span className="k">Egnyte events</span>
            <span className="v mono">{egnyteEventsToday}</span>
          </div>
        </div>
      </section>
      <section className="v2-card">
        <header className="v2-card-head">
          <h3>Live audit</h3>
        </header>
        <div className="v2-card-body space-y-2 text-[12.5px] text-ink-2">
          <p className="m-0">
            DocuPipe webhook events stream into this ledger as Schedio's
            pipeline classifies, extracts, and files each document.
          </p>
          <p className="m-0 text-muted-1">
            Auth + access rows are seeded from a historical fixture so the
            screen renders a populated timeline pre-launch.
          </p>
        </div>
      </section>
    </>
  )

  return (
    <AppShell
      active="audit"
      crumbs={[{ label: 'Audit log' }]}
      rail={rail}
      pendingUsers={pendingUsers.length}
      recentAuditEvents={todayEvents.length}
    >
      <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="v2-eyebrow">Administration</p>
          <h1 className="v2-h1">Audit log</h1>
          <p className="v2-lede">
            Append-only ledger of every action taken on this entity —
            including live DocuPipe + Egnyte pipeline events. Filter by
            category or export with the cryptographic chain hash.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="v2-seg" role="tablist" aria-label="Filter audit log">
            {filterValues.map((f) => {
              const active = activeFilter === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={active ? 'on' : ''}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
          <span className="chip">Export retained by SG Admin</span>
        </div>
      </header>

      <section className="v2-card">
        <div className="v2-table-scroll">
          <table className="v2-tbl">
            <thead>
              <tr>
                <th>Time (MST)</th>
                <th>Source</th>
                <th>Actor</th>
                <th>Event</th>
                <th>Object</th>
                <th>Result</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const pill = sourcePill(e.source)
                return (
                  <tr key={e.id}>
                    <td className="mono">{e.timeLabel}</td>
                    <td>
                      <span className={pill.className}>
                        <span className="dot" />
                        {pill.label}
                      </span>
                    </td>
                    <td>{e.actor}</td>
                    <td>
                      <div>{e.event}</div>
                      {e.docupipeEventType ? (
                        <div className="mono text-[11px] text-muted-1">
                          {e.docupipeEventType}
                        </div>
                      ) : null}
                      {e.detail ? (
                        <div className="text-[11px] text-muted-1">
                          {e.detail}
                        </div>
                      ) : null}
                    </td>
                    <td className="mono">{e.object}</td>
                    <td>
                      <span className={resultPillClass(e.result)}>
                        <span className="dot" />
                        {resultLabel(e.result)}
                      </span>
                    </td>
                    <td className="mono text-muted-1">{e.ip ?? '—'}</td>
                  </tr>
                )
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-muted-1 text-center text-[12.5px]"
                  >
                    No events match the selected filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  )
}
