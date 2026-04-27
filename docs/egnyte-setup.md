# Egnyte setup for SG DREAM (Layer 1 custody)

Reproducible checklist for giving the SG DREAM testing stage a real custody
chain inside Egnyte. The Egnyte integration is **server-only**: the app reads
five env vars via `src/server/env.ts` and talks to the Egnyte Public API v1
through `src/server/egnyte.ts`. The browser never sees credentials.

This matches the System Constitution's "Layer 1 — Document Custody" lifecycle:

```
Incoming → Processing → Classified → Relied → Locked
```

Phase 1 of the wiring only produces `Incoming`, `Processing` (on failure), and
`Classified`. `Relied` and `Locked` are reserved for the engineer-approval
lifecycle that lands in a later phase.

## 1. Register an Egnyte OAuth app

1. Sign in to the Egnyte web UI as an admin at
   `https://<your-subdomain>.egnyte.com`.
2. **Settings → Configuration → API Keys → Add a new key**. Fill in:
   - **Application name**: `SG DREAM Testing`
   - **Description**: `SG DREAM custody chain (server-side only)`
   - **Grant types**: enable **Authorization Code** AND **Refresh Token**.
     The app uses the long-lived refresh token to mint short-lived access
     tokens at runtime — no interactive login once the token is in place.
   - **Redirect URI**: `http://localhost:3000/_oauth/egnyte-callback` for the
     one-time redirect; the app itself does not expose this endpoint in
     production, it's only used during step 3.
   - **Permissions**: `Egnyte.filesystem` (required) and `Egnyte.permissions`
     (only if you need to move files into a folder where the app user is not
     a direct member).
3. Save the app. Egnyte shows a **Client ID** (`EGNYTE_CLIENT_ID`) and a
   **Client Secret** (`EGNYTE_CLIENT_SECRET`). Copy both into `.env.local`.

## 2. Identify the root path

Pick (or create) the folder that SG DREAM should own:

```
/Shared/Clients
```

This becomes `EGNYTE_ROOT_PATH`. Inside, the integration creates exactly this
layout per client per verification:

```
/Shared/Clients/<clientCode>/<verificationRef>/Incoming/<originalFileName>
/Shared/Clients/<clientCode>/<verificationRef>/Classified/<DocType>/<renamedName>
```

- `clientCode` — the 3-char `Client.code` already defined in
  [`src/lib/sg-dream.ts`](../src/lib/sg-dream.ts) (`SRC`, `HCA`, `DBI`).
- `verificationRef` — the standard `SGD-DP-V<n>-<year>-<seq>` / `SGD-DR-...`
  string built by `formatRef()`.
- `renamedName` — the SG DREAM filename convention built by `renamed()`:
  `SG-<clientCode>-V<NNN>-<DocType>-<Vendor4>-<year>-<NNN>.pdf`.

Make sure the OAuth app's user account has **Full** permissions on
`EGNYTE_ROOT_PATH` or the app cannot create subfolders (see Troubleshooting).

## 3. Mint the refresh token (one-time)

Egnyte's Authorization Code flow requires a human to click an approval
screen once. After that, the returned refresh token is long-lived (at least
30 days, typically much longer — we refresh the access token before it
expires, which rolls the refresh window too).

From a terminal on your dev machine, run:

```bash
open "https://<YOUR_DOMAIN>.egnyte.com/puboauth/token?client_id=<CLIENT_ID>&redirect_uri=http://localhost:3000/_oauth/egnyte-callback&scope=Egnyte.filesystem%20Egnyte.permissions&response_type=code&state=sg-dream"
```

Sign in (if asked), approve the scopes. Egnyte redirects to
`http://localhost:3000/_oauth/egnyte-callback?code=<AUTH_CODE>`; copy the
`code` query value.

Exchange it for a refresh token with a single curl:

