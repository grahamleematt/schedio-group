---
name: tanstack-start-foundation
description: Use when working on routing, route files, layout composition, metadata, or TanStack Start project structure in this repo.
---

# TanStack Start Foundation

Use this repo as a file-routed TanStack Start app.

## Rules

- Keep routes in `src/routes`.
- Prefer `createFileRoute` per route and `createRootRoute` in `src/routes/__root.tsx`.
- Keep route logic lightweight because this repo is mockup-first.
- Use route `head` metadata for page titles when it adds clarity.
- Do not add server functions, API routes, or loaders unless the user expands scope beyond static mockups.
- Keep shared typed mock data in `src/lib`, not duplicated across route files.

## Optional future references

- `@tanstack/start-client-core`
- `@tanstack/react-db`

These are not part of v1 runtime scope.
