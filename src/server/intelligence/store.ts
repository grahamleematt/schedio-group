import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import type { PoolClient } from 'pg'

import { dbQuery, dbTransaction } from '#/server/database'
import { isDatabaseConfigured, isVercel } from '#/server/env'
import { INTELLIGENCE_CATEGORIES } from './catalog'
import { deriveDocumentRelationships } from './relationships'
import type {
  IntelligenceClient,
  IntelligenceDocumentRelationship,
  IntelligenceDocument,
  IntelligenceFinding,
  IntelligenceFindingUpdate,
  IntelligenceImport,
  IntelligenceLearning,
  IntelligencePackage,
  IntelligenceRecommendation,
  IntelligenceSegment,
  IntelligenceWorkspace,
  JsonRecord,
} from './types'

const DATA_DIR = isVercel()
  ? path.join(os.tmpdir(), 'schedio-intelligence')
  : path.resolve(process.cwd(), '.data')
const DATA_FILE = path.join(DATA_DIR, 'intelligence.json')

const SCHEDIO_CLIENTS: ReadonlyArray<IntelligenceClient> = [
  {
    id: 'dawson-trails-md1',
    organizationId: 'schedio',
    code: 'DT1',
    name: 'Dawson Trails MD One - District',
    workflowKind: 'district_direct_pay',
    egnyteRootPath: '/Shared/Clients/Dawson Trails MD One/District',
    createdAt: '2026-05-20T00:00:00.000Z',
  },
  {
    id: 'dawson-trails-md1-developer',
    organizationId: 'schedio',
    code: 'DTD',
    name: 'Dawson Trails MD One - Developer',
    workflowKind: 'developer_reimbursement',
    egnyteRootPath: '/Shared/Clients/Dawson Trails MD One/Developer',
    createdAt: '2026-05-20T00:00:00.000Z',
  },
]

type IntelligenceStoreState = {
  imports: Array<IntelligenceImport>
  documents: Array<IntelligenceDocument>
  segments: Array<IntelligenceSegment>
  findings: Array<IntelligenceFinding>
  learnings: Array<IntelligenceLearning>
  relationships: Array<IntelligenceDocumentRelationship>
  revision: number
}

type IntelligenceStore = {
  mode: 'postgres' | 'local'
  upsertPackage: (pkg: IntelligencePackage) => Promise<void>
  appendFinding: (finding: IntelligenceFinding) => Promise<IntelligenceFinding>
  updateFinding: (
    id: string,
    update: IntelligenceFindingUpdate,
  ) => Promise<IntelligenceFinding | null>
  deleteFinding: (id: string) => Promise<boolean>
  appendLearning: (
    learning: IntelligenceLearning,
  ) => Promise<IntelligenceLearning>
  getWorkspace: () => Promise<IntelligenceWorkspace>
}

function emptyState(): IntelligenceStoreState {
  return {
    imports: [],
    documents: [],
    segments: [],
    findings: [],
    learnings: [],
    relationships: [],
    revision: 0,
  }
}

function sortImports(
  rows: ReadonlyArray<IntelligenceImport>,
): Array<IntelligenceImport> {
  return rows.slice().sort((a, b) => b.importedAt.localeCompare(a.importedAt))
}

function sortDocuments(
  rows: ReadonlyArray<IntelligenceDocument>,
): Array<IntelligenceDocument> {
  return rows.slice().sort((a, b) => {
    const catA =
      INTELLIGENCE_CATEGORIES.find((row) => row.id === a.categoryId)
        ?.sortOrder ?? 999
    const catB =
      INTELLIGENCE_CATEGORIES.find((row) => row.id === b.categoryId)
        ?.sortOrder ?? 999
    return catA - catB || a.title.localeCompare(b.title)
  })
}

