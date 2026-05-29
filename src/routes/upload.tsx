import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import {
  ArrowRight,
  FileText,
  FolderOpen,
  Loader2,
  RefreshCw,
  UploadCloud,
} from 'lucide-react'
import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { AppShell } from '#/components/sg-dream/AppShell'
import {
  clients,
  docTypeLabels,
  displaySubmissionCycle,
  formatCurrencyPrecise,
  getClientById,
  getOpenVerification,
  getVerificationById,
} from '#/lib/sg-dream'
import type { Document } from '#/lib/sg-dream'
import { verificationSnapshotQuery } from '#/lib/queries'
import { storedListToDisplay } from '#/lib/sg-dream-adapter'

type UploadState = 'normal' | 'empty' | 'error'

type UploadSearch = {
  client: string
  verification: string
  state?: UploadState
}

type EgnyteImportResponse = {
  jobId: string
  sourcePath: string
  imported: Array<unknown>
  skipped: Array<unknown>
  failed: Array<{ error: string }>
  unsupportedCount: number
}

const stateValues = new Set<UploadState>(['normal', 'empty', 'error'])

export function snapshotUploadFiles(files: FileList | null): File[] {
  if (!files || files.length === 0) return []
  return Array.from(files)
}

export const Route = createFileRoute('/upload')({
  validateSearch: (s: Record<string, unknown>): UploadSearch => ({
    client: typeof s.client === 'string' ? s.client : 'dawson-trails-md1',
    verification:
      typeof s.verification === 'string'
        ? s.verification
        : 'dawson-trails-md1-v1',
    state:
      typeof s.state === 'string' && stateValues.has(s.state as UploadState)
        ? (s.state as UploadState)
        : undefined,
  }),
  loader: ({ context, location }) => {
    const search = location.search as UploadSearch
    const requestedClient =
      typeof search.client === 'string' ? search.client : 'dawson-trails-md1'
    const knownClient = clients.find((c) => c.id === requestedClient)
    if (!knownClient) {
      const open = getOpenVerification('dawson-trails-md1')
      throw redirect({
        to: '/upload',
        search: { client: 'dawson-trails-md1', verification: open.id },
      })
    }
    const clientId = knownClient.id
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
  const {
    client: clientId,
    verification: verificationId,
    state: variant = 'normal',
  } = Route.useSearch()
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
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const snapshot = snapshotQuery.data
  const clientRootPath = (
    client.egnyteRootPath ?? `/Shared/Clients/${client.code}`
  ).replace(/\/$/, '')
  const egnyteIncomingFolder = `${clientRootPath}/Intake/Draft/Incoming`
  const storedDocs = snapshot?.verification.documents ?? []
  const displayDocs = storedListToDisplay(storedDocs)
  const hasDraftSubmission = displayDocs.length > 0
  const reviewCycle = displaySubmissionCycle(verification)
  const submissionStateLabel = hasDraftSubmission
    ? 'Draft submission'
    : 'Not started'
  const referenceStateLabel = hasDraftSubmission
    ? 'Assigned after Schedio review'
    : 'Pending first upload'
  const flaggedDocs = displayDocs.filter((d) => d.duplicateFlag !== 'none')
  const exactCount = flaggedDocs.filter(
    (d) => d.duplicateFlag === 'exact',
  ).length
  const likelyCount = flaggedDocs.filter(
    (d) => d.duplicateFlag === 'likely',
  ).length
  const inFlight = displayDocs.filter(
    (d) =>
      d.status === 'queued' ||
      d.status === 'classifying' ||
      d.status === 'standardizing',
  )

  const mutation = useMutation({
    mutationFn: async (files: File[]) => {
      const fd = new FormData()
      fd.set('verificationId', verificationId)
      fd.set('clientId', client.id)
      for (const file of files) fd.append('files', file)
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

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/egnyte/imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          verificationId: verification.id,
          sourcePath: egnyteIncomingFolder,
        }),
      })
      if (!res.ok) {
        let message = `Egnyte import failed (${res.status})`
        try {
          const data = (await res.json()) as { error?: string }
          if (data.error) message = data.error
        } catch {
          // non-JSON response; keep default message
        }
        throw new Error(message)
      }
      return (await res.json()) as EgnyteImportResponse
    },
    onSuccess: (data) => {
      setUploadError(null)
      setImportMessage(
        `${data.imported.length} imported · ${data.skipped.length} skipped · ${data.failed.length} failed`,
      )
      void queryClient.invalidateQueries({
        queryKey: ['verification', verificationId],
      })
    },
    onError: (err) => {
      setImportMessage(null)
      setUploadError(
        err instanceof Error ? err.message : 'Egnyte import failed',
      )
    },
  })

  const onFilesChosen = (files: FileList | null) => {
    const chosenFiles = snapshotUploadFiles(files)
    if (chosenFiles.length === 0) return
    mutation.mutate(chosenFiles)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) onFilesChosen(e.dataTransfer.files)
  }

  const renderEmpty = variant === 'empty'
  const renderError = variant === 'error' || Boolean(uploadError)
  const showQueue = !renderEmpty && displayDocs.length > 0

  const rail = (
    <>
      <section className="v2-card">
        <header className="v2-card-head">
          <h3>Submission preview</h3>
        </header>
        <div className="v2-card-body">
          <div className="kv">
            <span className="k">Submission</span>
            <span className="v">{submissionStateLabel}</span>
          </div>
          <div className="kv">
            <span className="k">Review period</span>
            <span className="v">{reviewCycle}</span>
          </div>
          <div className="kv">
            <span className="k">Cutoff</span>
            <span className="v">{verification.cutoffDate}</span>
          </div>
          <div className="kv">
            <span className="k">Reference status</span>
            <span className="v">{referenceStateLabel}</span>
          </div>
          <div className="kv">
            <span className="k">Files in queue</span>
            <span className="v">{displayDocs.length}</span>
          </div>
          {inFlight.length > 0 ? (
            <div className="kv">
              <span className="k">Processing</span>
              <span className="v">{inFlight.length}</span>
            </div>
          ) : null}
        </div>
      </section>

      <section className="v2-card">
        <header className="v2-card-head">
          <h3>Tips</h3>
        </header>
        <div className="v2-card-body space-y-3 text-[12.5px] text-ink-2">
          <p className="m-0">
            Upload PDF, TIFF, or JPG. DocuPipe runs classify + standardize on
            every file as it lands.
          </p>
          <p className="m-0">
            Duplicate checks run after each file finishes classification —
            results appear on this page and on the processing screen.
          </p>
          <p className="m-0 text-muted-1">
            Schedio Group assigns a final reference number when this submission
            is accepted.
          </p>
        </div>
      </section>

      <section className="v2-card">
        <header className="v2-card-head">
          <h3>Egnyte intake</h3>
        </header>
        <div className="v2-card-body space-y-3 text-[12.5px] text-ink-2">
          <p className="m-0">
            Files placed in this folder can be pulled into the same DocuPipe
            queue without uploading them again.
          </p>
          <div className="rounded-md border border-line bg-paper-soft p-2 font-mono text-[11px] leading-snug text-muted-1">
            {egnyteIncomingFolder}
          </div>
          <button
            type="button"
            className="v2-btn w-full justify-center"
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending}
          >
            {importMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FolderOpen className="size-4" />
            )}
            Import from Egnyte
          </button>
        </div>
      </section>
    </>
  )

  return (
    <AppShell
      active="submit"
      crumbs={[{ label: 'Submit Documents' }]}
      rail={rail}
    >
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="v2-eyebrow">
            Step 3 · Upload &amp; duplicate detection
          </p>
          <h1 className="v2-h1">
            {hasDraftSubmission
              ? 'Continue draft submission'
              : 'Start submission'}
          </h1>
          <p className="v2-lede">
            Drop files into the queue. DocuPipe classifies each file, extracts
            vendor + cost details, and compares the draft against every prior
            filing for {client.name}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="v2-btn"
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending}
          >
            {importMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Import from Egnyte
          </button>
          {displayDocs.length > 0 ? (
            <Link
              to="/processing"
              search={{ client: client.id, verification: verification.id }}
              className="v2-btn primary"
            >
              Analyze submission
              <ArrowRight className="size-4" />
            </Link>
          ) : (
            <button type="button" className="v2-btn primary" disabled>
              Analyze submission
              <ArrowRight className="size-4" />
            </button>
          )}
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        accept=".pdf,.tif,.tiff,.jpg,.jpeg"
        onChange={(e) => onFilesChosen(e.target.files)}
      />

      {renderError ? (
        <div className="errbar red mb-3" role="alert">
          <span className="icn">!</span>
          <div className="min-w-0">
            <p className="m-0 font-semibold">Upload failed</p>
            <p className="m-0 text-[12.5px]">
              {uploadError ??
                'One or more files were rejected by DocuPipe. Try again or contact Schedio Group.'}
            </p>
          </div>
        </div>
      ) : null}

      {importMessage && !renderError ? (
        <div className="errbar green mb-3" role="status">
          <span className="icn">✓</span>
          <div className="min-w-0">
            <p className="m-0 font-semibold">Egnyte import complete</p>
            <p className="m-0 text-[12.5px]">{importMessage}</p>
          </div>
        </div>
      ) : null}

      {flaggedDocs.length > 0 ? (
        <div className="errbar amber mb-3" role="status">
          <span className="icn">!</span>
          <div className="min-w-0 flex-1">
            <p className="m-0 font-semibold">
              {flaggedDocs.length} file{flaggedDocs.length === 1 ? '' : 's'}{' '}
              flagged for possible duplication
            </p>
            <p className="m-0 text-[12.5px]">
              {exactCount} exact · {likelyCount} likely. Review each row before
              sending this draft to Schedio.
            </p>
          </div>
          <span className="pill pill-amber">
            <span className="dot" />
            Decisions captured after analysis
          </span>
        </div>
      ) : null}

      <div
        className={`dropzone${isDragging ? ' hot' : ''}`}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault()
          if (!isDragging) setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
      >
        <div className="grid place-items-center gap-2">
          <span
            aria-hidden
            className="grid size-12 place-items-center rounded-2xl"
            style={{ background: 'var(--wf-soft)', color: 'var(--wf-strong)' }}
          >
            {mutation.isPending ? (
              <Loader2 className="size-6 animate-spin" />
            ) : (
              <UploadCloud className="size-6" />
            )}
          </span>
          <p className="m-0 font-ops text-[15px] font-semibold text-ink">
            {mutation.isPending
              ? 'Uploading to DocuPipe…'
              : 'Drag and drop documents here'}
          </p>
          <p className="m-0 text-[12.5px] text-muted-1">
            PDF, TIFF, JPG, or import this submission's Egnyte intake folder.
          </p>
          <button
            type="button"
            className="v2-btn primary mt-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={mutation.isPending}
          >
            <UploadCloud className="size-4" /> Browse files
          </button>
        </div>
      </div>

      {showQueue ? (
        <section className="v2-card mt-4">
          <header className="v2-card-head">
            <h3>Queue</h3>
            <span className="sub">
              {displayDocs.length} file{displayDocs.length === 1 ? '' : 's'}
            </span>
          </header>
          <div>
            {displayDocs.map((doc) => (
              <UploadRow key={doc.id} doc={doc} />
            ))}
          </div>
        </section>
      ) : renderEmpty ? (
        <section className="v2-card mt-4">
          <header className="v2-card-head">
            <h3>No files yet</h3>
          </header>
          <div className="v2-card-body text-[13px] text-ink-2">
            <p className="m-0 mb-2">When you drop files here, DocuPipe will:</p>
            <ol className="m-0 ml-5 list-decimal space-y-1 text-muted-1">
              <li>
                Classify each file (CTR / TO / CO / PA / INV / POP / LSP).
              </li>
              <li>Extract vendor + cost details from the document body.</li>
              <li>
                Compare every file to prior filings for {client.name} and flag
                exact or likely duplicates.
              </li>
            </ol>
          </div>
        </section>
      ) : null}
    </AppShell>
  )
}

