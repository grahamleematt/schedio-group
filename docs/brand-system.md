# Brand System

## Core Palette

- `--brand-blue`: `#003DA6`
- `--brand-slate`: `#292E34`
- `--brand-text`: `#333333`
- `--brand-surface`: `#F2F2F2`
- `--brand-white`: `#FFFFFF`
- `--brand-muted`: `#7A7A7A`

## Typography

- Major dashboard and intake headings: `Open Sans`
- Dense operational UI: `IBM Plex Sans`
- Metadata and operational labels: `IBM Plex Mono`
- Body: `Libre Franklin`

## Usage Rules

- Use blue as the primary accent and action color.
- Use slate, ink, and muted gray to keep the interface grounded and professional.
- Keep most surfaces light and structured. Avoid purple accents, novelty SaaS gradients, and off-token route styling.
- Preserve strong contrast and obvious hierarchy because the product needs to read as reliable and auditable.
- Let layout, density, and typography do more work than decorative color changes.

## Route Personality

- `/`: verification-first, dense, operational, command-surface oriented
- `/create-package`: task-flow focused, clear, reviewable, calmer than the dashboard
- `/review-workbench`: internal, file-first, analytical, preparation-focused
- `/review-console`: internal, authority-first, controlled, approval-oriented, auditable

## Token Ownership

The canonical token definitions live in `src/styles.css`. Do not hardcode colors into route files when a token or derived tone can express the same choice.
