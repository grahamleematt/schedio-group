import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  getActiveVerificationByDistrict,
  getClientWorkspaceSession,
  getWorkspaceAccountById,
  getWorkspaceContext,
  workOSWorkspaceAccounts,
} from '#/lib/mock-data'

export default function Header() {
  const navigate = useNavigate()
  const location = useRouterState({
    select: (state) => ({
      pathname: state.location.pathname,
      href: state.location.href,
    }),
  })
  const accountId = getAccountIdFromHref(location.href)
  const workspace = getWorkspaceContext(location.pathname, accountId)
  const isClientWorkspace = workspace.workspaceType === 'client'
  const clientWorkspace = getClientWorkspaceSession(accountId)

  return (
    <header className="sticky top-0 z-50 border-b border-white/30 bg-white/96 px-4 backdrop-blur-2xl shadow-[0_4px_30px_-8px_rgb(0,61,166,0.08)]">
      <nav className="page-wrap flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-4">
          <Link
            to={isClientWorkspace ? '/' : workspace.defaultRoute}
            search={
              isClientWorkspace ? { account: clientWorkspace.id } : undefined
            }
            className="inline-flex items-center rounded-full bg-white px-1 py-1 no-underline"
            aria-label="Schedio Group"
          >
            <img
              src="/schedio-logo.svg"
              alt="Schedio Group"
              className="h-10 w-auto sm:h-11"
            />
          </Link>

          <div className="flex flex-wrap items-center gap-1.5">
            {isClientWorkspace ? (
              <Link
                to="/"
                search={{
                  account: clientWorkspace.id,
                  district: undefined,
                  verification: undefined,
                  package: undefined,
                }}
                className="nav-pill"
                activeOptions={{ exact: true }}
                activeProps={{ className: 'nav-pill is-active' }}
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/review-workbench"
                  search={{ reviewId: undefined }}
                  className="nav-pill"
                  activeProps={{ className: 'nav-pill is-active' }}
                >
                  Drafting
                </Link>
                <Link
                  to="/review-console"
                  search={{
                    reviewId: undefined,
                    q: undefined,
                    districtId: undefined,
                  }}
                  className="nav-pill"
                  activeProps={{ className: 'nav-pill is-active' }}
                >
                  Approval
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:max-w-[420px] lg:flex-none lg:justify-end">
          <div className="min-w-0 flex-1 rounded-[1.3rem] border border-white/70 bg-white/90 px-3 py-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.95),0_2px_8px_rgba(0,0,0,0.04)] lg:flex-none lg:min-w-[320px] relative overflow-hidden">
            <p className="ops-label text-text-accent">Switch login</p>
            <div className="mt-2 flex flex-col gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-strong">
                  {workspace.accountLabel}
                </p>
                <p className="truncate text-xs text-text-muted">
                  {workspace.organizationName} • {workspace.roleLabel}
                </p>
              </div>
              <Select
                value={workspace.id}
                onValueChange={(nextAccountId) => {
                  const nextAccount = getWorkspaceAccountById(nextAccountId)

                  if (nextAccount && nextAccount.id !== workspace.id) {
                    if (nextAccount.workspaceType === 'client') {
                      const primaryDistrictId =
                        nextAccount.permittedDistrictIds[0]
                      const activeVerification =
                        getActiveVerificationByDistrict(primaryDistrictId)
                      void navigate({
                        to: '/',
                        search: {
                          account: nextAccount.id,
                          district: primaryDistrictId,
                          verification: activeVerification.id,
                          package: undefined,
                        },
                      })
                    } else {
                      void navigate({
                        to: nextAccount.defaultRoute,
                        search: undefined,
                      })
                    }
                  }
                }}
              >
                <SelectTrigger className="h-10 w-full rounded-full border-border-base bg-surface-panel font-ops text-text-strong">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent align="end">
                  {workOSWorkspaceAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.accountLabel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </nav>
    </header>
  )
}

function getAccountIdFromHref(href: string) {
  try {
    return (
      new URL(href, 'http://localhost').searchParams.get('account') ?? undefined
    )
  } catch {
    return undefined
  }
}
