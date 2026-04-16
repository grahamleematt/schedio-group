import { Link, useRouterState } from '@tanstack/react-router'
import { LogOut, ShieldCheck } from 'lucide-react'
import { clients, mockUser, workflowConfigs } from '#/lib/sg-dream'
import type { Workflow } from '#/lib/sg-dream'

/**
 * SG DREAM header. Two modes:
 *   - unauthenticated (/login, /clients): minimal shell, no entity context.
 *   - inside an entity workspace: workflow pill, entity name, user initials,
 *     sign-out link. Driven entirely by ?client= search param so the header
 *     stays stateless.
 */
export default function Header() {
  const location = useRouterState({
    select: (s) => ({
      pathname: s.location.pathname,
      search: s.location.search as Record<string, unknown>,
    }),
  })

  const isUnauthed =
    location.pathname === '/login' ||
    location.pathname === '/clients' ||
    location.pathname === '/'

  const clientIdParam =
    typeof location.search.client === 'string'
      ? location.search.client
      : undefined

  const client = clientIdParam
    ? clients.find((c) => c.id === clientIdParam)
    : undefined

  return (
    <header
      className="sticky top-0 z-50 border-b border-white/30 bg-white/95 px-4 backdrop-blur-2xl shadow-[0_2px_40px_-12px_rgb(0,61,166,0.1),inset_0_-1px_0_0_rgba(255,255,255,0.6)]"
      data-workflow={client?.workflow ?? 'district_dp'}
    >
      <nav className="page-wrap flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-4">
          <Link
            to={isUnauthed ? '/login' : '/dashboard'}
            search={
              !isUnauthed && client
                ? {
                    client: client.id,
                    verification: undefined,
                    libraryQuery: undefined,
                    libraryOpen: undefined,
                  }
                : undefined
            }
            className="inline-flex items-center rounded-full bg-white px-1 py-1 no-underline"
            aria-label="Schedio Group"
          >
            <img
              src="/schedio-logo.svg"
              alt="Schedio Group"
              className="h-9 w-auto sm:h-10"
            />
          </Link>

          <div className="flex items-center gap-2 text-sm">
            <span className="font-ops text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
              SG DREAM
            </span>
            <span className="text-text-muted">·</span>
            <span className="text-text-muted">
              Document Review &amp; Management
            </span>
          </div>
        </div>

        {isUnauthed ? (
          <UnauthedRightSide />
        ) : client ? (
          <AuthedRightSide workflow={client.workflow} clientName={client.name} />
        ) : null}
      </nav>
    </header>
  )
}

function UnauthedRightSide() {
  return (
    <div className="flex items-center gap-2 text-xs text-text-muted">
      <ShieldCheck className="size-4 text-text-accent" />
      <span>Invitation-based access · Schedio Group administers every entity.</span>
    </div>
  )
}

function AuthedRightSide({
  workflow,
  clientName,
}: {
  workflow: Workflow
  clientName: string
}) {
  const config = workflowConfigs[workflow]
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="workflow-pill">
        <span
          aria-hidden
          className="inline-block size-1.5 rounded-full"
          style={{ background: 'var(--wf-base)' }}
        />
        {config.label}
      </span>
      <div className="hidden text-right sm:block">
        <p className="font-ops text-sm font-semibold text-text-strong">
          {clientName}
        </p>
        <p className="font-mono text-[0.72rem] text-text-muted">
          {mockUser.name} · Entity Owner
        </p>
      </div>
      <span
        aria-hidden
        className="inline-flex size-10 items-center justify-center rounded-full font-ops text-sm font-semibold"
        style={{
          background: 'var(--wf-soft)',
          color: 'var(--wf-strong)',
        }}
      >
        {mockUser.initials}
      </span>
      <Link
        to="/login"
        search={{ error: undefined }}
        className="nav-pill"
      >
        <LogOut className="size-4" />
        Sign out
      </Link>
    </div>
  )
}

