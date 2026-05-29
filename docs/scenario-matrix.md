# Scenario Matrix

This file tracks the current customer review scope.

## User

- Tim McCarley (`TM`)
- Role: Entity Owner
- WorkOS identity: replace `tim.mccarley@schedio.example` with Tim's real email
  before staging review.

## Entities

| Code  | Entity                           | Workflow                | Region          | Status |
| ----- | -------------------------------- | ----------------------- | --------------- | ------ |
| `DT1` | Dawson Trails MD One - District  | District Direct Pay     | Castle Rock, CO | Active |
| `DTD` | Dawson Trails MD One - Developer | Developer Reimbursement | Castle Rock, CO | Active |

## Starting State

Both entities start with one open verification and no preloaded documents. The
only document counts shown in the customer app should come from uploads,
DocuPipe callbacks, or Egnyte imports.

## Verifications

| Entity | Verification | Period                         | Cutoff       | Status |
| ------ | ------------ | ------------------------------ | ------------ | ------ |
| `DT1`  | `V1`         | Verification No. 01            | May 04, 2026 | Open   |
| `DTD`  | `V1`         | Developer Reimbursement No. 01 | May 04, 2026 | Open   |

## Access Rule

Tim's app account is explicitly granted access to both Dawson entities in
`db/intelligence/003_workos_tim_access.sql`. If another entity is added later,
it should not appear until a matching row exists in
`intelligence_user_client_access`.
