import { Link } from '@tanstack/react-router'
import { Badge } from '#/components/ui/badge'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--brand-border)] bg-white/88 px-4 backdrop-blur-xl">
      <nav className="page-wrap flex flex-wrap items-center gap-3 py-4">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-3 rounded-full border border-[var(--brand-border)] bg-white px-3 py-2 text-sm text-[var(--brand-slate)] no-underline shadow-sm"
          >
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-[var(--brand-blue)] text-xs font-bold tracking-[0.14em] text-white">
              SG
            </span>
            <span>
              <span className="font-heading block text-sm font-bold">
                Schedio Group AI
              </span>
              <span className="block text-xs text-[var(--brand-muted)]">
                March 30 follow-up mockups
              </span>
            </span>
          </Link>

          <div className="flex flex-wrap items-center gap-1">
            <Link
              to="/"
              className="nav-pill"
              activeProps={{ className: 'nav-pill is-active' }}
            >
              Overview
            </Link>
            <Link
              to="/portal-trust"
              className="nav-pill"
              activeProps={{ className: 'nav-pill is-active' }}
            >
              Trust Portal
            </Link>
            <Link
              to="/portal-operations"
              className="nav-pill"
              activeProps={{ className: 'nav-pill is-active' }}
            >
              Operations Portal
            </Link>
            <Link
              to="/review-console"
              className="nav-pill"
              activeProps={{ className: 'nav-pill is-active' }}
            >
              Review Console
            </Link>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <Badge
            variant="outline"
            className="rounded-full border-[rgba(0,61,166,0.18)] bg-[rgba(0,61,166,0.06)] px-3 py-1 text-[0.72rem] tracking-[0.12em] uppercase text-[var(--brand-blue)]"
          >
            Portal List + Ignite Handoff
          </Badge>
        </div>
      </nav>
    </header>
  )
}
