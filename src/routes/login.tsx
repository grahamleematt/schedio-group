import { Link, createFileRoute } from '@tanstack/react-router'
import { KeyRound, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'

type LoginSearch = {
  error?: 'bad_creds'
}

export const Route = createFileRoute('/login')({
  validateSearch: (s: Record<string, unknown>): LoginSearch => ({
    error: s.error === 'bad_creds' ? 'bad_creds' : undefined,
  }),
  head: () => ({ meta: [{ title: 'Sign in | SG DREAM' }] }),
  component: LoginPage,
})

function LoginPage() {
  const { error } = Route.useSearch()
  const hasError = error === 'bad_creds'

  return (
    <main className="page-wrap page-frame" data-workflow="district_dp">
      <div className="mx-auto flex max-w-[480px] flex-col gap-6">
        <header className="text-center">
          <p className="ops-label justify-center">SG DREAM · Entity Portal</p>
          <h1 className="mt-2 font-ops text-2xl font-semibold tracking-[-0.02em] text-text-strong">
            Sign in to your entity workspace
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Access is invitation-only. Schedio Group manages every entity in
            this portal.
          </p>
        </header>

        <section
          className="brand-panel rounded-2xl p-6"
          style={{ borderColor: 'var(--color-border-base)' }}
        >
          {hasError ? (
            <div
              className="mb-4 rounded-xl border px-4 py-3 text-sm"
              style={{
                background: 'var(--color-status-error-bg)',
                color: 'var(--color-status-error-text)',
                borderColor: 'var(--color-flag-exact-border)',
              }}
            >
              We couldn&rsquo;t verify those credentials. Check your email or
              request a password reset.
            </div>
          ) : null}

          <form
            className="space-y-4"
            onSubmit={(e) => e.preventDefault()}
          >
            <label htmlFor="login-email" className="block space-y-1.5">
              <span className="font-ops text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">
                Email
              </span>
              <span
                className="flex h-11 items-center gap-2 rounded-xl border bg-white px-3 focus-within:ring-2 focus-within:ring-[color:var(--color-ring)]"
                style={{ borderColor: 'var(--color-border-base)' }}
              >
                <Mail className="size-4 text-text-muted" aria-hidden />
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  defaultValue="amy.lee@districts.example"
                  className="w-full border-none bg-transparent text-sm outline-none"
                />
              </span>
            </label>

            <label htmlFor="login-password" className="block space-y-1.5">
              <span className="font-ops text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">
                Password
              </span>
              <span
                className="flex h-11 items-center gap-2 rounded-xl border bg-white px-3 focus-within:ring-2 focus-within:ring-[color:var(--color-ring)]"
                style={{ borderColor: 'var(--color-border-base)' }}
              >
                <LockKeyhole className="size-4 text-text-muted" aria-hidden />
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  defaultValue="••••••••••"
                  className="w-full border-none bg-transparent text-sm outline-none"
                />
              </span>
            </label>

            <div className="flex flex-col gap-3 pt-2">
              <Link
                to="/clients"
                search={{ selected: undefined }}
                className="wf-button-primary w-full"
              >
                <KeyRound className="size-4" />
                Continue
              </Link>
              <div className="flex items-center justify-between text-xs">
                <Link
                  to="/login"
                  search={{ error: 'bad_creds' }}
                  className="font-mono uppercase tracking-[0.08em] text-text-muted no-underline hover:text-text-strong"
                >
                  Preview error state
                </Link>
                <button
                  type="button"
                  className="font-mono uppercase tracking-[0.08em] text-text-muted hover:text-text-strong"
                >
                  Reset password
                </button>
              </div>
            </div>
          </form>
        </section>

        <p className="flex items-center justify-center gap-2 text-xs text-text-muted">
          <ShieldCheck className="size-3.5 text-text-accent" />
          MFA encouraged for all entity users · required for Schedio staff.
        </p>
      </div>
    </main>
  )
}
