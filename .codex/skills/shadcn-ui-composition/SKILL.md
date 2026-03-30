---
name: shadcn-ui-composition
description: Use when installing, updating, or composing shadcn/ui components inside this repo.
---

# shadcn/ui Composition

Use `npx shadcn@latest` for component installation in this repo.

## Rules

- Install only the primitives the current feature needs.
- Reuse the local source under `src/components/ui`.
- Customize styling through class names and shared tokens instead of forking components casually.
- Keep component composition clean and product-specific.
