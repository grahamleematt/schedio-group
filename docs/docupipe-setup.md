# DocuPipe setup for SG DREAM (testing stage)

Reproducible checklist for getting one DocuPipe account wired to the District
Direct Pay green flow (`/upload → /processing → /confirmation → /dashboard`).
All steps happen in the DocuPipe dashboard and the repo's `.env.local`; the app
never holds an API key client-side.

## 1. Account + API key

1. Sign in at <https://app.docupipe.ai> (create account if needed).
2. **Settings → API Keys →** generate a new key, label it `sg-dream-dev`.
3. Copy the key into `.env.local`:

   ```bash
   DOCUPIPE_API_KEY=sk_...
   DOCUPIPE_BASE_URL=https://app.docupipe.ai
   ```

> The app reads both at boot through `src/server/env.ts`. Missing values throw
> before the first request is served.

## 2. Classes, schemas, and workflow — provisioned by `yarn sync:docupipe`

The full DocuPipe configuration (8 classes, 2 schemas, 1 workflow with
`classToSchema` mappings) is now described in code at
[`src/server/docupipe-spec.ts`](../src/server/docupipe-spec.ts) and
applied by a script.

```bash
yarn check:docupipe                # readonly drift report; non-zero on FAIL
yarn sync:docupipe                 # additive-only; creates anything missing
yarn sync:docupipe --dry-run       # preview the change set, write nothing
yarn sync:docupipe --allow-update  # also overwrite drifted classes/schemas
yarn sync:docupipe --register-webhook=https://abc.ngrok-free.dev/api/docupipe/webhook
```

**First-time setup** (cold workspace):

1. Manually create the workflow (the `POST /workflow/on-submit-document` call
   is opt-in for safety; see [docs/docupipe-alignment.md](./docupipe-alignment.md)
   for the rationale). Name it `SG DREAM Ingest`. You can leave the
   classifier and standardization steps empty for now.
2. Copy the workflow ID into `.env.local` as `DOCUPIPE_WORKFLOW_ID`.
3. Run `yarn sync:docupipe`. It will:
   - Create any of the 8 classes that are missing (`INV`, `PA`, `CTR`, `TO`,
     `CO`, `POP`, `LSP`, `CD`) using the descriptions in the spec file.
   - Create the two schemas (`SG DREAM INV` for invoices, `SG DREAM Universal`
     for the other 7 doc types).
   - Patch the workflow's `classToSchema` map so every class points at its
     schema. Existing entries are never deleted, only added.
4. Run `yarn check:docupipe` — should report `aligned. no drift detected.`

**Adding or renaming a class / schema later:** edit
`src/server/docupipe-spec.ts`, then re-run `yarn sync:docupipe`. The webhook
handler's `DOC_TYPES` enum is derived from the spec, so the runtime side
updates automatically on the next reload.