function sortSegments(
  rows: ReadonlyArray<IntelligenceSegment>,
): Array<IntelligenceSegment> {
  return rows
    .slice()
    .sort(
      (a, b) =>
        a.documentId.localeCompare(b.documentId) ||
        a.segmentType.localeCompare(b.segmentType) ||
        a.title.localeCompare(b.title),
    )
}

function sortLearnings(
  rows: ReadonlyArray<IntelligenceLearning>,
): Array<IntelligenceLearning> {
  return rows.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function sortFindings(
  rows: ReadonlyArray<IntelligenceFinding>,
): Array<IntelligenceFinding> {
  return rows
    .slice()
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) ||
        a.documentId.localeCompare(b.documentId) ||
        a.pageNumber - b.pageNumber,
    )
}

function sortRelationships(
  rows: ReadonlyArray<IntelligenceDocumentRelationship>,
): Array<IntelligenceDocumentRelationship> {
  return rows
    .slice()
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}

function asDateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  return typeof value === 'string' ? value : new Date().toISOString()
}

function asNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? (value as JsonRecord) : {}
}

function buildRecommendations(input: {
  documents: ReadonlyArray<IntelligenceDocument>
  segments: ReadonlyArray<IntelligenceSegment>
  learnings: ReadonlyArray<IntelligenceLearning>
}): Array<IntelligenceRecommendation> {
  const docsById = new Map(input.documents.map((doc) => [doc.id, doc]))
  const recommendations: Array<IntelligenceRecommendation> = []

  for (const learning of input.learnings) {
    const sourceDoc = learning.documentId
      ? docsById.get(learning.documentId)
      : undefined
    for (const segment of input.segments) {
      if (segment.id === learning.segmentId) continue
      if (segment.categoryId !== learning.categoryId) continue
      const targetDoc = docsById.get(segment.documentId)
      let score = 0.5
      if (learning.projectId && targetDoc?.projectId === learning.projectId) {
        score += 0.18
      }
      if (
        learning.districtId &&
        targetDoc?.districtId === learning.districtId
      ) {
        score += 0.14
      }
      if (learning.clientId && targetDoc?.clientId === learning.clientId) {
        score += 0.1
      }
      if (
        sourceDoc?.vendorName &&
        targetDoc?.vendorName &&
        sourceDoc.vendorName === targetDoc.vendorName
      ) {
        score += 0.08
      }
      if (
        sourceDoc?.filingLabel &&
        targetDoc?.filingLabel &&
        sourceDoc.filingLabel === targetDoc.filingLabel
      ) {
        score += 0.08
      }
      recommendations.push({
        id: `rec-${learning.id}-${segment.id}`,
        targetSegmentId: segment.id,
        learningId: learning.id,
        recommendation: learning.determination,
        score: Math.min(score, 0.98),
        rationale: `Similar ${segment.categoryId} segment matched learning "${learning.label}".`,
        status: 'suggested',
        createdAt: new Date().toISOString(),
      })
    }
  }

  return recommendations.sort((a, b) => b.score - a.score).slice(0, 30)
}

class IntelligenceJsonStore implements IntelligenceStore {
  readonly mode = 'local'
  private state: IntelligenceStoreState = emptyState()
  private loaded = false
  private writeLock: Promise<void> = Promise.resolve()

