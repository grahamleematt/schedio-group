import { Link } from '@tanstack/react-router'
import { ArrowRight, CircleAlert, Sparkles } from 'lucide-react'
import type { Client, User, Verification, Workflow } from '#/lib/sg-dream'
import { workflowConfigs } from '#/lib/sg-dream'

type StorytellerGateProps = {
  user: User
  client: Client
  verification: Verification
  workflow: Workflow
}

/**
 * Plain-English recap panel Tim called out as "what are you about to do".
 * Two outcomes: confirm and proceed to upload, or bail and switch entity.
 * Sits at the top of /verifications, above everything else.
 */
export function StorytellerGate({
  user,
  client,
  verification,
  workflow,
}: StorytellerGateProps) {
  const config = workflowConfigs[workflow]

  return (
    <section
      className="brand-panel overflow-hidden rounded-2xl p-5 sm:p-6"
      style={{
        background:
          'linear-gradient(180deg, var(--wf-softer), rgba(255,255,255,0.97))',
        borderColor: 'var(--wf-border)',
      }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <span
            aria-hidden
            className="inline-flex size-10 flex-shrink-0 items-center justify-center rounded-2xl"
            style={{ background: 'var(--wf-base)', color: 'var(--color-brand-white)' }}
          >
            <Sparkles className="size-5" />
          </span>
          <div className="space-y-1.5">
            <p className="font-mono text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[color:var(--wf-strong)]">
              Confirm before you continue
            </p>
            <h2 className="font-ops text-lg font-semibold leading-snug tracking-[-0.01em] text-text-strong sm:text-xl">
              You are{' '}
              <span className="text-[color:var(--wf-strong)]">{user.name}</span>,
              submitting documents on behalf of{' '}
              <span className="text-[color:var(--wf-strong)]">
                {client.name}
              </span>{' '}
              — a {config.label} entity — for Verification No.{' '}
              <span className="text-[color:var(--wf-strong)]">
                {verification.number}
              </span>
              , {verification.period}.
            </h2>
            <p className="text-sm text-text-muted">
              Your cutoff is{' '}
              <strong className="text-text-strong">
                {verification.cutoffDate}
              </strong>
              . If any of this is wrong, stop and switch entity before you
              upload.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 lg:flex-shrink-0 lg:justify-end">
          <Link
            to="/upload"
            search={{
              client: client.id,
              verification: verification.id,
              dupes: undefined,
            }}
            className="wf-button-primary"
          >
            Yes, continue
            <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/clients"
            search={{ selected: undefined }}
            className="wf-button-secondary"
          >
            <CircleAlert className="size-4" />
            This isn't right — change entity
          </Link>
        </div>
      </div>
    </section>
  )
}
