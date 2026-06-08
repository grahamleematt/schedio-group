-- Per-user Egnyte connections.
--
-- Each portal user (intelligence_users) can link their own Egnyte account via
-- the Resource Owner Password flow. We store only the long-lived refresh token,
-- encrypted at rest (AES-256-GCM via src/server/crypto.ts) — never the password,
-- and never the short-lived access token (cached in memory per request).
--
-- Interactive Egnyte file operations run as the connecting user; background and
-- webhook flows do not yet use these tokens.

create table if not exists intelligence_user_egnyte_connections (
  user_id text primary key references intelligence_users(id) on delete cascade,
  egnyte_domain text not null,
  egnyte_user_id text,
  egnyte_username text not null,
  refresh_token_encrypted text not null,
  scope text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_verified_at timestamptz
);