  private async init(): Promise<void> {
    if (this.loaded) return
    await fs.mkdir(DATA_DIR, { recursive: true })
    try {
      const raw = await fs.readFile(DATA_FILE, 'utf8')
      const parsed = JSON.parse(raw) as Partial<IntelligenceStoreState>
      this.state = {
        imports: Array.isArray(parsed.imports) ? parsed.imports : [],
        documents: Array.isArray(parsed.documents) ? parsed.documents : [],
        segments: Array.isArray(parsed.segments) ? parsed.segments : [],
        findings: Array.isArray(parsed.findings) ? parsed.findings : [],
        learnings: Array.isArray(parsed.learnings) ? parsed.learnings : [],
        relationships: Array.isArray(parsed.relationships)
          ? parsed.relationships
          : [],
        revision: parsed.revision ?? 0,
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
      this.state = emptyState()
    }
    this.loaded = true
  }

  private async flush(): Promise<void> {
    this.state.revision += 1
    this.writeLock = this.writeLock.then(async () => {
      await fs.mkdir(DATA_DIR, { recursive: true })
      await fs.writeFile(DATA_FILE, JSON.stringify(this.state, null, 2), 'utf8')
    })
    await this.writeLock
  }

  async upsertPackage(pkg: IntelligencePackage): Promise<void> {
    await this.init()
    this.state.imports = [
      pkg.importRow,
      ...this.state.imports.filter((row) => row.id !== pkg.importRow.id),
    ]
    const documentIds = new Set(pkg.documents.map((row) => row.id))
    this.state.documents = [
      ...this.state.documents.filter((row) => !documentIds.has(row.id)),
      ...pkg.documents,
    ]
    const segmentIds = new Set(pkg.segments.map((row) => row.id))
    this.state.segments = [
      ...this.state.segments.filter((row) => !segmentIds.has(row.id)),
      ...pkg.segments,
    ]
    const relationships = deriveDocumentRelationships({
      documents: this.state.documents,
      createdBy: pkg.importRow.importedBy,
      createdAt: pkg.importRow.importedAt,
    })
    const relationshipIds = new Set(relationships.map((row) => row.id))
    this.state.relationships = [
      ...this.state.relationships.filter((row) => !relationshipIds.has(row.id)),
      ...relationships,
    ]
    await this.flush()
  }

  async appendLearning(
    learning: IntelligenceLearning,
  ): Promise<IntelligenceLearning> {
    await this.init()
    if (!this.state.learnings.some((row) => row.id === learning.id)) {
      this.state.learnings.push(learning)
      await this.flush()
    }
    return learning
  }

  async appendFinding(
    finding: IntelligenceFinding,
  ): Promise<IntelligenceFinding> {
    await this.init()
    if (!this.state.findings.some((row) => row.id === finding.id)) {
      this.state.findings.push(finding)
      await this.flush()
    }
    return finding
  }

  async updateFinding(
    id: string,
    update: IntelligenceFindingUpdate,
  ): Promise<IntelligenceFinding | null> {
    await this.init()
    const index = this.state.findings.findIndex((row) => row.id === id)
    if (index === -1) return null
    const existing = this.state.findings[index]
    const next = { ...existing, ...update }
    this.state.findings[index] = next
    await this.flush()
    return next
  }

  async deleteFinding(id: string): Promise<boolean> {
    await this.init()
    const before = this.state.findings.length
    this.state.findings = this.state.findings.filter((row) => row.id !== id)
    if (this.state.findings.length === before) return false
    await this.flush()
    return true
  }

  async getWorkspace(): Promise<IntelligenceWorkspace> {
    await this.init()
    const imports = sortImports(this.state.imports)
    const documents = sortDocuments(this.state.documents)
    const segments = sortSegments(this.state.segments)
    const findings = sortFindings(this.state.findings)
    const learnings = sortLearnings(this.state.learnings)
    const relationships = sortRelationships(this.state.relationships)
    return {
      mode: this.mode,
      isDatabaseConfigured: isDatabaseConfigured(),
      clients: SCHEDIO_CLIENTS,
      categories: INTELLIGENCE_CATEGORIES,
      imports,
      documents,
      segments,
      findings,
      learnings,
      relationships,
      recommendations: buildRecommendations({
        documents,
        segments,
        learnings,
      }),
      sourceWarnings: [],
    }
  }
}

type ImportRow = {
  id: string
  organization_id: string
  client_id: string
  district_id?: string
  project_id?: string
  source_kind: IntelligenceImport['sourceKind']
  source_label: string
  source_uri: string
  status: IntelligenceImport['status']
  document_count: number
  segment_count: number
  imported_by: string
  imported_at: Date | string
}

type ClientRow = {
  id: string
  organization_id: string
  code: string
  name: string
  workflow_kind?: IntelligenceClient['workflowKind']
  egnyte_root_path?: string
  docupipe_workflow_id?: string
  created_at: Date | string
}

type DocumentRow = {
  id: string
  organization_id: string
  client_id: string
  district_id?: string
  project_id?: string
  import_id?: string
  category_id: IntelligenceDocument['categoryId']
  source_document_id?: string
  canonical_file_uri: string
  file_name: string
  mime_type: string
  title: string
  vendor_name?: string
  filing_label?: string
  ppp_percent?: string | number | null
  metadata: unknown
  created_at: Date | string
  updated_at: Date | string
}

type SegmentRow = {
  id: string
  organization_id: string
  document_id: string
  category_id: IntelligenceSegment['categoryId']
  segment_type: IntelligenceSegment['segmentType']
  title: string
  summary: string
  page_start?: number
  page_end?: number
  extracted_facts: unknown
  created_at: Date | string
}

type LearningRow = {
  id: string
  organization_id: string
  client_id?: string
  district_id?: string
  project_id?: string
  document_id?: string
  segment_id?: string
  category_id: IntelligenceLearning['categoryId']
  label: string
  determination: IntelligenceLearning['determination']
  ppp_value?: string | number | null
  applicability: IntelligenceLearning['applicability']
  confidence: IntelligenceLearning['confidence']
  rationale: string
  reason_tags: Array<string>
  evidence: unknown
  created_by: string
  created_at: Date | string
  supersedes_id?: string
}

type FindingRow = {
  id: string
  organization_id: string
  client_id?: string
  district_id?: string
  project_id?: string
  document_id: string
  segment_id?: string
  category_id: IntelligenceFinding['categoryId']
  page_number: number
  anchor_type: IntelligenceFinding['anchorType']
  normalized_rects: unknown
  selected_text?: string
  finding_type: IntelligenceFinding['findingType']
  status: IntelligenceFinding['status']
  confidence: IntelligenceFinding['confidence']
  label: string
  rationale: string
  reason_tags: Array<string>
  created_by: string
  created_at: Date | string
  linked_learning_id?: string
}

type RelationshipRow = {
  id: string
  organization_id: string
  source_document_id: string
  target_document_id: string
  relationship_type: IntelligenceDocumentRelationship['relationshipType']
  score: string | number
  reason: string
  evidence: unknown
  status: IntelligenceDocumentRelationship['status']
  created_by: string
  created_at: Date | string
  reviewed_by?: string
  reviewed_at?: Date | string
}

function clientFromRow(row: ClientRow): IntelligenceClient {
  return {
    id: row.id,
    organizationId: row.organization_id,
    code: row.code,
    name: row.name,
    workflowKind: row.workflow_kind ?? 'district_direct_pay',
    egnyteRootPath: row.egnyte_root_path,
    docupipeWorkflowId: row.docupipe_workflow_id,
    createdAt: asDateString(row.created_at),
  }
}

function importFromRow(row: ImportRow): IntelligenceImport {
  return {
    id: row.id,
    organizationId: row.organization_id,
    clientId: row.client_id,
    districtId: row.district_id,
    projectId: row.project_id,
    sourceKind: row.source_kind,
    sourceLabel: row.source_label,
    sourceUri: row.source_uri,
    status: row.status,
    documentCount: row.document_count,
    segmentCount: row.segment_count,
    importedBy: row.imported_by,
    importedAt: asDateString(row.imported_at),
  }
}

function documentFromRow(row: DocumentRow): IntelligenceDocument {
  return {
    id: row.id,
    organizationId: row.organization_id,
    clientId: row.client_id,
    districtId: row.district_id,
    projectId: row.project_id,
    importId: row.import_id,
    categoryId: row.category_id,
    sourceDocumentId: row.source_document_id,
    canonicalFileUri: row.canonical_file_uri,
    fileName: row.file_name,
    mimeType: row.mime_type,
    title: row.title,
    vendorName: row.vendor_name,
    filingLabel: row.filing_label,
    pppPercent: asNumber(row.ppp_percent),
    metadata: asRecord(row.metadata),
    createdAt: asDateString(row.created_at),
    updatedAt: asDateString(row.updated_at),
  }
}

function segmentFromRow(row: SegmentRow): IntelligenceSegment {
  return {
    id: row.id,
    organizationId: row.organization_id,
    documentId: row.document_id,
    categoryId: row.category_id,
    segmentType: row.segment_type,
    title: row.title,
    summary: row.summary,
    pageStart: row.page_start,
    pageEnd: row.page_end,
    extractedFacts: asRecord(row.extracted_facts),
    createdAt: asDateString(row.created_at),
  }
}

function learningFromRow(row: LearningRow): IntelligenceLearning {
  return {
    id: row.id,
    organizationId: row.organization_id,
    clientId: row.client_id,
    districtId: row.district_id,
    projectId: row.project_id,
    documentId: row.document_id,
    segmentId: row.segment_id,
    categoryId: row.category_id,
    label: row.label,
    determination: row.determination,
    pppValue: asNumber(row.ppp_value),
    applicability: row.applicability,
    confidence: row.confidence,
    rationale: row.rationale,
    reasonTags: row.reason_tags,
    evidence: asRecord(row.evidence),
    createdBy: row.created_by,
    createdAt: asDateString(row.created_at),
    supersedesId: row.supersedes_id,
  }
}

function findingRectsFromValue(
  value: unknown,
): IntelligenceFinding['normalizedRects'] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const rect = asRecord(item)
      return {
        x: Number(rect.x),
        y: Number(rect.y),
        width: Number(rect.width),
        height: Number(rect.height),
      }
    })
    .filter(
      (rect) =>
        Number.isFinite(rect.x) &&
        Number.isFinite(rect.y) &&
        Number.isFinite(rect.width) &&
        Number.isFinite(rect.height),
    )
}