function UploadRow({ doc }: { doc: Document }) {
  const status =
    doc.status ?? (doc.duplicateFlag !== 'none' ? 'completed' : 'queued')
  const statusLabel: Record<string, string> = {
    queued: 'Queued',
    classifying: 'Classifying',
    standardizing: 'Extracting',
    completed: 'Ready',
    error: 'Error',
  }
  const statusClass =
    status === 'error'
      ? 'pill-red'
      : status === 'completed'
        ? 'pill-green'
        : 'pill-amber'
  const dupClass =
    doc.duplicateFlag === 'exact'
      ? 'pill-red'
      : doc.duplicateFlag === 'likely'
        ? 'pill-amber'
        : null
  const hasStandardizedName = doc.renamedName !== doc.originalName
  const displayName = hasStandardizedName ? doc.renamedName : doc.originalName
  const typeAndVendor = [docTypeLabels[doc.docType], doc.vendorName]
    .filter(Boolean)
    .join(' · ')
  const sourceLabel =
    doc.sourceKind === 'egnyte_import' ? 'Imported from Egnyte' : 'Uploaded'

  return (
    <div className="queue-row">
      <span className="doc-ico" aria-hidden />
      <div className="qmeta min-w-0">
        <p className="qtitle truncate">{displayName}</p>
        <div className="qdetail">
          <span>{sourceLabel}</span>
          {hasStandardizedName ? (
            <span className="truncate">Original: {doc.originalName}</span>
          ) : null}
          <span>{typeAndVendor}</span>
          {dupClass ? (
            <span className={`pill ${dupClass}`}>
              {doc.duplicateFlag === 'exact' ? 'Exact' : 'Likely'}
            </span>
          ) : null}
        </div>
        {doc.errorMessage ? <p className="qerror">{doc.errorMessage}</p> : null}
      </div>
      <span className="queue-amount mono">
        {doc.amount > 0 ? formatCurrencyPrecise(doc.amount) : '—'}
      </span>
      <span className={`pill ${statusClass}`}>
        {status === 'classifying' || status === 'standardizing' ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <FileText className="size-3" />
        )}
        {statusLabel[status]}
      </span>
    </div>
  )
}
