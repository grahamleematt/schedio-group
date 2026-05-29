import { categoryLabels } from '#/server/intelligence/catalog'
import type {
  IntelligenceDocument,
  IntelligenceLearning,
  IntelligenceRecommendation,
  IntelligenceSegment,
  IntelligenceWorkspace,
} from '#/server/intelligence/types'

export type RelationshipMode = 'tree' | 'graph'

export type RelationshipNodeKind =
  | 'scope'
  | 'category'
  | 'document'
  | 'segment'
  | 'finding'
  | 'learning'

export type RelationshipEdgeKind =
  | 'contains'
  | 'same_vendor'
  | 'same_filing'
  | 'same_ppp'
  | 'same_source'
  | 'same_category'
  | 'shared_identifier'
  | 'manual'
  | 'source_evidence'
  | 'suggested_apply'

export type RelationshipNode = {
  id: string
  kind: RelationshipNodeKind
  label: string
  detail: string
  metric?: string
  documentId?: string
  segmentId?: string
  learningId?: string
  findingId?: string
  categoryId?: string
}

export type RelationshipEdge = {
  id: string
  source: string
  target: string
  kind: RelationshipEdgeKind
  label: string
  detail: string
  score?: number
}

export type RelationshipPreviewRow = {
  kind: RelationshipEdgeKind
  label: string
  title: string
  detail: string
  score?: number
  documentId?: string
}

export type RelationshipGraph = {
  mode: RelationshipMode
  focusDocumentId?: string
  focusNodeId?: string
  nodes: ReadonlyArray<RelationshipNode>
  edges: ReadonlyArray<RelationshipEdge>
  preview: {
    rows: ReadonlyArray<RelationshipPreviewRow>
    documentMatchCount: number
    applyCount: number
  }
}

const ROOT_NODE_ID = 'scope:dawson-trails'
const RELATED_DOCUMENT_LIMIT = 18
const TREE_DOCUMENT_LIMIT = 12
const LEARNING_LIMIT = 8
const APPLY_LIMIT = 10

export const relationshipNodeIds = {
  root: ROOT_NODE_ID,
  category: (id: string) => `category:${id}`,
  document: (id: string) => `document:${id}`,
  segment: (id: string) => `segment:${id}`,
  finding: (id: string) => `finding:${id}`,
  learning: (id: string) => `learning:${id}`,
}

function sourceKind(doc: IntelligenceDocument): string | undefined {
  const value = doc.metadata.sourceKind
  return typeof value === 'string' ? value : undefined
}

function groupLabel(doc: IntelligenceDocument): string | undefined {
  const value = doc.metadata.groupLabel
  return typeof value === 'string' ? value : undefined
}

function cleanDetail(parts: Array<string | undefined>): string {
  const detail = parts.filter(Boolean).join(' · ')
  return detail || 'Imported source document'
}

function formatPpp(value: number | undefined): string | undefined {
  if (typeof value !== 'number') return undefined
  return `${value.toFixed(value % 1 === 0 ? 0 : 2)}% PPP`
}

