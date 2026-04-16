# Brand System

## Core Palette (always applied)

- `--color-brand-blue`: `#003DA6` — Schedio Group house color, default `primary`.
- `--color-brand-slate`: `#292E34` — heading ink.
- `--color-brand-text`: `#333333` — body text.
- `--color-brand-surface`: `#F2F2F2` — page surface.
- `--color-brand-white`: `#FFFFFF`.
- `--color-brand-muted`: `#7A7A7A` — secondary text, metadata.

## Workflow Accents

SG DREAM supports two workflows. Each ships as its own token set and is bound to the generic `--wf-*` aliases via a `data-workflow` attribute on the page root.

- `--color-workflow-dp-base: #1B5E20` — District Direct Pay (green).
- `--color-workflow-dr-base: var(--color-brand-blue)` — Developer Reimbursement (blue, alias of the brand color).

Shared screens consume `var(--wf-base)`, `var(--wf-soft)`, `var(--wf-border)`, `var(--wf-hover)`, `var(--wf-softer)`, `var(--wf-tint)`, `var(--wf-strong)` — never the workflow-specific tokens directly. That rule is what lets the same markup render both flows.

## Flag Colors (duplicate detection)

- Exact duplicate → muted red (`--color-flag-exact-bg` / `--color-flag-exact-text`).
- Likely duplicate → burnt orange (`--color-flag-likely-bg` / `--color-flag-likely-text`).
- Summary + alert panel → amber (`--color-flag-summary-bg`, `--color-flag-panel-bg`).

## Utilization Bands (contract tracking)

- Healthy (< 70%) → green (`--color-util-healthy`).
- Monitor (70–89%) → amber (`--color-util-monitor`).
- Amendment likely (≥ 90%) → red (`--color-util-amend`).

## Typography

- Major headings: `Open Sans` (via `--font-heading`, exposed as `font-ops` too for dense operational UI).
- Dense operational UI and tables: `IBM Plex Sans` (`--font-ops`).
- Metadata, reference numbers, filenames: `IBM Plex Mono` (`--font-mono`).
- Body: `Libre Franklin` (`--font-sans`).

## Usage Rules

- Default accent is the workflow accent (`--wf-base`), not the brand blue. Screens outside a workflow (login, client selection) still fall back to the green default to keep the session consistent.
- Keep surfaces light and structured. Avoid novelty gradients and off-token route styling.
- Strong contrast, obvious hierarchy. Reference numbers and renamed filenames use mono — clients should be able to read them aloud without mistakes.
- Let layout, density, and typography do more work than decorative color changes. Color already carries the workflow story.

## Route Personality

- `/login`, `/clients`: calm, invitation-focused, minimal chrome.
- `/verifications`, `/upload`, `/processing`, `/confirmation`: ceremonial, clear progression, workflow banner always on screen.
- `/dashboard`: dense operational surface, verification context at the top, contract tracking stacked for District Direct Pay.

## Token Ownership

The canonical token definitions live in `src/styles.css`. Do not hardcode colors into route files when a token or derived tone can express the same choice. If you need a new state, add a token before shipping a one-off color.
