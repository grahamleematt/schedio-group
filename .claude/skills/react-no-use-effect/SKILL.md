---
name: react-no-use-effect
description: Use when editing React components in this repo to keep state derived, simple, and free of component-level useEffect.
---

# React No `useEffect`

This repo does not use component-level `useEffect`.

## Rules

- Derive values from props, mock data, and pure helpers.
- Do not mirror props into local state.
- For static mockups, prefer uncontrolled primitives with `defaultValue` over stateful wiring.
- Use `useMemo` only when there is a real recomputation cost.
