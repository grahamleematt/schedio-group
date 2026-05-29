import { createFileRoute } from '@tanstack/react-router'

import {
  intelligencePreviewDisabledResponse,
  isIntelligencePreviewOff,
} from '#/server/preview'
import { getSourceCorpus } from '#/server/determinations/source'
import { getDeterminationStore } from '#/server/determinations/store'
import type {
  DeterminationAssertion,
  DeterminationMethod,
  EvidenceStage,
  TrainingScope,
} from '#/server/determinations/types'

const methodValues = new Set<DeterminationMethod>([
  'SCOPE_INTERPRETATION',
  'PLAT_GEOMETRY',
])

const evidenceStageValues = new Set<EvidenceStage>([
  'ENGINEER_ESTIMATE',
  'PLANNING_DOCUMENT',
  'PRELIMINARY_PLAT',
  'FINAL_PLAT',
  'PLAT_AMENDMENT',
])

const trainingScopeValues = new Set<TrainingScope>([
  'client_filing',
  'client_project',
  'client_global',
  'firm_global',
])

type SubmitPayload = {
  sourceDocumentId?: string
  authorInitials?: string
  scopeLabel?: string
  filingLabel?: string
  platContextId?: string
  pppValue?: number
  method?: DeterminationMethod
  evidenceStage?: EvidenceStage
  trainingScope?: TrainingScope
  rationale?: string
  reasonTags?: string
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function newAssertionId(): string {
  const cryptoRef = (globalThis as { crypto?: { randomUUID?: () => string } })
    .crypto
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return `ppp-${cryptoRef.randomUUID()}`
  }
  return `ppp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function parseReasonTags(input: string | undefined): ReadonlyArray<string> {
  if (!input) return []
  return input
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
}

function validatePayload(payload: SubmitPayload): string | null {
  if (!payload.sourceDocumentId) return 'missing sourceDocumentId'
  if (!payload.scopeLabel?.trim()) return 'missing scopeLabel'
  if (!payload.authorInitials?.trim()) return 'missing authorInitials'
  if (typeof payload.pppValue !== 'number') return 'missing pppValue'
  if (payload.pppValue < 0 || payload.pppValue > 100) {
    return 'pppValue must be between 0 and 100'
  }
  if (!payload.method || !methodValues.has(payload.method)) {
    return 'invalid method'
  }
  if (
    !payload.evidenceStage ||
    !evidenceStageValues.has(payload.evidenceStage)
  ) {
    return 'invalid evidenceStage'
  }
  if (
    !payload.trainingScope ||
    !trainingScopeValues.has(payload.trainingScope)
  ) {
    return 'invalid trainingScope'
  }
  if (!payload.rationale?.trim()) return 'missing rationale'
  return null
}

async function submitDetermination(request: Request): Promise<Response> {
  const payload = (await request.json()) as SubmitPayload
  const error = validatePayload(payload)
  if (error) return jsonResponse({ error }, 400)

  const corpus = await getSourceCorpus()
  const doc = corpus.documents.find(
    (row) => row.id === payload.sourceDocumentId,
  )
  if (!doc) {
    return jsonResponse({ error: 'source document not found' }, 404)
  }

  const assertion: DeterminationAssertion = {
    id: newAssertionId(),
    sourceDocumentId: doc.id,
    sourceEntryPath: doc.entryPath,
    sourceFileName: doc.fileName,
    projectName: 'Dawson Trails',
    districtName: 'Dawson Trails MD1',
    vendorName: doc.vendorName,
    filingLabel: payload.filingLabel?.trim() || doc.filingLabel,
    platContextId: payload.platContextId?.trim() || undefined,
    scopeLabel: payload.scopeLabel?.trim() ?? '',
    pppValue: payload.pppValue ?? 0,
    method: payload.method ?? 'SCOPE_INTERPRETATION',
    evidenceStage: payload.evidenceStage ?? 'ENGINEER_ESTIMATE',
    trainingScope: payload.trainingScope ?? 'client_filing',
    rationale: payload.rationale?.trim() ?? '',
    reasonTags: parseReasonTags(payload.reasonTags),
    authorInitials: payload.authorInitials?.trim().toUpperCase() ?? '',
    createdAt: new Date().toISOString(),
  }

  const saved = await getDeterminationStore().appendAssertion(assertion)
  return jsonResponse({ assertion: saved })
}

export const Route = createFileRoute('/api/determinations')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (isIntelligencePreviewOff()) {
          return intelligencePreviewDisabledResponse()
        }
        try {
          return await submitDetermination(request)
        } catch (err) {
          console.error('[determinations] submit failed', err)
          return jsonResponse(
            { error: err instanceof Error ? err.message : 'submit failed' },
            500,
          )
        }
      },
    },
  },
})
