# Schedio Group AI

Mockup-first TanStack Start workspace for the March 30 follow-up with Tim. This repo packages SG DREAM through four coordinated views:

- `/portal-trust`
- `/portal-operations`
- `/review-workbench`
- `/review-console`

The client-facing routes also launch a shared task flow at `/create-package`, which models how a package enters SG DREAM custody from either client concept.

The app is intentionally static and typed in v1. There is no backend, no real auth, and no live upload or repository integration yet.

## Commands

```bash
yarn install
yarn dev
yarn lint
yarn build
yarn test
```

## Route Map

- `/` grouped concepts page for the four SG DREAM views
- `/portal-trust` calm client custody and intake concept
- `/portal-operations` denser client operations transparency concept
- `/create-package` shared 4-step client task flow launched from the two client portals
- `/review-workbench` analyst drafting workspace
- `/review-console` governance and approval console

## Stack

- TanStack Start
- React 19
- Tailwind CSS v4
- shadcn/ui
- TypeScript

## Design Notes

- Brand palette comes from Schedio Group’s site and logo.
- Typography follows `Open Sans` for headings and `Libre Franklin` for body copy.
- Visual tone should feel trustworthy, operational, and engineering-grade.
- The concepts are framed as two client-facing views and two internal governance roles.
- Repository and custody language is modeled as `Egnyte`, with SG DREAM attaching manifests, linked evidence, and governed determination state around preserved source records.

## Docs

- [docs/meeting-confirmed-details.md](./docs/meeting-confirmed-details.md)
- [docs/brand-system.md](./docs/brand-system.md)
- [docs/mockup-brief.md](./docs/mockup-brief.md)
- [docs/agent-instruction-map.md](./docs/agent-instruction-map.md)

## Source Of Truth

Use this order when orienting a new agent in the repo:

1. `README.md` for the current repo shape, route map, and agent entrypoints.
2. `docs/mockup-brief.md` for what each route is trying to prove.
3. `docs/brand-system.md` for tone, palette, and route personality.
4. `docs/meeting-confirmed-details.md` for transcript-backed business context.
5. `./.cursor/rules/director.mdc` as the canonical instruction entrypoint.

If instruction files disagree, `.cursor` is canonical and `.claude` / `.codex` are mirrors.

## Agent Instructions

- Cursor is the canonical source of truth for repo-local rules and skills.
- Claude and Codex each have mirrored rule and skill folders so the repo works cleanly across all three agents.
- Edit `.cursor` first, then keep `.claude` and `.codex` aligned.

Entry points:

- `./.cursor/rules/director.mdc`
- `./CLAUDE.md`
- `./AGENTS.md`
