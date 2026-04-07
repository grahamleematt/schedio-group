# Schedio Group AI

Static TanStack Start mock for the next Schedio pass. The app is structured like a product and backed by curated SG DREAM scenario packs, not a concept gallery:

- `/` client operations dashboard
- `/create-package` intake task flow launched from the dashboard
- `/review-workbench` internal drafting workspace
- `/review-console` internal approval console

The client-facing focus of this pass is the dashboard plus create-package flow. The internal routes remain structurally essential because SG DREAM requires drafting and approval to stay separate capabilities.

## Commands

```bash
yarn install
yarn dev
yarn lint
yarn build
yarn test
```

## Route Map

- `/` verification-first client operations dashboard with login-driven district switching, package selection, custody pipeline, and inventory
- `/create-package` 4-step intake flow with `monthly` and `setup` package modes
- `/review-workbench` analyst drafting workspace with PDF preview, manifests, rationale, and field confirmation
- `/review-console` engineer approval console with authority transitions, blocked packages, duplicates, and archive history

## Scenario Coverage

The current mock is built around five archive-backed workflow paths:

- CAB monthly close with a complete contract -> task order -> change order -> invoice -> proof chain
- CAB late rollover into the next verification
- CAB contract kickoff / setup intake
- Metro finance package with a support gap
- MD4 archived read-only package

See [docs/scenario-matrix.md](./docs/scenario-matrix.md) for the exact file map, preview assets, and route usage.

## Stack

- TanStack Start
- React 19
- Tailwind CSS v4
- shadcn/ui
- TypeScript

## Design Notes

- Palette, surfaces, and semantic colors come from `src/styles.css`.
- Typography: `Open Sans` for major headings, `IBM Plex Sans` for dense operational UI, `IBM Plex Mono` for metadata, `Libre Franklin` for body text.
- Dashboard uses modular sectioned panels (stats bar, custody pipeline, package selector, package detail, inventory). Internal routes use a 2-pane detail layout with PDF preview and fullscreen modal.
- The main UI story is verification, cutoff, upload inventory, renamed files, submitted amount, and relationship-chain visibility.
- Login switching drives district and verification context across the dashboard.

## Docs

- [docs/meeting-confirmed-details.md](./docs/meeting-confirmed-details.md)
- [docs/brand-system.md](./docs/brand-system.md)
- [docs/mockup-brief.md](./docs/mockup-brief.md)
- [docs/scenario-matrix.md](./docs/scenario-matrix.md)
- [docs/sg-dream-phase1-enterprise-architecture-research.md](./docs/sg-dream-phase1-enterprise-architecture-research.md)
- [docs/agent-instruction-map.md](./docs/agent-instruction-map.md)

## Source Of Truth

Use this order when orienting a new agent in the repo:

1. `README.md` for the current route map and repo shape.
2. `docs/mockup-brief.md` for what each route is trying to prove.
3. `docs/scenario-matrix.md` for the archive-backed scenario map.
4. `docs/meeting-confirmed-details.md` for transcript-backed product direction.
5. `docs/sg-dream-phase1-enterprise-architecture-research.md` for the full Phase 1 handoff sweep, repo delta map, and backend recommendation.
6. `docs/brand-system.md` for palette, typography, and route personality.
7. `./.cursor/rules/director.mdc` as the canonical instruction entrypoint.

If instruction files disagree, `.cursor` is canonical and `.claude` / `.codex` are mirrors.

## Agent Instructions

- Cursor is the canonical source of truth for repo-local rules and skills.
- Claude and Codex each have mirrored rule and skill folders so the repo works cleanly across all three agents.
- Edit `.cursor` first, then keep `.claude` and `.codex` aligned.

Entry points:

- `./.cursor/rules/director.mdc`
- `./CLAUDE.md`
- `./AGENTS.md`
