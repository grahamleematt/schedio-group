import type { SourceDocument } from '#/server/determinations/types'
import {
  getSourceCorpus,
  readSourceDocumentById,
} from '#/server/determinations/source'
import type {
  IntelligenceCategoryId,
  IntelligenceDocument,
  IntelligencePackage,
  IntelligenceSegment,
  JsonRecord,
} from './types'

const ORGANIZATION_ID = 'schedio'

export type DawsonIntelligenceScopeId = 'district' | 'developer'

type DawsonIntelligenceScope = {
  id: DawsonIntelligenceScopeId
  clientId: string
  districtId: string
  projectId: string
  importId: string
  sourceLabel: string
  processLabel: string
}

const DAWSON_SCOPES: Record<
  DawsonIntelligenceScopeId,
  DawsonIntelligenceScope
> = {
  district: {
    id: 'district',
    clientId: 'dawson-trails-md1',
    districtId: 'dawson-trails-md1',
    projectId: 'dawson-trails-district-direct-pay',
    importId: 'import-dawson-trails-md1-district',
    sourceLabel: 'Dawson Trails MD One - District intake package',
    processLabel: 'District Direct Pay',
  },
  developer: {
    id: 'developer',
    clientId: 'dawson-trails-md1-developer',
    districtId: 'dawson-trails-md1',
    projectId: 'dawson-trails-developer-reimbursement',
    importId: 'import-dawson-trails-md1-developer',
    sourceLabel: 'Dawson Trails MD One - Developer reimbursement package',
    processLabel: 'Developer Reimbursement',
  },
}

function dawsonScope(
  scopeId: DawsonIntelligenceScopeId | undefined,
): DawsonIntelligenceScope {
  return DAWSON_SCOPES[scopeId ?? 'district']
}

function nowIso(): string {
  return new Date().toISOString()
}

function categoryFor(doc: SourceDocument): IntelligenceCategoryId {
  if (doc.kind === 'marked_contract') return 'contract'
  if (doc.kind === 'marked_plat') return 'plat'
  if (doc.kind === 'verification_workbook') return 'workbook'
  return 'governance'
}

