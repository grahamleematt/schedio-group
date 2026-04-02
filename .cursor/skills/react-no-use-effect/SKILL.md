---
name: react-no-use-effect
description: Use when editing React components in this repo to keep state derived, simple, and free of component-level useEffect.
---

# React No `useEffect`

This repo does not use component-level `useEffect`.

## Rules

- Derive values from props, mock data, and pure helpers.
- Do not mirror props into local state.
- Use controlled `value` when the selection is driven by URL search params or other external state that can change after mount. Use `defaultValue` only for truly static initial values.
- Use `useMemo` only when there is a real recomputation cost.
- Keep formatting, filtering, and display shaping in pure helper code or route-local derived values.
