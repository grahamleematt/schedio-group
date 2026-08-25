# Schedio Group AI

SG DREAM — the Schedio Group Document Review, Evaluation, and Monitoring client portal. A live TanStack Start app where an entity owner signs in through WorkOS, picks an entity, and submits verification documents. Files are staged in Egnyte, extracted and classified by DocuPipe, and tracked in Postgres; the dashboard shows live intake state (documents, extracted dollars, categories, duplicate flags, processing status).

## Commands

```bash
yarn install
yarn dev                        # vite dev server on :3000
yarn test                       # vitest
yarn lint                       # eslint
yarn format                     # prettier --check
yarn build                      # production build (Nitro / Vercel preset)

yarn db:intelligence:migrate    # run db/intelligence/*.sql against DATABASE_URL
yarn db:intelligence:preflight  # verify database readiness
yarn check:docupipe             # diff local DocuPipe spec against the live workspace
yarn sync:docupipe              # push the local DocuPipe spec to the live workspace
yarn egnyte:mint-refresh-token  # interactive helper for the shared Egnyte token
```

Server scripts read env from `.env.local` via `tsx --env-file`.

## How the intake flow works

1. The user signs in through WorkOS (`/api/auth/*`). Postgres maps their WorkOS identity to permitted entities.
2. `/clients` lists only the entities that user can access; selection carries through the flow as `?client=`.
3. `/upload` accepts drag-and-drop files (large files go browser → Vercel Blob → server) or an Egnyte folder import.
4. The server stages each file in the entity's Egnyte intake folder, then posts it to DocuPipe for extraction and classification. DocuPipe calls back on `/api/docupipe/webhook`.
5. `/processing`, `/confirmation`, and `/dashboard` show live state from Postgres: standardized names, categories, extracted dollars, duplicate flags, and audit events. In-flight verifications poll every 2 seconds via React Query.

## Route map

- `/login` — WorkOS sign-in entry. `/` redirects here.
- `/clients` — entity picker, scoped to the signed-in user's access.
- `/verifications` — open verification card plus history for the selected entity.
- `/upload` → `/processing` → `/confirmation` — the three intake touch points.
- `/dashboard` — verification card, document inventory, summary table, contract tracking, document library, next steps.
- `/library`, `/contracts`, `/audit`, `/users`, `/settings` — supporting portal surfaces. Settings includes the per-user Egnyte connection flow.
- `/intelligence`, `/intelligence/relationships`, `/determinations` — internal Schedio surfaces, hidden unless `INTELLIGENCE_PREVIEW_ENABLED=true`.
- `/blocked` — shown to authenticated users with no entity access.

## Data layer

`src/server/store/index.ts` selects the store at first access:

- **Postgres** when `DATABASE_URL` is set — the real path. Schema lives in `db/intelligence/*.sql`; the store also ensures schema and seeds idempotently at init.
- **Vercel KV** as a legacy preview fallback, **JSON file** (`.data/dream.json`) for local dev without a database, **memory** as a last resort on Vercel.
- `SG_DREAM_STRICT_MODE=true` fails closed: Postgres and WorkOS become required and fallbacks are refused.

Verification schedules and vendor contract data are also database-driven (`dream_verifications`, `dream_vendors`, migration `006`). The server loads them in `src/server/portalConfig.ts` and exposes them through the `getPortalConfig` server function / `portalConfigQuery`; static defaults in `src/lib/sg-dream.ts` act only as seeds and no-database fallbacks. "Days until cutoff" is computed from the real date in `America/Denver` — there is no frozen mock clock. Editing a cutoff or adding a verification is a database row change, not a deploy.

## Environment

Grouped by integration (see `src/server/env.ts` for the full reader):

- **Database**: `DATABASE_URL`, `DATABASE_SSL`
- **WorkOS**: `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_COOKIE_PASSWORD`, `WORKOS_REDIRECT_URI`
- **Egnyte**: `EGNYTE_DOMAIN`, `EGNYTE_CLIENT_ID`, `EGNYTE_CLIENT_SECRET`, `EGNYTE_REFRESH_TOKEN`, `EGNYTE_ROOT_PATH`, `EGNYTE_TOKEN_ENC_KEY`
- **DocuPipe**: `DOCUPIPE_API_KEY`, `DOCUPIPE_WORKFLOW_ID`, `DOCUPIPE_WEBHOOK_SECRET`, `DOCUPIPE_BASE_URL`
- **Uploads**: `BLOB_READ_WRITE_TOKEN` (Vercel Blob, for files over the ~4.5 MB serverless body cap)
- **Flags**: `SG_DREAM_STRICT_MODE`, `INTAKE_PIPELINE_ENABLED` (master switch for real Egnyte/DocuPipe calls), `INTELLIGENCE_PREVIEW_ENABLED`

Every integration degrades gracefully when unconfigured (outside strict mode), so `yarn dev` works with an empty env for UI work.

## Stack

- TanStack Start + TanStack Router (file routes, loaders, server functions)
- React 19 + React Query
- Postgres (`pg`), WorkOS AuthKit, Egnyte, DocuPipe, Vercel Blob
- Tailwind CSS v4 + shadcn/ui primitives
- TypeScript, Vitest, Nitro (Vercel preset)

## Design notes

- Base tokens and shared primitives (`.page-wrap`, `.brand-panel`, `.nav-pill`, `.data-table-*`) live in `src/styles.css`. Workflow theming is driven by `data-workflow="district_dp" | "developer_reimb"` rebinding `--wf-*` variables — green for District Direct Pay, blue for Developer Reimbursement.
- No component-level `useEffect`. State is URL-driven, loader/query-driven, or derived.
- Portal components live under `src/components/sg-dream/`, shadcn primitives under `src/components/ui/`.

## Docs

- [docs/mockup-brief.md](./docs/mockup-brief.md) — customer intake brief (current product scope)
- [docs/scenario-matrix.md](./docs/scenario-matrix.md) — current review scope: Tim McCarley, Dawson Trails entities
- [docs/brand-system.md](./docs/brand-system.md) — token map and visual language
- [docs/workos-setup.md](./docs/workos-setup.md), [docs/egnyte-setup.md](./docs/egnyte-setup.md), [docs/docupipe-setup.md](./docs/docupipe-setup.md), [docs/intelligence-setup.md](./docs/intelligence-setup.md) — integration setup
- [docs/determination-pipeline.md](./docs/determination-pipeline.md), [docs/docupipe-alignment.md](./docs/docupipe-alignment.md) — internal pipelines
- [docs/agent-instruction-map.md](./docs/agent-instruction-map.md) — how agent rules stay in sync

## Agent instructions

- Cursor is the canonical source of truth for repo-local rules and skills.
- Claude and Codex have mirrored rule and skill folders; edit `.cursor` first, then keep `.claude` and `.codex` aligned.

Entry points: `./.cursor/rules/director.mdc`, `./CLAUDE.md`, `./AGENTS.md`
