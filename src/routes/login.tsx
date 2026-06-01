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
          Access is invitation-only. Schedio Group provisions every entity and
          identity through WorkOS single sign-on.
        </p>

        {hasError ? (
          <div
            className="border-line bg-red-bg mt-4 rounded-3 border px-3 py-2 text-[12.5px]"
            style={{ color: 'var(--color-red-base)' }}
            role="alert"
          >
            {errorCopy}
          </div>
        ) : null}

        <a
          href="/api/auth/sign-in?returnPathname=/clients"
          className="v2-btn primary lg mt-5 w-full justify-center"
        >
          Continue with WorkOS
          <ArrowRight className="size-4" aria-hidden />
        </a>
        <p className="text-muted-1 mt-2 flex items-center justify-center gap-1.5 text-[11px]">
          <ShieldCheck className="size-3.5" aria-hidden />
          Secured by WorkOS — your password is never stored by SG DREAM.
        </p>

        <div className="login-reset-head mt-5">
          <span className="field-label">Trouble signing in?</span>
          <span className="login-help">
            <button
              type="button"
              className="login-help-button"
              aria-label="Schedio Admin verifies identity and manages access and password resets through WorkOS."
            >
              <CircleHelp className="size-3.5" aria-hidden />
            </button>
            <span className="login-tooltip" role="tooltip">
              Schedio Admin verifies identity and manages access and password
              resets through WorkOS.
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
