---
name: tanstack-start-foundation
description: Use when working on routing, route files, loaders, server functions, API routes, or TanStack Start project structure in this repo.
---

# TanStack Start Foundation

This repo is a file-routed TanStack Start app with SSR, server functions, and API routes.

## Rules

- Keep routes in `src/routes`. Use `createFileRoute` per route and `createRootRoute` in `src/routes/__root.tsx`.
- Server functions live in `src/server/fns/` and are the bridge between routes and server-only code. API routes live under `src/routes/api/` for webhooks and non-TanStack clients (DocuPipe callbacks, uploads, auth).
- Loaders warm React Query caches via `context.queryClient.ensureQueryData(...)` with the query factories in `src/lib/queries.ts`; components read the same queries with `useSuspenseQuery`-style hooks. Do not fetch ad hoc in components.
- Session and portal config (`sessionUserQuery`, `portalConfigQuery`) are warmed in the root loader; child routes can rely on them being present.
- Cross-page UI state is URL-driven (search params like `?client=` and `?selected=`), not module-level or context state.
- Never import from `src/server/**` into a component or client loader; that code reads env vars and must stay server-only. Route loaders may call server functions, which run on the server.
- Use route `head` metadata for page titles when it adds clarity.
- Keep shared client-safe types and pure helpers in `src/lib`, not duplicated across route files.
