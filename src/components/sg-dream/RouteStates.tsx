/**
 * App-wide route loading + error chrome, wired into the TanStack router as
 * `defaultPendingComponent` / `defaultErrorComponent`. These render full-bleed
 * (outside the AppShell) while a route loader resolves its server data — the
 * verification snapshot, audit log, user directory, or intelligence workspace —
 * or when one of those queries throws.
 *
 * Kept deliberately calm and workflow-agnostic: loaders run before the
 * `data-workflow` root is mounted, so we lean on the neutral ink/line tokens
 * and the Schedio sigma mark rather than the green/blue workflow accents.
 */

import { Link } from '@tanstack/react-router'
import { RotateCcw } from 'lucide-react'

function StageFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-paper-2 p-10">
      {children}
    </main>
  )
}

/** Branded skeleton shown while a route loader is still resolving. */
export function RoutePending() {
  return (
    <StageFrame>
      <div
        className="w-[420px] max-w-full"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="mb-4 flex items-center gap-2.5">
          <div className="sigma lg" aria-hidden>
            Σ
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold tracking-[-0.01em] text-ink">
              Schedio Group · SG DREAM
            </div>
            <p className="ops-label m-0 mt-px text-muted-1">
              Loading workspace…
            </p>
          </div>
        </div>
        <div className="v2-card">
          <div className="v2-card-body grid gap-3">
            <div className="h-3 w-2/3 animate-pulse rounded-full bg-line-2" />
            <div className="h-3 w-full animate-pulse rounded-full bg-line-2" />
            <div className="h-3 w-5/6 animate-pulse rounded-full bg-line-2" />
            <div className="mt-1 grid grid-cols-3 gap-2">
              <div className="h-12 animate-pulse rounded-3 bg-line-3" />
              <div className="h-12 animate-pulse rounded-3 bg-line-3" />
              <div className="h-12 animate-pulse rounded-3 bg-line-3" />
            </div>
          </div>
        </div>
        <span className="sr-only">Loading the requested workspace.</span>
      </div>
    </StageFrame>
  )
}

/** Branded error panel shown when a route loader or query throws. */
export function RouteError({ error }: { error: Error }) {
  const message =
    error.message.length > 0
      ? error.message
      : 'An unexpected error stopped this page from loading.'
  return (
    <StageFrame>
      <div className="blocked-card" role="alert">
        <div
          className="lock-ill"
          aria-hidden
          style={{
            background: 'var(--color-amber-bg)',
            color: 'var(--color-amber-ink)',
          }}
        >
          <RotateCcw className="size-7" />
        </div>
        <p
          className="ops-label m-0"
          style={{ color: 'var(--color-amber-ink)' }}
        >
          Something went wrong
        </p>
        <h1 className="font-ops mt-1.5 mb-1.5 text-[22px] font-medium tracking-[-0.02em] text-ink">
          This page couldn’t load
        </h1>
        <p className="text-muted-1 mx-auto mb-4 max-w-[440px] text-[13px] leading-[1.55]">
          {message}
        </p>
        <div className="flex justify-center gap-2">
          <button
            type="button"
            className="v2-btn"
            onClick={() => window.location.reload()}
          >
            <RotateCcw className="size-4" aria-hidden />
            Try again
          </button>
          <Link
            to="/dashboard"
            search={{ client: 'dawson-trails-md1' }}
            className="v2-btn primary"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </StageFrame>
  )
}
