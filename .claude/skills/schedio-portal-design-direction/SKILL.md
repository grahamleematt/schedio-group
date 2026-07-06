---
name: schedio-portal-design-direction
description: Use when designing or refining SG DREAM portal routes so they stay distinct, trustworthy, and aligned with the intake flow.
---

# Schedio Portal Design Direction

SG DREAM is one coherent product: an entity picker, a three-step intake flow, a live dashboard, and supporting portal surfaces. Internal Intelligence/Determinations routes exist behind a preview flag and are not part of the customer journey.

## Shared tone

- Trustworthy
- Operational
- Engineering-grade
- Reviewable

## Route personalities

- `/clients`: gatekeeping, calm, access-scoped — the user should feel their permissions
- `/verifications` and `/dashboard`: verification-first, operational, inventory-led
- `/upload` → `/processing` → `/confirmation`: task-flow focused, honest about live processing state, calmer than the dashboard
- `/library`, `/contracts`, `/audit`: reference surfaces — dense, tabular, auditable
- `/intelligence`, `/determinations` (preview-gated): internal, analytical, authority-first

## Rules

- Keep the interfaces intentional and presentation-ready.
- Avoid generic SaaS polish that makes every route feel interchangeable.
- Use spacing, information density, and copy tone to create distinction.
- Make human oversight visible where it matters.
- Preserve the sense that original filenames stay visible and auditable throughout the flow — duplicates happen frequently and clients need to trace them.
- Show live state honestly: processing, duplicate flags, and extraction confidence come from real data, so design for the empty, in-flight, and flagged variants of each surface.
- Cutoff awareness matters: days-until-cutoff is computed from the real date, so countdown surfaces must read correctly whether the cutoff is far away, imminent, or passed.
