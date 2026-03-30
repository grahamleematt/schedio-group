# Schedio Group AI

Mockup-first TanStack Start workspace for the March 30 follow-up with Tim. This repo packages three polished directions around the same product brief:

- `/portal-trust`
- `/portal-operations`
- `/review-console`

The app is intentionally static and typed in v1. There is no backend, no real auth, and no live upload or Ignite integration yet.

## Commands

```bash
yarn install
yarn dev
yarn lint
yarn build
yarn test
```

## Route Map

- `/` chooser page for the three mockups
- `/portal-trust` calm client intake portal
- `/portal-operations` denser status-first client portal
- `/review-console` internal review and traceability concept

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
- The portal concept uses `Portal list + Ignite handoff` instead of trying to replace Ignite.

## Docs

- [docs/meeting-confirmed-details.md](./docs/meeting-confirmed-details.md)
- [docs/brand-system.md](./docs/brand-system.md)
- [docs/mockup-brief.md](./docs/mockup-brief.md)
- [docs/agent-instruction-map.md](./docs/agent-instruction-map.md)

## Agent Instructions

- Cursor is the canonical source of truth for repo-local rules and skills.
- Claude and Codex each have mirrored rule and skill folders so the repo works cleanly across all three agents.
- Edit `.cursor` first, then keep `.claude` and `.codex` aligned.

Entry points:

- `./.cursor/rules/director.mdc`
- `./CLAUDE.md`
- `./AGENTS.md`