function scoreRelatedDocument(
  focusDoc: IntelligenceDocument,
  candidate: IntelligenceDocument,
): {
  score: number
  reasons: Array<RelationshipPreviewRow>
} {
  const reasons: Array<RelationshipPreviewRow> = []
  let score = 0

  if (focusDoc.vendorName && focusDoc.vendorName === candidate.vendorName) {
    score += 0.34
    reasons.push({
      kind: 'same_vendor',
      label: 'Same vendor',
      title: candidate.title,
      detail: focusDoc.vendorName,
      score: 0.34,
      documentId: candidate.id,
    })
  }

  if (focusDoc.filingLabel && focusDoc.filingLabel === candidate.filingLabel) {
    score += 0.3
    reasons.push({
      kind: 'same_filing',
      label: 'Same filing',
      title: candidate.title,
      detail: focusDoc.filingLabel,
      score: 0.3,
      documentId: candidate.id,
    })
  }

  if (
    typeof focusDoc.pppPercent === 'number' &&
    typeof candidate.pppPercent === 'number' &&
    Math.abs(focusDoc.pppPercent - candidate.pppPercent) <= 0.75
  ) {
    score += 0.22
    reasons.push({
      kind: 'same_ppp',
      label: 'PPP match',
      title: candidate.title,
      detail: `${formatPpp(candidate.pppPercent)} within 0.75 points`,
      score: 0.22,
      documentId: candidate.id,
    })
  }

  if (sourceKind(focusDoc) && sourceKind(focusDoc) === sourceKind(candidate)) {
    score += 0.08
    reasons.push({
      kind: 'same_source',
      label: 'Same source type',
      title: candidate.title,
      detail: sourceKind(candidate)?.replace(/_/g, ' ') ?? 'source type match',
      score: 0.08,
      documentId: candidate.id,
    })
  }

  if (focusDoc.categoryId === candidate.categoryId) {
    score += 0.06
  }

  return { score: Math.min(score, 1), reasons }
}

function edgeKindForRelationship(
  type: string,
): Exclude<
  RelationshipEdgeKind,
  'contains' | 'source_evidence' | 'suggested_apply'
> {
  if (type === 'similar_ppp') return 'same_ppp'
  if (
    type === 'same_vendor' ||
    type === 'same_filing' ||
    type === 'same_source' ||
    type === 'same_category' ||
    type === 'shared_identifier' ||
    type === 'manual'
  ) {
    return type
  }
  return 'manual'
}

function relationshipLabel(type: string): string {
  if (type === 'same_vendor') return 'Same vendor'
  if (type === 'same_filing') return 'Same filing'
  if (type === 'similar_ppp') return 'PPP match'
  if (type === 'same_source') return 'Same source type'
  if (type === 'same_category') return 'Same category'
  if (type === 'shared_identifier') return 'Shared identifier'
  return 'Manual link'
}

function persistedRelatedDocuments(
  workspace: IntelligenceWorkspace,
  focusDoc: IntelligenceDocument,
): Array<{
  doc: IntelligenceDocument
  score: number
  reasons: ReadonlyArray<RelationshipPreviewRow>
}> {
  const docsById = new Map(workspace.documents.map((doc) => [doc.id, doc]))
  const byCandidate = new Map<
    string,
    {
      doc: IntelligenceDocument
      score: number
      reasons: Array<RelationshipPreviewRow>
    }
  >()

  for (const relationship of workspace.relationships) {
    if (relationship.status === 'rejected') continue
    const candidateId =
      relationship.sourceDocumentId === focusDoc.id
        ? relationship.targetDocumentId
        : relationship.targetDocumentId === focusDoc.id
          ? relationship.sourceDocumentId
          : undefined
    if (!candidateId) continue
    const candidate = docsById.get(candidateId)
    if (!candidate) continue
    const existing =
      byCandidate.get(candidateId) ??
      ({
        doc: candidate,
        score: 0,
        reasons: [],
      } satisfies {
        doc: IntelligenceDocument
        score: number
        reasons: Array<RelationshipPreviewRow>
      })
    existing.score = Math.max(existing.score, relationship.score)
    existing.reasons.push({
      kind: edgeKindForRelationship(relationship.relationshipType),
      label: relationshipLabel(relationship.relationshipType),
      title: candidate.title,
      detail: relationship.reason,
      score: relationship.score,
      documentId: candidate.id,
    })
    byCandidate.set(candidateId, existing)
  }

  return Array.from(byCandidate.values()).sort(
    (a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title),
  )
}

