/**
 * "Reports & issued documents" — the reverse direction from intake: files
 * Schedio publishes TO the client entity (cost verification reports,
 * engineer letters). Rendered on /dashboard and /verifications so clients
 * can always find what Schedio has sent them, separate from what they
 * submitted.
 *
 * Clients get a read-only list with downloads. Internal roles additionally
 * get "Publish document": the file uploads directly to Vercel Blob via
 * /api/blob-token (`kind: 'issued'`), then `issueDocument` records it in
 * Postgres and the audit log.
 */

import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, FileUp, Loader2, Paperclip, X } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { displaySubmissionCycle } from '#/lib/sg-dream'
import type { Client, Verification } from '#/lib/sg-dream'
import { issuedDocumentsQuery } from '#/lib/queries'
import {
  deleteIssuedDocument,
  issueDocument,
} from '#/server/fns/issuedDocuments'

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/tiff',
]
const MAX_FILE_BYTES = 50 * 1024 * 1024

/** Radix Select can't represent an empty value; sentinel = entity-level. */
const CYCLE_NONE = 'entity-level'

const issuedDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function IssuedDocumentsCard({
  client,
  verifications,
  internal,
}: {
  client: Client
  verifications: ReadonlyArray<Verification>
  internal: boolean
}) {
  const issued = useQuery(issuedDocumentsQuery(client.id))
  const queryClient = useQueryClient()
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  const removeMut = useMutation({
    mutationFn: (id: string) =>
      deleteIssuedDocument({ data: { id, clientId: client.id } }),
    onSuccess: () => {
      setConfirmRemoveId(null)
      void queryClient.invalidateQueries({
        queryKey: issuedDocumentsQuery(client.id).queryKey,
      })
    },
  })

  const cycleLabel = (verificationId?: string): string => {
    if (!verificationId) return 'Entity-level'
    const verification = verifications.find((v) => v.id === verificationId)
    return verification ? displaySubmissionCycle(verification) : 'Entity-level'
  }

  const docs = issued.data ?? []

  return (
    <section className="v2-card" aria-label="Reports and issued documents">
      <header className="v2-card-head">
        <h3>Reports &amp; issued documents</h3>
        <span className="sub">Published to {client.code} by Schedio Group</span>
        {internal ? (
          <span className="ml-auto">
            <PublishDocumentDialog
              client={client}
              verifications={verifications}
            />
          </span>
        ) : null}
      </header>
      {issued.isPending ? (
        <div className="v2-card-body text-center text-[13px] text-muted-1">
          Loading issued documents…
        </div>
      ) : docs.length === 0 ? (
        <div className="v2-card-body text-center text-[13px] text-muted-1">
          Nothing issued yet. Cost verification reports and other Schedio
          deliverables appear here once published
          {internal ? ' — use Publish document to send one' : ''}.
        </div>
      ) : (
        <div className="v2-table-scroll">
          <table className="v2-tbl">
            <thead>
              <tr>
                <th>Document</th>
                <th>Cycle</th>
                <th>Issued</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <div className="font-semibold text-ink">{doc.title}</div>
                    {doc.note ? (
                      <div className="mt-0.5 text-[12px] text-muted-1">
                        {doc.note}
                      </div>
                    ) : null}
                    <div className="mono mt-0.5 text-[11px] text-muted-1">
                      {doc.fileName}
                      {doc.sizeBytes ? ` · ${formatSize(doc.sizeBytes)}` : ''}
                    </div>
                  </td>
                  <td>{cycleLabel(doc.verificationId)}</td>
                  <td>
                    <div>{issuedDate.format(new Date(doc.createdAtISO))}</div>
                    <div
                      className="text-[12px] text-muted-1"
                      title={doc.issuedByEmail}
                    >
                      by {doc.issuedByName}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="v2-btn"
                      >
                        <Download className="size-3.5" aria-hidden />
                        Download
                      </a>
                      {internal ? (
                        confirmRemoveId === doc.id ? (
                          <>
                            <button
                              type="button"
                              className="v2-btn"
                              style={{ color: 'var(--color-red-base)' }}
                              onClick={() => removeMut.mutate(doc.id)}
                              disabled={removeMut.isPending}
                            >
                              {removeMut.isPending ? (
                                <Loader2
                                  className="size-3.5 animate-spin"
                                  aria-hidden
                                />
                              ) : null}
                              Confirm removal
                            </button>
                            <button
                              type="button"
                              className="v2-btn"
                              onClick={() => setConfirmRemoveId(null)}
                              disabled={removeMut.isPending}
                            >
                              Keep
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="v2-btn"
                            onClick={() => setConfirmRemoveId(doc.id)}
                          >
                            Remove
                          </button>
                        )
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function PublishDocumentDialog({
  client,
  verifications,
}: {
  client: Client
  verifications: ReadonlyArray<Verification>
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [cycleId, setCycleId] = useState<string>(CYCLE_NONE)
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Newest cycle first — the report being published usually covers it.
  const cycles = [...verifications].sort((a, b) => b.number - a.number)

  const publish = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('missing file')
      const { upload } = await import('@vercel/blob/client')
      const uploaded = await upload(`issued/${file.name}`, file, {
        access: 'public',
        handleUploadUrl: '/api/blob-token',
        contentType: file.type || undefined,
        clientPayload: JSON.stringify({ kind: 'issued', clientId: client.id }),
      })
      return issueDocument({
        data: {
          clientId: client.id,
          verificationId: cycleId === CYCLE_NONE ? undefined : cycleId,
          title,
          note: note.trim().length > 0 ? note : undefined,
          fileUrl: uploaded.url,
          fileName: file.name,
          contentType: file.type || undefined,
          sizeBytes: file.size,
        },
      })
    },
    onSuccess: (result) => {
      if (result.ok) {
        void queryClient.invalidateQueries({
          queryKey: issuedDocumentsQuery(client.id).queryKey,
        })
        handleOpenChange(false)
      }
    },
  })

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      publish.reset()
      setTitle('')
      setNote('')
      setCycleId(CYCLE_NONE)
      setFile(null)
      setFileError(null)
    }
  }

  const pickFile = (incoming: File) => {
    setFileError(null)
    if (!ACCEPTED_TYPES.includes(incoming.type)) {
      setFileError('Only PDFs and images can be published.')
      return
    }
    if (incoming.size > MAX_FILE_BYTES) {
      setFileError(`${incoming.name} is over 50 MB.`)
      return
    }
    setFile(incoming)
  }

  const error = publish.isError
    ? 'Could not publish the document — try again.'
    : publish.data && !publish.data.ok
      ? publish.data.error
      : null
  const canSubmit =
    title.trim().length > 0 && file !== null && !publish.isPending

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className="v2-btn">
        <FileUp className="size-4" aria-hidden />
        Publish document
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Publish a document to {client.code}</DialogTitle>
          <DialogDescription>
            The file becomes visible to everyone with access to{' '}
            {client.name} — it appears under Reports &amp; issued documents on
            their dashboard.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (canSubmit) publish.mutate()
          }}
        >
          <label className="invite-field">
            <span className="field-label">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="e.g. Cost verification report · Cycle 02"
              disabled={publish.isPending}
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>

          <div className="invite-field">
            <span className="field-label" id="issued-cycle-label">
              Review cycle
            </span>
            <Select
              value={cycleId}
              onValueChange={setCycleId}
              disabled={publish.isPending}
            >
              <SelectTrigger
                className="w-full"
                aria-labelledby="issued-cycle-label"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CYCLE_NONE}>
                  <span className="font-semibold">Entity-level</span>
                  <span className="text-muted-1 text-[11px]">
                    Not tied to one review cycle
                  </span>
                </SelectItem>
                {cycles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    <span className="font-semibold">
                      {displaySubmissionCycle(v)}
                    </span>
                    <span className="text-muted-1 text-[11px]">
                      Cutoff {v.cutoffDate}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="invite-field">
            <span className="field-label">Note (optional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Anything the client should know about this document."
              disabled={publish.isPending}
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>

          <div className="invite-field">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                className="hidden"
                onChange={(e) => {
                  const picked = e.target.files?.[0]
                  if (picked) pickFile(picked)
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                className="v2-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={publish.isPending}
              >
                <Paperclip className="size-4" aria-hidden />
                {file ? 'Replace file' : 'Choose file'}
              </button>
              {file ? (
                <span className="border-input text-muted-1 inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-[12px]">
                  <span className="max-w-40 truncate">{file.name}</span>
                  <span className="shrink-0">{formatSize(file.size)}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    className="hover:text-ink shrink-0 rounded-sm p-0.5"
                    onClick={() => setFile(null)}
                    disabled={publish.isPending}
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </span>
              ) : null}
            </div>
            {fileError ? (
              <span
                className="text-[12px]"
                style={{ color: 'var(--color-red-base)' }}
                role="alert"
              >
                {fileError}
              </span>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-1 text-[12px]" role="status">
              {error ? (
                <span style={{ color: 'var(--color-red-base)' }}>{error}</span>
              ) : (
                <>PDF or image · up to 50 MB</>
              )}
            </span>
            <button type="submit" className="v2-btn primary" disabled={!canSubmit}>
              {publish.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <FileUp className="size-4" aria-hidden />
              )}
              {publish.isPending ? 'Publishing…' : 'Publish'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
