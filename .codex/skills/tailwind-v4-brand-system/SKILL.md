---
name: tailwind-v4-brand-system
description: Use when defining or modifying Tailwind v4 tokens, CSS variables, shared visual language, or brand-driven styling in this repo.
---

# Tailwind v4 Brand System

This repo uses Tailwind CSS v4 with CSS-variable tokens defined in `src/styles.css`.

## Rules

- Put canonical palette and surface tokens in `src/styles.css`.
- Prefer token reuse over hardcoded colors in components.
- Keep the Schedio palette centered on blue, slate, ink, surface, and muted gray.
- Use Tailwind utilities for layout and composition, but use CSS variables for brand consistency.
- Distinguish the three mockups through hierarchy, density, and tone more than through unrelated color changes.
