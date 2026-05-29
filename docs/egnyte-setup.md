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
   - **Redirect URI**: `https://localhost/callback` (Egnyte requires **HTTPS**;
     `http://localhost` is rejected with `INVALID_CALLBACK`). This is only for
     the one-time token mint in step 3 — no app server needs to listen on that
     URL; copy the `code` from the browser address bar after redirect.
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

This becomes `EGNYTE_ROOT_PATH` only for clients that do not have an explicit
root. Tim's Dawson review uses the explicit roots in
[`src/lib/sg-dream.ts`](../src/lib/sg-dream.ts):

```
/Shared/Clients/Dawson Trails MD One/District
/Shared/Clients/Dawson Trails MD One/Developer
```

Inside each client root, the integration creates one draft intake layout before
Schedio assigns the public submission reference:

```
<clientRoot>/Intake/Draft/Incoming/<originalFileName>
<clientRoot>/Intake/Draft/Classified/<DocType>/<renamedName>
```

- `clientRoot` — the client-specific `Client.egnyteRootPath`; falls back to
  `EGNYTE_ROOT_PATH/<clientCode>` only when no explicit root exists.
- The internal `verificationRef` is still stored as metadata for traceability,
  but the customer-facing folder stays a draft intake until Schedio accepts the
  submission.
- `renamedName` — the SG DREAM filename convention built by `renamed()`:
  `SG-<clientCode>-V<NNN>-<DocType>-<Vendor4>-<year>-<NNN>.pdf`.

Make sure the OAuth app's user account has **Full** permissions on
`EGNYTE_ROOT_PATH` or the app cannot create subfolders (see Troubleshooting).

## 3. Mint the refresh token (one-time)

Egnyte's Authorization Code flow requires a human to click an approval
screen once. After that, the returned refresh token is long-lived (at least
30 days, typically much longer — we refresh the access token before it
expires, which rolls the refresh window too).

**Before running:** in Egnyte **API Keys**, set **Redirect URI** to exactly
`https://localhost/callback` (or another `https://` URL you put in
`EGNYTE_REDIRECT_URI` in `.env.local`). Save the key, then mint.

From the repo root (reads `EGNYTE_DOMAIN`, `EGNYTE_CLIENT_ID`, and
`EGNYTE_CLIENT_SECRET` from `.env.local`; optional `EGNYTE_REDIRECT_URI`,
default `https://localhost/callback`):

```bash
yarn egnyte:mint-refresh-token
```

The script opens the approval URL in your browser, then prompts for the
`code` from the redirect. Sign in (if asked), approve the scopes. Egnyte
redirects to
`https://localhost/callback?code=<AUTH_CODE>`; the page may not load — copy
the `code` query value from the address bar and paste it at the prompt.

To skip the prompt if you already have the code:

```bash
yarn egnyte:mint-refresh-token --code=<AUTH_CODE>
```

Manual alternative (same flow without the script):

```bash
open "https://<YOUR_DOMAIN>.egnyte.com/puboauth/token?client_id=<CLIENT_ID>&redirect_uri=https://localhost/callback&scope=Egnyte.filesystem%20Egnyte.permissions&response_type=code&state=sg-dream"
```

```bash
curl -s -X POST \
  "https://<YOUR_DOMAIN>.egnyte.com/puboauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=<CLIENT_ID>" \
  -d "client_secret=<CLIENT_SECRET>" \
  -d "redirect_uri=https://localhost/callback" \
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

Missing values throw only when an Egnyte action is attempted. Direct upload
can still run DocuPipe without Egnyte in local/CI, but the **Import from
Egnyte** button returns `503 Egnyte is not configured` until these values are
present.

## 5. Smoke test

1. `yarn dev` and `ngrok http 3000` in two terminals; register the webhook
   endpoint per [docs/docupipe-setup.md](./docupipe-setup.md).
2. Upload a PDF through `/upload`. Check Egnyte:

   ```
   /Shared/Clients/Dawson Trails MD One/District/Intake/Draft/Incoming/<original>.pdf
   ```

   appears within a few hundred milliseconds.

3. To test the customer-facing import path, place PDF/TIFF/JPG files directly
   into the same `Incoming` folder, then click **Import from Egnyte** on
   `/upload`. The app lists that folder server-side, downloads supported
   files, creates queued document rows in Postgres, and sends each file to
   DocuPipe.

4. Wait for DocuPipe's `standardization.processing.success` webhook to fire.
   The file should move to:

   ```
   /Shared/Clients/Dawson Trails MD One/District/Intake/Draft/Classified/INV/SG-DT1-V001-INV-RSIN-2026-001.pdf
   ```

5. Open the `/confirmation` page; the "Filed to Egnyte" chip should point to
   the `Classified/` folder, and the "Filed in Egnyte" link on each row of
   the document library deep-links into the file in Egnyte's Web UI.

## 6. Troubleshooting

- **`No valid app info found for api key`.** Egnyte does not recognize
  `EGNYTE_CLIENT_ID` on `https://<EGNYTE_DOMAIN>.egnyte.com`. The value in
  `.env.local` does not match a saved OAuth app on **that** domain. Open
  **Settings → Configuration → API Keys** on `schediogroup.egnyte.com` (or your
  tenant), copy **Client ID** and **Client Secret** again from the SG DREAM row,
  and save the key after setting redirect URI to `https://localhost/callback`.
  Do not reuse an old key from email or a different Egnyte tenant. If you
  registered at [developers.egnyte.com](https://developers.egnyte.com) instead,
  the app must list your domain and be approved before OAuth works. Run
  `yarn egnyte:mint-refresh-token` — it preflights this before opening the
  browser.
- **`INVALID_CALLBACK` / redirect must be https.** Use
  `https://localhost/callback` in both Egnyte API key settings and
  `EGNYTE_REDIRECT_URI` (optional; that is the script default).
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
- **Import says the folder is missing.** Create the verification `Incoming`
  folder shown in the upload page rail, or upload one file through the app
  first so SG DREAM creates it.
- **Custody lag warning.** DocuPipe sometimes completes extraction before
  the Egnyte upload finishes on large PDFs. We write the DocuPipe document
  ID first and retry the Egnyte upload in the webhook on a best-effort
  basis; `custodyState: 'processing'` surfaces the lag in the UI.

## 7. What's intentionally out of scope this phase

- **`Relied` / `Locked` custody states** — these transition when an engineer
  approves the extracted fields or a verification is finalized; gated
  behind the engineer-approval lifecycle in a later phase.
- **Egnyte webhooks/events** — Tim's first test is deliberately user-triggered:
  files sync only when he clicks **Import from Egnyte**. Webhooks/events can
  later power drift warnings such as "this folder changed since last import."
- **Visual Review artifacts in Egnyte** — DocuPipe hosts the overlay image;
  we embed the URL on `/confirmation`. Copying the image into Egnyte for
  cold archival is a later optimization.
