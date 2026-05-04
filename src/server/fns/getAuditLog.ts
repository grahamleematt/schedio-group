/**
 * Read audit events for a single client. Live events flow in from the
 * DocuPipe webhook (see `emitAuditEvents` in
 * `src/routes/api/docupipe/webhook.ts`). The mock auth + access events
 * from `src/lib/sg-dream.ts` are appended as historical fixtures so the
 * /audit screen reads as a populated ledger even when the user hasn't
 * exercised the full pipeline yet.
 */

import { createServerFn } from '@tanstack/react-start'

import { auditEvents as mockAuditEvents } from '#/lib/sg-dream'
import type { AuditEvent as MockAuditEvent } from '#/lib/sg-dream'
import { getStore } from '#/server/store'
import type { StoredAuditEvent } from '#/server/store'

export type AuditLogEntry = {
  id: string
  ts: string
  /** Pretty time label (`MMM dd · HH:mm`) for the table cell. */
  timeLabel: string
  source: 'docupipe' | 'egnyte' | 'system' | 'user'
  category: 'auth' | 'documents' | 'verifications' | 'access' | 'system'
  actor: string
  event: string
  object: string
  result: 'ok' | 'override' | 'flagged' | 'pending' | 'failed'
  ip?: string
  detail?: string
  docupipeEventType?: string
  documentId?: string
  verificationId?: string
}

const TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Denver',
})

function formatTimeLabel(iso: string): string {
  try {
    const parts = TIME_FORMATTER.formatToParts(new Date(iso))
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
    return `${get('month')} ${get('day')} · ${get('hour')}:${get('minute')}`
  } catch {
    return iso
  }
}

function adaptStored(row: StoredAuditEvent): AuditLogEntry {
  return {
    id: row.id,
    ts: row.ts,
    timeLabel: formatTimeLabel(row.ts),
    source: row.source,
    category: row.category,
    actor: row.actor,
    event: row.event,
    object: row.object,
    result: row.result,
    ip: row.ip,
    detail: row.detail,
    docupipeEventType: row.docupipeEventType,
    documentId: row.documentId,
    verificationId: row.verificationId,
  }
}

/**
 * Adapt the legacy mock fixtures into the same row shape so the table
 * doesn't have to branch. We keep them clearly labelled as `system` source
 * so anyone tracing a row in the UI knows it predates the live store.
 */
function adaptMock(row: MockAuditEvent): AuditLogEntry {
  return {
    id: row.id,
    ts: row.id,
    timeLabel: row.timeLabel,
    source: 'system',
    category: row.category,
    actor: row.actor,
    event: row.event,
    object: row.object,
    result: row.result,
    ip: row.ip,
  }
}

export const getAuditLog = createServerFn({ method: 'GET' })
  .inputValidator(
    (data: { clientId?: string; limit?: number } | undefined) => data ?? {},
  )
  .handler(async ({ data }): Promise<ReadonlyArray<AuditLogEntry>> => {
    const store = getStore()
    const live = await store.listAuditEvents({
      clientId: data.clientId,
      limit: data.limit ?? 200,
    })
    const mock: ReadonlyArray<AuditLogEntry> = mockAuditEvents
      .filter(
        (e) =>
          (e.category === 'auth' || e.category === 'access') &&
          (!data.clientId || e.clientId === data.clientId),
      )
      .map(adaptMock)
    const adaptedLive = live.map(adaptStored)
    return [...adaptedLive, ...mock]
  })
