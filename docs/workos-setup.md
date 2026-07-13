# WorkOS AuthKit setup

Schedio uses WorkOS AuthKit for real sign-in and organization context. AuthKit
stays optional in local development: if the WorkOS env vars are missing,
`/api/auth/sign-in` redirects back to `/login?error=workos_missing` instead of
breaking the rest of the review surface. Local dev can also set
`SG_DREAM_AUTH_BYPASS=true` to skip the WorkOS round-trip entirely and resolve
to the seeded user (never honored in strict mode).

## Routes

- `GET /api/auth/sign-in` starts AuthKit and preserves an optional
  `returnPathname`. It also accepts an optional `email` query param, forwarded
  to AuthKit as `loginHint` so the hosted screen lands with the email already
  filled in — the `/login` page's email field feeds this, cutting a step out
  of both the password and one-time-code paths.
- `GET /api/auth/callback` completes the AuthKit code exchange and stores the
  sealed WorkOS session cookie.
- `GET /api/auth/sign-out` signs the user out. It guards the no-session case
  (redirects to `/login`) and sends WorkOS an **absolute** `return_to`
  (`<origin>/login`) — relative paths are rejected and fall back to the App
  Homepage URL, producing the `app-homepage-url-not-found` error.

## Who the UI shows

The signed-in identity is resolved server-side by `resolvePortalUser`
(`src/server/authz.ts`): the WorkOS user is matched to a Postgres
`intelligence_user_client_access` row by `workos_user_id` **or** lowercased
email. `getSessionUser` exposes that user to the client via the
`sessionUserQuery` (warmed in the root loader), so the sidebar avatar, header
badge, and entity picker render the real user — not the seeded fallback. In
local dev with `SG_DREAM_AUTH_BYPASS=true` the UI shows the seeded user.

## Environment

```bash
WORKOS_API_KEY=sk_test_...
WORKOS_CLIENT_ID=client_...
WORKOS_ORGANIZATION_ID=org_...
WORKOS_REDIRECT_URI=https://schedio-group-ai.vercel.app/api/auth/callback
WORKOS_COOKIE_PASSWORD=...   # openssl rand -base64 24
```

`WORKOS_REDIRECT_URI` must exactly match one of the dashboard Redirect URIs.

## WorkOS dashboard — Authentication methods

These toggles live under **Authentication** in the WorkOS dashboard and are
environment-wide (they cannot be set via the API). For the sign-in experience
the portal is built around — email first, then password or a one-time code,
with self-serve password reset — enable:

| Method             | Setting                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| **Email + Password** | On. This is what makes "Forgot password?" appear on the hosted AuthKit screen — reset is fully self-serve (WorkOS emails the reset link; no admin involved). |
| **Magic Auth**       | On. AuthKit emails a six-digit one-time code — this is the "magic link" path. With the `loginHint` prefill from `/login`, the user types their email once and goes straight to the code step. |
| **SSO / Google OAuth** | Optional; leave off unless a customer brings their own IdP.                                    |

With both methods on, AuthKit shows password entry with a "use a one-time
code instead" switch — users pick whichever is easier, and password reset
never routes through Schedio Admin.

## WorkOS dashboard — Redirects

Configure these on the AuthKit **Redirects** page. Add both the local and the
staging origin for each value you set.

| Field                           | Set it?      | Value (staging)                                                                                 |
| ------------------------------- | ------------ | ----------------------------------------------------------------------------------------------- |
| Redirect URI (sign-in callback) | **Required** | `https://schedio-group-ai.vercel.app/api/auth/callback`                                         |
| Sign-out redirects              | **Required** | `https://schedio-group-ai.vercel.app/login`                                                     |
| Sign-in endpoint                | Recommended  | `https://schedio-group-ai.vercel.app/api/auth/sign-in`                                          |
| User invitation URL             | Recommended  | `https://schedio-group-ai.vercel.app/api/auth/sign-in`                                          |
| Sign-up URL                     | Skip         | — (access is invitation-only; no self-serve sign-up)                                            |
| Password reset URL              | **Required** | `https://schedio-group-ai.vercel.app/api/auth/sign-in` (email+password auth is enabled; this is where users land after resetting) |

Notes:

- **Sign-out redirects** is what clears the `app-homepage-url-not-found` logout
  error. The route already sends `<origin>/login`; that URL must be allowlisted
  here.
- **Sign-in endpoint** is where WorkOS sends users to start a session
  (expired-session bounces, invitation/verification links). Our endpoint
  generates the authorization URL and redirects to WorkOS.
- **User invitation URL** matters because access is invitation-based — point it
  at the sign-in endpoint so an invited user lands in the app and AuthKit
  completes acceptance.
- **Password reset URL** pairs with the Email + Password method above — reset
  links land the user back on our sign-in endpoint with a fresh session.
  **Sign-up URL** stays unset because access is invitation-only.

Local equivalents use `http://localhost:3000` in place of the staging origin.

## Granting a tester entity access

WorkOS owns identity; Postgres owns entity access. A user can sign in via
WorkOS but sees a `403` until they have an `intelligence_user_client_access`
row. To grant a tester:

1. Ensure the person exists in WorkOS and is a member of the Schedio
   organization (`WORKOS_ORGANIZATION_ID`). Invite them if needed.
2. Insert an `intelligence_users` row (bind both `email` and, when known,
   `workos_user_id`) and one `intelligence_user_client_access` row per entity.
   The seed grant for the first reviewer lives in
   `db/intelligence/003_workos_tim_access.sql`; mirror its shape.
3. The two Dawson review entities are:
   - `dawson-trails-md1` — District Direct Pay
   - `dawson-trails-md1-developer` — Developer Reimbursement

Because the lookup matches on email or WorkOS id in both strict and non-strict
mode, the grant takes effect immediately against the live database — no
redeploy needed.

## Organization model

Use one Schedio WorkOS organization for early testing. Longer term, WorkOS
organizations map to Schedio customer accounts while Postgres stores
entity/workflow access, so one user can belong to several districts or
developers without document leakage. Server routes resolve the signed-in WorkOS
user and check `intelligence_user_client_access` before allowing snapshot
reads, direct uploads, or Egnyte imports.
