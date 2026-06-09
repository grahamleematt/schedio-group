import { useState } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { Loader2, Trash2 } from 'lucide-react'
import { AppShell } from '#/components/sg-dream/AppShell'
import { DocumentLibrary } from '#/components/sg-dream/DocumentLibrary'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  clients,
  docTypeOrder,
  getClientById,
  getOpenVerification,
  getVerificationById,
} from '#/lib/sg-dream'
import type { Document, DocType } from '#/lib/sg-dream'
import { verificationSnapshotQuery } from '#/lib/queries'
import { storedListToDisplay } from '#/lib/sg-dream-adapter'
import {
  clearSubmission,
  deleteSubmissionDocument,
} from '#/server/fns/deleteSubmission'
import type { DreamSnapshot } from '#/server/store'

type LibrarySearch = {
  client: string
  verification: string
  libraryQuery?: string
  libraryOpen?: DocType
}

const docTypes = new Set<DocType>(docTypeOrder)

export const Route = createFileRoute('/library')({
  validateSearch: (s: Record<string, unknown>): LibrarySearch => ({
    client: typeof s.client === 'string' ? s.client : 'dawson-trails-md1',
    verification:
      typeof s.verification === 'string'
        ? s.verification
        : 'dawson-trails-md1-v1',
    libraryQuery:
      typeof s.libraryQuery === 'string' && s.libraryQuery.length > 0
        ? s.libraryQuery
        : undefined,
    libraryOpen:
      typeof s.libraryOpen === 'string' &&
      docTypes.has(s.libraryOpen as DocType)
        ? (s.libraryOpen as DocType)
        : undefined,
  }),
  loader: ({ context, location }) => {
    const search = location.search as LibrarySearch
    const requestedClient =
      typeof search.client === 'string' ? search.client : 'dawson-trails-md1'
    const knownClient = clients.find((c) => c.id === requestedClient)
    if (!knownClient) {
      const open = getOpenVerification('dawson-trails-md1')
      throw redirect({
        to: '/library',
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
        to: '/library',
        search: { client: clientId, verification: open.id },
      })
    }
    return context.queryClient.ensureQueryData(
      verificationSnapshotQuery(verification.id),
    )
  },
  head: () => ({ meta: [{ title: 'Document library | SG DREAM' }] }),
  component: LibraryPage,
})

