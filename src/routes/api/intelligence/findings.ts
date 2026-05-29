import { createFileRoute } from '@tanstack/react-router'

import {
  intelligencePreviewDisabledResponse,
  isIntelligencePreviewOff,
} from '#/server/preview'
import { getIntelligenceStore } from '#/server/intelligence/store'
import type {
  FindingAnchorType,
  FindingRect,
  FindingStatus,
  FindingType,
  IntelligenceFinding,
  IntelligenceFindingUpdate,
  LearningConfidence,
} from '#/server/intelligence/types'

const anchorTypes = new Set<FindingAnchorType>([
  'point',
  'rect',
  'text',
  'page',
  'document',
])

const findingTypes = new Set<FindingType>([
  'ppp',
  'not_ppp',
  'conditional',
  'needs_review',
  'question',
  'source_evidence',
])

const confidences = new Set<LearningConfidence>(['high', 'medium', 'low'])

const statuses = new Set<FindingStatus>([
  'open',
  'promoted',
  'resolved',
  'dismissed',
])

type FindingPayload = {
  findingId?: string
  documentId?: string
  segmentId?: string
  pageNumber?: number
  anchorType?: FindingAnchorType
  normalizedRects?: Array<FindingRect>
  selectedText?: string
  findingType?: FindingType
  confidence?: LearningConfidence
  label?: string
  rationale?: string
  reasonTags?: string
  createdBy?: string
  status?: FindingStatus
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function newFindingId(): string {
  const cryptoRef = (globalThis as { crypto?: { randomUUID?: () => string } })
    .crypto
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return `find-${cryptoRef.randomUUID()}`
  }
  return `find-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function parseTags(input: string | undefined): ReadonlyArray<string> {
  if (!input) return []
  return input
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function normalizeRect(rect: FindingRect): FindingRect | null {
  const x = Number(rect.x)
  const y = Number(rect.y)
  const width = Number(rect.width)
  const height = Number(rect.height)
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return null
  }
  const safeX = clamp01(x)
  const safeY = clamp01(y)
  return {
    x: safeX,
    y: safeY,
    width: Math.min(clamp01(width), 1 - safeX),
    height: Math.min(clamp01(height), 1 - safeY),
  }
}

function normalizedRects(payload: FindingPayload): ReadonlyArray<FindingRect> {
  return (payload.normalizedRects ?? [])
    .map(normalizeRect)
    .filter((rect): rect is FindingRect => Boolean(rect))
}

function validateCreate(payload: FindingPayload): string | null {
  if (!payload.documentId) return 'missing documentId'
  if (
    payload.pageNumber === undefined ||
    !Number.isInteger(payload.pageNumber) ||
    payload.pageNumber < 1
  ) {
    return 'invalid pageNumber'
  }
  if (!payload.anchorType || !anchorTypes.has(payload.anchorType)) {
    return 'invalid anchorType'
  }
  if (
    (payload.anchorType === 'point' ||
      payload.anchorType === 'rect' ||
      payload.anchorType === 'text') &&
    normalizedRects(payload).length === 0
  ) {
    return 'missing normalizedRects'
  }
  if (!payload.findingType || !findingTypes.has(payload.findingType)) {
    return 'invalid findingType'
  }
  if (!payload.confidence || !confidences.has(payload.confidence)) {
    return 'invalid confidence'
  }
  if (!payload.label?.trim()) return 'missing label'
  if (!payload.rationale?.trim()) return 'missing rationale'
  return null
}

function validateUpdate(payload: FindingPayload): string | null {
  if (!payload.findingId) return 'missing findingId'
  if (payload.findingType && !findingTypes.has(payload.findingType)) {
    return 'invalid findingType'
  }
  if (payload.status && !statuses.has(payload.status)) return 'invalid status'
  if (payload.confidence && !confidences.has(payload.confidence)) {
    return 'invalid confidence'
  }
  if (payload.label !== undefined && !payload.label.trim()) {
    return 'missing label'
  }
  if (payload.rationale !== undefined && !payload.rationale.trim()) {
    return 'missing rationale'
  }
  return null
}

function updateFromPayload(payload: FindingPayload): IntelligenceFindingUpdate {
  return {
    findingType: payload.findingType,
    status: payload.status,
    confidence: payload.confidence,
    label: payload.label?.trim(),
    rationale: payload.rationale?.trim(),
    reasonTags:
      payload.reasonTags === undefined
        ? undefined
        : parseTags(payload.reasonTags),
  }
}

export const Route = createFileRoute('/api/intelligence/findings')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (isIntelligencePreviewOff()) {
          return intelligencePreviewDisabledResponse()
        }
        try {
          const payload = (await request.json()) as FindingPayload
          const error = validateCreate(payload)
          if (error) return jsonResponse({ error }, 400)

          const store = getIntelligenceStore()
          const workspace = await store.getWorkspace()
          const doc = workspace.documents.find(
            (row) => row.id === payload.documentId,
          )
          if (!doc) return jsonResponse({ error: 'document not found' }, 404)

          const explicitSegment = payload.segmentId
            ? workspace.segments.find(
                (row) =>
                  row.id === payload.segmentId && row.documentId === doc.id,
              )
            : undefined
          const pageSegment = workspace.segments.find(
            (row) =>
              row.documentId === doc.id &&
              (row.pageStart ?? payload.pageNumber ?? 1) <=
                (payload.pageNumber ?? 1) &&
              (row.pageEnd ?? payload.pageNumber ?? 1) >=
                (payload.pageNumber ?? 1),
          )
          const segment =
            explicitSegment ??
            pageSegment ??
            workspace.segments.find((row) => row.documentId === doc.id)

          const finding: IntelligenceFinding = {
            id: newFindingId(),
            organizationId: doc.organizationId,
            clientId: doc.clientId,
            districtId: doc.districtId,
            projectId: doc.projectId,
            documentId: doc.id,
            segmentId: segment?.id,
            categoryId: doc.categoryId,
            pageNumber: payload.pageNumber ?? 1,
            anchorType: payload.anchorType ?? 'rect',
            normalizedRects: normalizedRects(payload),
            selectedText: payload.selectedText?.trim() || undefined,
            findingType: payload.findingType ?? 'needs_review',
            status: 'open',
            confidence: payload.confidence ?? 'medium',
            label: payload.label?.trim() ?? '',
            rationale: payload.rationale?.trim() ?? '',
            reasonTags: parseTags(payload.reasonTags),
            createdBy: payload.createdBy?.trim() || 'Tim',
            createdAt: new Date().toISOString(),
          }

          const saved = await store.appendFinding(finding)
          return jsonResponse({ finding: saved })
        } catch (err) {
          console.error('[intelligence/findings] failed', err)
          return jsonResponse(
            {
              error: err instanceof Error ? err.message : 'save failed',
            },
            500,
          )
        }
      },
      PATCH: async ({ request }) => {
        if (isIntelligencePreviewOff()) {
          return intelligencePreviewDisabledResponse()
        }
        try {
          const payload = (await request.json()) as FindingPayload
          const error = validateUpdate(payload)
          if (error) return jsonResponse({ error }, 400)

          const store = getIntelligenceStore()
          const saved = await store.updateFinding(
            payload.findingId ?? '',
            updateFromPayload(payload),
          )
          if (!saved) return jsonResponse({ error: 'finding not found' }, 404)
          return jsonResponse({ finding: saved })
        } catch (err) {
          console.error('[intelligence/findings] update failed', err)
          return jsonResponse(
            {
              error: err instanceof Error ? err.message : 'update failed',
            },
            500,
          )
        }
      },
      DELETE: async ({ request }) => {
        if (isIntelligencePreviewOff()) {
          return intelligencePreviewDisabledResponse()
        }
        try {
          const payload = (await request.json()) as FindingPayload
          if (!payload.findingId)
            return jsonResponse({ error: 'missing findingId' }, 400)

          const store = getIntelligenceStore()
          const deleted = await store.deleteFinding(payload.findingId)
          if (!deleted) return jsonResponse({ error: 'finding not found' }, 404)
          return jsonResponse({ ok: true })
        } catch (err) {
          console.error('[intelligence/findings] delete failed', err)
          return jsonResponse(
            {
              error: err instanceof Error ? err.message : 'delete failed',
            },
            500,
          )
        }
      },
    },
  },
})
