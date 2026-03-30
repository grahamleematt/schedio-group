import { Link } from '@tanstack/react-router'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--brand-border)] bg-white/94 px-4 backdrop-blur-xl">
      <nav className="page-wrap flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-4">
          <Link
            to="/"
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
            <Link
              to="/"
              className="nav-pill"
              activeProps={{ className: 'nav-pill is-active' }}
            >
              Concepts
            </Link>
            <Link
              to="/portal-trust"
              className="nav-pill"
              activeProps={{ className: 'nav-pill is-active' }}
            >
              Client Intake
            </Link>
            <Link
              to="/portal-operations"
              className="nav-pill"
              activeProps={{ className: 'nav-pill is-active' }}
            >
              Client Operations
            </Link>
            <Link
              to="/review-workbench"
              className="nav-pill"
              activeProps={{ className: 'nav-pill is-active' }}
            >
              Drafting Workbench
            </Link>
            <Link
              to="/review-console"
              className="nav-pill"
              activeProps={{ className: 'nav-pill is-active' }}
            >
              Approval Console
            </Link>
          </div>
        </div>
      </nav>
    </header>
  )
}
