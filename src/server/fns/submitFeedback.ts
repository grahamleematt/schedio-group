/**
 * Help & feedback server fn — any signed-in portal user can submit. Persists
 * to Postgres, notifies Slack when configured, and always appends an audit
 * event so a submission is never silently lost even with neither configured.
 */

import { randomUUID } from 'node:crypto'

import { createServerFn } from '@tanstack/react-start'

import { getKnownClientById } from '#/lib/sg-dream'
import { resolvePortalUser } from '#/server/authz'
import {
  feedbackCategoryLabels,
  listFeedbackForEmail,
  recordFeedback,
} from '#/server/feedback'
import type {
  FeedbackAttachment,
  FeedbackCategory,
  FeedbackContext,
  FeedbackHistoryItem,
} from '#/server/feedback'
import { getStore } from '#/server/store'

const CATEGORIES: ReadonlyArray<FeedbackCategory> = ['bug', 'idea', 'question']
const MESSAGE_MAX = 4_000
const MAX_ATTACHMENTS = 3

export type SubmitFeedbackInput = {
  category: FeedbackCategory
  message: string
  clientId?: string
  route?: string
  attachments?: FeedbackAttachment[]
  context?: FeedbackContext
}

function cleanString(value: unknown, max: number): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim().slice(0, max)
    : undefined
}

function validateContext(
  input: FeedbackContext | undefined,
): FeedbackContext | undefined {
  if (!input) return undefined
  const context: FeedbackContext = {
    userAgent: cleanString(input.userAgent, 300),
    viewport: cleanString(input.viewport, 20),
    screen: cleanString(input.screen, 20),
    devicePixelRatio:
      typeof input.devicePixelRatio === 'number' &&
      Number.isFinite(input.devicePixelRatio)
        ? Math.round(input.devicePixelRatio * 100) / 100
        : undefined,
    timezone: cleanString(input.timezone, 60),
  }
  const hasAny =
    context.userAgent !== undefined ||
    context.viewport !== undefined ||
    context.screen !== undefined ||
    context.devicePixelRatio !== undefined ||
    context.timezone !== undefined
  return hasAny ? context : undefined
}

/**
 * Attachments must be URLs of blobs the browser just uploaded through our
 * authenticated `/api/blob-token` route — i.e. hosted on Vercel Blob storage.
 * Anything else (arbitrary links, data URIs) is rejected.
 */
function validateAttachments(
  input: FeedbackAttachment[] | undefined,
): FeedbackAttachment[] | undefined {
  if (!input || input.length === 0) return undefined
  if (input.length > MAX_ATTACHMENTS) {
    throw new Error(`At most ${MAX_ATTACHMENTS} attachments allowed`)
  }
  return input.map((att) => {
    let parsed: URL
    try {
      parsed = new URL(att.url)
    } catch {
      throw new Error('Invalid attachment URL')
    }
    if (
      parsed.protocol !== 'https:' ||
      !parsed.hostname.endsWith('.blob.vercel-storage.com')
    ) {
      throw new Error('Attachments must be uploaded through the portal')
    }
    return {
      url: att.url,
      name:
        typeof att.name === 'string' && att.name.trim().length > 0
          ? att.name.trim().slice(0, 200)
          : 'attachment',
      contentType:
        typeof att.contentType === 'string'
          ? att.contentType.slice(0, 100)
          : undefined,
      sizeBytes:
        typeof att.sizeBytes === 'number' && Number.isFinite(att.sizeBytes)
          ? att.sizeBytes
          : undefined,
    }
  })
}

export type SubmitFeedbackResult =
  | { ok: true }
  | { ok: false; error: string }

export const submitFeedback = createServerFn({ method: 'POST' })
  .inputValidator((data: SubmitFeedbackInput): SubmitFeedbackInput => {
    if (!CATEGORIES.includes(data.category)) {
      throw new Error('Unknown feedback category')
    }
    const message = data.message.trim()
    if (message.length === 0) throw new Error('Feedback message is required')
    return {
      category: data.category,
      message: message.slice(0, MESSAGE_MAX),
      clientId:
        typeof data.clientId === 'string' ? data.clientId.slice(0, 100) : undefined,
      route: typeof data.route === 'string' ? data.route.slice(0, 300) : undefined,
      attachments: validateAttachments(data.attachments),
      context: validateContext(data.context),
    }
  })
  .handler(async ({ data }): Promise<SubmitFeedbackResult> => {
    const user = await resolvePortalUser()
    const client = getKnownClientById(data.clientId)
    const record = {
      id: randomUUID(),
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      clientId: client?.id,
      clientName: client ? `${client.name} (${client.code})` : undefined,
      route: data.route,
      category: data.category,
      message: data.message,
      attachments: data.attachments,
      context: data.context,
    }

    try {
      await recordFeedback(record)
    } catch (err) {
      console.warn('[feedback] delivery failed', err)
      return { ok: false, error: 'Could not send your feedback — try again.' }
    }

    // Best-effort audit trail; the feedback itself already landed above.
    try {
      await getStore().appendAuditEvent({
        id: randomUUID(),
        ts: new Date().toISOString(),
        source: 'user',
        category: 'system',
        actor: user.name,
        event: `Feedback submitted (${feedbackCategoryLabels[data.category]})`,
        object: data.route ?? 'portal',
        result: 'ok',
        clientId: client?.id,
        detail: data.message.slice(0, 200),
      })
    } catch (err) {
      console.warn('[feedback] audit write failed', err)
    }

    return { ok: true }
  })

/**
 * The current user's recent feedback, newest first, so the dialog can show
 * each submission's triage status. Empty in degraded (no-database) mode.
 */
export const listMyFeedback = createServerFn({ method: 'GET' }).handler(
  async (): Promise<FeedbackHistoryItem[]> => {
    const user = await resolvePortalUser()
    return listFeedbackForEmail(user.email)
  },
)
