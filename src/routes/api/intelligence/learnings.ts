import { createFileRoute } from '@tanstack/react-router'

import {
  intelligencePreviewDisabledResponse,
  isIntelligencePreviewOff,
} from '#/server/preview'
import { getIntelligenceStore } from '#/server/intelligence/store'
import type {
  IntelligenceLearning,
  LearningApplicability,
  LearningConfidence,
  LearningDetermination,
} from '#/server/intelligence/types'

const determinations = new Set<LearningDetermination>([
  'ppp',
  'not_ppp',
  'conditional',
  'needs_review',
])

const applicabilities = new Set<LearningApplicability>([
  'filing',
  'project',
  'district',
  'client',
  'organization',
])

const confidences = new Set<LearningConfidence>(['high', 'medium', 'low'])

type LearningPayload = {
  segmentId?: string
  documentId?: string
  findingId?: string
  label?: string
  determination?: LearningDetermination
  pppValue?: number
  applicability?: LearningApplicability
  confidence?: LearningConfidence
  rationale?: string
  reasonTags?: string
  createdBy?: string
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function newLearningId(): string {
  const cryptoRef = (globalThis as { crypto?: { randomUUID?: () => string } })
    .crypto
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return `learn-${cryptoRef.randomUUID()}`
  }
  return `learn-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function parseTags(input: string | undefined): ReadonlyArray<string> {
  if (!input) return []
  return input
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
}

function validate(payload: LearningPayload): string | null {
  if (!payload.segmentId) return 'missing segmentId'
  if (!payload.label?.trim()) return 'missing label'
  if (!payload.determination || !determinations.has(payload.determination)) {
    return 'invalid determination'
  }
  if (
    payload.pppValue !== undefined &&
    (payload.pppValue < 0 || payload.pppValue > 100)
  ) {
    return 'pppValue must be between 0 and 100'
  }
  if (!payload.applicability || !applicabilities.has(payload.applicability)) {
    return 'invalid applicability'
  }
  if (!payload.confidence || !confidences.has(payload.confidence)) {
    return 'invalid confidence'
  }
  if (!payload.rationale?.trim()) return 'missing rationale'
  return null
}

export const Route = createFileRoute('/api/intelligence/learnings')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (isIntelligencePreviewOff()) {
          return intelligencePreviewDisabledResponse()
        }
        try {
          const payload = (await request.json()) as LearningPayload
          const error = validate(payload)
          if (error) return jsonResponse({ error }, 400)

          const store = getIntelligenceStore()
          const workspace = await store.getWorkspace()
          const segment = workspace.segments.find(
            (row) => row.id === payload.segmentId,
          )
          if (!segment) return jsonResponse({ error: 'segment not found' }, 404)
          const doc = workspace.documents.find(
            (row) => row.id === segment.documentId,
          )
          if (!doc) return jsonResponse({ error: 'document not found' }, 404)
          const finding = payload.findingId
            ? workspace.findings.find(
                (row) =>
                  row.id === payload.findingId && row.documentId === doc.id,
              )
            : undefined

          const learning: IntelligenceLearning = {
            id: newLearningId(),
            organizationId: segment.organizationId,
            clientId: doc.clientId,
            districtId: doc.districtId,
            projectId: doc.projectId,
            documentId: doc.id,
            segmentId: segment.id,
            categoryId: segment.categoryId,
            label: payload.label?.trim() ?? '',
            determination: payload.determination ?? 'needs_review',
            pppValue: payload.pppValue,
            applicability: payload.applicability ?? 'project',
            confidence: payload.confidence ?? 'medium',
            rationale: payload.rationale?.trim() ?? '',
            reasonTags: parseTags(payload.reasonTags),
            evidence: {
              segmentTitle: segment.title,
              documentTitle: doc.title,
              canonicalFileUri: doc.canonicalFileUri,
              extractedFacts: segment.extractedFacts,
              finding: finding
                ? {
                    id: finding.id,
                    pageNumber: finding.pageNumber,
                    anchorType: finding.anchorType,
                    normalizedRects: finding.normalizedRects,
                    selectedText: finding.selectedText,
                    findingType: finding.findingType,
                    label: finding.label,
                  }
                : undefined,
            },
            createdBy: payload.createdBy?.trim() || 'Tim',
            createdAt: new Date().toISOString(),
          }

          const saved = await store.appendLearning(learning)
          return jsonResponse({ learning: saved })
        } catch (err) {
          console.error('[intelligence/learnings] failed', err)
          return jsonResponse(
            {
              error: err instanceof Error ? err.message : 'save failed',
            },
            500,
          )
        }
      },
    },
  },
})