function findingFromRow(row: FindingRow): IntelligenceFinding {
  return {
    id: row.id,
    organizationId: row.organization_id,
    clientId: row.client_id,
    districtId: row.district_id,
    projectId: row.project_id,
    documentId: row.document_id,
    segmentId: row.segment_id,
    categoryId: row.category_id,
    pageNumber: row.page_number,
    anchorType: row.anchor_type,
    normalizedRects: findingRectsFromValue(row.normalized_rects),
    selectedText: row.selected_text,
    findingType: row.finding_type,
    status: row.status,
    confidence: row.confidence,
    label: row.label,
    rationale: row.rationale,
    reasonTags: row.reason_tags,
    createdBy: row.created_by,
    createdAt: asDateString(row.created_at),
    linkedLearningId: row.linked_learning_id,
  }
}

function relationshipFromRow(
  row: RelationshipRow,
): IntelligenceDocumentRelationship {
  return {
    id: row.id,
    organizationId: row.organization_id,
    sourceDocumentId: row.source_document_id,
    targetDocumentId: row.target_document_id,
    relationshipType: row.relationship_type,
    score: Number(row.score),
    reason: row.reason,
    evidence: asRecord(row.evidence),
    status: row.status,
    createdBy: row.created_by,
    createdAt: asDateString(row.created_at),
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at ? asDateString(row.reviewed_at) : undefined,
  }
}

