import { createFileRoute } from '@tanstack/react-router'
import { ArrowRight, CircleHelp, Mail, ShieldCheck } from 'lucide-react'

type LoginSearch = {
  error?: 'bad_creds' | 'auth_failed' | 'workos_missing'
}

export const Route = createFileRoute('/login')({
  validateSearch: (s: Record<string, unknown>): LoginSearch => ({
    error:
      s.error === 'bad_creds' ||
      s.error === 'auth_failed' ||
      s.error === 'workos_missing'
        ? s.error
        : undefined,
  }),
  head: () => ({ meta: [{ title: 'Sign in | SG DREAM' }] }),
  component: LoginPage,
})

// No hardcoded recipient — Schedio's admin address isn't known to the client.
// Mirrors the access-request affordance on /blocked.
const supportMailto = `mailto:?subject=${encodeURIComponent(
  'SG DREAM sign-in help',
)}&body=${encodeURIComponent(
  'I need help accessing my SG DREAM workspace.\n\nName:\nOrganization / entity:\n',
)}`

function LoginPage() {
  const { error } = Route.useSearch()
  const hasError = Boolean(error)
  const errorCopy =
    error === 'workos_missing'
      ? 'Single sign-on isn’t configured in this environment yet. Add the WorkOS keys, then restart the server.'
      : error === 'auth_failed'
        ? 'WorkOS couldn’t complete that sign-in. Try again, or confirm the callback URL in the WorkOS dashboard.'
        : 'We couldn’t verify that sign-in. Try again, or contact Schedio Group to confirm your access.'

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
        <p className="text-ink-2 mt-1 text-[12.5px] leading-snug">
          Access is invitation-only. Enter your work email and continue with
          your password or a one-time code we email you.
        </p>

        {hasError ? (
          <div
            className="border-line bg-red-bg text-red-base mt-4 rounded-3 border px-3 py-2 text-[12.5px]"
            role="alert"
          >
            {errorCopy}
          </div>
        ) : null}

        <form
          method="get"
          action="/api/auth/sign-in"
          className="login-email-form mt-5"
        >
          <input type="hidden" name="returnPathname" value="/clients" />
          <label className="field-label" htmlFor="login-email">
            Work email
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@yourdistrict.org"
            className="login-email-input"
            // Optional on purpose: submitting without an email still starts
            // the AuthKit flow, where the email is asked first.
          />
          <button
            type="submit"
            className="v2-btn primary lg mt-3 w-full justify-center"
          >
            Continue
            <ArrowRight className="size-4" aria-hidden />
          </button>
        </form>
        <p className="text-muted-1 mt-2 flex items-center justify-center gap-1.5 text-[11px]">
          <ShieldCheck className="size-3.5" aria-hidden />
          Secured by WorkOS — password, one-time email code, and MFA supported.
        </p>

        <div className="login-reset-head mt-5">
          <span className="field-label">Trouble signing in?</span>
          <span className="login-help">
            <button
              type="button"
              className="login-help-button"
              aria-label="Forgot your password? Use “Forgot password” on the sign-in screen, or choose the emailed one-time code — no admin needed. Contact Schedio Admin only for access changes."
            >
              <CircleHelp className="size-3.5" aria-hidden />
            </button>
            <span className="login-tooltip" role="tooltip">
              Forgot your password? Use “Forgot password” on the sign-in
              screen, or choose the emailed one-time code — no admin needed.
              Contact Schedio Admin only for access changes.
            </span>
          </span>
        </div>
        <a href={supportMailto} className="login-reset-field">
          <span className="login-reset-copy">
            <Mail className="size-4" aria-hidden />
            Email Schedio Admin
          </span>
          <ArrowRight className="size-4" aria-hidden />
        </a>

        <div className="login-trust">
          <ShieldCheck className="size-3.5" aria-hidden />
          Invitation-only · MFA encouraged · administered by Schedio Group
        </div>
      </div>
    </main>
  )
}
