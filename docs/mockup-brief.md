# Mockup Brief

## `/`

Goal:
Show the client operations dashboard Tim reacted most strongly to in the March 30 meeting, with real district and package variation.

What it should communicate:

- A client can switch between permitted districts on one login.
- Every upload belongs to a specific verification with a visible cutoff.
- The main surface is the uploaded inventory, not a concept grid.
- Package selection changes the inventory, class counts, submitted amount, and relationship chain inline.
- Original filenames stay visible, renamed outputs are obvious, and duplicates are easy to spot.
- Submitted amount, class counts, and the contract-to-proof chain are visible without exposing internal approval controls.
- CAB, Metro, and MD4 should feel materially different: active operations, finance/in-progress, and archived read-only.

## `/create-package`

Goal:
Show the intake task flow that feeds the dashboard.

What it should communicate:

- The route supports two modes: recurring monthly intake and contract kickoff / setup.
- The default case is the recurring monthly package: invoices, pay applications, and proof of payment.
- The client sees verification context before uploading.
- The flow uses reviewable language: proposed class, needs confirmation, ready for review.
- The client can compare original filenames to renamed inventory before the package is created.
- The package enters as `Incoming`, then moves into processing and classification afterward.
- Archived districts do not use this flow; they stay read-only on the dashboard.

## `/review-workbench`

Goal:
Show the internal drafting workspace where governed meaning is prepared.

What it should communicate:

- The PDF/source record is the primary artifact.
- Draft rationale, document manifest, run manifest, and evidence hierarchy are assembled here.
- Region or field confirmation belongs here when the system needs human teaching or validation.
- The queue should cover multiple scenario types: rollover, kickoff, malformed amount, pay-app variant, and Metro support gaps.
- This role prepares the package that approval will later act on.

## `/review-console`

Goal:
Show the governance and approval console where authority state changes are decided.

What it should communicate:

- Drafting and approval are separate capabilities.
- Approval decisions center on custody transitions, governance checks, rationale, and adjustment history.
- The source record remains available for spot-checking, but it is secondary to the approval decision.
- Only approval can move a record into `Relied` or `Locked`.
- The queue should include a clean approval, a duplicate suppression decision, a blocked missing-support package, and an archived/superseded-history example.

## Shared Constraints

- Static mockups only
- No real integrations
- No reimbursement-estimate concept in this version
- One client dashboard, one intake flow, two internal governance routes
- All visible source filenames and preview assets should map back to exact SG DREAM archive files
