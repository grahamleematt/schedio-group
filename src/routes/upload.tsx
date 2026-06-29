import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import {
  ArrowRight,
  FolderOpen,
  Loader2,
  RefreshCw,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { AppShell } from '#/components/sg-dream/AppShell'
import { RenameTransform } from '#/components/sg-dream/RenameTransform'
import {
  clients,
  displaySubmissionCycle,
  getClientById,
  getOpenVerification,
  getVerificationById,
} from '#/lib/sg-dream'
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

/** A file the user has added to the draft but has NOT analyzed yet. Held in
 * browser state only — nothing reaches the server, DocuPipe, or Egnyte until
 * "Analyze submission" runs. */
type StagedFile = {
  /** Stable client id so React keys + removal are deterministic. */
  id: string
  file: File
  /** SHA-256 of the file bytes; used to block staging the same file twice. */
  hash: string
}

/** SHA-256 the file bytes in the browser so we can dedupe a draft before
 * spending a DocuPipe call. */
async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  // Files the user has added but not yet analyzed. Browser-only — see StagedFile.
  const [stagedFiles, setStagedFiles] = useState<Array<StagedFile>>([])
  const [isStaging, setIsStaging] = useState(false)
  const [stageNotice, setStageNotice] = useState<string | null>(null)

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
  const inFlight = displayDocs.filter(
    (d) =>
      d.status === 'queued' ||
      d.status === 'classifying' ||
      d.status === 'standardizing',
  )

  const mutation = useMutation({
    mutationFn: async (files: File[]) => {
      // Vercel caps a serverless function's request body at ~4.5 MB, so files
      // can't all ride the same multipart POST. We split the drop two ways:
      //   - Small files (< 4 MB) are greedily packed into ~4 MB multipart
      //     batches and POSTed normally — fast, no extra round-trips.
      //   - Large files (>= 4 MB) are uploaded straight to Vercel Blob from the
      //     browser (bypassing the request-body cap), then handed to the server
      //     as blob URLs to fetch + ingest. This handles documents of any size.
      // Tim still just drops the whole submission at once.
      const LARGE_FILE_THRESHOLD = 4 * 1024 * 1024
      const smallFiles = files.filter((f) => f.size < LARGE_FILE_THRESHOLD)
      const largeFiles = files.filter((f) => f.size >= LARGE_FILE_THRESHOLD)

      const uploaded: Array<unknown> = []
      const failures: Array<string> = []

      const BATCH_BUDGET = 4 * 1024 * 1024
      const batches: Array<Array<File>> = []
      let current: Array<File> = []
      let currentSize = 0
      for (const file of smallFiles) {
        if (current.length > 0 && currentSize + file.size > BATCH_BUDGET) {
          batches.push(current)
          current = []
          currentSize = 0
        }
        current.push(file)
        currentSize += file.size
      }
      if (current.length > 0) batches.push(current)

      for (const batch of batches) {
        const fd = new FormData()
        fd.set('verificationId', verificationId)
        fd.set('clientId', client.id)
        for (const file of batch) fd.append('files', file)

        const label = batch.map((f) => f.name).join(', ')
        let res: Response
        try {
          res = await fetch('/api/uploads', { method: 'POST', body: fd })
        } catch {
          failures.push(`${label}: network error`)
          continue
        }
        if (!res.ok) {
          let message = `upload failed (${res.status})`
          if (res.status !== 413) {
            try {
              const data = (await res.json()) as { error?: string }
              if (data.error) message = data.error
            } catch {
              // non-JSON response; keep default message
            }
          }
          failures.push(`${label}: ${message}`)
          continue
        }
        const data = (await res.json()) as { uploaded: Array<unknown> }
        uploaded.push(...data.uploaded)
      }

      // Large files: direct-to-Blob, then ingest via blob URL.
      if (largeFiles.length > 0) {
        const { upload } = await import('@vercel/blob/client')
        const blobs: Array<{
          url: string
          filename: string
          contentType?: string
          sizeBytes: number
        }> = []
        for (const file of largeFiles) {
          try {
            const result = await upload(file.name, file, {
              access: 'public',
              handleUploadUrl: '/api/blob-token',
              contentType: file.type || undefined,
              clientPayload: JSON.stringify({
                clientId: client.id,
                verificationId,
              }),
            })
            blobs.push({
              url: result.url,
              filename: file.name,
              contentType: file.type || undefined,
              sizeBytes: file.size,
            })
          } catch (err) {
            const reason =
              err instanceof Error ? err.message : 'direct upload failed'
            failures.push(`${file.name}: ${reason}`)
          }
        }

        if (blobs.length > 0) {
          const label = blobs.map((b) => b.filename).join(', ')
          try {
            const res = await fetch('/api/uploads', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                verificationId,
                clientId: client.id,
                blobs,
              }),
            })
            if (!res.ok) {
              let message = `upload failed (${res.status})`
              try {
                const data = (await res.json()) as { error?: string }
                if (data.error) message = data.error
              } catch {
                // keep default
              }
              failures.push(`${label}: ${message}`)
            } else {
              const data = (await res.json()) as { uploaded: Array<unknown> }
              uploaded.push(...data.uploaded)
            }
          } catch {
            failures.push(`${label}: network error`)
          }
        }
      }

      // Whole submission failed — surface the combined reason via onError.
      if (uploaded.length === 0 && failures.length > 0) {
        throw new Error(failures.join('; '))
      }
      return { uploaded, failures }
    },
    onSuccess: (result) => {
      setUploadError(
        result.failures.length > 0
          ? `Some files were not analyzed — ${result.failures.join('; ')}`
          : null,
      )
      void queryClient.invalidateQueries({
        queryKey: ['verification', verificationId],
      })
      // The staged files are now real, queued documents. Clear the draft tray
      // and move to the processing view where DocuPipe progress streams in.
      if (result.uploaded.length > 0) {
        setStagedFiles([])
        setStageNotice(null)
        void navigate({
          to: '/processing',
          search: { client: client.id, verification: verification.id },
        })
      }
    },
    onError: (err) => {
      setUploadError(err instanceof Error ? err.message : 'Analysis failed')
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

  const stageFiles = async (files: FileList | null) => {
    const chosenFiles = snapshotUploadFiles(files)
    if (chosenFiles.length === 0) return
    setIsStaging(true)
    setStageNotice(null)
    try {
      const seen = new Set(stagedFiles.map((s) => s.hash))
      const additions: Array<StagedFile> = []
      const skipped: Array<string> = []
      for (const file of chosenFiles) {
        const hash = await hashFile(file)
        if (seen.has(hash)) {
          skipped.push(file.name)
          continue
        }
        seen.add(hash)
        additions.push({ id: `${hash}-${file.size}-${seen.size}`, file, hash })
      }
      if (additions.length > 0) {
        setStagedFiles((prev) => [...prev, ...additions])
      }
      setStageNotice(
        skipped.length > 0
          ? `Skipped ${skipped.length} duplicate file${
              skipped.length === 1 ? '' : 's'
            } already in this draft — ${skipped.join(', ')}`
          : null,
      )
    } finally {
      setIsStaging(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeStagedFile = (id: string) => {
    setStagedFiles((prev) => prev.filter((s) => s.id !== id))
  }

  const analyzeSubmission = () => {
    if (stagedFiles.length === 0 || mutation.isPending) return
    setUploadError(null)
    mutation.mutate(stagedFiles.map((s) => s.file))
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) void stageFiles(e.dataTransfer.files)
  }

  const renderError = variant === 'error' || Boolean(uploadError)
  const hasStaged = stagedFiles.length > 0
  const stagedBytes = stagedFiles.reduce((sum, s) => sum + s.file.size, 0)
  const hasAnalyzed = displayDocs.length > 0
  const canAnalyze = hasStaged && !mutation.isPending && !isStaging

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
            <span className="k">Staged (not analyzed)</span>
            <span className="v">{stagedFiles.length}</span>
          </div>
          <div className="kv">
            <span className="k">Analyzed</span>
            <span className="v">{displayDocs.length}</span>
          </div>
          {inFlight.length > 0 ? (
            <div className="kv">
              <span className="k">Processing</span>
              <span className="v">{inFlight.length}</span>
            </div>
          ) : null}
          {hasAnalyzed ? (
            <button
              type="button"
              className="v2-btn mt-2 w-full justify-center"
              onClick={() =>
                void navigate({
                  to: '/processing',
                  search: {
                    client: client.id,
                    verification: verification.id,
                  },
                })
              }
            >
              View processing
              <ArrowRight className="size-4" />
            </button>
          ) : null}
        </div>
      </section>

      <section className="v2-card">
        <header className="v2-card-head">
          <h3>Tips</h3>
        </header>
        <div className="v2-card-body space-y-3 text-[12.5px] text-ink-2">
          <p className="m-0">
            Add PDF, TIFF, or JPG files to the draft. Nothing is sent to
            DocuPipe until you click <strong>Analyze submission</strong>.
          </p>
          <p className="m-0">
            Remove anything you didn&rsquo;t mean to add before analyzing. The
            same file can&rsquo;t be staged twice.
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
          <div className="rounded-md border border-line bg-paper-2 p-2 font-mono text-[11px] leading-snug text-muted-1">
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
            Add files to the draft and review them. When you click Analyze,
            DocuPipe classifies each file, extracts vendor + cost details, and
            compares the draft against every prior filing for {client.name}.
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
          <button
            type="button"
            className="v2-btn primary"
            onClick={analyzeSubmission}
            disabled={!canAnalyze}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            {mutation.isPending
              ? 'Analyzing…'
              : hasStaged
                ? `Analyze submission · ${stagedFiles.length} file${
                    stagedFiles.length === 1 ? '' : 's'
                  }`
                : 'Analyze submission'}
            {!mutation.isPending ? <ArrowRight className="size-4" /> : null}
          </button>
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        accept=".pdf,.tif,.tiff,.jpg,.jpeg"
        onChange={(e) => void stageFiles(e.target.files)}
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

      {stageNotice ? (
        <div className="errbar amber mb-3" role="status">
          <span className="icn">!</span>
          <div className="min-w-0">
            <p className="m-0 font-semibold">Duplicate skipped</p>
            <p className="m-0 text-[12.5px]">{stageNotice}</p>
          </div>
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
            {isStaging || mutation.isPending ? (
              <Loader2 className="size-6 animate-spin" />
            ) : (
              <UploadCloud className="size-6" />
            )}
          </span>
          <p className="m-0 font-ops text-[15px] font-semibold text-ink">
            {mutation.isPending
              ? 'Analyzing submission…'
              : isStaging
                ? 'Adding files to draft…'
                : 'Drag and drop documents here'}
          </p>
          <p className="m-0 text-[12.5px] text-muted-1">
            Files are added to the draft below. PDF, TIFF, JPG, or import this
            submission's Egnyte intake folder.
          </p>
          <button
            type="button"
            className="v2-btn primary mt-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={isStaging || mutation.isPending}
          >
            <UploadCloud className="size-4" /> Browse files
          </button>
        </div>
      </div>

      {hasStaged ? (
        <section className="v2-card mt-4">
          <header className="v2-card-head">
            <h3>Draft · not analyzed yet</h3>
            <span className="sub">
              {stagedFiles.length} file{stagedFiles.length === 1 ? '' : 's'} ·{' '}
              {formatBytes(stagedBytes)} · review before analyzing
            </span>
          </header>
          <div>
            {stagedFiles.map((staged) => (
              <div className="queue-row" key={staged.id}>
                <span className="doc-ico" aria-hidden />
                <div className="qmeta min-w-0">
                  <RenameTransform
                    mode="preview"
                    originalName={staged.file.name}
                    entityCode={client.code}
                    verificationNumber={verification.number}
                    year={verification.year}
                  />
                  <div className="qdetail">
                    <span>{formatBytes(staged.file.size)}</span>
                    <span>Staged — analysis pending</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeStagedFile(staged.id)}
                  disabled={mutation.isPending}
                  aria-label={`Remove ${staged.file.name} from draft`}
                  title="Remove from draft"
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-transparent text-text-muted transition-colors hover:border-flag-exact-border hover:bg-flag-exact-bg hover:text-(--color-flag-exact-text) disabled:opacity-50"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

    </AppShell>
  )
}
