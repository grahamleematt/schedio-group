/**
 * Per-document "Re-run extraction (high effort)".
 *
 * DocuPipe's workflow runs at the workflow-wide effort level (standard, 2
 * credits/page). For the occasional dense or long document that comes back
 * UNK or low-confidence, this server fn escalates just that document to the
 * V3 engine's `effortLevel: 'high'` (4 credits/page) without touching the
 * workflow default:
 *
 * - Document already classified with a mapped schema → fire
 *   `POST /v3/standardize` directly at high effort. The result arrives via
 *   the same `standardization.processed.success` webhook as the workflow.
 * - Document stuck at UNK (or class unmapped) → classification is the
 *   blocker, and classification has no effort knob. We re-run
 *   `POST /classify/batch` and set `pendingEffortLevel: 'high'` on the row;
 *   the webhook's classification handler sees the flag and chains the
 *   high-effort standardization itself (standalone classification does not
 *   auto-chain the way the workflow does).
 */

import { randomUUID } from 'node:crypto'

import { createServerFn } from '@tanstack/react-start'

import { assertInternalClientAccess, resolvePortalUser } from '#/server/authz'
import {
  classifyDocument,
  getClassMap,
  getWorkflow,
  standardizeV3,
} from '#/server/docupipe'
import { isDocupipeConfigured } from '#/server/env'
import { getStore } from '#/server/store'
import type { DreamSnapshot, StoredAuditEvent } from '#/server/store'

export type RerunExtractionResult = {
  ok: boolean
  /** Which escalation path was taken. */
  mode?: 'standardize' | 'classify'
  snapshot: DreamSnapshot | null
  error?: string
}

/**
 * Resolve the DocuPipe schemaId mapped to a docType via the live workflow:
 * classMap gives classId → className, the workflow gives classId → schemaId.
 */
async function schemaIdForDocType(
  docType: string,
): Promise<string | undefined> {
  const [workflow, classMap] = await Promise.all([getWorkflow(), getClassMap()])
  if (!workflow) return undefined
  const classId = Object.entries(classMap).find(
    ([, className]) => className.toUpperCase().trim() === docType,
  )?.[0]
  if (!classId) return undefined
  return workflow.classToSchema[classId]
}

function rerunAuditEvent(input: {
  actor: string
  documentName: string
  clientId: string
  verificationId: string
  documentId: string
  docupipeDocumentId?: string
  mode: 'standardize' | 'classify'
}): StoredAuditEvent {
  return {
    id: randomUUID(),
    ts: new Date().toISOString(),
    source: 'user',
    category: 'documents',
    actor: input.actor,
    event:
      input.mode === 'standardize'
        ? 'Re-run extraction requested (high effort)'
        : 'Re-classification requested (high effort)',
    object: input.documentName,
    result: 'pending',
    clientId: input.clientId,
    verificationId: input.verificationId,
    documentId: input.documentId,
    docupipeDocumentId: input.docupipeDocumentId,
  }
}

export const rerunExtraction = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: { verificationId: string; documentId: string }) => data,
  )
  .handler(async ({ data }): Promise<RerunExtractionResult> => {
    await resolvePortalUser()
    const store = getStore()
    const snapshot = await store.getSnapshot(data.verificationId)
    const doc = snapshot?.verification.documents.find(
      (d) => d.id === data.documentId,
    )
    if (!doc) {
      return { ok: false, snapshot: null, error: 'unknown document' }
    }
    const user = await assertInternalClientAccess(doc.clientId)

    if (!isDocupipeConfigured() || !doc.docupipeDocumentId) {
      return {
        ok: false,
        snapshot,
        error: 'this document has no DocuPipe record to re-run',
      }
    }
    if (doc.status !== 'completed' && doc.status !== 'error') {
      return {
        ok: false,
        snapshot,
        error: 'the document is still processing — wait for it to finish',
      }
    }

    const schemaId =
      doc.docType !== 'UNK' ? await schemaIdForDocType(doc.docType) : undefined

    let mode: 'standardize' | 'classify'
    if (schemaId) {
      const result = await standardizeV3({
        documentId: doc.docupipeDocumentId,
        schemaId,
        effortLevel: 'high',
      })
      mode = 'standardize'
      await store.upsertDocument({
        ...doc,
        updatedAt: new Date().toISOString(),
        status: 'standardizing',
        docupipeJobId: result.jobId,
        errorMessage: undefined,
        pendingEffortLevel: undefined,
      })
    } else {
      // UNK or unmapped class: the classifier is the blocker. Re-classify and
      // let the webhook chain the high-effort standardization via the flag.
      const result = await classifyDocument({
        documentId: doc.docupipeDocumentId,
      })
      mode = 'classify'
      await store.upsertDocument({
        ...doc,
        updatedAt: new Date().toISOString(),
        status: 'classifying',
        docupipeJobId: result.jobId ?? doc.docupipeJobId,
        errorMessage: undefined,
        pendingEffortLevel: 'high',
      })
    }

    try {
      await store.appendAuditEvent(
        rerunAuditEvent({
          actor: user.name,
          documentName: doc.renamedName ?? doc.displayName,
          clientId: doc.clientId,
          verificationId: doc.verificationId,
          documentId: doc.id,
          docupipeDocumentId: doc.docupipeDocumentId,
          mode,
        }),
      )
    } catch (err) {
      console.warn('[rerun extraction] audit write failed', err)
    }

    return { ok: true, mode, snapshot: await store.getSnapshot(data.verificationId) }
  })
