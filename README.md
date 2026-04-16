# Schedio Group AI

Static TanStack Start mock for SG DREAM — the Schedio Group Document Review, Evaluation, and Monitoring client portal. This pass implements the **green flow (District Direct Pay) end to end**, with every shared screen built workflow-aware so the blue flow (Developer Reimbursement) can be turned on later by flipping one value.

## Commands

```bash
yarn install
yarn dev
yarn lint
yarn build
```

## Route Map

The green flow is seven screens long and reads like a real client journey:

- `/login` — Screen 1. Email + password, invitation-only. `?error=bad_creds` shows the error state. Submit links to `/clients`.
- `/clients` — Screen 2. Lists only entities the signed-in user has access to. Continue is disabled until a client is selected; selection is kept in `?selected=`.
- `/verifications` — Screen 3. Primary card is the currently open verification. Past verifications are listed below with status + amounts. Requires `?client=…`.
- `/upload` — Screen 4. Touch Point 1. Drag-and-drop zone, file queue with inline `exact` / `likely` duplicate flags, orange summary bar. `?clean=1` previews the non-flagged variant. Analyze CTA routes to `/processing`.
- `/processing` — Screen 5. Touch Point 2. CSS-only six-step animated log. Step 5 amber branch when `?dupes>0`. CTA to `/confirmation`.
- `/confirmation` — Screen 6. Touch Point 3. Shows the generated reference number (`SGD-DP-V4-2026-0011`), client / workflow strip, `DuplicateAlertPanel` when applicable, CTAs to Notify Schedio or continue to dashboard.
- `/dashboard` — Screens 7 + 9. District Direct Pay stacked view: verification card → document inventory tiles → verification summary table → contract tracking table → document library → what happens next → actions.

`/` simply redirects to `/login` so the app has a single entry point.

## Theming

Workflows are driven by a `data-workflow="district_dp" | "developer_reimb"` attribute on the page root. The attribute rebinds `--wf-*` CSS variables, and every shared surface (banner, buttons, tables, pills) consumes those variables rather than a hard-coded color. Switching a screen from green to blue is a one-line change.

- District Direct Pay (green) → `--wf-base: #1B5E20`
- Developer Reimbursement (blue) → `--wf-base: var(--color-brand-blue)` (#003DA6)

See `docs/brand-system.md` for the full token map.

## Scenario Seed

The seed lives in `src/lib/sg-dream.ts`. It models:

- **Amy Lee** — entity owner with access to three District Direct Pay clients: Highlands Creek Authority (`HCA`), SR Metro District (`SRM`), Downtown BID (`DBI`).
- Multiple verifications per client in mixed statuses (`approved`, `under_review`, `open`).
- A queue of 11 realistic documents on HCA V4 including two exact duplicates and one likely duplicate — enough to exercise every flagged branch through the flow.
- Per-vendor authorized / spent / remaining numbers covering the healthy, monitor, and amendment-likely utilization bands.

See `docs/scenario-matrix.md` for the explicit list.

## Stack

- TanStack Start (file routes, search-param state)
- React 19
- Tailwind CSS v4
- shadcn/ui primitives
- TypeScript

## Design Notes

- All base tokens, `.page-wrap`, `.brand-panel`, `.nav-pill`, `.data-table-*` primitives live in `src/styles.css`.
- Workflow-specific primitives live under `src/components/sg-dream/`.
- State is either URL-driven (search params) or derived. No component-level `useEffect`. The Screen 5 log uses CSS keyframes with staggered `animation-delay`; advancement to `/confirmation` is a user-clicked `Link`.

## Gaps left for later

The PDF handoff also lists work outside this pass. Noted here so the repo is honest about what is and isn't built:

- Blue flow dashboard (Screen 7) — tokens are in place, component is not.
- Schedio internal portal, admin console, account settings.
- Email templates, session timeout UX, Terms of Service, historical onboarding.
- Real error and empty states beyond the login `?error=bad_creds` variant.

## Docs

- [docs/meeting-confirmed-details.md](./docs/meeting-confirmed-details.md)
- [docs/brand-system.md](./docs/brand-system.md)
- [docs/mockup-brief.md](./docs/mockup-brief.md)
- [docs/scenario-matrix.md](./docs/scenario-matrix.md)
- [docs/agent-instruction-map.md](./docs/agent-instruction-map.md)

## Agent Instructions

- Cursor is the canonical source of truth for repo-local rules and skills.
- Claude and Codex each have mirrored rule and skill folders so the repo works cleanly across all three agents.
- Edit `.cursor` first, then keep `.claude` and `.codex` aligned.

Entry points:

- `./.cursor/rules/director.mdc`
- `./CLAUDE.md`
- `./AGENTS.md`