function relatedDocuments(
  workspace: IntelligenceWorkspace,
  focusDoc: IntelligenceDocument | undefined,
): Array<{
  doc: IntelligenceDocument
  score: number
  reasons: ReadonlyArray<RelationshipPreviewRow>
}> {
  if (!focusDoc) return []
  const persisted = persistedRelatedDocuments(workspace, focusDoc)
  if (persisted.length > 0) return persisted
  return workspace.documents
    .filter((doc) => doc.id !== focusDoc.id)
    .map((doc) => ({ doc, ...scoreRelatedDocument(focusDoc, doc) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title))
}

function segmentsForDocuments(
  workspace: IntelligenceWorkspace,
  documentIds: ReadonlySet<string>,
): Array<IntelligenceSegment> {
  return workspace.segments.filter((segment) =>
    documentIds.has(segment.documentId),
  )
}

function learningsForGraph(
  workspace: IntelligenceWorkspace,
  focusDoc: IntelligenceDocument | undefined,
  focusSegments: ReadonlyArray<IntelligenceSegment>,
): Array<IntelligenceLearning> {
  if (!focusDoc) return []
  const focusSegmentIds = new Set(focusSegments.map((segment) => segment.id))
  return workspace.learnings
    .filter(
      (learning) =>
        learning.documentId === focusDoc.id ||
        (learning.segmentId
          ? focusSegmentIds.has(learning.segmentId)
          : false) ||
        learning.categoryId === focusDoc.categoryId,
    )
    .slice(0, LEARNING_LIMIT)
}

function recommendationsForLearnings(
  workspace: IntelligenceWorkspace,
  learnings: ReadonlyArray<IntelligenceLearning>,
): Array<IntelligenceRecommendation> {
  const learningIds = new Set(learnings.map((learning) => learning.id))
  return workspace.recommendations
    .filter((recommendation) => learningIds.has(recommendation.learningId))
    .sort((a, b) => b.score - a.score)
    .slice(0, APPLY_LIMIT)
}

function pushUniqueNode(
  nodes: Array<RelationshipNode>,
  seen: Set<string>,
  node: RelationshipNode,
): void {
  if (seen.has(node.id)) return
  seen.add(node.id)
  nodes.push(node)
}

function pushUniqueEdge(
  edges: Array<RelationshipEdge>,
  seen: Set<string>,
  edge: RelationshipEdge,
): void {
  if (seen.has(edge.id)) return
  seen.add(edge.id)
  edges.push(edge)
}

function documentNode(doc: IntelligenceDocument): RelationshipNode {
  return {
    id: relationshipNodeIds.document(doc.id),
    kind: 'document',
    label: doc.title,
    detail: cleanDetail([
      categoryLabels[doc.categoryId],
      doc.vendorName,
      doc.filingLabel,
    ]),
    metric: formatPpp(doc.pppPercent),
    documentId: doc.id,
    categoryId: doc.categoryId,
  }
}

function segmentNode(segment: IntelligenceSegment): RelationshipNode {
  return {
    id: relationshipNodeIds.segment(segment.id),
    kind: 'segment',
    label: segment.title,
    detail: segment.segmentType.replace(/_/g, ' '),
    documentId: segment.documentId,
    segmentId: segment.id,
    categoryId: segment.categoryId,
  }
}

export function buildRelationshipPreview(
  workspace: IntelligenceWorkspace,
  documentId: string | undefined,
): RelationshipGraph['preview'] {
  const focusDoc = documentId
    ? workspace.documents.find((doc) => doc.id === documentId)
    : workspace.documents.at(0)
  const matches = relatedDocuments(workspace, focusDoc)
  const rows = matches
    .flatMap((match) =>
      match.reasons.map((reason) => ({
        ...reason,
        score: match.score,
      })),
    )
    .slice(0, 4)

  const focusSegmentIds = new Set(
    workspace.segments
      .filter((segment) => segment.documentId === focusDoc?.id)
      .map((segment) => segment.id),
  )
  const focusLearningIds = new Set(
    workspace.learnings
      .filter(
        (learning) =>
          learning.documentId === focusDoc?.id ||
          (learning.segmentId
            ? focusSegmentIds.has(learning.segmentId)
            : false) ||
          learning.categoryId === focusDoc?.categoryId,
      )
      .map((learning) => learning.id),
  )
  const applies = workspace.recommendations.filter((recommendation) =>
    focusLearningIds.has(recommendation.learningId),
  )

  return {
    rows,
    documentMatchCount: matches.length,
    applyCount: applies.length,
  }
}

export function buildRelationshipGraph(
  workspace: IntelligenceWorkspace,
  input: {
    documentId?: string
    mode: RelationshipMode
  },
): RelationshipGraph {
  const focusDoc =
    (input.documentId
      ? workspace.documents.find((doc) => doc.id === input.documentId)
      : undefined) ?? workspace.documents.at(0)
  const focusSegments = focusDoc
    ? workspace.segments.filter((segment) => segment.documentId === focusDoc.id)
    : []
  const matches = relatedDocuments(workspace, focusDoc)
  const relatedLimit =
    input.mode === 'tree' ? TREE_DOCUMENT_LIMIT : RELATED_DOCUMENT_LIMIT
  const scopedDocuments = [
    ...(focusDoc ? [focusDoc] : []),
    ...matches.slice(0, relatedLimit).map((match) => match.doc),
  ]
  const scopedDocumentIds = new Set(scopedDocuments.map((doc) => doc.id))
  const learnings = learningsForGraph(workspace, focusDoc, focusSegments)
  const recommendations = recommendationsForLearnings(workspace, learnings)

  for (const recommendation of recommendations) {
    const targetSegment = workspace.segments.find(
      (segment) => segment.id === recommendation.targetSegmentId,
    )
    const targetDocument = targetSegment
      ? workspace.documents.find((doc) => doc.id === targetSegment.documentId)
      : undefined
    if (targetDocument) scopedDocumentIds.add(targetDocument.id)
  }

  const allScopedDocuments = workspace.documents.filter((doc) =>
    scopedDocumentIds.has(doc.id),
  )
  const graphSegments =
    input.mode === 'tree'
      ? focusSegments
      : segmentsForDocuments(workspace, scopedDocumentIds).slice(0, 36)
  const graphSegmentIds = new Set(graphSegments.map((segment) => segment.id))
  const graphFindings = workspace.findings.filter(
    (finding) =>
      finding.documentId === focusDoc?.id &&
      (!finding.segmentId || graphSegmentIds.has(finding.segmentId)),
  )
  const nodes: Array<RelationshipNode> = []
  const nodeIds = new Set<string>()
  const edges: Array<RelationshipEdge> = []
  const edgeIds = new Set<string>()

  pushUniqueNode(nodes, nodeIds, {
    id: ROOT_NODE_ID,
    kind: 'scope',
    label: 'Dawson Trails MD1',
    detail: cleanDetail([
      workspace.imports.at(0)?.sourceLabel,
      workspace.imports.at(0)?.sourceKind.replace(/_/g, ' '),
    ]),
    metric: `${workspace.documents.length} docs`,
  })

  const categories = Array.from(
    new Set(allScopedDocuments.map((doc) => doc.categoryId)),
  ).sort((a, b) => categoryLabels[a].localeCompare(categoryLabels[b]))
  for (const categoryId of categories) {
    pushUniqueNode(nodes, nodeIds, {
      id: relationshipNodeIds.category(categoryId),
      kind: 'category',
      label: categoryLabels[categoryId],
      detail: 'Document category',
      metric: `${allScopedDocuments.filter((doc) => doc.categoryId === categoryId).length} docs`,
      categoryId,
    })
    pushUniqueEdge(edges, edgeIds, {
      id: `contains:${ROOT_NODE_ID}:${categoryId}`,
      source: ROOT_NODE_ID,
      target: relationshipNodeIds.category(categoryId),
      kind: 'contains',
      label: 'contains',
      detail: 'Imported package category',
    })
  }

  for (const doc of allScopedDocuments) {
    pushUniqueNode(nodes, nodeIds, documentNode(doc))
    pushUniqueEdge(edges, edgeIds, {
      id: `contains:${doc.categoryId}:${doc.id}`,
      source: relationshipNodeIds.category(doc.categoryId),
      target: relationshipNodeIds.document(doc.id),
      kind: 'contains',
      label: 'contains',
      detail: categoryLabels[doc.categoryId],
    })
  }

  for (const segment of graphSegments) {
    pushUniqueNode(nodes, nodeIds, segmentNode(segment))
    pushUniqueEdge(edges, edgeIds, {
      id: `contains:${segment.documentId}:${segment.id}`,
      source: relationshipNodeIds.document(segment.documentId),
      target: relationshipNodeIds.segment(segment.id),
      kind: 'contains',
      label: 'segment',
      detail: segment.segmentType.replace(/_/g, ' '),
    })
  }

  for (const finding of graphFindings) {
    const sourceId = finding.segmentId
      ? relationshipNodeIds.segment(finding.segmentId)
      : relationshipNodeIds.document(finding.documentId)
    pushUniqueNode(nodes, nodeIds, {
      id: relationshipNodeIds.finding(finding.id),
      kind: 'finding',
      label: finding.label,
      detail: `Page ${finding.pageNumber} · ${finding.findingType.replace(/_/g, ' ')}`,
      metric: finding.confidence,
      documentId: finding.documentId,
      segmentId: finding.segmentId,
      findingId: finding.id,
      categoryId: finding.categoryId,
    })
    pushUniqueEdge(edges, edgeIds, {
      id: `evidence:${finding.id}`,
      source: sourceId,
      target: relationshipNodeIds.finding(finding.id),
      kind: 'source_evidence',
      label: 'evidence',
      detail: finding.rationale,
    })
  }

  for (const learning of learnings) {
    const sourceId =
      learning.segmentId && graphSegmentIds.has(learning.segmentId)
        ? relationshipNodeIds.segment(learning.segmentId)
        : learning.documentId && scopedDocumentIds.has(learning.documentId)
          ? relationshipNodeIds.document(learning.documentId)
          : relationshipNodeIds.category(learning.categoryId)
    pushUniqueNode(nodes, nodeIds, {
      id: relationshipNodeIds.learning(learning.id),
      kind: 'learning',
      label: learning.label,
      detail: `${learning.determination.replace(/_/g, ' ')} · ${learning.applicability}`,
      metric: learning.confidence,
      documentId: learning.documentId,
      segmentId: learning.segmentId,
      learningId: learning.id,
      categoryId: learning.categoryId,
    })
    pushUniqueEdge(edges, edgeIds, {
      id: `learning:${learning.id}`,
      source: sourceId,
      target: relationshipNodeIds.learning(learning.id),
      kind: 'source_evidence',
      label: 'teaches',
      detail: learning.rationale,
    })
  }

  if (focusDoc) {
    for (const match of matches.slice(0, relatedLimit)) {
      const primaryReason = match.reasons.at(0)
      if (!primaryReason) continue
      pushUniqueEdge(edges, edgeIds, {
        id: `${primaryReason.kind}:${focusDoc.id}:${match.doc.id}`,
        source: relationshipNodeIds.document(focusDoc.id),
        target: relationshipNodeIds.document(match.doc.id),
        kind: primaryReason.kind,
        label: primaryReason.label,
        detail: cleanDetail([primaryReason.detail, groupLabel(match.doc)]),
        score: match.score,
      })
    }
  }

  for (const recommendation of recommendations) {
    if (!graphSegmentIds.has(recommendation.targetSegmentId)) continue
    pushUniqueEdge(edges, edgeIds, {
      id: `apply:${recommendation.learningId}:${recommendation.targetSegmentId}`,
      source: relationshipNodeIds.learning(recommendation.learningId),
      target: relationshipNodeIds.segment(recommendation.targetSegmentId),
      kind: 'suggested_apply',
      label: 'apply',
      detail: recommendation.rationale,
      score: recommendation.score,
    })
  }

  return {
    mode: input.mode,
    focusDocumentId: focusDoc?.id,
    focusNodeId: focusDoc
      ? relationshipNodeIds.document(focusDoc.id)
      : undefined,
    nodes,
    edges,
    preview: {
      ...buildRelationshipPreview(workspace, focusDoc?.id),
      applyCount: recommendations.length,
    },
  }
}
