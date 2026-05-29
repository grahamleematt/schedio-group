-- Semantic search (pgvector) is intentionally NOT part of the MVP schema.
-- The live recall path is structured-only (class + scope + vendor + filing),
-- so plain PostgreSQL on any recent version is sufficient. The deferred
-- embedding column + extension live in db/intelligence/optional/005_embeddings.sql
-- and are applied manually only if/when lexical recall proves insufficient.

create table if not exists intelligence_organizations (
  id text primary key,
  name text not null,
  workos_org_id text,
  created_at timestamptz not null default now()
);

create table if not exists intelligence_clients (
  id text primary key,
  organization_id text not null references intelligence_organizations(id),
  code text not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists intelligence_districts (
  id text primary key,
  organization_id text not null references intelligence_organizations(id),
  client_id text not null references intelligence_clients(id),
  name text not null,
  region text,
  created_at timestamptz not null default now()
);

create table if not exists intelligence_projects (
  id text primary key,
  organization_id text not null references intelligence_organizations(id),
  client_id text not null references intelligence_clients(id),
  district_id text references intelligence_districts(id),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists intelligence_imports (
  id text primary key,
  organization_id text not null references intelligence_organizations(id),
  client_id text not null references intelligence_clients(id),
  district_id text references intelligence_districts(id),
  project_id text references intelligence_projects(id),
  source_kind text not null,
  source_label text not null,
  source_uri text not null,
  status text not null,
  document_count integer not null default 0,
  segment_count integer not null default 0,
  imported_by text not null,
  imported_at timestamptz not null default now()
);

create table if not exists intelligence_document_categories (
  id text primary key,
  label text not null,
  description text not null,
  sort_order integer not null default 0
);

create table if not exists intelligence_documents (
  id text primary key,
  organization_id text not null references intelligence_organizations(id),
  client_id text not null references intelligence_clients(id),
  district_id text references intelligence_districts(id),
  project_id text references intelligence_projects(id),
  import_id text references intelligence_imports(id),
  category_id text not null references intelligence_document_categories(id),
  source_document_id text,
  canonical_file_uri text not null,
  file_name text not null,
  mime_type text not null,
  title text not null,
  vendor_name text,
  filing_label text,
  ppp_percent numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists intelligence_documents_scope_idx
  on intelligence_documents (organization_id, client_id, district_id, project_id, category_id);

create table if not exists intelligence_docupipe_runs (
  id text primary key,
  organization_id text not null references intelligence_organizations(id),
  document_id text not null references intelligence_documents(id),
  docupipe_document_id text,
  docupipe_standardization_id text,
  class_name text,
  extracted_fields jsonb not null default '{}'::jsonb,
  field_confidence jsonb not null default '{}'::jsonb,
  status text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists intelligence_document_segments (
  id text primary key,
  organization_id text not null references intelligence_organizations(id),
  document_id text not null references intelligence_documents(id),
  category_id text not null references intelligence_document_categories(id),
  segment_type text not null,
  title text not null,
  summary text not null,
  page_start integer,
  page_end integer,
  extracted_facts jsonb not null default '{}'::jsonb,
  -- embedding column deferred; see db/intelligence/optional/005_embeddings.sql
  created_at timestamptz not null default now()
);

create index if not exists intelligence_segments_scope_idx
  on intelligence_document_segments (organization_id, document_id, category_id, segment_type);

create table if not exists intelligence_learnings (
  id text primary key,
  organization_id text not null references intelligence_organizations(id),
  client_id text references intelligence_clients(id),
  district_id text references intelligence_districts(id),
  project_id text references intelligence_projects(id),
  document_id text references intelligence_documents(id),
  segment_id text references intelligence_document_segments(id),
  category_id text not null references intelligence_document_categories(id),
  label text not null,
  determination text not null,
  ppp_value numeric,
  applicability text not null,
  confidence text not null,
  rationale text not null,
  reason_tags text[] not null default '{}',
  evidence jsonb not null default '{}'::jsonb,
  created_by text not null,
  created_at timestamptz not null default now(),
  supersedes_id text references intelligence_learnings(id)
);

create index if not exists intelligence_learnings_scope_idx
  on intelligence_learnings (organization_id, client_id, district_id, project_id, category_id, applicability);

create table if not exists intelligence_findings (
  id text primary key,
  organization_id text not null references intelligence_organizations(id),
  client_id text references intelligence_clients(id),
  district_id text references intelligence_districts(id),
  project_id text references intelligence_projects(id),
  document_id text not null references intelligence_documents(id),
  segment_id text references intelligence_document_segments(id),
  category_id text not null references intelligence_document_categories(id),
  page_number integer not null,
  anchor_type text not null,
  normalized_rects jsonb not null default '[]'::jsonb,
  selected_text text,
  finding_type text not null,
  status text not null default 'open',
  confidence text not null,
  label text not null,
  rationale text not null,
  reason_tags text[] not null default '{}',
  created_by text not null,
  created_at timestamptz not null default now(),
  linked_learning_id text references intelligence_learnings(id)
);

create index if not exists intelligence_findings_document_idx
  on intelligence_findings (organization_id, document_id, page_number, status);

create index if not exists intelligence_findings_scope_idx
  on intelligence_findings (organization_id, client_id, district_id, project_id, category_id, status);

create table if not exists intelligence_runs (
  id text primary key,
  organization_id text not null references intelligence_organizations(id),
  client_id text references intelligence_clients(id),
  district_id text references intelligence_districts(id),
  project_id text references intelligence_projects(id),
  run_type text not null,
  status text not null,
  model text,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  created_by text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists intelligence_recommendations (
  id text primary key,
  organization_id text not null references intelligence_organizations(id),
  run_id text references intelligence_runs(id),
  target_segment_id text not null references intelligence_document_segments(id),
  learning_id text references intelligence_learnings(id),
  recommendation text not null,
  score numeric not null,
  rationale text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists intelligence_audit_events (
  id text primary key,
  organization_id text not null references intelligence_organizations(id),
  actor text not null,
  event text not null,
  object_type text not null,
  object_id text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into intelligence_document_categories (id, label, description, sort_order)
values
  ('contract', 'Contracts', 'Executed agreements, task orders, amendments, and marked-up scope materials.', 10),
  ('work_authorization', 'Work authorizations', 'Authorizations, proposals, and scopes that can drive downstream invoice PPP treatment.', 12),
  ('task_order', 'Task orders', 'Task orders and work orders tied to monthly invoices or pay applications.', 14),
  ('change_order', 'Change orders', 'Approved or pending scope changes that alter authorization value or PPP treatment.', 16),
  ('plat', 'Plats', 'Land survey plats, preliminary plats, final plats, and plat amendments.', 20),
  ('pdp', 'PDPs', 'Planned development plans and planning exhibits.', 30),
  ('invoice', 'Invoices', 'Invoices, pay applications, and cost support.', 40),
  ('pay_application', 'Pay applications', 'Pay applications and monthly draw packages.', 42),
  ('proof_of_payment', 'Proofs of payment', 'Proofs of payment, lien waivers, and payment confirmations.', 44),
  ('report', 'Reports', 'Engineer reports, cost reports, and narrative support.', 50),
  ('governance', 'Governance', 'Policy, authorization, constitution, and internal review materials.', 60),
  ('workbook', 'Workbooks', 'Verification workbooks and structured schedule data.', 70),
  ('construction_drawing', 'Construction drawings', 'Drawings and plan sheets used as supporting project context.', 80),
  ('unknown', 'Uncategorized', 'Documents awaiting classification.', 999)
on conflict (id) do update
set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order;
