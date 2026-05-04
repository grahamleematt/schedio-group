# Mockup Brief

This mock is a clickable end-to-end walkthrough of the **District Direct Pay (green)** workflow in the SG DREAM client portal. Shared screens (login, client selection, verifications, upload, processing, confirmation, library / what-happens-next) are built once and themed by workflow so the blue flow can be turned on later by flipping one value.

## `/login`

Goal: Establish the invitation-only entry point.

- Email + password, no self-serve signup, MFA encouraged.
- `?error=bad_creds` previews the error state.
- Submit always lands on `/clients`.

## `/clients`

Goal: Show clients they are explicitly granted access to — nothing else.

- One list, driven by `mockUser.permittedClientIds`.
- Selection is kept in the URL (`?selected=`). Continue is disabled until a client is picked.
- Selecting a client fixes the workflow for the session; the URL then carries `?client=…` through the rest of the flow.

## `/verifications`

Goal: Make the currently open verification unmistakable, with historical context.

- Primary card: the open verification, cutoff date, counts, costs submitted, work authorization.
- Secondary list: previous verifications with `Approved` / `Under Review` / `Open` pills and submitted / verified totals.
- Workflow banner + pill sit above the card so the workflow is always on screen.

## `/upload` — Touch Point 1

Goal: Show duplicate detection as an assist, not a gate.

- Drag-and-drop zone, queue with original filenames, renamed filenames, duplicate flags.
- Exact match → red pill with previous filename and verification ref.
- Likely match → amber pill with the same inline context.
- Orange summary bar counts total flagged files.
- `?clean=1` previews the variant without any flags for demo purposes.

## `/processing` — Touch Point 2

Goal: Make the behind-the-scenes work visible and legible.

- Six-step animated log (CSS `animation-delay` stagger, no timers or effects).
- Step 5 switches to amber + flagged count when `?dupes>0`.
- The CTA is always visible so the user advances on their schedule, not ours.

## `/confirmation` — Touch Point 3

Goal: Issue the reference number and tell the user what to do next.

- Generated reference (`SGD-DP-V4-2026-0011`) printed in mono alongside the workflow pill.
- Document summary strip (count, flagged, types, workflow).
- `DuplicateAlertPanel` shows up only when duplicates were detected, with Keep / Remove / View Previous per file and a Notify Schedio CTA.
- Primary CTA leads to `/dashboard`.

## `/dashboard` — Screens 7 + 9 (District Direct Pay)

Goal: Give the client a single page that summarizes everything Schedio has accepted and what is coming next.

Stacked for District Direct Pay (Developer Reimbursement will use the single-table variant when that flow is added):

1. `VerificationDashboardCard` — active verification, key stats.
2. `DocumentInventoryTiles` — eight doc-type tiles, active in workflow color, amber badge when any flag.
3. `VerificationSummaryTable` — per-verification submitted vs verified, running total row tinted in workflow accent.
4. `ContractTrackingTable` — per-vendor authorized / spent / remaining with utilization bar (healthy / monitor / amend bands).
5. `DocumentLibrary` — collapsible category groups, URL-driven search and open category, duplicate rows highlighted.
6. `WhatHappensNext` — three-step timeline with ETA copy keyed off the workflow.
7. `DashboardActions` — Upload More + Email Me This Summary.

## Shared constraints

- **Live integrations:** DocuPipe (classify + standardize via the workflow webhook) and Egnyte (Originals → Classified custody) drive `/upload`, `/processing`, `/confirmation`, `/dashboard`, `/library`, `/verifications`, and the `/clients` entity picker against the real `getVerificationSnapshot` server fn. The open-verification cards on every entity now show **live** docs-in-queue and **live** costs-submitted (sum of extracted invoice amounts) for any entity with real activity (Downtown BID, etc.), falling back to the mock fixture only when no docs have been uploaded yet. **Mocked surfaces:** identity/session, work-authorization totals, vendor contract tree, prior-verification financial outcomes, users & access, and the audit log.
- State is derived or lives in URL search params; no component-level `useEffect`.
- Workflow is an attribute on the page root, not a theme switch. The same markup renders both workflows.
- Filenames, reference numbers, and vendor codes all follow the PDF naming convention (`SG-[CLIENT]-V###-[DOCTYPE]-[VENDOR]-[YEAR]-[SEQ]`, `SGD-DP-V#-YEAR-####`).

## Gaps called out but not built

Per §8 of the PDF, these belong in later passes:

- Blue flow (Developer Reimbursement) dashboard.
- Schedio internal portal + admin console.
- Email templates, session timeout, Terms of Service.
- Account settings and historical onboarding UX.
- Robust error and empty states beyond the login error variant.