async function ensureScopeRows(client: PoolClient): Promise<void> {
  await client.query(
    `
      insert into intelligence_organizations (id, name)
      values ('schedio', 'Schedio')
      on conflict (id) do update set name = excluded.name
    `,
  )
  await client.query(
    `
      insert into intelligence_clients (
        id, organization_id, code, name, workflow_kind, egnyte_root_path
      )
      values
        (
          'dawson-trails-md1',
          'schedio',
          'DT1',
          'Dawson Trails MD One - District',
          'district_direct_pay',
          '/Shared/Clients/Dawson Trails MD One/District'
        ),
        (
          'dawson-trails-md1-developer',
          'schedio',
          'DTD',
          'Dawson Trails MD One - Developer',
          'developer_reimbursement',
          '/Shared/Clients/Dawson Trails MD One/Developer'
        )
      on conflict (id) do update set
        organization_id = excluded.organization_id,
        code = excluded.code,
        name = excluded.name,
        workflow_kind = excluded.workflow_kind,
        egnyte_root_path = excluded.egnyte_root_path
    `,
  )
  await client.query(
    `
      insert into intelligence_districts (id, organization_id, client_id, name, region)
      values ('dawson-trails-md1', 'schedio', 'dawson-trails-md1', 'Dawson Trails MD1', 'Castle Rock, CO')
      on conflict (id) do update set
        organization_id = excluded.organization_id,
        client_id = excluded.client_id,
        name = excluded.name,
        region = excluded.region
    `,
  )
  await client.query(
    `
      insert into intelligence_projects (id, organization_id, client_id, district_id, name)
      values
        (
          'dawson-trails-district-direct-pay',
          'schedio',
          'dawson-trails-md1',
          'dawson-trails-md1',
          'Dawson Trails District Direct Pay'
        ),
        (
          'dawson-trails-developer-reimbursement',
          'schedio',
          'dawson-trails-md1-developer',
          'dawson-trails-md1',
          'Dawson Trails Developer Reimbursement'
        )
      on conflict (id) do update set
        organization_id = excluded.organization_id,
        client_id = excluded.client_id,
        district_id = excluded.district_id,
        name = excluded.name
    `,
  )
}

