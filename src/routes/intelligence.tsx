import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import {
  Archive,
  ArrowLeft,
  Brain,
  CheckCircle2,
  Database,
  FileText,
  FolderInput,
  GraduationCap,
  Highlighter,
  Layers3,
  MousePointer2,
  Network,
  Pencil,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { lazy, Suspense, useState, useSyncExternalStore } from 'react'
import type { FormEvent } from 'react'

import type { PdfDraftFinding } from '#/components/intelligence/PdfFindingViewer'
import { buildRelationshipPreview } from '#/lib/intelligence-relationships'
import { intelligenceWorkspaceQuery } from '#/lib/queries'
import { getIntelligencePreviewEnabled } from '#/server/fns/intelligencePreviewEnabled'
import { categoryLabels } from '#/server/intelligence/catalog'
import type {
  FindingType,
  IntelligenceCategoryId,
  IntelligenceDocument,
  IntelligenceFinding,
  IntelligenceLearning,
  IntelligenceRecommendation,
  IntelligenceSegment,
  FindingStatus,
  LearningApplicability,
  LearningConfidence,
  LearningDetermination,
} from '#/server/intelligence/types'

const PdfFindingViewer = lazy(
  () => import('#/components/intelligence/PdfFindingViewer'),
)

function subscribeToHydration(): () => void {
  return () => {}
}

function useIsServerRender(): boolean {
  return useSyncExternalStore(
    subscribeToHydration,
    () => false,
    () => true,
  )
}

type IntelligenceSearch = {
  document?: string
  segment?: string
  category?: IntelligenceCategoryId | 'all'
  q?: string
}

const categoryValues = new Set<IntelligenceCategoryId | 'all'>([
  'all',
  'contract',
  'work_authorization',
  'task_order',
  'change_order',
  'plat',
  'pdp',
  'invoice',
  'pay_application',
  'proof_of_payment',
  'report',
  'governance',
  'workbook',
  'construction_drawing',
  'unknown',
])

const determinationLabels: Record<LearningDetermination, string> = {
  ppp: 'PPP',
  not_ppp: 'Not PPP',
  conditional: 'Conditional',
  needs_review: 'Needs review',
}

const applicabilityLabels: Record<LearningApplicability, string> = {
  filing: 'Filing',
  project: 'Project',
  district: 'District',
  client: 'Client',
  organization: 'Organization',
}

const confidenceLabels: Record<LearningConfidence, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

const findingTypeLabels: Record<FindingType, string> = {
  ppp: 'PPP evidence',
  not_ppp: 'Not PPP',
  conditional: 'Conditional',
  needs_review: 'Needs review',
  question: 'Question',
  source_evidence: 'Source evidence',
}

const findingStatusLabels: Record<FindingStatus, string> = {
  open: 'Open',
  promoted: 'Promoted',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
}

type FindingMutationPayload = PdfDraftFinding & {
  findingType: FindingType
  confidence: LearningConfidence
  label: string
  rationale: string
  reasonTags: string
}

type FindingUpdateMutationPayload = {
  findingId: string
  findingType: FindingType
  status: FindingStatus
  confidence: LearningConfidence
  label: string
  rationale: string
  reasonTags: string
}

type ImportScopeId = 'district' | 'developer'

const importScopeLabels: Record<ImportScopeId, string> = {
  district: 'District',
  developer: 'Developer',
}

export const Route = createFileRoute('/intelligence')({
  beforeLoad: async () => {
    const { enabled } = await getIntelligencePreviewEnabled()
    if (!enabled) throw redirect({ to: '/' })
  },
  validateSearch: (s: Record<string, unknown>): IntelligenceSearch => ({
    document: typeof s.document === 'string' ? s.document : undefined,
    segment: typeof s.segment === 'string' ? s.segment : undefined,
    category:
      typeof s.category === 'string' &&
      categoryValues.has(s.category as IntelligenceCategoryId | 'all')
        ? (s.category as IntelligenceCategoryId | 'all')
        : 'all',
    q:
      typeof s.q === 'string' && s.q.trim().length > 0 ? s.q.trim() : undefined,
  }),
  loader: ({ context, location }) => {
    const search = location.search as IntelligenceSearch
    return context.queryClient.ensureQueryData(
      intelligenceWorkspaceQuery({
        selectedDocumentId: search.document,
        selectedSegmentId: search.segment,
      }),
    )
  },
  head: () => ({ meta: [{ title: 'Intelligence | Schedio' }] }),
  component: IntelligencePage,
})

function formatPpp(value: number | undefined): string {
  if (typeof value !== 'number') return 'PPP open'
  return `${value.toFixed(value % 1 === 0 ? 0 : 2)}% PPP`
}

function formatScore(score: number): string {
  return `${Math.round(score * 100)}%`
}

function docMatches(
  doc: IntelligenceDocument,
  category: IntelligenceCategoryId | 'all',
  query: string | undefined,
): boolean {
  if (category !== 'all' && doc.categoryId !== category) return false
  if (!query) return true
  const haystack = [
    doc.title,
    doc.fileName,
    doc.vendorName,
    doc.filingLabel,
    doc.categoryId,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(query.toLowerCase())
}

function segmentsForDoc(
  doc: IntelligenceDocument | undefined,
  segments: ReadonlyArray<IntelligenceSegment>,
): ReadonlyArray<IntelligenceSegment> {
  if (!doc) return []
  return segments.filter((segment) => segment.documentId === doc.id)
}

function documentUrl(doc: IntelligenceDocument): string {
  const params = new URLSearchParams({ documentId: doc.id })
  return `/api/intelligence/documents?${params.toString()}`
}

function documentSearch(input: {
  documentId?: string
  segmentId?: string
  category: IntelligenceCategoryId | 'all'
  q?: string
}): IntelligenceSearch {
  return {
    document: input.documentId,
    segment: input.segmentId,
    category: input.category,
    q: input.q,
  }
}

function factEntries(
  segment: IntelligenceSegment | undefined,
): Array<[string, string]> {
  if (!segment) return []
  return Object.entries(segment.extractedFacts)
    .filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    )
    .slice(0, 6)
    .map(([key, value]) => [
      key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (char) => char.toUpperCase()),
      typeof value === 'number' ? value.toLocaleString('en-US') : String(value),
    ])
}