```bash
curl -s -X POST \
  "https://<YOUR_DOMAIN>.egnyte.com/puboauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=<CLIENT_ID>" \
  -d "client_secret=<CLIENT_SECRET>" \
  -d "redirect_uri=http://localhost:3000/_oauth/egnyte-callback" \
  -d "code=<AUTH_CODE>" \
  -d "grant_type=authorization_code"
```

Response body looks like:

```json
{
  "access_token": "a1b2c3...",
  "refresh_token": "r1r2r3...",
  "expires_in": 3600,
  "token_type": "bearer"
}
```

Paste the `refresh_token` into `.env.local` as `EGNYTE_REFRESH_TOKEN`. Also
paste the subdomain (just the part before `.egnyte.com`) into
`EGNYTE_DOMAIN`.

## 4. Verify the env is complete

`.env.local` must have all five values:

```bash
EGNYTE_DOMAIN=your-subdomain
EGNYTE_CLIENT_ID=abcdef...
EGNYTE_CLIENT_SECRET=...
EGNYTE_REFRESH_TOKEN=...
EGNYTE_ROOT_PATH=/Shared/Clients
```

Missing values throw at first request via `src/server/env.ts`; the submit
path gracefully degrades to DocuPipe-only when `isEgnyteConfigured()` is
false so CI and demo environments without Egnyte still work.

## 5. Smoke test

1. `yarn dev` and `ngrok http 3000` in two terminals; register the webhook
   endpoint per [docs/docupipe-setup.md](./docupipe-setup.md).
2. Upload a PDF through `/upload`. Check Egnyte:

   ```
   /Shared/Clients/SRC/SGD-DP-V4-2026-0012/Incoming/<original>.pdf
   ```

   appears within a few hundred milliseconds.

3. Wait for DocuPipe's `standardization.processing.success` webhook to fire.
   The file should move to:

   ```
   /Shared/Clients/SRC/SGD-DP-V4-2026-0012/Classified/INV/SG-SRC-V004-INV-RSIN-2026-012.pdf
   ```

4. Open the `/confirmation` page; the "Filed to Egnyte" chip should point to
   the `Classified/` folder, and the "Filed in Egnyte" link on each row of
   the document library deep-links into the file in Egnyte's Web UI.

## 6. Troubleshooting

- **`403 Forbidden` on `/pubapi/v1/fs-content/...`.** The user account
  behind the OAuth app does not have write access to `EGNYTE_ROOT_PATH`.
  Share the folder explicitly with that user at the `Full` permission level,
  or move `EGNYTE_ROOT_PATH` into a folder they own.
- **`403 already exists` on folder create.** Expected. `createFolderIfMissing`
  swallows this; no action needed.
- **`404` on `moveFile`.** The `Incoming/` folder is missing. Either the
  upload never succeeded (check the submit server function logs) or another
  process moved the file. The webhook logs this as a promotion failure and
  leaves the doc in `custodyState: 'processing'` for engineer follow-up.
- **Access token refresh fails with `invalid_grant`.** Refresh token has
  been rotated or revoked (this happens if a second client redeems the
  same refresh token). Re-run step 3 to mint a new refresh token and paste
  it back into `.env.local`.
- **Custody lag warning.** DocuPipe sometimes completes extraction before
  the Egnyte upload finishes on large PDFs. We write the DocuPipe document
  ID first and retry the Egnyte upload in the webhook on a best-effort
  basis; `custodyState: 'processing'` surfaces the lag in the UI.

## 7. What's intentionally out of scope this phase

- **`Relied` / `Locked` custody states** — these transition when an engineer
  approves the extracted fields or a verification is finalized; gated
  behind the engineer-approval lifecycle in a later phase.
- **Egnyte folder permissions per client** — everything currently goes under
  a single root. Multi-tenant permission segmentation is a Phase 2 concern.
- **Visual Review artifacts in Egnyte** — DocuPipe hosts the overlay image;
  we embed the URL on `/confirmation`. Copying the image into Egnyte for
  cold archival is a later optimization.
