/**
 * In-app Help & feedback persistence + Slack delivery.
 *
 * Postgres (`dream_feedback`) is the durable record; Slack is a best-effort
 * notification layered on top when `SLACK_FEEDBACK_WEBHOOK_URL` is configured.
 * Both halves degrade independently: without a database the row is skipped,
 * without the webhook Slack is skipped, and the caller still records an audit
 * event so no submission is silently lost.
 */

import { dbQuery } from './database'
import { getSlackFeedbackWebhookUrl, isDatabaseConfigured } from './env'

export type FeedbackCategory = 'bug' | 'idea' | 'question'

export const feedbackCategoryLabels: Record<FeedbackCategory, string> = {
  bug: 'Bug',
  idea: 'Idea',
  question: 'Question',
}

export type FeedbackAttachment = {
  /** Public Vercel Blob URL (unguessable random-suffixed pathname). */
  url: string
  name: string
  contentType?: string
  sizeBytes?: number
}

/**
 * Browser diagnostics captured silently at submit time so bug reports don't
 * need a "what browser are you on?" follow-up.
 */
export type FeedbackContext = {
  userAgent?: string
  /** e.g. "1512x982" */
  viewport?: string
  /** e.g. "3024x1964" */
  screen?: string
  devicePixelRatio?: number
  timezone?: string
}

/** Triage state; updated by the Schedio team (in-app inbox to come). */
export type FeedbackStatus = 'new' | 'in_review' | 'resolved'

export const feedbackStatusLabels: Record<FeedbackStatus, string> = {
  new: 'Received',
  in_review: 'In review',
  resolved: 'Resolved',
}

export type FeedbackRecord = {
  id: string
  userId?: string
  userName: string
  userEmail: string
  clientId?: string
  clientName?: string
  route?: string
  category: FeedbackCategory
  message: string
  attachments?: FeedbackAttachment[]
  context?: FeedbackContext
}

export type FeedbackDelivery = {
  stored: boolean
  slackDelivered: boolean
}

let tableReady: Promise<void> | null = null

/**
 * Self-healing table create (mirrors db/intelligence/009_feedback.sql) so
 * environments that haven't run the migration yet still accept feedback.
 */
async function ensureFeedbackTable(): Promise<void> {
  if (!tableReady) {
    tableReady = dbQuery(`
      create table if not exists dream_feedback (
        id text primary key,
        user_id text,
        user_name text not null,
        user_email text not null,
        client_id text,
        route text,
        category text not null,
        message text not null,
        slack_delivered boolean not null default false,
        attachments jsonb not null default '[]'::jsonb,
        context jsonb not null default '{}'::jsonb,
        status text not null default 'new',
        created_at timestamptz not null default now()
      );

      alter table dream_feedback
        add column if not exists attachments jsonb not null default '[]'::jsonb;
      alter table dream_feedback
        add column if not exists context jsonb not null default '{}'::jsonb;
      alter table dream_feedback
        add column if not exists status text not null default 'new';

      create index if not exists dream_feedback_created_idx
        on dream_feedback (created_at desc);
    `).then(() => undefined)
    tableReady.catch(() => {
      tableReady = null
    })
  }
  await tableReady
}

async function storeFeedbackRow(
  record: FeedbackRecord,
  slackDelivered: boolean,
): Promise<boolean> {
  if (!isDatabaseConfigured()) return false
  try {
    await ensureFeedbackTable()
    await dbQuery(
      `
        insert into dream_feedback
          (id, user_id, user_name, user_email, client_id, route, category,
           message, slack_delivered, attachments, context)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        on conflict (id) do nothing
      `,
      [
        record.id,
        record.userId ?? null,
        record.userName,
        record.userEmail,
        record.clientId ?? null,
        record.route ?? null,
        record.category,
        record.message,
        slackDelivered,
        JSON.stringify(record.attachments ?? []),
        JSON.stringify(record.context ?? {}),
      ],
    )
    return true
  } catch (err) {
    console.warn('[feedback] database write failed', err)
    return false
  }
}

