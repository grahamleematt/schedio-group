import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  CircleHelp,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react'

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
    <main className="stage login-stage" data-workflow="district_dp">
      <div className="login-card">
        <div className="login-brand">
          <img
            src="/schedio-logo.svg"
            alt="Schedio Group"
            className="login-logo"
          />
          <div className="login-product">SG DREAM entity portal</div>
        </div>

        <h2 className="mt-6 font-ops text-[20px] font-semibold tracking-[-0.02em] text-ink">
          Sign in to your workspace
        </h2>
        <p className="text-ink-2 mt-1 text-[12.5px]">
          Access is invitation-only. Schedio Group manages every entity in this
          portal.
        </p>

        {hasError ? (
          <div
            className="border-line bg-red-bg mt-4 rounded-3 border px-3 py-2 text-[12.5px]"
            style={{ color: 'var(--color-red-base)' }}
            role="alert"
          >
            We couldn&rsquo;t verify those credentials. Check your email or
            request a password reset.
          </div>
        ) : null}

        <form
          onSubmit={(e) => e.preventDefault()}
          className="mt-3"
          aria-label="Sign in"
        >
          <label className="field-block" htmlFor="login-email">
            <span className="field-label">Email</span>
            <span className="field-input">
              <Mail className="text-muted-1 size-4" aria-hidden />
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                defaultValue="amy.lee@districts.example"
              />
            </span>
          </label>

          <label className="field-block" htmlFor="login-password">
            <span className="field-label">Password</span>
            <span className="field-input">
              <LockKeyhole className="text-muted-1 size-4" aria-hidden />
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                defaultValue="••••••••••"
              />
            </span>
          </label>

          <div className="field-block">
            <div className="login-reset-head">
              <span className="field-label">Password reset</span>
              <span className="login-help">
                <button
                  type="button"
                  className="login-help-button"
                  aria-label="Password resets are managed by SG Admin after identity verification."
                >
                  <CircleHelp className="size-3.5" aria-hidden />
                </button>
                <span className="login-tooltip" role="tooltip">
                  SG Admin verifies identity and sends a reset invitation.
                </span>
              </span>
            </div>
            <Link
              to="/login"
              search={{ error: undefined }}
              className="login-reset-field"
            >
              <span className="login-reset-copy">
                <KeyRound className="size-4" aria-hidden />
                Request reset invitation
              </span>
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>

          <Link
            to="/clients"
            search={{ selected: undefined }}
            className="v2-btn primary mt-2 w-full justify-center"
          >
            Continue
            <ArrowRight className="size-4" aria-hidden />
          </Link>

          <div className="login-trust">
            <ShieldCheck className="size-3.5" aria-hidden />
            MFA encouraged for every entity owner
          </div>

          <Link
            to="/login"
            search={{ error: 'bad_creds' }}
            className="login-preview-link"
          >
            Preview error state
          </Link>
        </form>
      </div>
    </main>
  )
}
