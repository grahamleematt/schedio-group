-- Submission finalize / lock.
--
-- Clients finalize a draft submission from the portal: the open verification
-- moves to `under_review`, its documents' custody moves to the reserved
-- `locked` state, and these columns record who finalized it and when. A
-- reopen (allowed for clients until the cutoff, and for Schedio staff at any
-- time before approval) clears them and returns the cycle to `open`.
--
-- Mirrors the additive alter in postgresStore.ts `ensureSchema()`.

alter table dream_verifications
  add column if not exists submitted_at timestamptz,
  add column if not exists submitted_by text;