function LibraryPage() {
  const navigate = useNavigate()
  const {
    client: clientId,
    verification: verificationId,
    libraryQuery,
    libraryOpen,
  } = Route.useSearch()
  const client = getClientById(clientId)
  const verification =
    getVerificationById(verificationId, clientId) ??
    getOpenVerification(clientId)

  const queryClient = useQueryClient()
  const snapshotQuery = useSuspenseQuery(
    verificationSnapshotQuery(verification.id),
  )
  const snapshot = snapshotQuery.data
  const docs = storedListToDisplay(snapshot?.verification.documents ?? [])

  const [pendingDoc, setPendingDoc] = useState<Document | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const snapshotKey = verificationSnapshotQuery(verification.id).queryKey
  const applySnapshot = (next: DreamSnapshot | null) => {
    queryClient.setQueryData(snapshotKey, next)
  }

  const deleteDocMut = useMutation({
    mutationFn: (documentId: string) =>
      deleteSubmissionDocument({
        data: { verificationId: verification.id, documentId },
      }),
    onSuccess: (next) => {
      applySnapshot(next)
      setPendingDoc(null)
    },
  })

  const clearMut = useMutation({
    mutationFn: () =>
      clearSubmission({ data: { verificationId: verification.id } }),
    onSuccess: (next) => {
      applySnapshot(next)
      setConfirmClear(false)
    },
  })
  const referenceLabel =
    docs.length > 0 && snapshot?.verification.ref
      ? snapshot.verification.ref
      : 'Pending'

  const queryValue = libraryQuery ?? ''

  const baseSearch = {
    client: client.id,
    verification: verification.id,
  }

  const updateLibrary = (next: { query?: string; open?: DocType | null }) => {
    void navigate({
      to: '/library',
      search: {
        ...baseSearch,
        libraryQuery:
          next.query !== undefined
            ? next.query.length > 0
              ? next.query
              : undefined
            : libraryQuery,
        libraryOpen:
          next.open !== undefined ? (next.open ?? undefined) : libraryOpen,
      },
      resetScroll: false,
    })
  }

  const flaggedCount = docs.filter((d) => d.duplicateFlag !== 'none').length
  const filedCount = docs.filter((d) => d.egnyteClassifiedPath).length

  const rail = (
    <>
      <section className="v2-card">
        <header className="v2-card-head">
          <h3>Library stats</h3>
        </header>
        <div className="v2-card-body">
          <div className="kv">
            <span className="k">Documents</span>
            <span className="v mono">{docs.length}</span>
          </div>
          <div className="kv">
            <span className="k">Filed in Egnyte</span>
            <span className="v mono">{filedCount}</span>
          </div>
          <div className="kv">
            <span className="k">Flagged</span>
            <span className="v">
              {flaggedCount > 0 ? (
                <span className="pill pill-amber">{flaggedCount}</span>
              ) : (
                <span className="pill pill-green">0</span>
              )}
            </span>
          </div>
          <div className="kv">
            <span className="k">Reference status</span>
            <span className="v mono">{referenceLabel}</span>
          </div>
        </div>
      </section>

      <section className="v2-card">
        <header className="v2-card-head">
          <h3>Retention policy</h3>
        </header>
        <div className="v2-card-body text-ink-2 space-y-2 text-[12.5px]">
          <p className="m-0">
            Originals are preserved indefinitely in Egnyte. Standardized renames
            mirror the originals; both paths are auditable from the document
            detail panel.
          </p>
          <p className="text-muted-1 m-0">
            Removing a document from the library marks it as discarded but does
            not delete the underlying Egnyte file.
          </p>
        </div>
      </section>

      {docs.length > 0 ? (
        <section className="v2-card">
          <header className="v2-card-head">
            <h3>Danger zone</h3>
          </header>
          <div className="v2-card-body space-y-3">
            <p className="text-muted-1 m-0 text-[12.5px]">
              Clear this submission to remove all {docs.length} document
              {docs.length === 1 ? '' : 's'} from SG DREAM — useful when a batch
              was filed to the wrong workflow. The verification reference and
              audit trail are kept; Egnyte originals are untouched.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmClear(true)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden />
              Clear submission
            </Button>
          </div>
        </section>
      ) : null}
    </>
  )

  return (
    <AppShell
      active="library"
      crumbs={[{ label: 'Document library' }]}
      rail={rail}
    >
      <header className="mb-3">
        <p className="v2-eyebrow">Document library</p>
        <h1 className="v2-h1">All filed documents · {client.name}</h1>
        <p className="v2-lede">
          Grouped by document type for the current submission. Each file carries
          its full extracted detail — vendor, amounts, dates, the pay-app
          waterfall, and any fields flagged for review.
        </p>
      </header>

      <DocumentLibrary
        documents={docs}
        query={queryValue}
        openCategory={libraryOpen}
        verificationId={verification.id}
        onQueryChange={(q) => updateLibrary({ query: q })}
        onToggleCategory={(t) =>
          updateLibrary({ open: libraryOpen === t ? null : t })
        }
        onDelete={(doc) => {
          deleteDocMut.reset()
          setPendingDoc(doc)
        }}
        pendingDeleteId={
          deleteDocMut.isPending ? (pendingDoc?.id ?? undefined) : undefined
        }
      />

      <Dialog
        open={pendingDoc !== null}
        onOpenChange={(next) => {
          if (!next && !deleteDocMut.isPending) {
            setPendingDoc(null)
            deleteDocMut.reset()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove document?</DialogTitle>
            <DialogDescription>
              This removes{' '}
              <span className="font-mono">
                {pendingDoc?.originalName ?? 'this document'}
              </span>{' '}
              from SG DREAM and records the removal in the audit log. The
              original file in Egnyte is not deleted.
            </DialogDescription>
          </DialogHeader>
          {deleteDocMut.isError ? (
            <p className="m-0 text-[13px] text-destructive" role="alert">
              Could not remove the document. Try again.
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={deleteDocMut.isPending}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={deleteDocMut.isPending || !pendingDoc}
              onClick={() => {
                if (pendingDoc) deleteDocMut.mutate(pendingDoc.id)
              }}
            >
              {deleteDocMut.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="size-4" aria-hidden />
              )}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmClear}
        onOpenChange={(next) => {
          if (!next && !clearMut.isPending) {
            setConfirmClear(false)
            clearMut.reset()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear this submission?</DialogTitle>
            <DialogDescription>
              This removes all {docs.length} document
              {docs.length === 1 ? '' : 's'} filed under{' '}
              <span className="font-mono">
                {snapshot?.verification.ref ?? verification.id}
              </span>{' '}
              and records the change in the audit log. Egnyte originals are not
              deleted.
            </DialogDescription>
          </DialogHeader>
          {clearMut.isError ? (
            <p className="m-0 text-[13px] text-destructive" role="alert">
              Could not clear the submission. Try again.
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={clearMut.isPending}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={clearMut.isPending}
              onClick={() => clearMut.mutate()}
            >
              {clearMut.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="size-4" aria-hidden />
              )}
              Clear submission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