async function postToSlack(record: FeedbackRecord): Promise<boolean> {
  const webhookUrl = getSlackFeedbackWebhookUrl()
  if (!webhookUrl) return false
  const label = feedbackCategoryLabels[record.category]
  const contextLines = [
    `*From:* ${record.userName} (${record.userEmail})`,
    record.clientName ? `*Entity:* ${record.clientName}` : null,
    record.route ? `*Page:* ${record.route}` : null,
  ].filter(Boolean)
  const attachments = record.attachments ?? []
  const attachmentBlocks: Array<Record<string, unknown>> =
    attachments.length === 0
      ? []
      : [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Attachments:* ${attachments
                .map((a) => `<${a.url}|${a.name}>`)
                .join(' · ')}`,
            },
          },
          // Inline previews for image attachments; PDFs stay links above.
          ...attachments
            .filter((a) => a.contentType?.startsWith('image/'))
            .map((a) => ({
              type: 'image',
              image_url: a.url,
              alt_text: a.name,
            })),
        ]
  const diag = record.context
  const diagParts = diag
    ? [
        diag.viewport ? `viewport ${diag.viewport}` : null,
        diag.screen ? `screen ${diag.screen}` : null,
        diag.devicePixelRatio ? `${diag.devicePixelRatio}x` : null,
        diag.timezone ?? null,
        diag.userAgent ?? null,
      ].filter(Boolean)
    : []
  const diagBlocks =
    diagParts.length === 0
      ? []
      : [
          {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: diagParts.join(' · ') }],
          },
        ]
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: `SG DREAM feedback — ${label}: ${record.message.slice(0, 140)}`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `SG DREAM feedback — ${label}`,
              emoji: true,
            },
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: contextLines.join('\n') },
          },
          { type: 'divider' },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: record.message },
          },
          ...attachmentBlocks,
          ...diagBlocks,
        ],
      }),
    })
    if (!response.ok) {
      console.warn('[feedback] slack webhook returned', response.status)
      return false
    }
    return true
  } catch (err) {
    console.warn('[feedback] slack webhook failed', err)
    return false
  }
}

/**
 * Deliver one feedback submission: Slack first (so the stored row can record
 * whether the notification landed), then the durable Postgres row.
 */
export async function recordFeedback(
  record: FeedbackRecord,
): Promise<FeedbackDelivery> {
  const slackDelivered = await postToSlack(record)
  const stored = await storeFeedbackRow(record, slackDelivered)
  return { stored, slackDelivered }
}

export type FeedbackHistoryItem = {
  id: string
  category: FeedbackCategory
  message: string
  status: FeedbackStatus
  createdAtISO: string
}

const STATUSES: ReadonlyArray<FeedbackStatus> = ['new', 'in_review', 'resolved']

/**
 * The current user's recent submissions, newest first, for the dialog's
 * "your recent feedback" list. Empty without a database (degraded mode).
 */
export async function listFeedbackForEmail(
  email: string,
  limit = 5,
): Promise<FeedbackHistoryItem[]> {
  if (!isDatabaseConfigured()) return []
  try {
    await ensureFeedbackTable()
    const { rows } = await dbQuery<{
      id: string
      category: string
      message: string
      status: string
      created_at: string
    }>(
      `
        select id, category, message, status, created_at
        from dream_feedback
        where lower(user_email) = lower($1)
        order by created_at desc
        limit $2
      `,
      [email, limit],
    )
    return rows.map((row) => ({
      id: row.id,
      category: (row.category in feedbackCategoryLabels
        ? row.category
        : 'question') as FeedbackCategory,
      message: row.message,
      status: STATUSES.includes(row.status as FeedbackStatus)
        ? (row.status as FeedbackStatus)
        : 'new',
      createdAtISO: new Date(row.created_at).toISOString(),
    }))
  } catch (err) {
    console.warn('[feedback] history read failed', err)
    return []
  }
}
