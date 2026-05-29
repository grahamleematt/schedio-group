insert into intelligence_organizations (id, name)
values ('schedio', 'Schedio Group')
on conflict (id) do update set
  name = excluded.name;

alter table intelligence_clients
  add column if not exists workflow_kind text not null default 'district_direct_pay',
  add column if not exists egnyte_root_path text,
  add column if not exists docupipe_workflow_id text;

insert into intelligence_clients (
  id, organization_id, code, name, workflow_kind, egnyte_root_path
)
values
  (
    'dawson-trails-md1',
    'schedio',
    'DT1',
    'Dawson Trails MD One - District',
    'district_direct_pay',
    '/Shared/Clients/Dawson Trails MD One/District'
  ),
  (
    'dawson-trails-md1-developer',
    'schedio',
    'DTD',
    'Dawson Trails MD One - Developer',
    'developer_reimbursement',
    '/Shared/Clients/Dawson Trails MD One/Developer'
  )
on conflict (id) do update set
  organization_id = excluded.organization_id,
  code = excluded.code,
  name = excluded.name,
  workflow_kind = excluded.workflow_kind,
  egnyte_root_path = excluded.egnyte_root_path;

insert into intelligence_districts (
  id, organization_id, client_id, name, region
)
values (
  'dawson-trails-md1',
  'schedio',
  'dawson-trails-md1',
  'Dawson Trails MD One',
  'Castle Rock, CO'
)
on conflict (id) do update set
  organization_id = excluded.organization_id,
  client_id = excluded.client_id,
  name = excluded.name,
  region = excluded.region;

insert into intelligence_projects (
  id, organization_id, client_id, district_id, name
)
values
  (
    'dawson-trails-district-direct-pay',
    'schedio',
    'dawson-trails-md1',
    'dawson-trails-md1',
    'Dawson Trails District Direct Pay'
  ),
  (
    'dawson-trails-developer-reimbursement',
    'schedio',
    'dawson-trails-md1-developer',
    'dawson-trails-md1',
    'Dawson Trails Developer Reimbursement'
  )
on conflict (id) do update set
  organization_id = excluded.organization_id,
  client_id = excluded.client_id,
  district_id = excluded.district_id,
  name = excluded.name;

create table if not exists intelligence_document_relationships (
  id text primary key,
  organization_id text not null references intelligence_organizations(id),
  source_document_id text not null references intelligence_documents(id) on delete cascade,
  target_document_id text not null references intelligence_documents(id) on delete cascade,
  relationship_type text not null,
  score numeric not null,
  reason text not null,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'suggested',
  created_by text not null,
  created_at timestamptz not null default now(),
  reviewed_by text,
  reviewed_at timestamptz,
  constraint intelligence_relationship_documents_distinct
    check (source_document_id <> target_document_id)
);

create index if not exists intelligence_relationship_source_idx
  on intelligence_document_relationships (organization_id, source_document_id, relationship_type, status);

create index if not exists intelligence_relationship_target_idx
  on intelligence_document_relationships (organization_id, target_document_id, relationship_type, status);

create table if not exists intelligence_relationship_reviews (
  id text primary key,
  organization_id text not null references intelligence_organizations(id),
  relationship_id text not null references intelligence_document_relationships(id) on delete cascade,
  actor text not null,
  decision text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists intelligence_relationship_reviews_idx
  on intelligence_relationship_reviews (organization_id, relationship_id, created_at desc);

insert into intelligence_document_categories (id, label, description, sort_order)
values
  ('work_authorization', 'Work authorizations', 'Authorizations, proposals, and scopes that can drive downstream invoice PPP treatment.', 12),
  ('task_order', 'Task orders', 'Task orders and work orders tied to monthly invoices or pay applications.', 14),
  ('change_order', 'Change orders', 'Approved or pending scope changes that alter authorization value or PPP treatment.', 16),
  ('pay_application', 'Pay applications', 'Pay applications and monthly draw packages.', 42),
  ('proof_of_payment', 'Proofs of payment', 'Proofs of payment, lien waivers, and payment confirmations.', 44),
  ('construction_drawing', 'Construction drawings', 'Drawings and plan sheets used as supporting project context.', 80)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order;