class IntelligencePostgresStore implements IntelligenceStore {
  readonly mode = 'postgres'

  async upsertPackage(pkg: IntelligencePackage): Promise<void> {
    await dbTransaction(async (client) => {
      await ensureScopeRows(client)
      const i = pkg.importRow
      await client.query(
        `
          insert into intelligence_imports (
            id, organization_id, client_id, district_id, project_id, source_kind,
            source_label, source_uri, status, document_count, segment_count,
            imported_by, imported_at
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          on conflict (id) do update set
            source_kind = excluded.source_kind,
            source_label = excluded.source_label,
            source_uri = excluded.source_uri,
            status = excluded.status,
            document_count = excluded.document_count,
            segment_count = excluded.segment_count,
            imported_by = excluded.imported_by,
            imported_at = excluded.imported_at
        `,
        [
          i.id,
          i.organizationId,
          i.clientId,
          i.districtId,
          i.projectId,
          i.sourceKind,
          i.sourceLabel,
          i.sourceUri,
          i.status,
          i.documentCount,
          i.segmentCount,
          i.importedBy,
          i.importedAt,
        ],
      )

      for (const doc of pkg.documents) {
        await client.query(
          `
            insert into intelligence_documents (
              id, organization_id, client_id, district_id, project_id, import_id,
              category_id, source_document_id, canonical_file_uri, file_name,
              mime_type, title, vendor_name, filing_label, ppp_percent, metadata,
              created_at, updated_at
            )
            values (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
              $11, $12, $13, $14, $15, $16::jsonb, $17, $18
            )
            on conflict (id) do update set
              category_id = excluded.category_id,
              canonical_file_uri = excluded.canonical_file_uri,
              file_name = excluded.file_name,
              mime_type = excluded.mime_type,
              title = excluded.title,
              vendor_name = excluded.vendor_name,
              filing_label = excluded.filing_label,
              ppp_percent = excluded.ppp_percent,
              metadata = excluded.metadata,
              updated_at = excluded.updated_at
          `,
          [
            doc.id,
            doc.organizationId,
            doc.clientId,
            doc.districtId,
            doc.projectId,
            doc.importId,
            doc.categoryId,
            doc.sourceDocumentId,
            doc.canonicalFileUri,
            doc.fileName,
            doc.mimeType,
            doc.title,
            doc.vendorName,
            doc.filingLabel,
            doc.pppPercent,
            JSON.stringify(doc.metadata),
            doc.createdAt,
            doc.updatedAt,
          ],
        )
      }

      for (const segment of pkg.segments) {
        await client.query(
          `
            insert into intelligence_document_segments (
              id, organization_id, document_id, category_id, segment_type, title,
              summary, page_start, page_end, extracted_facts, created_at
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
            on conflict (id) do update set
              category_id = excluded.category_id,
              segment_type = excluded.segment_type,
              title = excluded.title,
              summary = excluded.summary,
              page_start = excluded.page_start,
              page_end = excluded.page_end,
              extracted_facts = excluded.extracted_facts
          `,
          [
            segment.id,
            segment.organizationId,
            segment.documentId,
            segment.categoryId,
            segment.segmentType,
            segment.title,
            segment.summary,
            segment.pageStart,
            segment.pageEnd,
            JSON.stringify(segment.extractedFacts),
            segment.createdAt,
          ],
        )
      }

      const docsForRelationships = await client.query<DocumentRow>(
        'select * from intelligence_documents where organization_id = $1',
        [i.organizationId],
      )
      const relationships = deriveDocumentRelationships({
        documents: docsForRelationships.rows.map(documentFromRow),
        createdBy: i.importedBy,
        createdAt: i.importedAt,
      })
      for (const relationship of relationships) {
        await client.query(
          `
            insert into intelligence_document_relationships (
              id, organization_id, source_document_id, target_document_id,
              relationship_type, score, reason, evidence, status, created_by,
              created_at
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
            on conflict (id) do update set
              score = excluded.score,
              reason = excluded.reason,
              evidence = excluded.evidence,
              status = case
                when intelligence_document_relationships.status in ('accepted', 'rejected')
                  then intelligence_document_relationships.status
                else excluded.status
              end
          `,
          [
            relationship.id,
            relationship.organizationId,
            relationship.sourceDocumentId,
            relationship.targetDocumentId,
            relationship.relationshipType,
            relationship.score,
            relationship.reason,
            JSON.stringify(relationship.evidence),
            relationship.status,
            relationship.createdBy,
            relationship.createdAt,
          ],
        )
      }
    })
  }

