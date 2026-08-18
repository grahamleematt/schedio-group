/**
 * Users & access — the admin surface for managing who can sign in to the
 * portal. Gated to users with `canManageUsers` (Tim): everyone else is
 * redirected to the dashboard and never sees the nav entry.
 *
 * Inviting someone here runs the same onboarding core as `yarn team:onboard`:
 * Postgres identity + entity grants and the WorkOS AuthKit invitation in one
 * step. Pending invitations and the live organization roster render below.
 */

import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { CheckCircle2, ChevronDown, Loader2, UserPlus } from 'lucide-react'
import { AppShell } from '#/components/sg-dream/AppShell'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  accessRoleLabels,
  clients,
  getClientById,
  getOpenVerification,
  isInternalRole,
} from '#/lib/sg-dream'
import type { AccessRole } from '#/lib/sg-dream'
import {
  pendingInvitesQuery,
  portalConfigQuery,
  sessionUserQuery,
  userDirectoryQuery,
  verificationSnapshotQuery,
} from '#/lib/queries'
import { usePortalConfig } from '#/lib/session'
import {
  addPortalUser,
  resendPendingInvite,
  revokePendingInvite,
} from '#/server/fns/manageUsers'
import type { AddPortalUserResult } from '#/server/fns/manageUsers'

type UsersSearch = {
  client: string
}

export const Route = createFileRoute('/users')({
  validateSearch: (s: Record<string, unknown>): UsersSearch => ({
    client: typeof s.client === 'string' ? s.client : 'dawson-trails-md1',
  }),
  loader: async ({ context, location }) => {
    const search = location.search as UsersSearch
    const requested =
      typeof search.client === 'string' ? search.client : 'dawson-trails-md1'
    const known = clients.find((c) => c.id === requested)
    if (!known) {
      throw redirect({ to: '/users', search: { client: 'dawson-trails-md1' } })
    }
    // Admin-only surface: bounce anyone without user-management access back
    // to their dashboard (the nav entry is hidden for them too).
    const user = await context.queryClient.ensureQueryData(sessionUserQuery())
    if (!user) {
      throw redirect({ to: '/login' })
    }
    if (!user.canManageUsers) {
      throw redirect({ to: '/dashboard', search: { client: known.id } })
    }
    const { verifications } =
      await context.queryClient.ensureQueryData(portalConfigQuery())
    const open = getOpenVerification(verifications, known.id)
    return Promise.all([
      context.queryClient.ensureQueryData(verificationSnapshotQuery(open.id)),
      context.queryClient.ensureQueryData(userDirectoryQuery()),
      context.queryClient.ensureQueryData(pendingInvitesQuery()),
    ])
  },
  head: () => ({ meta: [{ title: 'Users & access | SG DREAM' }] }),
  component: UsersPage,
})

function formatInviteDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function expiresLabel(iso: string, nowISO: string): string {
  const expires = new Date(iso).getTime()
  const now = new Date(nowISO).getTime()
  if (Number.isNaN(expires) || Number.isNaN(now)) return '—'
  const days = Math.max(0, Math.ceil((expires - now) / 86_400_000))
  return days === 0 ? 'today' : `in ${days}d`
}

function successCopy(result: AddPortalUserResult & { ok: true }): string {
  const { workos } = result.result
  if (workos === 'invited') {
    return 'Invitation sent — they’ll get an email to set up their account.'
  }
  if (workos === 'invitation_pending' || workos === 'membership_pending') {
    return 'Access granted. Their earlier invitation is still pending — no new email needed.'
  }
  if (workos === 'unconfigured') {
    return 'Access granted in the portal. WorkOS isn’t configured here, so no invitation email went out.'
  }
  return 'Access granted — they already have an account and can sign in now.'
}

const roleDescriptions: Record<AccessRole, string> = {
  sg_admin: 'Schedio staff · all entities · manages users',
  sg_pm: 'Schedio staff · all entities · full detail',
  entity_owner: 'Client · approves and submits',
  client_mgr: 'Client · uploads documents',
  client_viewer: 'Client · read-only',
}

function entityAccessLabel(entityIds: ReadonlyArray<string>): string {
  if (entityIds.length === 0) return 'Select entities'
  if (entityIds.length === clients.length) return 'All entities'
  const codes = clients
    .filter((c) => entityIds.includes(c.id))
    .map((c) => c.code)
  const noun = entityIds.length === 1 ? 'entity' : 'entities'
  return `${entityIds.length} ${noun} · ${codes.join(', ')}`
}

