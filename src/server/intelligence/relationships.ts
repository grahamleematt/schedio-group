import type {
  IntelligenceDocument,
  IntelligenceDocumentRelationship,
  JsonRecord,
  RelationshipType,
} from './types'

type RelationshipSignal = {
  type: RelationshipType
  score: number
  reason: string
  evidence: JsonRecord
}

function sourceKind(doc: IntelligenceDocument): string | undefined {
  const value = doc.metadata.sourceKind
  return typeof value === 'string' ? value : undefined
}

function groupLabel(doc: IntelligenceDocument): string | undefined {
  const value = doc.metadata.groupLabel
  return typeof value === 'string' ? value : undefined
}

function processLabel(doc: IntelligenceDocument): string | undefined {
  const value = doc.metadata.processLabel
  return typeof value === 'string' ? value : undefined
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join(':')
}

function relationshipId(
  type: RelationshipType,
  a: IntelligenceDocument,
  b: IntelligenceDocument,
): string {
  return `rel-${type}-${pairKey(a.id, b.id)}`
}

function signalsForPair(
  a: IntelligenceDocument,
  b: IntelligenceDocument,
): Array<RelationshipSignal> {
  const signals: Array<RelationshipSignal> = []

  if (a.sourceDocumentId && a.sourceDocumentId === b.sourceDocumentId) {
    signals.push({
      type: 'shared_identifier',
      score: 0.99,
      reason: 'Same source document is present in both Dawson workspaces.',
      evidence: {
        sourceDocumentId: a.sourceDocumentId,
        sourceProcesses: [processLabel(a), processLabel(b)].filter(Boolean),
      },
    })
  }

  if (a.vendorName && a.vendorName === b.vendorName) {
    signals.push({
      type: 'same_vendor',
      score: 0.78,
      reason: `Both documents reference ${a.vendorName}.`,
      evidence: { vendorName: a.vendorName },
    })
  }

  if (a.filingLabel && a.filingLabel === b.filingLabel) {
    signals.push({
      type: 'same_filing',
      score: 0.82,
      reason: `Both documents share filing label ${a.filingLabel}.`,
      evidence: { filingLabel: a.filingLabel },
    })
  }

  if (
    typeof a.pppPercent === 'number' &&
    typeof b.pppPercent === 'number' &&
    Math.abs(a.pppPercent - b.pppPercent) <= 0.75
  ) {
    signals.push({
      type: 'similar_ppp',
      score: 0.72,
      reason: `PPP values are within 0.75 percentage points (${a.pppPercent}% and ${b.pppPercent}%).`,
      evidence: { sourcePpp: a.pppPercent, targetPpp: b.pppPercent },
    })
  }

  if (sourceKind(a) && sourceKind(a) === sourceKind(b)) {
    signals.push({
      type: 'same_source',
      score: 0.58,
      reason: `Both documents came from ${sourceKind(a)?.replace(/_/g, ' ')} intake.`,
      evidence: { sourceKind: sourceKind(a) },
    })
  }

  if (a.categoryId === b.categoryId) {
    signals.push({
      type: 'same_category',
      score: 0.42,
      reason: `Both documents are categorized as ${a.categoryId}.`,
      evidence: { categoryId: a.categoryId },
    })
  }

  const sharedGroupLabel =
    groupLabel(a) && groupLabel(a) === groupLabel(b) ? groupLabel(a) : undefined
  if (sharedGroupLabel) {
    signals.push({
      type: 'shared_identifier',
      score: 0.86,
      reason: `Both documents share extracted group label ${sharedGroupLabel}.`,
      evidence: { groupLabel: sharedGroupLabel },
    })
  }

  return signals
}

export function deriveDocumentRelationships(input: {
  documents: ReadonlyArray<IntelligenceDocument>
  createdAt?: string
  createdBy?: string
}): Array<IntelligenceDocumentRelationship> {
  const createdAt = input.createdAt ?? new Date().toISOString()
  const createdBy = input.createdBy ?? 'system'
  const rows: Array<IntelligenceDocumentRelationship> = []

  for (let i = 0; i < input.documents.length; i += 1) {
    const a = input.documents[i]
    for (let j = i + 1; j < input.documents.length; j += 1) {
      const b = input.documents[j]
      if (a.organizationId !== b.organizationId) continue
      for (const signal of signalsForPair(a, b)) {
        rows.push({
          id: relationshipId(signal.type, a, b),
          organizationId: a.organizationId,
          sourceDocumentId: a.id,
          targetDocumentId: b.id,
          relationshipType: signal.type,
          score: signal.score,
          reason: signal.reason,
          evidence: signal.evidence,
          status: 'suggested',
          createdBy,
          createdAt,
        })
      }
    }
  }

  return rows
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 500)
}