  async appendLearning(
    learning: IntelligenceLearning,
  ): Promise<IntelligenceLearning> {
    await dbQuery(
      `
        insert into intelligence_learnings (
          id, organization_id, client_id, district_id, project_id, document_id,
          segment_id, category_id, label, determination, ppp_value,
          applicability, confidence, rationale, reason_tags, evidence,
          created_by, created_at, supersedes_id
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16::jsonb, $17, $18, $19
        )
        on conflict (id) do nothing
      `,
      [
        learning.id,
        learning.organizationId,
        learning.clientId,
        learning.districtId,
        learning.projectId,
        learning.documentId,
        learning.segmentId,
        learning.categoryId,
        learning.label,
        learning.determination,
        learning.pppValue,
        learning.applicability,
        learning.confidence,
        learning.rationale,
        learning.reasonTags,
        JSON.stringify(learning.evidence),
        learning.createdBy,
        learning.createdAt,
        learning.supersedesId,
      ],
    )
    return learning
  }

  async appendFinding(
    finding: IntelligenceFinding,
  ): Promise<IntelligenceFinding> {
    await dbQuery(
      `
        insert into intelligence_findings (
          id, organization_id, client_id, district_id, project_id, document_id,
          segment_id, category_id, page_number, anchor_type, normalized_rects,
          selected_text, finding_type, status, confidence, label, rationale,
          reason_tags, created_by, created_at, linked_learning_id
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11::jsonb, $12, $13, $14, $15, $16, $17,
          $18, $19, $20, $21
        )
        on conflict (id) do nothing
      `,
      [
        finding.id,
        finding.organizationId,
        finding.clientId,
        finding.districtId,
        finding.projectId,
        finding.documentId,
        finding.segmentId,
        finding.categoryId,
        finding.pageNumber,
        finding.anchorType,
        JSON.stringify(finding.normalizedRects),
        finding.selectedText,
        finding.findingType,
        finding.status,
        finding.confidence,
        finding.label,
        finding.rationale,
        finding.reasonTags,
        finding.createdBy,
        finding.createdAt,
        finding.linkedLearningId,
      ],
    )
    return finding
  }