function cleanTitle(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function documentSummary(doc: SourceDocument): string {
  const bits = [
    doc.groupLabel,
    doc.vendorName,
    doc.filingLabel,
    typeof doc.pppPercent === 'number' ? `${doc.pppPercent}% PPP` : undefined,
  ].filter(Boolean)
  return bits.length > 0
    ? bits.join(' · ')
    : 'Imported source document awaiting deeper segmentation.'
}

function toDocument(
  doc: SourceDocument,
  sourceZipPath: string,
  scope: DawsonIntelligenceScope,
  timestamp: string,
): IntelligenceDocument {
  const categoryId = categoryFor(doc)
  return {
    id: `doc-${scope.id}-${doc.id}`,
    organizationId: ORGANIZATION_ID,
    clientId: scope.clientId,
    districtId: scope.districtId,
    projectId: scope.projectId,
    importId: scope.importId,
    categoryId,
    sourceDocumentId: doc.id,
    canonicalFileUri: `zip://${sourceZipPath}#${doc.entryPath}`,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    title: cleanTitle(doc.fileName),
    vendorName: doc.vendorName,
    filingLabel: doc.filingLabel,
    pppPercent: doc.pppPercent,
    metadata: {
      sourceEntryPath: doc.entryPath,
      groupLabel: doc.groupLabel,
      docCode: doc.docCode,
      sourceKind: doc.kind,
      processLabel: scope.processLabel,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function sourceDocumentSegments(
  sourceDoc: SourceDocument,
  doc: IntelligenceDocument,
  timestamp: string,
): Array<IntelligenceSegment> {
  const facts: JsonRecord = {
    vendorName: sourceDoc.vendorName,
    filingLabel: sourceDoc.filingLabel,
    docCode: sourceDoc.docCode,
    pppPercent: sourceDoc.pppPercent,
    sourceKind: sourceDoc.kind,
  }
  const segments: Array<IntelligenceSegment> = [
    {
      id: `seg-${doc.id}-summary`,
      organizationId: ORGANIZATION_ID,
      documentId: doc.id,
      categoryId: doc.categoryId,
      segmentType: 'document_summary',
      title: doc.title,
      summary: documentSummary(sourceDoc),
      extractedFacts: facts,
      createdAt: timestamp,
    },
  ]

  if (doc.categoryId === 'contract') {
    segments.push({
      id: `seg-${doc.id}-scope`,
      organizationId: ORGANIZATION_ID,
      documentId: doc.id,
      categoryId: doc.categoryId,
      segmentType: 'scope_item',
      title: sourceDoc.vendorName
        ? `${sourceDoc.vendorName} scope review`
        : doc.title,
      summary:
        'Marked contract package segment for Tim to teach PPP treatment and rationale.',
      extractedFacts: facts,
      createdAt: timestamp,
    })
  }

  if (doc.categoryId === 'plat') {
    segments.push({
      id: `seg-${doc.id}-plat`,
      organizationId: ORGANIZATION_ID,
      documentId: doc.id,
      categoryId: doc.categoryId,
      segmentType: 'plat_ppp',
      title: sourceDoc.filingLabel ?? doc.title,
      summary:
        'Marked plat segment for matching plat geometry, public/private areas, and PPP evidence.',
      extractedFacts: facts,
      createdAt: timestamp,
    })
  }

  return segments
}

export async function createDawsonIntelligencePackage(input: {
  importedBy: string
  scopeId?: DawsonIntelligenceScopeId
}): Promise<{
  pkg: IntelligencePackage
  sourceWarnings: ReadonlyArray<string>
}> {
  const timestamp = nowIso()
  const scope = dawsonScope(input.scopeId)
  const corpus = await getSourceCorpus()
  if (!corpus.sourceExists) {
    throw new Error(
      `Dawson source package is not available on this server. Configure SG_DREAM_SOURCE_ZIP locally, or replace the zip adapter with Egnyte-backed import before deploying this review flow.`,
    )
  }
  const documents = corpus.documents.map((doc) =>
    toDocument(doc, corpus.sourceZipPath, scope, timestamp),
  )
  const segments = corpus.documents.flatMap((sourceDoc, index) =>
    sourceDocumentSegments(sourceDoc, documents[index], timestamp),
  )

  const workbook = documents.find((doc) => doc.categoryId === 'workbook')
  if (workbook) {
    for (const row of corpus.platPpps) {
      segments.push({
        id: `seg-${workbook.id}-plat-${row.id}`,
        organizationId: ORGANIZATION_ID,
        documentId: workbook.id,
        categoryId: 'workbook',
        segmentType: 'workbook_row',
        title: row.label,
        summary: `${row.publicAreaAcres.toFixed(2)} public acres and ${row.privateAreaAcres.toFixed(2)} private acres produce ${(row.ppp * 100).toFixed(2)}% PPP.`,
        extractedFacts: {
          totalAreaAcres: row.totalAreaAcres,
          privateAreaAcres: row.privateAreaAcres,
          publicAreaAcres: row.publicAreaAcres,
          ppp: row.ppp,
        },
        createdAt: timestamp,
      })
    }
  }

  return {
    pkg: {
      importRow: {
        id: scope.importId,
        organizationId: ORGANIZATION_ID,
        clientId: scope.clientId,
        districtId: scope.districtId,
        projectId: scope.projectId,
        sourceKind: 'egnyte_export',
        sourceLabel: scope.sourceLabel,
        sourceUri: `zip://${corpus.sourceZipPath}`,
        status: 'imported',
        documentCount: documents.length,
        segmentCount: segments.length,
        importedBy: input.importedBy,
        importedAt: timestamp,
      },
      documents,
      segments,
    },
    sourceWarnings: corpus.sourceWarnings,
  }
}

export { readSourceDocumentById }
