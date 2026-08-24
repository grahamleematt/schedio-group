-- Schedio-issued deliverables (cost verification reports, engineer letters)
-- published TO a client entity — the reverse direction from dream_documents,
-- which holds client-submitted intake files. Kept as its own table rather
-- than a discriminator column on dream_documents because issued files skip
-- the entire intake pipeline (no DocuPipe, no custody states, no cycles of
-- processing status) and their bytes live durably on Vercel Blob.
create table if not exists dream_issued_documents (
  id text primary key,
  client_id text not null,
  -- Optional link to the review cycle the deliverable covers.
  verification_id text,
  title text not null,
  note text,
  file_url text not null,
  file_name text not null,
  content_type text,
  size_bytes bigint,
  issued_by_name text not null,
  issued_by_email text not null,
  created_at timestamptz not null default now()
);

create index if not exists dream_issued_documents_client_idx
  on dream_issued_documents (client_id, created_at desc);