> **Why two schemas instead of nine?** `INV` is 83% of corpus volume, so it
> earns a tailored schema with invoice-specific fields. The remaining seven
> doc types share a Universal schema that maps cleanly onto the 9
> `ExtractedFields` the app actually reads from
> [`src/server/store/types.ts`](../src/server/store/types.ts), with per-class
> extraction hints baked into each field's `description`. See
> [docs/docupipe-alignment.md](./docupipe-alignment.md#why-two-schemas) for
> the full rationale.

> **Note on low-confidence routing.** DocuPipe does not expose a workflow-level
> "below threshold → UNK" knob. We enforce the same idea client-side in the
> webhook handler using the per-field confidences that come back on the
> standardization (see `LOW_CONFIDENCE_THRESHOLD` in
> [`src/server/docupipe.ts`](../src/server/docupipe.ts)).

## 3. (deprecated — see §2)

Earlier revisions of this doc described per-class schemas you'd hand-build
in the portal. That is now generated from the spec file by `yarn sync:docupipe`;
do not edit schemas in the portal directly or `yarn check:docupipe` will
flag the drift.

## 4. (deprecated — see §2)

The `SG DREAM Ingest` workflow's `classToSchema` map is now patched by
`yarn sync:docupipe` from the spec file. Initial workflow creation is still
manual (one-time, cold start only).

## 5. Webhook endpoint

The webhook is the **only** source of status updates **into the store**.
The browser learns about updates by polling `verificationSnapshotQuery`
(see `src/lib/queries.ts`); see [§6.5 below](#65-how-updates-reach-the-browser)
for the full hand-off.

### Dev (local) — ngrok tunnel

```bash
ngrok http 3000
```

Copy the HTTPS forwarding URL (e.g. `https://a1b2.ngrok-free.app`) and:

1. **Settings → Webhooks → Add endpoint**.
2. URL: `https://<tunnel>/api/docupipe/webhook`.
3. Subscribe to **only** these events (DocuPipe uses the
   `<entity>.<verb>.<status>` naming convention; the canonical list lives in
   `SG_DREAM_DOCUPIPE_SPEC.webhookEvents`):
   - `document.processed.success`
   - `document.processed.error`
   - `classification.processed.success`
   - `classification.processed.error`
   - `standardization.processed.success`
   - `standardization.processed.error`

   You can also let the script register the endpoint for you:

   ```bash
   yarn sync:docupipe --register-webhook=https://<tunnel>/api/docupipe/webhook
   ```

4. Save. DocuPipe shows the Svix signing secret — copy it into `.env.local`:

   ```bash
   DOCUPIPE_WEBHOOK_SECRET=whsec_...
   ```

### Prod — Vercel preview or production URL

Same as above, with `https://<vercel-url>/api/docupipe/webhook`. Each Vercel
preview deploy has a stable preview URL; re-register if the tunnel URL
changes between sessions.

## 6. Smoke test

1. `yarn dev` + `ngrok http 3000` in two terminals.
2. Navigate `/login → /clients → /verifications → /upload` (Sterling Ranch CAB,
   verification V4).
3. Drop two PDFs: one that matches a seeded prior filing (e.g. the repo seed
   for `Rusin_Invoice_March2026.pdf` → `SGD-DP-V3-2026-0028`) and one fresh
   invoice.
4. Watch `/processing` transition through per-doc statuses driven by the
   webhook → store → react-query polling loop. No page reloads.
5. `/confirmation` should show the duplicate alert with real extracted fields;
   `/dashboard` should reflect the new upload under its doc type and vendor.

### 6.5. How updates reach the browser

There is no SSE or held-open connection. The flow is:

```
DocuPipe → Svix-signed webhook → server store (KV/JSON)
                                       ↑
browser ──── react-query refetchInterval (2 s while in-flight) ────────────┘
```

`verificationSnapshotQuery` polls every 2 seconds while at least one
document in the verification is still `queued`, `classifying`, or
`standardizing`, and stops polling automatically once everything is
`completed` or `error`. This is intentional: the webhook is the source of
truth, polling is multi-instance-safe (no per-process state to leak), and
nothing keeps a connection open across deploys.

## 7. Env summary

`.env.local` (all server-only):

```bash
DOCUPIPE_API_KEY=sk_...
DOCUPIPE_BASE_URL=https://app.docupipe.ai
DOCUPIPE_WORKFLOW_ID=wf_...
DOCUPIPE_WEBHOOK_SECRET=whsec_...
```

Never ship any of these to the browser; only `src/server/**` reads them.

## 8. Troubleshooting events

- **Testing a handler change without uploading a real PDF.** In the DocuPipe
  webhook portal, open the endpoint and use the **Testing** tab to send a
  simulated event. The mock payload uses a placeholder `documentId` our store
  won't know; the webhook handler silently `200`s and logs nothing — that's
  expected idempotency (`findDocumentByDocupipeId` returns `null`, we exit
  cleanly). For end-to-end verification, use a real upload.
- **Event name mismatches.** If nothing updates after the classifier runs,
  double-check the exact event names in the portal. DocuPipe's naming is
  `<entity>.<verb>.<status>`; the handler also accepts the legacy
  `standardization.completed` / `workflow.completed` aliases so a stale
  subscription does not silently stall.
- **Invalid signature.** The handler returns `401 invalid signature` when Svix
  verification fails. Common causes: wrong `DOCUPIPE_WEBHOOK_SECRET`, body
  mutated by middleware, or the tunnel URL changed between deploys.

## 9. Known limits for this stage

- Single tenant — the store is keyed by `clientId` + `verificationId`, but
  there is no auth layer; anyone with the URL can submit.
- Local JSON persistence (`.data/dream.json`) is wiped when `.data/` is
  deleted. Vercel KV takes over only when `KV_REST_API_URL` and
  `KV_REST_API_TOKEN` are configured; otherwise deployed previews use an
  ephemeral in-memory store so the seeded portal still renders.
- Browser polling cadence is fixed at 2 s while in-flight; not adaptive.
  Acceptable for the testing demo, revisit if cost or latency change.
- Webhook retries are handled by DocuPipe; we swallow unknown `documentId`s
  with a `200` so out-of-order deliveries don't crash the handler.
