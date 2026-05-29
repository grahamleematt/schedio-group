# Customer Intake Brief

SG DREAM is now framed as a customer-facing intake app for Tim's Dawson Trails
review, not as an Intelligence workbench entry point.

## Current Review Scope

- User: Tim McCarley.
- WorkOS account: invited by Schedio Group, mapped in Postgres.
- Entities:
  - `Dawson Trails MD One - District`
  - `Dawson Trails MD One - Developer`
- Storage custody: Egnyte.
- Extraction/classification: DocuPipe.
- App database: Postgres stores entity access, document identity, category,
  standardized names, extraction state, findings, learnings, relationships, and
  audit events.

## Customer Flow

1. Tim signs in through WorkOS.
2. Tim chooses one Dawson entity.
3. Tim uploads or imports files for the open verification.
4. SG DREAM stages files in Egnyte and sends them to DocuPipe.
5. The portal shows live intake state only: uploaded docs, extracted dollars,
   categories, duplicate flags, and processing status.
6. Downstream intelligence can consume reviewed documents after intake.

## Product Boundary

The customer portal should stay simple: entity choice, dashboard, verifications,
submit documents, and document library. Internal Intelligence routes may exist
for Schedio review, but they are not the intake flow Tim should use first.
