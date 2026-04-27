# DocuPipe alignment + sync

The DocuPipe workspace is provisioned from a typed spec in code, not by
clicking around the portal. One file declares intent; one script enforces
it; the runtime webhook always reads the _live_ state. This document
describes the moving parts.

## TL;DR

```bash
yarn check:docupipe                # readonly drift report; exits non-zero on FAIL
yarn sync:docupipe                 # additive-only: create missing items
yarn sync:docupipe --dry-run       # preview the plan, write nothing
yarn sync:docupipe --allow-update  # also overwrite drifted classes/schemas
yarn sync:docupipe --register-webhook=https://abc.ngrok-free.dev/api/docupipe/webhook
```

## Architecture

```
src/server/docupipe-spec.ts ─┐                            ┌─ src/server/docupipe.ts
       (intent)              │                            │       (live reads)
                             ▼                            ▲
                  scripts/docupipe/align.ts ──writes──► DocuPipe API ──reads──► webhook handler
                       (check / sync)                                          (runtime)
```

- `docupipe-spec.ts` is the **single source of truth** for what classes,
  schemas, and workflow mappings the SG DREAM app expects.
- `align.ts` reconciles the live workspace against the spec. It _only_
  writes; the runtime never imports it.
- The webhook handler always pulls live state via cached `getClassMap()` /
  `getWorkflow()`. This means a stale spec can never poison runtime
  decisions — it can only cause the alignment check to report drift on the
  next run.

## What lives in the spec

[`src/server/docupipe-spec.ts`](../src/server/docupipe-spec.ts) exports a
single constant `SG_DREAM_DOCUPIPE_SPEC` with four sections:

- **`classes`** — eight `DocType` entries (`INV`, `PA`, `CTR`, `TO`, `CO`,
  `POP`, `LSP`, `CD`), each with a description that DocuPipe uses to
  classify documents.
- **`schemas`** — two JSON-Schema bodies plus the list of class names each
  one is mapped to in the workflow:
  - `SG DREAM INV` — invoice-tailored, mapped to `INV` only.
  - `SG DREAM Universal` — the 9 fields the app reads from
    `ExtractedFields`, with per-class hints baked into each field's
    `description`. Mapped to `CTR`, `TO`, `CO`, `PA`, `POP`, `LSP`, `CD`.
- **`workflow`** — name, step type (`classifyStandardize`), and DocuPipe
  engine knobs.
- **`webhookEvents`** — the six Svix events the handler knows how to act
  on.

### Why two schemas?

The SG DREAM examples folder contains 281 documents in the green flow:

| DocType  | Count | % of corpus |
| -------- | ----- | ----------- |
| INV      | 233   | 83%         |
| TO       | 33    | 12%         |
| PA       | 6     | 2%          |
| CTR      | 3     | 1%          |
| CO       | 3     | 1%          |
| POP      | 2     | 1%          |
| LSP / CD | 0     | 0%          |

INV's volume justifies a tailored schema; the long tail does not. The
universal schema covers the remaining seven cleanly because the app only
ever consumes nine fields downstream regardless of doc type. Per-class
behavior is encoded in field `description`s — the only mechanism that
DocuPipe's standardization engine respects under a shared schema.

## What `check` does

`yarn check:docupipe` reads the live workspace via DocuPipe's REST API and
diffs it against the spec. Each finding has a severity:

- `[PASS]` — live matches spec.
- `[WARN]` — drift that's recoverable but cosmetic (e.g. a schema has
  extra fields the app doesn't read). `check` exits 0 but flags it.
- `[FAIL]` — structural gap (missing class, missing schema, missing
  workflow mapping). `check` exits 1 so it can gate CI.
- `[INFO]` — informational (deferred work, webhook reminders).

## What `sync` does

By default, `sync` is **additive only**. It will:

- Create missing classes via `POST /class`.
- Create missing schemas via `POST /schema`.
- Patch the workflow's `classToSchema` map via
  `POST /workflow/{id}/update`. Existing entries are merged, never deleted
  — even if the corresponding class has been removed from the spec.

It will **not**, without explicit flags:

- Overwrite a class description or schema body that has drifted (use
  `--allow-update`).
- Delete remote items that are no longer in the spec (no `--prune` flag
  exists today; intentionally — too risky to bake in).
- Register a webhook endpoint (use `--register-webhook=<url>` — ngrok
  URLs change per session, so opt-in keeps the typical run from hitting
  Svix).

The script runs in two phases when needed: structural changes
(classes, schemas) are applied first, then the workflow plan is
**recomputed against the now-updated live state** before being applied.
This is what makes a single `yarn sync:docupipe` enough to provision a
brand-new universal schema _and_ point the seven non-INV classes at it
in one invocation.

## Updating the spec

When SG DREAM gains a new doc type or a schema needs a new field:

1. Edit [`src/server/docupipe-spec.ts`](../src/server/docupipe-spec.ts).
2. Run `yarn sync:docupipe --dry-run` to preview the plan.
3. Run `yarn sync:docupipe` (or with `--allow-update` if you're modifying
   an existing schema rather than adding fields).
4. Run `yarn check:docupipe` to confirm `aligned. no drift detected.`
5. The webhook's `DOC_TYPES` enum is derived from
   `SG_DREAM_DOCUPIPE_SPEC.classes`, so the runtime side picks up new
   types automatically on the next reload — no separate edit needed.

## When the spec and live state disagree on purpose

Sometimes you'll deliberately let drift exist (e.g. the live INV schema
has two extra fields — `po_number`, `line_item_count` — kept because
DocuPipe's AI uses them as helpful context even though the app doesn't
render them). In those cases the diff returns `[WARN]`, the check still
exits 0, and you take no action. If you want to actively clean up the
drift, pass `--allow-update`.

## Out of scope

- Schemas tailored per-class beyond INV + Universal (corpus volume
  doesn't justify the maintenance cost).
- Auto-deletion of remote items not in spec (would silently destroy
  hand-tuned configuration during a typo).
- Webhook endpoint enumeration (DocuPipe doesn't expose a list endpoint
  via API; check the Svix portal).
- Migrating the existing INV schema to drop unused fields (additive-only
  respects what's there; flagged as WARN).
