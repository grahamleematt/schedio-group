create table if not exists dream_store_meta (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists dream_verifications (
  id text primary key,
  client_id text not null,
  ref text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists dream_documents (
  id text primary key,
  client_id text not null,
  verification_id text not null references dream_verifications(id) on delete cascade,
  source_kind text,
  original_name text not null,
  display_name text not null,
  docupipe_document_id text,
  docupipe_job_id text,
  docupipe_standardization_id text,
  renamed_name text,
  doc_type text not null,
  status text not null,
  uploaded_at timestamptz not null,
  updated_at timestamptz not null,
  extracted_fields jsonb,
  duplicate_flag text not null,
  matched_previous_name text,
  matched_verification_ref text,
  error_message text,
  custody_state text,
  egnyte_incoming_path text,
  egnyte_classified_path text,
  egnyte_guid text,
  egnyte_source_path text,
  egnyte_entry_id text,
  egnyte_group_id text,
  egnyte_checksum text,
  egnyte_web_url text,
  mime_type text,
  size_bytes bigint,
  import_job_id text,
  visual_review_url text,
  field_confidence jsonb,
  low_confidence boolean
);

create index if not exists dream_documents_verification_idx
  on dream_documents (verification_id, uploaded_at, id);

create index if not exists dream_documents_docupipe_idx
  on dream_documents (docupipe_document_id)
  where docupipe_document_id is not null;

create index if not exists dream_documents_egnyte_idx
  on dream_documents (client_id, verification_id, egnyte_group_id, egnyte_entry_id)
  where egnyte_group_id is not null;

create table if not exists dream_doc_sequences (
  verification_id text not null references dream_verifications(id) on delete cascade,
  doc_type text not null,
  seq integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (verification_id, doc_type)
);

create table if not exists dream_audit_events (
  id text primary key,
  ts timestamptz not null,
  source text not null,
  category text not null,
  actor text not null,
  event text not null,
  object text not null,
  result text not null,
  ip text,
  client_id text,
  verification_id text,
  document_id text,
  docupipe_document_id text,
  docupipe_event_type text,
  detail text
);

create index if not exists dream_audit_scope_idx
  on dream_audit_events (client_id, verification_id, ts desc);

create table if not exists dream_import_jobs (
  id text primary key,
  client_id text not null,
  verification_id text not null references dream_verifications(id) on delete cascade,
  source_kind text not null default 'egnyte_folder',
  source_path text not null,
  status text not null,
  total_files integer not null default 0,
  imported_files integer not null default 0,
  skipped_files integer not null default 0,
  failed_files integer not null default 0,
  actor text not null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dream_import_jobs_scope_idx
  on dream_import_jobs (client_id, verification_id, created_at desc);

create table if not exists dream_import_files (
  id text primary key,
  job_id text not null references dream_import_jobs(id) on delete cascade,
  document_id text references dream_documents(id) on delete set null,
  egnyte_path text not null,
  egnyte_entry_id text,
  egnyte_group_id text,
  checksum text,
  status text not null,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists dream_import_files_job_idx
  on dream_import_files (job_id, status);
