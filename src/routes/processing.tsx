import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Loader2 } from 'lucide-react'
import { WorkflowChrome } from '#/components/sg-dream/WorkflowChrome'
import { WorkflowBanner } from '#/components/sg-dream/WorkflowBanner'
import { VerificationPill } from '#/components/sg-dream/VerificationPill'
import { ProcessingLog } from '#/components/sg-dream/ProcessingLog'
import {
  formatRef,
  getClientById,
  getVerificationById,
} from '#/lib/sg-dream'

type ProcessingSearch = {
  client: string
  verification: string
  dupes: number
}

export const Route = createFileRoute('/processing')({
  validateSearch: (s: Record<string, unknown>): ProcessingSearch => ({
    client: typeof s.client === 'string' ? s.client : 'srcab',
    verification:
      typeof s.verification === 'string' ? s.verification : 'srcab-v4',
    dupes: typeof s.dupes === 'number'
      ? s.dupes
      : Number.parseInt(String(s.dupes ?? '0'), 10) || 0,
  }),
  head: () => ({ meta: [{ title: 'Processing | SG DREAM' }] }),
  component: ProcessingPage,
})

function ProcessingPage() {
  const { client: clientId, verification: verificationId, dupes } =
    Route.useSearch()
  const client = getClientById(clientId)
  const verification = getVerificationById(verificationId)

  // Preview-only reference, the confirmation screen re-computes against the
  // same verification+seq so both agree.
  const previewRef = formatRef({
    workflow: client.workflow,
    number: verification.number,
    year: verification.year,
    seq: verification.seq,
  })

  return (
    <WorkflowChrome
      workflow={client.workflow}
      entityName={client.name}
      eyebrow="Step 4 · Analyzing documents"
      title="Running duplicate detection & classification"
      description="SG DREAM renames each file, extracts vendor and cost details, and compares the submission against every prior filing for this entity."
      aside={
        <div className="space-y-2 text-sm">
          <VerificationPill
            number={verification.number}
            period={verification.period}
          />
          <p className="font-ops text-base font-semibold text-text-strong">
            {client.name}
          </p>
          <p className="text-xs text-text-muted">
            Preview reference{' '}
            <span className="font-mono text-text-strong">{previewRef}</span>.
          </p>
          <p className="flex items-center gap-2 text-xs text-text-muted">
            <Loader2 className="size-3.5 animate-spin" />
            Touch point 2 · automated duplicate check
          </p>
        </div>
      }
      actions={
        <Link
          to="/confirmation"
          search={{
            client: client.id,
            verification: verification.id,
            dupes,
          }}
          className="wf-button-primary"
        >
          View confirmation
          <ArrowRight className="size-4" />
        </Link>
      }
    >
      <WorkflowBanner workflow={client.workflow} />
      <ProcessingLog duplicateCount={dupes} />
    </WorkflowChrome>
  )
}
