import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { AppShell } from '#/components/sg-dream/AppShell'
import { DocumentLibrary } from '#/components/sg-dream/DocumentLibrary'
import type { NameDisplay } from '#/components/sg-dream/DocumentLibrary'
import {
  clients,
  docTypeOrder,
  getClientById,
  getOpenVerification,
  getVerificationById,
} from '#/lib/sg-dream'
import type { DocType } from '#/lib/sg-dream'
import { verificationSnapshotQuery } from '#/lib/queries'
import { storedListToDisplay } from '#/lib/sg-dream-adapter'

type LibrarySearch = {
  client: string
  verification: string
  libraryQuery?: string
  libraryOpen?: DocType
  nameDisplay?: NameDisplay
}

const docTypes = new Set<DocType>(docTypeOrder)
const nameDisplayValues = new Set<NameDisplay>([
  'original',
  'standardized',
  'both',
])

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
    nameDisplay:
      typeof s.nameDisplay === 'string' &&
      nameDisplayValues.has(s.nameDisplay as NameDisplay)
        ? (s.nameDisplay as NameDisplay)
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
    nameDisplay,
  } = Route.useSearch()
  const client = getClientById(clientId)
  const verification =
    getVerificationById(verificationId, clientId) ??
    getOpenVerification(clientId)

  const snapshotQuery = useSuspenseQuery(
    verificationSnapshotQuery(verification.id),
  )
  const snapshot = snapshotQuery.data
  const docs = storedListToDisplay(snapshot?.verification.documents ?? [])
  const referenceLabel =
    docs.length > 0 && snapshot?.verification.ref
      ? snapshot.verification.ref
      : 'Pending'

  const queryValue = libraryQuery ?? ''
  const nameDisplayValue: NameDisplay = nameDisplay ?? 'both'

  const baseSearch = {
    client: client.id,
    verification: verification.id,
  }

  const updateLibrary = (next: {
    query?: string
    open?: DocType | null
    nameDisplay?: NameDisplay
  }) => {
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
        nameDisplay:
          next.nameDisplay !== undefined ? next.nameDisplay : nameDisplay,
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
          Grouped by document type for the current submission. Toggle between
          original and standardized filenames to match how Schedio Group stores
          each artifact.
        </p>
      </header>

      <DocumentLibrary
        documents={docs}
        query={queryValue}
        openCategory={libraryOpen}
        nameDisplay={nameDisplayValue}
        onQueryChange={(q) => updateLibrary({ query: q })}
        onToggleCategory={(t) =>
          updateLibrary({ open: libraryOpen === t ? null : t })
        }
        onNameDisplayChange={(v) => updateLibrary({ nameDisplay: v })}
      />
    </AppShell>
  )
}
