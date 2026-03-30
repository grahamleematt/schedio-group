# Brand System

## Core Palette

- `--brand-blue`: `#003DA6`
- `--brand-ink`: `#231F20`
- `--brand-slate`: `#292E34`
- `--brand-text`: `#333333`
- `--brand-surface`: `#F2F2F2`
- `--brand-white`: `#FFFFFF`
- `--brand-muted`: `#7A7A7A`

## Typography

- Headings: `Open Sans`
- Body: `Libre Franklin`

## Usage Rules

- Use the blue as the main accent and action color.
- Use slate, ink, and muted gray to keep the interface grounded and professional.
- Keep most surfaces light and structured. Avoid flashy gradients, purple accents, and novelty SaaS styling.
- Preserve strong contrast and obvious hierarchy because the product needs to read as reliable and auditable.

## Route Personality

- `portal-trust`: calm, guided, welcoming, confidence-building
- `portal-operations`: denser, more status-forward, more dashboard-like
- `review-workbench`: internal, file-first, analytical, preparation-focused
- `review-console`: internal, authority-first, controlled, approval-oriented, and auditable

## Token Ownership

The canonical token definitions live in `src/styles.css`. Do not hardcode colors into route files when a token or a derived tone can express the same choice.