function UsersPage() {
  const { client: clientId } = Route.useSearch()
  const config = usePortalConfig()
  const client = getClientById(clientId)
  const open = getOpenVerification(config.verifications, client.id)
  useQuery(verificationSnapshotQuery(open.id))

  // The active-users table is the real WorkOS organization roster (membership,
  // MFA enrollment, last sign-in) joined with each user's Postgres entity
  // access.
  const activeUsers = useSuspenseQuery(userDirectoryQuery()).data
  const pendingInvites = useSuspenseQuery(pendingInvitesQuery()).data

  const queryClient = useQueryClient()
  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: userDirectoryQuery().queryKey,
    })
    void queryClient.invalidateQueries({
      queryKey: pendingInvitesQuery().queryKey,
    })
  }

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AccessRole>('entity_owner')
  const [entityIds, setEntityIds] = useState<ReadonlyArray<string>>(
    clients.map((c) => c.id),
  )
  // Schedio-internal roles always span every entity; the server grants all
  // regardless of the picker, so reflect that in the UI too.
  const internalRole = isInternalRole(role)

  const addMut = useMutation({
    mutationFn: () =>
      addPortalUser({
        data: { email, name, entities: [...entityIds], role },
      }),
    onSuccess: (result: AddPortalUserResult) => {
      refresh()
      if (result.ok) {
        setName('')
        setEmail('')
        setRole('entity_owner')
        setEntityIds(clients.map((c) => c.id))
      }
    },
  })

  const revokeMut = useMutation({
    mutationFn: (invitationId: string) =>
      revokePendingInvite({ data: { invitationId } }),
    onSuccess: refresh,
  })

  const resendMut = useMutation({
    mutationFn: (inviteEmail: string) =>
      resendPendingInvite({ data: { email: inviteEmail } }),
    onSuccess: refresh,
  })
  const resendError =
    resendMut.isError || (resendMut.isSuccess && !resendMut.data.ok)
      ? ((resendMut.data && !resendMut.data.ok && resendMut.data.error) ||
        'Couldn’t resend the invitation — try again.')
      : null

  const toggleEntity = (id: string) => {
    setEntityIds((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id],
    )
  }

  const canSubmit =
    name.trim().length > 0 &&
    email.includes('@') &&
    (internalRole || entityIds.length > 0) &&
    !addMut.isPending
  const addResult = addMut.data
  const addError = addMut.isError
    ? 'Couldn’t add the user — try again.'
    : addResult && !addResult.ok
      ? addResult.error
      : null

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
      pendingUsers={pendingInvites.length}
      recentAuditEvents={0}
    >
      <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="v2-eyebrow">Administration</p>
          <h1 className="v2-h1">Users &amp; access</h1>
          <p className="v2-lede">
            Invite teammates and manage who can sign in. New users get a
            secure WorkOS invitation and only see the entities you grant.
          </p>
        </div>
        <span className="chip">Visible to admins only</span>
      </header>

      <section className="v2-card mb-3">
        <header className="v2-card-head">
          <h3>Add a user</h3>
          <span className="sub">
            One step: portal access + WorkOS invitation
          </span>
        </header>
        <form
          className="v2-card-body invite-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (canSubmit) addMut.mutate()
          }}
        >
          <div className="invite-form-grid">
            <label className="invite-field">
              <span className="field-label">Full name</span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jordan Rivera"
                autoComplete="off"
                disabled={addMut.isPending}
              />
            </label>
            <label className="invite-field">
              <span className="field-label">Work email</span>
              <Input
                className="mono"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jrivera@schediogroup.com"
                autoComplete="off"
                disabled={addMut.isPending}
              />
            </label>
          </div>

          <div className="invite-form-grid">
            <div className="invite-field">
              <span className="field-label" id="invite-role-label">
                Role
              </span>
              <Select
                value={role}
                onValueChange={(value) => setRole(value as AccessRole)}
                disabled={addMut.isPending}
              >
                <SelectTrigger
                  className="w-full"
                  aria-labelledby="invite-role-label"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.entries(accessRoleLabels) as Array<
                      [AccessRole, string]
                    >
                  ).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      <span className="font-semibold">{label}</span>
                      <span className="text-muted-1 text-[11px]">
                        {roleDescriptions[value]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="invite-field">
              <span className="field-label" id="entity-access-label">
                Entity access
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  type="button"
                  disabled={addMut.isPending || internalRole}
                  aria-labelledby="entity-access-label"
                  className="border-input bg-transparent shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full items-center justify-between gap-2 rounded-md border px-3 text-left text-sm outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="min-w-0 truncate font-semibold text-ink">
                    {internalRole
                      ? 'All entities · SG internal'
                      : entityAccessLabel(entityIds)}
                  </span>
                  <ChevronDown
                    className="text-muted-foreground size-4 shrink-0 opacity-50"
                    aria-hidden
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-(--radix-dropdown-menu-trigger-width) min-w-64"
                >
                  {clients.map((c) => (
                    <DropdownMenuCheckboxItem
                      key={c.id}
                      checked={entityIds.includes(c.id)}
                      onCheckedChange={() => toggleEntity(c.id)}
                      className="gap-2.5"
                    >
                      <span
                        className="grid size-6 shrink-0 place-items-center rounded-2 bg-(--color-brand-blue) font-mono text-[9.5px] font-bold text-white"
                        aria-hidden
                      >
                        {c.code}
                      </span>
                      <span className="min-w-0 truncate font-semibold">
                        {c.name}
                      </span>
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="invite-actions">
            <span className="invite-note" role="status">
              {addError ? (
                <span className="invite-note-error">{addError}</span>
              ) : addResult?.ok ? (
                <>
                  <CheckCircle2
                    className="size-4 shrink-0"
                    style={{ color: 'var(--color-green-base)' }}
                    aria-hidden
                  />
                  {successCopy(addResult)}
                </>
              ) : (
                'Invitations expire after 7 days. Access can be revoked any time.'
              )}
            </span>
            <button
              type="submit"
              className="v2-btn primary"
              disabled={!canSubmit}
            >
              {addMut.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <UserPlus className="size-4" aria-hidden />
              )}
              {addMut.isPending ? 'Adding…' : 'Add user'}
            </button>
          </div>
        </form>
      </section>

      <section className="v2-card mb-3">
        <header className="v2-card-head">
          <h3>Pending invitations · {pendingInvites.length}</h3>
          <span className="sub">
            Sent via WorkOS · invitations expire after 7 days
          </span>
        </header>
        {pendingInvites.length === 0 ? (
          <div className="v2-card-body flex items-center gap-2 text-[12.5px] text-muted-1">
            <CheckCircle2
              className="size-4 shrink-0"
              style={{ color: 'var(--color-green-base)' }}
              aria-hidden
            />
            No outstanding invitations. People you add appear here until they
            accept — including expired invites you can resend.
          </div>
        ) : (
          <div className="v2-table-scroll">
            <table className="v2-tbl users-table users-table-invites">
              <colgroup>
                <col style={{ width: '38%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '26%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Invited</th>
                  <th>Expires</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pendingInvites.map((inv) => (
                  <tr key={inv.id}>
                    <td className="mono email-cell">{inv.email}</td>
                    <td className="mono whitespace-nowrap text-muted-1">
                      {formatInviteDate(inv.invitedAtISO)}
                    </td>
                    <td
                      className="mono whitespace-nowrap"
                      style={{
                        color:
                          inv.state === 'expired'
                            ? 'var(--color-red-base)'
                            : 'var(--color-amber-base)',
                      }}
                    >
                      {inv.state === 'expired'
                        ? `Expired ${formatInviteDate(inv.expiresAtISO)}`
                        : expiresLabel(inv.expiresAtISO, config.todayISO)}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        {inv.state === 'expired' ? (
                          <>
                            <span className="pill pill-red">
                              <span className="dot" />
                              Expired
                            </span>
                            <button
                              type="button"
                              className="qlink"
                              disabled={resendMut.isPending}
                              onClick={() => resendMut.mutate(inv.email)}
                            >
                              {resendMut.isPending &&
                              resendMut.variables === inv.email
                                ? 'Resending…'
                                : 'Resend'}
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="pill pill-amber">
                              <span className="dot" />
                              Awaiting acceptance
                            </span>
                            <button
                              type="button"
                              className="qlink"
                              disabled={revokeMut.isPending}
                              onClick={() => revokeMut.mutate(inv.id)}
                            >
                              Revoke
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {resendError ? (
              <p
                className="m-0 px-4 pb-3 text-[12px] font-semibold"
                style={{ color: 'var(--color-red-base)' }}
                role="alert"
              >
                {resendError}
              </p>
            ) : null}
          </div>
        )}
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
                            <span className="pill pill-brand text-[10px]">
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
        style={{ background: 'var(--color-brand-tint-2)' }}
      >
        <div className="v2-card-body">
          <p
            className="ops-label m-0"
            style={{ color: 'var(--color-brand-blue)' }}
          >
            Competitor isolation
          </p>
          <p className="text-ink-2 m-0 mt-1 text-[12.5px] leading-relaxed">
            Every account is limited to the entities granted here. Users never
            see workspaces that conflict with their other assignments.
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
