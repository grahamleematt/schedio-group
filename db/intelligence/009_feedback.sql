-- In-app Help & feedback.
--
-- Every submission from the portal's feedback dialog is persisted here, and
-- additionally posted to Slack when SLACK_FEEDBACK_WEBHOOK_URL is configured.
-- The table is the durable record; Slack is the notification channel.

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
  -- [{ url, name, contentType?, sizeBytes? }] — public Vercel Blob URLs for
  -- screenshots/files attached in the feedback dialog.
  attachments jsonb not null default '[]'::jsonb,
  -- Browser diagnostics captured silently at submit (userAgent, viewport,
  -- screen, devicePixelRatio, timezone).
  context jsonb not null default '{}'::jsonb,
  -- Triage state shown back to the submitter: new | in_review | resolved.
  status text not null default 'new',
  created_at timestamptz not null default now()
);

-- Additive for environments where the table predates these columns.
alter table dream_feedback
  add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table dream_feedback
  add column if not exists context jsonb not null default '{}'::jsonb;
alter table dream_feedback
  add column if not exists status text not null default 'new';

create index if not exists dream_feedback_created_idx
  on dream_feedback (created_at desc);