  async updateFinding(
    id: string,
    update: IntelligenceFindingUpdate,
  ): Promise<IntelligenceFinding | null> {
    const result = await dbQuery<FindingRow>(
      `
        update intelligence_findings
        set
          finding_type = coalesce($2, finding_type),
          status = coalesce($3, status),
          confidence = coalesce($4, confidence),
          label = coalesce($5, label),
          rationale = coalesce($6, rationale),
          reason_tags = coalesce($7, reason_tags),
          linked_learning_id = coalesce($8, linked_learning_id)
        where id = $1
        returning *
      `,
      [
        id,
        update.findingType,
        update.status,
        update.confidence,
        update.label,
        update.rationale,
        update.reasonTags,
        update.linkedLearningId,
      ],
    )
    const row = result.rows.at(0)
    return row ? findingFromRow(row) : null
  }

  async deleteFinding(id: string): Promise<boolean> {
    const result = await dbQuery<{ id: string }>(
      'delete from intelligence_findings where id = $1 returning id',
      [id],
    )
    return (result.rowCount ?? 0) > 0
  }

  async getWorkspace(): Promise<IntelligenceWorkspace> {
    const [
      clientsRaw,
      importsRaw,
      docsRaw,
      segmentsRaw,
      findingsRaw,
      learningsRaw,
      relationshipsRaw,
    ] = await Promise.all([
      dbQuery<ClientRow>('select * from intelligence_clients order by name'),
      dbQuery<ImportRow>(
        'select * from intelligence_imports order by imported_at desc',
      ),
      dbQuery<DocumentRow>(
        'select * from intelligence_documents order by category_id, title',
      ),
      dbQuery<SegmentRow>(
        'select * from intelligence_document_segments order by document_id, segment_type, title',
      ),
      dbQuery<FindingRow>(
        'select * from intelligence_findings order by created_at desc',
      ),
      dbQuery<LearningRow>(
        'select * from intelligence_learnings order by created_at desc',
      ),
      dbQuery<RelationshipRow>(
        'select * from intelligence_document_relationships order by score desc, created_at desc',
      ),
    ])
    const clients = clientsRaw.rows.map(clientFromRow)
    const imports = importsRaw.rows.map(importFromRow)
    const documents = sortDocuments(docsRaw.rows.map(documentFromRow))
    const segments = sortSegments(segmentsRaw.rows.map(segmentFromRow))
    const findings = sortFindings(findingsRaw.rows.map(findingFromRow))
    const learnings = sortLearnings(learningsRaw.rows.map(learningFromRow))
    const relationships = sortRelationships(
      relationshipsRaw.rows.map(relationshipFromRow),
    )
    return {
      mode: this.mode,
      isDatabaseConfigured: true,
      clients,
      categories: INTELLIGENCE_CATEGORIES,
      imports,
      documents,
      segments,
      findings,
      learnings,
      relationships,
      recommendations: buildRecommendations({
        documents,
        segments,
        learnings,
      }),
      sourceWarnings: [],
    }
  }
}

let jsonStore: IntelligenceJsonStore | null = null
let postgresStore: IntelligencePostgresStore | null = null

export function getIntelligenceStore(): IntelligenceStore {
  if (isDatabaseConfigured()) {
    if (!postgresStore) postgresStore = new IntelligencePostgresStore()
    return postgresStore
  }
  if (!jsonStore) jsonStore = new IntelligenceJsonStore()
  return jsonStore
}
