import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { AppShell } from '#/components/sg-dream/AppShell'
import {
  accessRoleLabels,
  clients,
  getClientById,
  getOpenVerification,
  pendingUsers,
} from '#/lib/sg-dream'
import { userDirectoryQuery, verificationSnapshotQuery } from '#/lib/queries'

type UsersSearch = {
  client: string
}

export const Route = createFileRoute('/users')({
  validateSearch: (s: Record<string, unknown>): UsersSearch => ({
    client: typeof s.client === 'string' ? s.client : 'dawson-trails-md1',
  }),
  loader: ({ context, location }) => {
    const search = location.search as UsersSearch
    const requested =
      typeof search.client === 'string' ? search.client : 'dawson-trails-md1'
    const known = clients.find((c) => c.id === requested)
    if (!known) {
      throw redirect({ to: '/users', search: { client: 'dawson-trails-md1' } })
    }
    const open = getOpenVerification(known.id)
    return Promise.all([
      context.queryClient.ensureQueryData(verificationSnapshotQuery(open.id)),
      context.queryClient.ensureQueryData(userDirectoryQuery()),
    ])
  },
  head: () => ({ meta: [{ title: 'Users & access | SG DREAM' }] }),
  component: UsersPage,
})

function UsersPage() {
  const { client: clientId } = Route.useSearch()
  const client = getClientById(clientId)
  const open = getOpenVerification(client.id)
  useQuery(verificationSnapshotQuery(open.id))

  // The active-users table is the real WorkOS organization roster (membership,
  // MFA enrollment, last sign-in) joined with each user's Postgres entity
  // access.
  const activeUsers = useSuspenseQuery(userDirectoryQuery()).data

  const rail = (
    <section className="v2-card">
      <header className="v2-card-head">
        <h3>Roles</h3>
      </header>
      <div className="v2-card-body">
        <div className="kv">
          <span className="k">SG Admin</span>
          <span className="v mono">Full</span>
        </div>
        <div className="kv">
          <span className="k">SG PM</span>
          <span className="v mono">Full</span>
        </div>
        <div className="kv">
          <span className="k">Entity Owner</span>
          <span className="v mono">Approve · invite</span>
        </div>
        <div className="kv">
          <span className="k">Client Mgr</span>
          <span className="v mono">Upload</span>
        </div>
        <div className="kv">
          <span className="k">Client Viewer</span>
          <span className="v mono">Read-only</span>
        </div>
      </div>
    </section>
  )

  return (
    <AppShell
      active="users"
      crumbs={[{ label: 'Users & access' }]}
      rail={rail}
      pendingUsers={pendingUsers.length}
      recentAuditEvents={0}
    >
      <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="v2-eyebrow">Administration</p>
          <h1 className="v2-h1">Users &amp; access</h1>
          <p className="v2-lede">
            Entity Owners approve every access request. Pending requests expire
            in 72 hours. Every action is logged in the audit trail.
          </p>
        </div>
        <span className="chip">Access changes handled by SG Admin</span>
      </header>

      <section
        className="v2-card mb-3"
        style={{
          borderColor: 'var(--color-amber-bd)',
          background: 'linear-gradient(180deg, var(--color-amber-bg), #fff)',
        }}
      >
        <header
          className="v2-card-head"
          style={{
            background: 'transparent',
            borderBottomColor: 'var(--color-amber-bd)',
          }}
        >
          <h3 style={{ color: 'var(--color-amber-base)' }}>
            Pending approval · {pendingUsers.length}
          </h3>
          <span className="sub" style={{ color: 'var(--color-amber-base)' }}>
            72-hour window
          </span>
        </header>
        <div className="v2-table-scroll">
          <table className="v2-tbl users-table users-table-pending">
            <colgroup>
              <col style={{ width: '23%' }} />
              <col style={{ width: '26%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '15%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Requester</th>
                <th>Email</th>
                <th>Requested role</th>
                <th>Entity</th>
                <th className="num">Expires</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pendingUsers.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Avatar initials={u.initials} />
                      <div className="min-w-0">
                        <div className="user-name font-semibold text-ink">
                          {u.name}
                        </div>
                        <div className="user-sub text-muted-1 text-[11px]">
                          {u.affiliation}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="mono email-cell">{u.email}</td>
                  <td>
                    <span className="pill pill-gray">
                      {accessRoleLabels[u.requestedRole]}
                    </span>
                  </td>
                  <td>
                    <span className="pill pill-wf">
                      <span className="dot" />
                      {u.entityCode}
                    </span>
                  </td>
                  <td
                    className="num mono whitespace-nowrap"
                    style={{ color: 'var(--color-amber-base)' }}
                  >
                    in {u.expiresInHours}h
                  </td>
                  <td>
                    <div className="flex justify-end">
                      <span className="pill pill-amber">
                        <span className="dot" />
                        Awaiting owner decision
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="v2-card mb-3">
        <header className="v2-card-head">
          <h3>Active users</h3>
          <span className="sub">
            {activeUsers.length} {activeUsers.length === 1 ? 'user' : 'users'} ·
            organization roster
          </span>
        </header>
        <div className="v2-table-scroll">
          <table className="v2-tbl users-table users-table-active">
            <colgroup>
              <col style={{ width: '26%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '18%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Entities</th>
                <th>MFA</th>
                <th>Last sign-in</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {activeUsers.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Avatar initials={u.initials} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-semibold text-ink">
                          <span className="user-name">{u.name}</span>
                          {u.isYou ? (
                            <span
                              className="pill pill-brand"
                              style={{ fontSize: '10px' }}
                            >
                              You
                            </span>
                          ) : null}
                        </div>
                        <div className="email-cell text-muted-1 text-[11px]">
                          {u.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span
                      className={
                        u.role === 'entity_owner'
                          ? 'pill pill-brand'
                          : 'pill pill-gray'
                      }
                    >
                      {accessRoleLabels[u.role]}
                    </span>
                  </td>
                  <td className="mono whitespace-nowrap">
                    {u.entityCodes.join(' · ')}
                  </td>
                  <td>
                    {u.mfa === 'enabled' ? (
                      <span className="pill pill-green">
                        <span className="dot" />
                        Enabled
                      </span>
                    ) : (
                      <span className="pill pill-amber">
                        <span className="dot" />
                        Not set
                      </span>
                    )}
                  </td>
                  <td className="mono whitespace-nowrap text-muted-1">
                    {u.lastSignInLabel}
                  </td>
                  <td>
                    <div className="flex justify-end">
                      <span className="pill pill-gray">SG Admin managed</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        className="v2-card"
        style={{ background: 'var(--color-brand-tint-2, #EAF1FA)' }}
      >
        <div className="v2-card-body">
          <p
            className="ops-label m-0"
            style={{ color: 'var(--color-brand-blue)' }}
          >
            Competitor isolation
          </p>
          <p className="text-ink-2 m-0 mt-1 text-[12.5px] leading-relaxed">
            Your WorkOS account is limited to the entities attached to your
            review package. Additional entity access is granted by SG Admin
            before it appears in this portal.
          </p>
        </div>
      </section>
    </AppShell>
  )
}

function Avatar({ initials }: { initials: string }) {
  return (
    <span
      className="bg-paper-2 text-ink-2 grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold"
      aria-hidden
    >
      {initials}
    </span>
  )
}
