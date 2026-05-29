# Schedio Intelligence setup

Schedio Intelligence is the standalone learning system for Tim's document
review loop. SG DREAM can consume the outputs, but Intelligence owns imports,
document categories, segmentation, saved learnings, and reuse recommendations.

## Current vertical slice

- `/intelligence` is the standalone workbench.
- `POST /api/intelligence/imports` imports the Dawson Trails source package.
- `GET /api/intelligence/documents` streams imported source files for review.
- PDF documents render through PDF.js with a Schedio finding layer. Tim can
  click or drag a document section, save a finding, then promote that evidence
  into a reusable learning.
- `POST /api/intelligence/findings` saves page-anchored findings with
  normalized rectangles so anchors survive zoom, page size, and viewer changes.
- `POST /api/intelligence/learnings` saves Tim's reusable learning.
- The local fallback store is `.data/intelligence.json` when `DATABASE_URL` is
  not configured.
- When `DATABASE_URL` is configured, the Intelligence store writes to plain
  PostgreSQL.

## Production stack

- Hosting: Vercel staging and production.
- Auth: WorkOS organizations and roles.
- Canonical files: Egnyte.
- Derived data: AWS RDS PostgreSQL (plain Postgres; no extensions required).
- Recall: structured + (future) full-text, in the same RDS database. Semantic
  vector search (`pgvector`) is deferred — see "Recall v1" below.
- Ingestion: user-triggered only. The user clicks **Import from Egnyte**.
- AI: OpenAI for structured reasoning, with model names in env. Embeddings are
  not part of the MVP.

## Environment

```bash
DATABASE_URL=postgres://...
DATABASE_SSL=true

WORKOS_API_KEY=...
WORKOS_CLIENT_ID=...
WORKOS_COOKIE_PASSWORD=...
WORKOS_REDIRECT_URI=https://<vercel-domain>/api/auth/callback

EGNYTE_DOMAIN=...
EGNYTE_CLIENT_ID=...
EGNYTE_CLIENT_SECRET=...
EGNYTE_REFRESH_TOKEN=...
EGNYTE_ROOT_PATH=/Shared/Clients

DOCUPIPE_API_KEY=...
DOCUPIPE_BASE_URL=https://app.docupipe.ai
DOCUPIPE_WORKFLOW_ID=...
DOCUPIPE_WEBHOOK_SECRET=...

OPENAI_API_KEY=...
OPENAI_EMBEDDING_MODEL=text-embedding-3-large
OPENAI_REASONING_MODEL=gpt-5.2
```

## Database

Run the migration against AWS RDS:

```bash
yarn db:intelligence:migrate
```

The initial schema creates:

- organization/client/district/project scope tables
- imports
- document categories
- documents
- DocuPipe runs
- document segments (no embedding column in the MVP; deferred to
  `db/intelligence/optional/005_embeddings.sql`)
- page-anchored findings
- learnings
- persisted document relationships and accept/reject reviews
- AI runs
- recommendations
- audit events

## Recall v1 (no vectors)

The point of the workbench is to capture Tim's PPP determinations and then
re-surface relevant precedent when he reviews a similar document. The MVP does
this with **structured matching only** — no embeddings:

- Every learning is scoped (`client_id`, `district_id`, `project_id`,
  `category_id`) and carries `vendor`/`filing` context via its source document.
- `buildRecommendations()` in `src/server/intelligence/store.ts` scores each
  open segment against saved learnings by category match, then boosts on
  project → district → client → vendor → filing overlap. That is the recall
  engine; it runs in both the local and Postgres stores with identical logic.

This covers the bulk of what Tim described, because PPP scope language is
"95% cookie cutter" and a lot of the rules are vendor/keyword driven
(e.g. street lighting → 100%, private electrical → 0%).

**Planned v1.1 (still no vectors):** add a Postgres `tsvector` column + GIN
index over segment `title`/`summary` and `pg_trgm` for near-duplicate scope
text, so recall ranks on lexical similarity in-database. This is a small,
additive migration when needed.

**Only if v1.1 is insufficient:** enable `pgvector` via
`db/intelligence/optional/005_embeddings.sql` and add an embedding backfill.
Same database, same tables — no architectural change.

## Vercel review readiness

Before sending a preview link to Tim, confirm:

1. The Vercel project Node.js version is `22.x`.
2. Preview and production have `DATABASE_URL` and `DATABASE_SSL` configured.
3. The database migration has been run against the target AWS RDS database.
4. The Dawson source files are available from a deployed source, preferably
   Egnyte. The local `SG_DREAM_SOURCE_ZIP` adapter is only for local review.
5. `Import from Egnyte` imports into Postgres and `GET /api/intelligence/documents`
   can stream the selected PDF in the deployed environment.
6. WorkOS AuthKit is configured with:
   - redirect URI: `https://<vercel-domain>/api/auth/callback`
   - sign-in endpoint: `https://<vercel-domain>/api/auth/sign-in`
   - sign-out redirect: `https://<vercel-domain>/login`

## Next hardening pass

1. Replace the local Dawson zip import adapter with direct Egnyte folder import.
2. Persist DocuPipe classification and standardization runs into
   `intelligence_docupipe_runs`.
3. Add Postgres full-text (`tsvector`) + `pg_trgm` recall ranking (Recall v1.1).
   Embeddings/pgvector remain deferred and optional (see "Recall v1").
4. Add role checks around `/intelligence` once WorkOS org roles are finalized.
5. Add explicit approval events when Tim accepts or rejects an apply suggestion.
6. Add text selection anchors and PDF annotation export when we need shareable
   marked-up copies outside Schedio.