function learningMatchesSegment(
  learning: IntelligenceLearning,
  segment: IntelligenceSegment | undefined,
): boolean {
  if (!segment) return false
  return (
    learning.segmentId === segment.id ||
    learning.categoryId === segment.categoryId
  )
}

function findingDetermination(
  finding: IntelligenceFinding | undefined,
): LearningDetermination {
  if (!finding) return 'ppp'
  if (
    finding.findingType === 'ppp' ||
    finding.findingType === 'not_ppp' ||
    finding.findingType === 'conditional' ||
    finding.findingType === 'needs_review'
  ) {
    return finding.findingType
  }
  return 'needs_review'
}

function recommendationRows(
  recommendations: ReadonlyArray<IntelligenceRecommendation>,
  segment: IntelligenceSegment | undefined,
): ReadonlyArray<IntelligenceRecommendation> {
  if (!segment) return []
  return recommendations
    .filter((row) => row.targetSegmentId === segment.id)
    .slice(0, 5)
}

function PdfViewerFallback() {
  return (
    <div className="intel-pdf-viewer">
      <div className="intel-pdf-scroll">
        <div className="intel-pdf-state">Loading PDF viewer</div>
      </div>
    </div>
  )
}

function IntelligencePage() {
  const {
    document: selectedDocumentId,
    segment: selectedSegmentId,
    category = 'all',
    q,
  } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const workspaceQuery = useSuspenseQuery(
    intelligenceWorkspaceQuery({
      selectedDocumentId,
      selectedSegmentId,
    }),
  )
  const workspace = workspaceQuery.data

  const filteredDocs = workspace.documents.filter((doc) =>
    docMatches(doc, category, q),
  )
  const selectedDoc =
    (selectedDocumentId
      ? workspace.documents.find((doc) => doc.id === selectedDocumentId)
      : undefined) ??
    filteredDocs.at(0) ??
    workspace.documents.at(0)

  const docSegments = segmentsForDoc(selectedDoc, workspace.segments)
  const selectedSegment =
    (selectedSegmentId
      ? docSegments.find((segment) => segment.id === selectedSegmentId)
      : undefined) ?? docSegments.at(0)
  const relatedLearnings = workspace.learnings
    .filter((learning) => learningMatchesSegment(learning, selectedSegment))
    .slice(0, 8)
  const selectedRecommendations = recommendationRows(
    workspace.recommendations,
    selectedSegment,
  )
  const relationshipPreview = buildRelationshipPreview(
    workspace,
    selectedDoc?.id,
  )
  const selectedDocFindings = selectedDoc
    ? workspace.findings.filter(
        (finding) => finding.documentId === selectedDoc.id,
      )
    : []
  const selectedSegmentFindings = selectedSegment
    ? selectedDocFindings.filter(
        (finding) =>
          !finding.segmentId || finding.segmentId === selectedSegment.id,
      )
    : selectedDocFindings
  const [draftFinding, setDraftFinding] = useState<PdfDraftFinding | null>(null)
  const [importScope, setImportScope] = useState<ImportScopeId>('district')
  const [editingFindingId, setEditingFindingId] = useState<string | null>(null)
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(
    null,
  )
  const activeEvidenceFinding =
    selectedDocFindings.find((finding) => finding.id === selectedFindingId) ??
    selectedSegmentFindings.at(0) ??
    selectedDocFindings.at(0)
  const isServerRender = useIsServerRender()
  const activeDraft =
    draftFinding?.documentId === selectedDoc?.id ? draftFinding : null
  const evidenceSourceClass = `intel-evidence-link${
    activeDraft ? ' pending' : activeEvidenceFinding ? ' linked' : ''
  }`
  const evidenceSourceLabel = activeDraft
    ? `Draft on page ${activeDraft.pageNumber}`
    : activeEvidenceFinding
      ? `Page ${activeEvidenceFinding.pageNumber} · ${activeEvidenceFinding.label}`
      : 'Segment summary only'
  const evidenceSourceBody = activeDraft
    ? 'Save the finding to attach this marked section to the learning.'
    : activeEvidenceFinding
      ? 'This learning will stay tied to the selected document evidence.'
      : 'No saved finding is selected for this learning.'

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/intelligence/imports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ importedBy: 'Tim', scopeId: importScope }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? `import failed (${res.status})`)
      }
      return res.json()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['intelligence-workspace'],
      })
    },
  })

  const findingMutation = useMutation({
    mutationFn: async (payload: FindingMutationPayload) => {
      const res = await fetch('/api/intelligence/findings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? `finding save failed (${res.status})`)
      }
      return res.json()
    },
    onSuccess: (data: { finding?: IntelligenceFinding }) => {
      setDraftFinding(null)
      if (data.finding?.id) setSelectedFindingId(data.finding.id)
      void queryClient.invalidateQueries({
        queryKey: ['intelligence-workspace'],
      })
    },
  })

  const findingUpdateMutation = useMutation({
    mutationFn: async (payload: FindingUpdateMutationPayload) => {
      const res = await fetch('/api/intelligence/findings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? `finding update failed (${res.status})`)
      }
      return res.json()
    },
    onSuccess: () => {
      setEditingFindingId(null)
      void queryClient.invalidateQueries({
        queryKey: ['intelligence-workspace'],
      })
    },
  })

  const findingDeleteMutation = useMutation({
    mutationFn: async (payload: { findingId: string }) => {
      const res = await fetch('/api/intelligence/findings', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? `finding delete failed (${res.status})`)
      }
      return res.json()
    },
    onSuccess: (_data, variables) => {
      if (editingFindingId === variables.findingId) setEditingFindingId(null)
      if (selectedFindingId === variables.findingId) setSelectedFindingId(null)
      void queryClient.invalidateQueries({
        queryKey: ['intelligence-workspace'],
      })
    },
  })

  const learningMutation = useMutation({
    mutationFn: async (payload: {
      segmentId: string
      findingId?: string
      label: string
      determination: LearningDetermination
      pppValue?: number
      applicability: LearningApplicability
      confidence: LearningConfidence
      rationale: string
      reasonTags: string
    }) => {
      const res = await fetch('/api/intelligence/learnings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? `save failed (${res.status})`)
      }
      return res.json()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['intelligence-workspace'],
      })
    },
  })

  const saveLearning = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedSegment) return
    const form = new FormData(event.currentTarget)
    const rawPpp = String(form.get('pppValue') ?? '').trim()
    const findingId = String(form.get('findingId') ?? '').trim()
    learningMutation.mutate({
      segmentId: selectedSegment.id,
      findingId: findingId || undefined,
      label: String(form.get('label') ?? ''),
      determination: String(form.get('determination')) as LearningDetermination,
      pppValue: rawPpp ? Number(rawPpp) : undefined,
      applicability: String(form.get('applicability')) as LearningApplicability,
      confidence: String(form.get('confidence')) as LearningConfidence,
      rationale: String(form.get('rationale') ?? ''),
      reasonTags: String(form.get('reasonTags') ?? ''),
    })
  }

  const saveFinding = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeDraft) return
    const form = new FormData(event.currentTarget)
    findingMutation.mutate({
      ...activeDraft,
      findingType: String(form.get('findingType')) as FindingType,
      confidence: String(form.get('confidence')) as LearningConfidence,
      label: String(form.get('label') ?? ''),
      rationale: String(form.get('rationale') ?? ''),
      reasonTags: String(form.get('reasonTags') ?? ''),
    })
  }

  const saveFindingEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    findingUpdateMutation.mutate({
      findingId: String(form.get('findingId') ?? ''),
      findingType: String(form.get('findingType')) as FindingType,
      status: String(form.get('status')) as FindingStatus,
      confidence: String(form.get('confidence')) as LearningConfidence,
      label: String(form.get('label') ?? ''),
      rationale: String(form.get('rationale') ?? ''),
      reasonTags: String(form.get('reasonTags') ?? ''),
    })
  }

  const selectFinding = (
    findingId: string,
    scrollTarget: 'card' | 'mark' = 'card',
  ) => {
    setSelectedFindingId(findingId)
    setDraftFinding(null)
    if (typeof document === 'undefined') return
    window.requestAnimationFrame(() => {
      document
        .querySelector(`[data-finding-${scrollTarget}-id="${findingId}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  }

  const moveDocumentSelection = (nextIndex: number) => {
    const nextDoc = filteredDocs.at(nextIndex)
    if (!nextDoc) return
    const segment = workspace.segments.find(
      (row) => row.documentId === nextDoc.id,
    )
    void navigate({
      to: '/intelligence',
      search: documentSearch({
        documentId: nextDoc.id,
        segmentId: segment?.id,
        category,
        q,
      }),
    })
  }

  return (
    <div className="intel-app">
      <aside className="intel-rail">
        <div className="intel-brand">
          <img src="/schedio-logo.svg" alt="Schedio Group" />
          <span>Intelligence</span>
        </div>
        <Link
          to="/dashboard"
          search={{ client: 'dawson-trails-md1' }}
          className="intel-back-link unstyled-link"
        >
          <ArrowLeft className="size-4" aria-hidden />
          SG DREAM workspace
        </Link>

        <section className="intel-import-card">
          <div>
            <p>Pipeline</p>
            <strong>
              {workspace.imports.at(0)?.status === 'imported'
                ? `${workspace.imports.at(0)?.sourceLabel ?? 'Dawson package'} imported`
                : 'Ready for import'}
            </strong>
          </div>
          <div
            className="intel-scope-switch"
            aria-label="Dawson import workspace"
          >
            {(['district', 'developer'] as const).map((scopeId) => (
              <button
                key={scopeId}
                type="button"
                className={scopeId === importScope ? 'active' : ''}
                onClick={() => setImportScope(scopeId)}
              >
                {importScopeLabels[scopeId]}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="intel-button primary"
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending}
          >
            <FolderInput className="size-4" aria-hidden />
            {importMutation.isPending ? 'Importing' : 'Import from Egnyte'}
          </button>
          <div className="intel-mode">
            <Database className="size-4" aria-hidden />
            <span>
              {workspace.mode === 'postgres'
                ? 'AWS Postgres'
                : 'Local persistence'}
            </span>
          </div>
          {importMutation.isError ? (
            <div className="intel-error">
              {importMutation.error instanceof Error
                ? importMutation.error.message
                : 'Import failed'}
            </div>
          ) : null}
        </section>

        <div className="intel-search">
          <Search className="size-4" aria-hidden />
          <input
            key={q ?? 'empty'}
            defaultValue={q ?? ''}
            placeholder="Search documents"
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              const value = event.currentTarget.value.trim()
              void navigate({
                to: '/intelligence',
                search: documentSearch({
                  documentId: selectedDoc?.id,
                  segmentId: selectedSegment?.id,
                  category,
                  q: value || undefined,
                }),
              })
            }}
          />
        </div>

        <div className="intel-category-grid" aria-label="Document categories">
          {Array.from(categoryValues).map((value) => {
            const active = value === category
            const label = value === 'all' ? 'All' : categoryLabels[value]
            return (
              <Link
                to="/intelligence"
                search={documentSearch({ category: value, q })}
                className={active ? 'active unstyled-link' : 'unstyled-link'}
                aria-current={active ? 'true' : undefined}
                key={value}
              >
                {label}
              </Link>
            )
          })}
        </div>

        <div className="intel-doc-list" aria-label="Documents">
          {filteredDocs.map((doc, index) => {
            const active = selectedDoc?.id === doc.id
            const segment = workspace.segments.find(
              (row) => row.documentId === doc.id,
            )
            return (
              <Link
                to="/intelligence"
                search={documentSearch({
                  documentId: doc.id,
                  segmentId: segment?.id,
                  category,
                  q,
                })}
                className={`intel-doc-row unstyled-link${
                  active ? ' active' : ''
                }`}
                aria-current={active ? 'page' : undefined}
                tabIndex={active ? 0 : -1}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    moveDocumentSelection(
                      Math.min(filteredDocs.length - 1, index + 1),
                    )
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    moveDocumentSelection(Math.max(0, index - 1))
                  }
                  if (event.key === 'Home') {
                    event.preventDefault()
                    moveDocumentSelection(0)
                  }
                  if (event.key === 'End') {
                    event.preventDefault()
                    moveDocumentSelection(filteredDocs.length - 1)
                  }
                }}
                key={doc.id}
              >
                <FileText className="size-4" aria-hidden />
                <span>
                  <strong>{doc.title}</strong>
                  <em>
                    {categoryLabels[doc.categoryId]}
                    {doc.vendorName ? ` · ${doc.vendorName}` : ''}
                  </em>
                </span>
                {typeof doc.pppPercent === 'number' ? (
                  <b>{formatPpp(doc.pppPercent)}</b>
                ) : null}
              </Link>
            )
          })}
        </div>
      </aside>

      <main className="intel-main">
        <header className="intel-top">
          <div>
            <p className="intel-kicker">Schedio Intelligence</p>
            <h1>Teach the system once. Reuse the judgment everywhere.</h1>
          </div>
          <div className="intel-metrics" aria-label="Pipeline metrics">
            <span>
              <b>{workspace.documents.length}</b> docs
            </span>
            <span>
              <b>{workspace.segments.length}</b> segments
            </span>
            <span>
              <b>{workspace.learnings.length}</b> learnings
            </span>
            <span>
              <b>{workspace.recommendations.length}</b> applies
            </span>
          </div>
        </header>

        <section className="intel-stage-strip" aria-label="Pipeline stages">
          <span>
            <Archive className="size-4" aria-hidden /> Egnyte
          </span>
          <span>
            <Sparkles className="size-4" aria-hidden /> DocuPipe
          </span>
          <span>
            <Layers3 className="size-4" aria-hidden /> Categories
          </span>
          <span>
            <GraduationCap className="size-4" aria-hidden /> Learnings
          </span>
          <span>
            <Brain className="size-4" aria-hidden /> Apply
          </span>
        </section>

        {workspace.documents.length === 0 ? (
          <section className="intel-empty">
            <FolderInput className="size-9" aria-hidden />
            <strong>No package imported yet.</strong>
            <button
              type="button"
              className="intel-button primary"
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending}
            >
              <FolderInput className="size-4" aria-hidden />
              {importMutation.isPending ? 'Importing' : 'Import from Egnyte'}
            </button>
          </section>
        ) : (
          <section className="intel-workbench">
            <div className="intel-document-pane">
              {selectedDoc ? (
                <>
                  <div className="intel-pane-head">
                    <div>
                      <span className="intel-pill">
                        {categoryLabels[selectedDoc.categoryId]}
                      </span>
                      {selectedDoc.filingLabel ? (
                        <span className="intel-pill warm">
                          {selectedDoc.filingLabel}
                        </span>
                      ) : null}
                    </div>
                    <strong>{selectedDoc.title}</strong>
                    <p>{selectedDoc.fileName}</p>
                  </div>

                  <div className="intel-segment-tabs">
                    {docSegments.map((segment) => (
                      <Link
                        to="/intelligence"
                        search={documentSearch({
                          documentId: selectedDoc.id,
                          segmentId: segment.id,
                          category,
                          q,
                        })}
                        className={
                          segment.id === selectedSegment?.id
                            ? 'active unstyled-link'
                            : 'unstyled-link'
                        }
                        key={segment.id}
                      >
                        {segment.segmentType.replace(/_/g, ' ')}
                      </Link>
                    ))}
                  </div>

                  {selectedDoc.mimeType === 'application/pdf' ? (
                    isServerRender ? (
                      <PdfViewerFallback />
                    ) : (
                      <Suspense fallback={<PdfViewerFallback />}>
                        <PdfFindingViewer
                          doc={selectedDoc}
                          fileUrl={documentUrl(selectedDoc)}
                          findings={selectedDocFindings}
                          draftFinding={activeDraft}
                          selectedFindingId={selectedFindingId ?? undefined}
                          selectedSegmentId={selectedSegment?.id}
                          onDraftFinding={(finding) => {
                            setDraftFinding(finding)
                            if (finding) {
                              setSelectedFindingId(null)
                              setEditingFindingId(null)
                            }
                          }}
                          onSelectFinding={(findingId) =>
                            selectFinding(findingId, 'card')
                          }
                        />
                      </Suspense>
                    )
                  ) : (
                    <div className="intel-file-preview">
                      <FileText className="size-9" aria-hidden />
                      <strong>{selectedDoc.fileName}</strong>
                      <a
                        className="intel-button unstyled-link"
                        href={documentUrl(selectedDoc)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open workbook
                      </a>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            <aside className="intel-teach-pane">
              {selectedSegment ? (
                <>
                  <section className="intel-card">
                    <div className="intel-card-head">
                      <div>
                        <p>Selected segment</p>
                        <h2>{selectedSegment.title}</h2>
                      </div>
                      <span>
                        {selectedSegment.segmentType.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="intel-summary">{selectedSegment.summary}</p>
                    <div className="intel-facts">
                      {factEntries(selectedSegment).map(([key, value]) => (
                        <div key={key}>
                          <span>{key}</span>
                          <strong>{value}</strong>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="intel-card">
                    <div className="intel-card-head">
                      <div>
                        <p>Document relationships</p>
                        <h2>Tree and graph map</h2>
                      </div>
                      <span>{relationshipPreview.documentMatchCount}</span>
                    </div>
                    <div className="intel-relationship-list">
                      {relationshipPreview.rows.length > 0 ? (
                        relationshipPreview.rows.map((row) => (
                          <article
                            key={`${row.kind}-${row.documentId}-${row.title}`}
                          >
                            <Network className="size-4" aria-hidden />
                            <div>
                              <strong>{row.label}</strong>
                              <span>{row.title}</span>
                            </div>
                            <p>{row.detail}</p>
                          </article>
                        ))
                      ) : (
                        <div className="intel-muted">
                          Import metadata has not found adjacent documents for
                          this file yet.
                        </div>
                      )}
                    </div>
                    <Link
                      to="/intelligence/relationships"
                      search={{
                        document: selectedDoc?.id,
                        mode: 'tree',
                      }}
                      className="intel-button unstyled-link"
                    >
                      <Network className="size-4" aria-hidden />
                      Open relationship map
                    </Link>
                  </section>

                  <section className="intel-card">
                    <div className="intel-card-head">
                      <div>
                        <p>Document markup</p>
                        <h2>Findings</h2>
                      </div>
                      <span>{selectedSegmentFindings.length}</span>
                    </div>

                    {activeDraft || activeEvidenceFinding ? (
                      <div className={evidenceSourceClass}>
                        <Highlighter className="size-4" aria-hidden />
                        <div>
                          <span>Evidence source</span>
                          <strong>{evidenceSourceLabel}</strong>
                        </div>
                        <p>{evidenceSourceBody}</p>
                      </div>
                    ) : null}

                    {activeDraft ? (
                      <form
                        className="intel-form intel-finding-form"
                        onSubmit={saveFinding}
                        key={`${activeDraft.documentId}-${activeDraft.pageNumber}-${activeDraft.normalizedRects
                          .map((rect) => `${rect.x}-${rect.y}`)
                          .join('-')}`}
                      >
                        <div className="intel-finding-capture">
                          <Highlighter className="size-4" aria-hidden />
                          <span>
                            Page {activeDraft.pageNumber} ·{' '}
                            {activeDraft.anchorType === 'point'
                              ? 'point'
                              : 'section'}
                          </span>
                          <button
                            type="button"
                            className="intel-icon-button"
                            aria-label="Clear draft finding"
                            onClick={() => setDraftFinding(null)}
                          >
                            <X className="size-4" aria-hidden />
                          </button>
                        </div>

                        {findingMutation.isError ? (
                          <div className="intel-error">
                            {findingMutation.error instanceof Error
                              ? findingMutation.error.message
                              : 'Finding save failed'}
                          </div>
                        ) : null}

                        <label>
                          <span>Finding label</span>
                          <input
                            name="label"
                            defaultValue={selectedSegment.title}
                            required
                          />
                        </label>

                        <div className="intel-form-grid">
                          <label>
                            <span>Type</span>
                            <select name="findingType" defaultValue="ppp">
                              {Object.entries(findingTypeLabels).map(
                                ([value, label]) => (
                                  <option value={value} key={value}>
                                    {label}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                          <label>
                            <span>Confidence</span>
                            <select name="confidence" defaultValue="medium">
                              {Object.entries(confidenceLabels).map(
                                ([value, label]) => (
                                  <option value={value} key={value}>
                                    {label}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                        </div>

                        <label>
                          <span>Reason tags</span>
                          <input
                            name="reasonTags"
                            placeholder="scope, plat, cost basis"
                          />
                        </label>

                        <label>
                          <span>Rationale</span>
                          <textarea
                            name="rationale"
                            rows={4}
                            placeholder="What should Tim teach the system from this section?"
                            required
                          />
                        </label>

                        <button
                          type="submit"
                          className="intel-button primary"
                          disabled={findingMutation.isPending}
                        >
                          <Save className="size-4" aria-hidden />
                          {findingMutation.isPending
                            ? 'Saving'
                            : 'Save finding for learning'}
                        </button>
                      </form>
                    ) : (
                      <div className="intel-finding-empty">
                        <MousePointer2 className="size-4" aria-hidden />
                        <span>
                          Drag the PDF to capture evidence. Click a saved mark
                          to reuse it.
                        </span>
                      </div>
                    )}

                    {findingMutation.isSuccess ? (
                      <div className="intel-success">
                        <CheckCircle2 className="size-4" aria-hidden />
                        Finding saved.
                      </div>
                    ) : null}
                    {findingUpdateMutation.isSuccess ? (
                      <div className="intel-success">
                        <CheckCircle2 className="size-4" aria-hidden />
                        Finding updated.
                      </div>
                    ) : null}
                    {findingDeleteMutation.isSuccess ? (
                      <div className="intel-success">
                        <CheckCircle2 className="size-4" aria-hidden />
                        Finding deleted.
                      </div>
                    ) : null}
                    {findingUpdateMutation.isError ||
                    findingDeleteMutation.isError ? (
                      <div className="intel-error">
                        {findingUpdateMutation.error instanceof Error
                          ? findingUpdateMutation.error.message
                          : findingDeleteMutation.error instanceof Error
                            ? findingDeleteMutation.error.message
                            : 'Finding change failed'}
                      </div>
                    ) : null}

                    <div className="intel-finding-list">
                      {selectedSegmentFindings.length > 0 ? (
                        selectedSegmentFindings.map((finding) => {
                          const selected =
                            finding.id === activeEvidenceFinding?.id
                          return (
                            <article
                              className={selected ? 'selected' : undefined}
                              data-finding-card-id={finding.id}
                              key={finding.id}
                            >
                              {editingFindingId === finding.id ? (
                                <form
                                  className="intel-form intel-finding-form"
                                  onSubmit={saveFindingEdit}
                                >
                                  <input
                                    type="hidden"
                                    name="findingId"
                                    value={finding.id}
                                  />
                                  <div className="intel-finding-capture">
                                    <Highlighter
                                      className="size-4"
                                      aria-hidden
                                    />
                                    <span>Page {finding.pageNumber}</span>
                                    <button
                                      type="button"
                                      className="intel-icon-button"
                                      aria-label="Cancel edit"
                                      onClick={() => setEditingFindingId(null)}
                                    >
                                      <X className="size-4" aria-hidden />
                                    </button>
                                  </div>

                                  <label>
                                    <span>Finding label</span>
                                    <input
                                      name="label"
                                      defaultValue={finding.label}
                                      required
                                    />
                                  </label>

                                  <div className="intel-form-grid">
                                    <label>
                                      <span>Type</span>
                                      <select
                                        name="findingType"
                                        defaultValue={finding.findingType}
                                      >
                                        {Object.entries(findingTypeLabels).map(
                                          ([value, label]) => (
                                            <option value={value} key={value}>
                                              {label}
                                            </option>
                                          ),
                                        )}
                                      </select>
                                    </label>
                                    <label>
                                      <span>Status</span>
                                      <select
                                        name="status"
                                        defaultValue={finding.status}
                                      >
                                        {Object.entries(
                                          findingStatusLabels,
                                        ).map(([value, label]) => (
                                          <option value={value} key={value}>
                                            {label}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                  </div>

                                  <div className="intel-form-grid">
                                    <label>
                                      <span>Confidence</span>
                                      <select
                                        name="confidence"
                                        defaultValue={finding.confidence}
                                      >
                                        {Object.entries(confidenceLabels).map(
                                          ([value, label]) => (
                                            <option value={value} key={value}>
                                              {label}
                                            </option>
                                          ),
                                        )}
                                      </select>
                                    </label>
                                    <label>
                                      <span>Reason tags</span>
                                      <input
                                        name="reasonTags"
                                        defaultValue={finding.reasonTags.join(
                                          ', ',
                                        )}
                                      />
                                    </label>
                                  </div>

                                  <label>
                                    <span>Rationale</span>
                                    <textarea
                                      name="rationale"
                                      rows={4}
                                      defaultValue={finding.rationale}
                                      required
                                    />
                                  </label>

                                  <div className="intel-finding-edit-actions">
                                    <button
                                      type="submit"
                                      className="intel-button primary"
                                      disabled={findingUpdateMutation.isPending}
                                    >
                                      <Save className="size-4" aria-hidden />
                                      {findingUpdateMutation.isPending
                                        ? 'Saving'
                                        : 'Save edits'}
                                    </button>
                                    <button
                                      type="button"
                                      className="intel-button"
                                      onClick={() => setEditingFindingId(null)}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <>
                                  <div className="intel-finding-row-head">
                                    <div>
                                      <strong>{finding.label}</strong>
                                      <span>
                                        Page {finding.pageNumber} ·{' '}
                                        {findingTypeLabels[finding.findingType]}{' '}
                                        · {findingStatusLabels[finding.status]}{' '}
                                        · {confidenceLabels[finding.confidence]}
                                      </span>
                                    </div>
                                    <div className="intel-finding-actions">
                                      <button
                                        type="button"
                                        className="intel-icon-button"
                                        aria-label={`Show ${finding.label} on document`}
                                        title="Show on document"
                                        onClick={() =>
                                          selectFinding(finding.id, 'mark')
                                        }
                                      >
                                        <MousePointer2
                                          className="size-4"
                                          aria-hidden
                                        />
                                      </button>
                                      <button
                                        type="button"
                                        className="intel-icon-button"
                                        aria-label={`Edit ${finding.label}`}
                                        title="Edit finding"
                                        onClick={() => {
                                          setSelectedFindingId(finding.id)
                                          setEditingFindingId(finding.id)
                                        }}
                                      >
                                        <Pencil
                                          className="size-4"
                                          aria-hidden
                                        />
                                      </button>
                                      <button
                                        type="button"
                                        className="intel-icon-button danger"
                                        aria-label={`Delete ${finding.label}`}
                                        title="Delete finding"
                                        disabled={
                                          findingDeleteMutation.isPending
                                        }
                                        onClick={() => {
                                          if (
                                            window.confirm(
                                              'Delete this finding?',
                                            )
                                          ) {
                                            findingDeleteMutation.mutate({
                                              findingId: finding.id,
                                            })
                                          }
                                        }}
                                      >
                                        <Trash2
                                          className="size-4"
                                          aria-hidden
                                        />
                                      </button>
                                    </div>
                                  </div>
                                  <p>{finding.rationale}</p>
                                </>
                              )}
                            </article>
                          )
                        })
                      ) : (
                        <div className="intel-muted">
                          Findings become reusable evidence before they become
                          saved learnings.
                        </div>
                      )}
                    </div>
                  </section>

                  <form
                    className="intel-card intel-form"
                    onSubmit={saveLearning}
                    key={`${selectedSegment.id}-${activeEvidenceFinding?.id ?? 'none'}`}
                  >
                    <div className="intel-card-head">
                      <div>
                        <p>Teach Intelligence</p>
                        <h2>Save learning</h2>
                      </div>
                      <button
                        type="submit"
                        className="intel-button primary"
                        disabled={
                          learningMutation.isPending || Boolean(activeDraft)
                        }
                      >
                        <Save className="size-4" aria-hidden />
                        {activeDraft
                          ? 'Save finding first'
                          : learningMutation.isPending
                            ? 'Saving'
                            : 'Save'}
                      </button>
                    </div>

                    {learningMutation.isSuccess ? (
                      <div className="intel-success">
                        <CheckCircle2 className="size-4" aria-hidden />
                        Learning saved.
                      </div>
                    ) : null}
                    {learningMutation.isError ? (
                      <div className="intel-error">
                        {learningMutation.error instanceof Error
                          ? learningMutation.error.message
                          : 'Save failed'}
                      </div>
                    ) : null}

                    <div className={evidenceSourceClass}>
                      <Highlighter className="size-4" aria-hidden />
                      <div>
                        <span>Evidence source</span>
                        <strong>{evidenceSourceLabel}</strong>
                      </div>
                      <p>{evidenceSourceBody}</p>
                    </div>

                    <label>
                      <span>Learning label</span>
                      <input
                        name="label"
                        defaultValue={
                          activeEvidenceFinding?.label ?? selectedSegment.title
                        }
                        required
                      />
                    </label>

                    {selectedDocFindings.length > 0 ? (
                      <label>
                        <span>Evidence finding</span>
                        <select
                          name="findingId"
                          defaultValue={activeEvidenceFinding?.id ?? ''}
                        >
                          <option value="">Segment summary only</option>
                          {selectedDocFindings.map((finding) => (
                            <option value={finding.id} key={finding.id}>
                              Page {finding.pageNumber} · {finding.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}

                    <div className="intel-form-grid">
                      <label>
                        <span>Determination</span>
                        <select
                          name="determination"
                          defaultValue={findingDetermination(
                            activeEvidenceFinding,
                          )}
                        >
                          {Object.entries(determinationLabels).map(
                            ([value, label]) => (
                              <option value={value} key={value}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                      <label>
                        <span>PPP %</span>
                        <input
                          name="pppValue"
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          defaultValue={selectedDoc?.pppPercent ?? ''}
                        />
                      </label>
                    </div>

                    <div className="intel-form-grid">
                      <label>
                        <span>Scope</span>
                        <select name="applicability" defaultValue="project">
                          {Object.entries(applicabilityLabels).map(
                            ([value, label]) => (
                              <option value={value} key={value}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                      <label>
                        <span>Confidence</span>
                        <select name="confidence" defaultValue="medium">
                          {Object.entries(confidenceLabels).map(
                            ([value, label]) => (
                              <option value={value} key={value}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    </div>

                    <label>
                      <span>Reason tags</span>
                      <input
                        name="reasonTags"
                        placeholder="scope, filing, public improvement"
                        defaultValue={
                          activeEvidenceFinding?.reasonTags.join(', ') ?? ''
                        }
                      />
                    </label>

                    <label>
                      <span>Rationale</span>
                      <textarea
                        name="rationale"
                        rows={5}
                        placeholder="Why this should be reused when similar documents appear."
                        defaultValue={activeEvidenceFinding?.rationale ?? ''}
                        required
                      />
                    </label>
                  </form>

                  <section className="intel-card">
                    <div className="intel-card-head">
                      <div>
                        <p>Apply</p>
                        <h2>Suggested uses</h2>
                      </div>
                      <span>{selectedRecommendations.length}</span>
                    </div>
                    <div className="intel-match-list">
                      {selectedRecommendations.length > 0 ? (
                        selectedRecommendations.map((row) => (
                          <article key={row.id}>
                            <b>{determinationLabels[row.recommendation]}</b>
                            <span>{formatScore(row.score)}</span>
                            <p>{row.rationale}</p>
                          </article>
                        ))
                      ) : (
                        <div className="intel-muted">
                          Save a learning on a related segment to create reuse
                          suggestions.
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="intel-card">
                    <div className="intel-card-head">
                      <div>
                        <p>Memory</p>
                        <h2>Related learnings</h2>
                      </div>
                      <span>{relatedLearnings.length}</span>
                    </div>
                    <div className="intel-learning-list">
                      {relatedLearnings.length > 0 ? (
                        relatedLearnings.map((learning) => (
                          <article key={learning.id}>
                            <div>
                              <strong>{learning.label}</strong>
                              <span>
                                {determinationLabels[learning.determination]} ·{' '}
                                {applicabilityLabels[learning.applicability]}
                              </span>
                            </div>
                            <p>{learning.rationale}</p>
                          </article>
                        ))
                      ) : (
                        <div className="intel-muted">
                          No related learnings saved yet.
                        </div>
                      )}
                    </div>
                  </section>
                </>
              ) : null}
            </aside>
          </section>
        )}
      </main>
    </div>
  )
}
