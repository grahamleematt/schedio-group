-- OPTIONAL — semantic recall (pgvector). NOT applied by `yarn db:intelligence:migrate`.
--
-- The migrate script reads only top-level *.sql files in db/intelligence, so this
-- file is skipped by default. Apply it by hand ONLY when structured + full-text
-- recall (see docs/intelligence-setup.md "Recall v1") proves insufficient for
-- paraphrased scope language and you decide to add vector search.
--
-- Prerequisites:
--   - PostgreSQL 15.2+/16.x (RDS supports pgvector for the master user).
--   - An embedding backfill step that populates intelligence_document_segments.embedding
--     (OpenAI text-embedding-3-large, 3072 dims) after import. No such pipeline
--     ships today — adding this column without a backfill leaves it null.
--
-- Apply with:
--   psql "$DATABASE_URL" -f db/intelligence/optional/005_embeddings.sql

create extension if not exists vector;

alter table intelligence_document_segments
  add column if not exists embedding vector(3072);

-- Approximate-nearest-neighbor index. Build AFTER a backfill so the index has
-- real vectors to train on. cosine distance pairs with normalized embeddings.
create index if not exists intelligence_segments_embedding_idx
  on intelligence_document_segments
  using hnsw (embedding vector_cosine_ops);
