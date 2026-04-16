import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { WorkflowChrome } from '#/components/sg-dream/WorkflowChrome'
import { WorkflowBanner } from '#/components/sg-dream/WorkflowBanner'
import { VerificationPill } from '#/components/sg-dream/VerificationPill'
import { UploadQueue } from '#/components/sg-dream/UploadQueue'
import {
  getClientById,
  getDocumentsByVerification,
  getDuplicateCounts,
  getVerificationById,
} from '#/lib/sg-dream'

type UploadSearch = {
  client: string
  verification: string
  clean?: 1
}

export const Route = createFileRoute('/upload')({
  validateSearch: (s: Record<string, unknown>): UploadSearch => ({
    client: typeof s.client === 'string' ? s.client : 'srcab',
    verification:
      typeof s.verification === 'string' ? s.verification : 'srcab-v4',
    clean: s.clean === 1 || s.clean === '1' ? 1 : undefined,
  }),
  head: () => ({ meta: [{ title: 'Upload documents | SG DREAM' }] }),
  component: UploadPage,
})

function UploadPage() {
  const { client: clientId, verification: verificationId, clean } =
    Route.useSearch()
  const client = getClientById(clientId)
  const verification = getVerificationById(verificationId)

  const rawDocs = getDocumentsByVerification(verification.id)
  const docs =
    clean === 1
      ? rawDocs.map((d) => ({ ...d, duplicateFlag: 'none' as const }))
      : rawDocs
  const counts = getDuplicateCounts(docs)

  return (
    <WorkflowChrome
      workflow={client.workflow}
      entityName={client.name}
      eyebrow="Step 3 · Upload & duplicate detection"
      title={`Submit to Verification No. ${verification.number}`}
      description="Drag and drop files into the queue. Each file is compared against every document previously filed for this entity — exact matches flag red, likely matches flag amber."
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
            Cutoff <strong>{verification.cutoffDate}</strong>. Files remain in
            the queue until you press Analyze.
          </p>
          <div
            className="mt-3 rounded-xl border bg-white/90 px-3 py-2"
            style={{ borderColor: 'var(--color-border-base)' }}
          >
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.1em] text-text-muted">
              Queue
            </p>
            <p className="font-ops text-base font-semibold text-text-strong">
              {docs.length} file{docs.length === 1 ? '' : 's'}
            </p>
            <p className="text-xs text-text-muted">
              {counts.total > 0
                ? `${counts.total} flagged · ${counts.exact} exact · ${counts.likely} likely`
                : 'No duplicates detected yet.'}
            </p>
          </div>
        </div>
      }
      actions={
        <>
          <Link
            to="/processing"
            search={{
              client: client.id,
              verification: verification.id,
              dupes: counts.total,
            }}
            className="wf-button-primary"
          >
            Analyze documents
            <ArrowRight className="size-4" />
          </Link>
          {clean !== 1 ? (
            <Link
              to="/upload"
              search={{
                client: client.id,
                verification: verification.id,
                clean: 1,
              }}
              className="wf-button-secondary"
            >
              Preview clean queue
            </Link>
          ) : (
            <Link
              to="/upload"
              search={{
                client: client.id,
                verification: verification.id,
                clean: undefined,
              }}
              className="wf-button-secondary"
            >
              Restore flagged queue
            </Link>
          )}
        </>
      }
    >
      <WorkflowBanner workflow={client.workflow} />
      <UploadQueue queuedDocs={docs} />
    </WorkflowChrome>
  )
}
