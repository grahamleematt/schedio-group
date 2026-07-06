-- Verification schedule + vendor contract config move from static app config
-- into Postgres so Schedio can manage cycles and authorizations with SQL
-- instead of a redeploy. Mirrors the runtime-additive schema in
-- src/server/store/postgresStore.ts.

alter table dream_verifications
  add column if not exists number integer,
  add column if not exists year integer,
  add column if not exists period text,
  add column if not exists cutoff_date date,
  add column if not exists status text not null default 'open',
  add column if not exists docs_count integer not null default 0,
  add column if not exists costs_submitted numeric not null default 0,
  add column if not exists costs_verified numeric not null default 0,
  add column if not exists ref_seq integer not null default 1;

create table if not exists dream_vendors (
  id text primary key,
  client_id text not null,
  code text not null,
  name text not null,
  authorized numeric not null default 0,
  contract_ref text,
  contract_executed_on date,
  contract_value numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dream_vendors_client_idx
  on dream_vendors (client_id, code);

-- Seed the Dawson verification schedule. `coalesce` keeps any values an
-- operator already set; only null config columns are backfilled.
insert into dream_verifications
  (id, client_id, ref, number, year, period, cutoff_date, status, ref_seq)
values
  ('dawson-trails-md1-v1', 'dawson-trails-md1', 'SGD-DP-V1-2026-0001',
   1, 2026, 'Verification No. 01', '2026-08-03', 'open', 1),
  ('dawson-trails-md1-developer-v1', 'dawson-trails-md1-developer', 'SGD-DR-V1-2026-0001',
   1, 2026, 'Developer Reimbursement No. 01', '2026-08-03', 'open', 1)
on conflict (id) do update set
  number = coalesce(dream_verifications.number, excluded.number),
  year = coalesce(dream_verifications.year, excluded.year),
  period = coalesce(dream_verifications.period, excluded.period),
  cutoff_date = coalesce(dream_verifications.cutoff_date, excluded.cutoff_date),
  updated_at = now();

-- Seed the DT1 vendor contract authorizations. Existing rows are never
-- touched; operators own them after first insert.
insert into dream_vendors
  (id, client_id, code, name, authorized, contract_ref, contract_executed_on, contract_value)
values
  ('dt1-classic', 'dawson-trails-md1', 'CLAS', 'Classic SRJ, LLC',
   1350000, 'MSA-2024-CLAS', '2024-01-12', 1350000),
  ('dt1-wassenaar', 'dawson-trails-md1', 'AGWA', 'A.G. Wassenaar, Inc.',
   850000, 'MSA-2024-AGWA', '2024-03-03', 850000)
on conflict (id) do nothing;
