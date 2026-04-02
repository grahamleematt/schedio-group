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
- Prefer shadcn primitives for buttons, cards, badges, inputs, selects, tables, tabs, separators, progress, and scroll areas.
- Keep component composition clean and product-specific rather than piling on generic dashboard chrome.
