import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { ArrowRight, UploadCloud, Loader2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { WorkflowChrome } from '#/components/sg-dream/WorkflowChrome'
import { WorkflowBanner } from '#/components/sg-dream/WorkflowBanner'
import { VerificationPill } from '#/components/sg-dream/VerificationPill'
import { UploadQueue } from '#/components/sg-dream/UploadQueue'
import {
  getClientById,
  getOpenVerification,
  getVerificationById,
} from '#/lib/sg-dream'
import { verificationSnapshotQuery } from '#/lib/queries'
import { storedListToDisplay } from '#/lib/sg-dream-adapter'

type UploadSearch = {
  client: string
  verification: string
}

export const Route = createFileRoute('/upload')({
  validateSearch: (s: Record<string, unknown>): UploadSearch => ({
    client: typeof s.client === 'string' ? s.client : 'srcab',
    verification:
      typeof s.verification === 'string' ? s.verification : 'srcab-v4',
  }),
  loader: ({ context, location }) => {
    const search = location.search as UploadSearch
    const clientId = typeof search.client === 'string' ? search.client : 'srcab'
    const requested =
      typeof search.verification === 'string' ? search.verification : ''
    const verification = getVerificationById(requested, clientId)
    if (!verification) {
      const open = getOpenVerification(clientId)
      throw redirect({
        to: '/upload',
        search: { client: clientId, verification: open.id },
      })
    }
    return context.queryClient.ensureQueryData(
      verificationSnapshotQuery(verification.id),
    )
  },
  head: () => ({ meta: [{ title: 'Upload documents | SG DREAM' }] }),
  component: UploadPage,
})

function UploadPage() {
  const { client: clientId, verification: verificationId } = Route.useSearch()
  const client = getClientById(clientId)
  const verification =
    getVerificationById(verificationId, clientId) ??
    getOpenVerification(clientId)
  const snapshotQuery = useSuspenseQuery(
    verificationSnapshotQuery(verification.id),
  )
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const snapshot = snapshotQuery.data
  const storedDocs = snapshot?.verification.documents ?? []
  const displayDocs = storedListToDisplay(storedDocs)
  const flaggedCount = storedDocs.filter(
    (d) => d.duplicateFlag !== 'none' && d.status === 'completed',
  ).length
  const exactCount = storedDocs.filter(
    (d) => d.duplicateFlag === 'exact' && d.status === 'completed',
  ).length
  const likelyCount = storedDocs.filter(
    (d) => d.duplicateFlag === 'likely' && d.status === 'completed',
  ).length

  const mutation = useMutation({
    mutationFn: async (files: FileList) => {
      const fd = new FormData()
      fd.set('verificationId', verificationId)
      fd.set('clientId', client.id)
      for (const file of Array.from(files)) fd.append('files', file)
      // Hit the server route directly (not a server function) so the browser
      // sends a real multipart/form-data body and Files survive the transport.
      const res = await fetch('/api/uploads', { method: 'POST', body: fd })
      if (!res.ok) {
        let message = `upload failed (${res.status})`
        try {
          const data = (await res.json()) as { error?: string }
          if (data.error) message = data.error
        } catch {
          // non-JSON response; keep default message
        }
        throw new Error(message)
      }
      return (await res.json()) as { uploaded: Array<unknown> }
    },
    onSuccess: () => {
      setUploadError(null)
      void queryClient.invalidateQueries({
        queryKey: ['verification', verificationId],
      })
    },
    onError: (err) => {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    },
  })

  const onFilesChosen = (files: FileList | null) => {
    if (!files || files.length === 0) return
    mutation.mutate(files)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const hasQueue = storedDocs.length > 0
  const anyInFlight = storedDocs.some(
    (d) =>
      d.status === 'queued' ||
      d.status === 'classifying' ||
      d.status === 'standardizing',
  )

  return (
    <WorkflowChrome
      workflow={client.workflow}
      eyebrow="Step 3 · Upload & duplicate detection"
      title={`Submit to Verification No. ${verification.number}`}
      description="Drop files into the queue. DocuPipe classifies each file, extracts vendor and cost details, and compares the submission against every prior filing for this entity."
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
            Cutoff <strong>{verification.cutoffDate}</strong>. Files stream
            through the queue until DocuPipe finishes each one.
          </p>
          <div
            className="mt-3 rounded-xl border bg-white/90 px-3 py-2"
            style={{ borderColor: 'var(--color-border-base)' }}
          >
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.1em] text-text-muted">
              Queue
            </p>
            <p className="font-ops text-base font-semibold text-text-strong">
              {storedDocs.length} file{storedDocs.length === 1 ? '' : 's'}
            </p>
            <p className="text-xs text-text-muted">
              {flaggedCount > 0
                ? `${flaggedCount} flagged · ${exactCount} exact · ${likelyCount} likely`
                : anyInFlight
                  ? 'Processing…'
                  : 'No duplicates detected yet.'}
            </p>
          </div>
        </div>
      }
      actions={
        <>
          {hasQueue ? (
            <Link
              to="/processing"
              search={{ client: client.id, verification: verification.id }}
              className="wf-button-primary"
            >
              Analyze documents
              <ArrowRight className="size-4" />
            </Link>
          ) : (
            <button type="button" className="wf-button-primary" disabled>
              Analyze documents
              <ArrowRight className="size-4" />
            </button>
          )}
          <button
            type="button"
            className="wf-button-secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Uploading…
              </>
            ) : (
              <>
                <UploadCloud className="size-4" /> Browse files
              </>
            )}
          </button>
        </>
      }
    >
      <WorkflowBanner workflow={client.workflow} />

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        accept=".pdf,.tif,.tiff,.jpg,.jpeg"
        onChange={(e) => onFilesChosen(e.target.files)}
      />

      {uploadError ? (
        <div
          role="alert"
          className="rounded-2xl border px-4 py-3 text-sm"
          style={{
            borderColor: 'var(--color-flag-panel-border)',
            background: 'var(--color-flag-panel-bg)',
            color: 'var(--color-flag-exact-text, var(--color-flag-likely-text))',
          }}
        >
          {uploadError}
        </div>
      ) : null}

      <UploadQueue
        queuedDocs={displayDocs}
        onBrowseClick={() => fileInputRef.current?.click()}
        isUploading={mutation.isPending}
        onDropFiles={(files) => onFilesChosen(files)}
      />

    </WorkflowChrome>
  )
}
