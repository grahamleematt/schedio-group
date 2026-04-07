# SG DREAM Phase 1 Handoff Sweep And Enterprise Architecture Research

Last reviewed: April 7, 2026

## Purpose

This memo is the canonical research artifact for the SG DREAM Phase 1 design handoff received on April 6, 2026. It preserves the full sweep of:

- what the 18-page handoff actually specifies
- how that differs from the current repo
- what backend architecture is implied by the product
- how AWS Textract, Google Document AI, and DocuPipe compare for this use case
- which platform should be the default recommendation for implementation

This document is intended to outlive chat context and remain the source-backed basis for future product, design, and backend implementation work.

## Review Status

### Handoff Coverage

The full PDF was reviewed page by page, including the visual-heavy dashboard comp pages that are easy to under-read with plain text extraction:

- Page 7: Developer Reimbursement confirmation + duplicate alert panel
- Page 9: Developer Reimbursement dashboard comp
- Page 12: District Direct Pay dashboard comp

Manual verification note:

- The PDF was rendered to temporary page images for spot-checking visual-only pages.
- Pages 7, 9, and 12 were manually checked in image form in addition to text extraction.

### Files Reviewed In This Repo

- [README.md](/Users/matthewgraham/Code/schedioGroup-ai/README.md)
- [docs/mockup-brief.md](/Users/matthewgraham/Code/schedioGroup-ai/docs/mockup-brief.md)
- [docs/meeting-confirmed-details.md](/Users/matthewgraham/Code/schedioGroup-ai/docs/meeting-confirmed-details.md)
- [docs/scenario-matrix.md](/Users/matthewgraham/Code/schedioGroup-ai/docs/scenario-matrix.md)
- [src/routes/index.tsx](/Users/matthewgraham/Code/schedioGroup-ai/src/routes/index.tsx)
- [src/routes/create-package.tsx](/Users/matthewgraham/Code/schedioGroup-ai/src/routes/create-package.tsx)
- [src/routes/review-workbench.tsx](/Users/matthewgraham/Code/schedioGroup-ai/src/routes/review-workbench.tsx)
- [src/routes/review-console.tsx](/Users/matthewgraham/Code/schedioGroup-ai/src/routes/review-console.tsx)
- [src/lib/mock-data.ts](/Users/matthewgraham/Code/schedioGroup-ai/src/lib/mock-data.ts)
- [src/lib/scenario-data.ts](/Users/matthewgraham/Code/schedioGroup-ai/src/lib/scenario-data.ts)

## Executive Summary

The handoff PDF is broader than the current repo in three important ways:

1. It defines a full client funnel before the dashboard, not just a dashboard-first experience.
2. It formalizes two workflow types that materially change the client product shape:
   - `developer_reimbursement`
   - `district_direct_pay`
3. It assumes a much more complete production operating model:
   - invitation-based access
   - entity owner approvals
   - duplicate resolution across client and internal surfaces
   - verified dollar entry by Schedio staff
   - internal administration and verification management

The current repo is still valuable. It already demonstrates several core behaviors the handoff depends on:

- verification-scoped uploads
- visible cutoffs and rollover context
- original vs renamed filenames
- duplicate visibility
- classed inventory
- drafting and approval as separate internal capabilities

Inference:

- The repo should be treated as a strong operational prototype and vocabulary source, but not as a direct implementation of the new handoff.
- The handoff changes the product model enough that implementation should begin from a formal domain model and workflow architecture, not route-by-route UI patching alone.

## Section-By-Section Handoff Sweep

### 1. Project Overview

The handoff defines SG DREAM as a secure client-facing portal for document submission, cost verification, and program financial tracking across two client relationship types.

Important product implications:

- Every entity belongs to exactly one workflow type.
- Workflow type is not cosmetic; it changes layout, terminology, color accents, tables, and reference number format.
- The portal is not only a document upload system. It is also a verification and financial-tracking system.

### 1.1 The Two Workflows

The handoff distinguishes:

- `developer_reimbursement`
  - private land developers
  - purpose: submit costs for public reimbursement through the district
  - dashboard: verification summary table only
  - accent: blue
  - reference format: `SGD-DR-V[#]-[YEAR]-[####]`
- `district_direct_pay`
  - quasi-governmental entities
  - purpose: submit pay apps and invoices for Schedio approval and direct payment
  - dashboard: verification summary plus contract tracking
  - accent: green
  - reference format: `SGD-DP-V[#]-[YEAR]-[####]`

Inference:

- `WorkflowType` must become a top-level domain attribute, not a presentation detail.
- The current repo's district profile concept is directionally useful, but it is not the same abstraction.

### 2. Shared Client Flow

The handoff defines a shared six-screen client journey before workflow-specific dashboards:

1. Login
2. Client selection
3. Verification selection / open verification view
4. Upload with duplicate detection
5. Processing / analyzing documents
6. Confirmation with duplicate alert panel

Important product implications:

- The dashboard is post-submission, not the first screen after authentication.
- Client selection is required and must only show entities a user can access.
- Competing clients are never surfaced together.
- Verification context is explicit before upload.
- Duplicate detection appears in three touchpoints:
  - upload queue
  - processing step
  - confirmation panel

### 3. Developer Reimbursement Dashboard

The workflow-specific developer dashboard includes:

- verification dashboard card
- document inventory by type
- verified public costs summary table
- financial summary
- document library
- what happens next

Important product implications:

- The dashboard is not just current-upload status.
- It includes verification history and verification outcome tracking.
- It includes a running total row based on approved verifications only.
- No contract tracking table is shown for this workflow.

### 3.1 Verified Public Costs Summary Table

The table requires:

- verification number
- total amount submitted
- total public amount verified
- percent verified public
- status

Important product implications:

- There is a hard distinction between submitted dollars and verified dollars.
- Verified dollars must come from an internal process, not only extraction.

Inference:

- Phase 1 should model `submittedAmount` and `verifiedAmount` separately, even if `verifiedAmount` is entered manually by Schedio users.

### 4. District Direct Pay Dashboard

The district workflow includes:

- the same verification dashboard card
- the same inventory concept
- verification summary table
- a stacked contract tracking table

The contract tracking section requires:

- authorized
- spent
- remaining
- utilization percentage
- vendor-by-vendor rows
- color-coded utilization health

Important product implications:

- This workflow needs budget and vendor contract data, not just uploaded document metadata.
- The data model needs `ContractBudget` or equivalent, even if some values are manually curated in Phase 1.

### 5. Document Library, What Happens Next, Actions

These shared panels require:

- searchable document library
- collapsible categories
- original and standardized filenames shown together
- inline duplicate notes
- workflow-adapted next-steps copy
- actions:
  - upload more documents
  - email me this summary

Important product implications:

- Document inventory is not enough. A persistent library view is expected.
- Notifications and email summary generation become product requirements, not nice-to-haves.

### 6. Document Naming Convention

The naming rule is explicit:

`SG-[CLIENT]-V[###]-[DOCTYPE]-[VENDOR]-[YEAR]-[SEQ].[ext]`

Token meanings are defined for:

- client
- verification number
- document type
- vendor code
- calendar year
- per-type sequence

Important product implications:

- Naming cannot remain ad hoc or mock-data-only.
- The naming engine must preserve a source chain back to the original file.
- Vendor code derivation and sequence assignment will require durable metadata.

### 7. Authentication, Entity Owner, Permissions

The handoff specifies:

- no self-registration
- invitation-based onboarding
- MFA required for Schedio internal users
- entity owners with approval power
- competitor isolation for developer clients
- a 5-role permission matrix

Roles required:

- `sg_admin`
- `sg_pm`
- `entity_owner`
- `client_manager`
- `client_viewer`

Important product implications:

- Access is entity-scoped, not just district-scoped.
- Approval to join an entity is a workflow with expiration and audit requirements.
- Competitor isolation is a business rule with data-model implications.

Inference:

- This cannot be left to UI filtering alone. It must live in the account-entity membership model and authorization layer.

### 8. Phase 1 Gaps Still Needed Before Build

The handoff explicitly says the client-facing portal is designed, but the following still need design before development handoff:

- internal portal
- email templates
- empty states
- error states
- document status visibility decision
- account settings
- session timeout behavior
- terms of service
- historical data onboarding decision

Important product implications:

- The PDF is not actually implementation-ready by itself.
- The repo can proceed with architecture and planning, but several product decisions remain open.

### 9. Schedio Group Internal Portal Scope

The handoff lists the internal portal capabilities required to power the client portal:

- submission inbox
- document review and approval
- verified dollar entry
- verification management
- duplicate resolution override
- cross-client dashboard
- entity and user management

Important product implications:

- The current `review-workbench` and `review-console` are aligned in spirit but materially incomplete in scope.

### 10. Open Decisions Before Build

The handoff leaves six decisions unresolved:

1. How verified dollar data enters the system
2. Whether clients can see individual document status
3. Whether clients can resubmit or revise a document
4. Who gets notified of what and when
5. Data retention policy
6. Mobile baseline vs full experience

Phase 1 defaults used in this memo:

- verified dollars entered manually by SG staff
- client document status mostly internal in Phase 1
- resubmissions modeled as linked `DocumentVersion` records
- long-term retention assumed
- desktop-first responsive experience

### 11. Recommended Next Steps

The handoff recommends:

- answer the six open decisions
- design the internal portal

This repo-specific recommendation extends that list:

- lock the domain model first
- pick the extraction provider and ownership boundaries second
- only then decompose UI and backend implementation phases

### 12. Resume Instructions

The final section is process guidance for resuming the Claude design session.

Repo implication:

- This repo should not depend on that external conversation to remain usable.
- The findings from the PDF need to be preserved in repo docs, which is the reason this memo exists.

## Product Delta Map Against The Current Repo

### What Already Aligns Well

#### `/`

The current dashboard already demonstrates several handoff-compatible ideas:

- verification-specific context
- district switching
- cutoff visibility
- uploaded inventory
- original and governed filenames
- duplicate watch visibility
- relationship-chain visibility

#### `/create-package`

The intake flow already aligns on:

- verification context before upload
- reviewable language
- uploaded file inventory
- original vs renamed file comparison
- late-upload rollover context

#### `/review-workbench`

The drafting workspace already aligns conceptually on:

- source PDF as the primary artifact
- evidence hierarchy
- rationale and manifest review
- ambiguity requiring human confirmation

#### `/review-console`

The approval console already aligns conceptually on:

- drafting vs approval separation
- governance-focused review
- duplicate suppression
- blocked packages
- approval history

### What The Repo Does Not Yet Model

The handoff requires the following surfaces or concepts that are not yet first-class in the repo:

- login screen
- entity selection screen
- entity owner approval workflow
- workflow-type-specific dashboards
- verification history tables with verified amounts
- contract tracking table for district direct pay
- post-upload processing screen
- post-upload confirmation screen with duplicate panel
- searchable document library
- email-me-this-summary action
- invitation and access request flows
- session timeout and account settings surfaces
- internal verification management
- cross-client internal dashboard
- entity/user management

### Delta Severity

#### Incremental Changes

These can build on the current mock structure:

- richer duplicate treatment
- explicit naming engine
- stronger workflow typing
- library/search views
- verified vs submitted amount separation

#### Structural Changes

These require broader product and domain shifts:

- entity-scoped auth and membership
- workflow-typed dashboards
- full pre-dashboard funnel
- internal admin and verification management
- contract budget modeling

Inference:

- The repo should not be “upgraded” route by route without first introducing explicit domain entities and workflow types.

## Recommended Future Domain Model

The current mock data should eventually converge toward these production-facing concepts:

```ts
type WorkflowType = 'developer_reimbursement' | 'district_direct_pay'

type Role =
  | 'sg_admin'
  | 'sg_pm'
  | 'entity_owner'
  | 'client_manager'
  | 'client_viewer'

type Entity = {
  id: string
  name: string
  workflowType: WorkflowType
  competitorGroupId?: string
  ownerUserId?: string
  status: 'active' | 'pending' | 'archived'
}

type Verification = {
  id: string
  entityId: string
  number: number
  periodLabel: string
  dueDate: string
  status: 'open' | 'under_review' | 'approved' | 'closed'
}

type Submission = {
  id: string
  entityId: string
  verificationId: string
  referenceNumber: string
  submittedByUserId: string
  submittedAt: string
  duplicateFlagCount: number
  status: 'uploaded' | 'processing' | 'ready_for_review' | 'reviewed'
}

type Document = {
  id: string
  submissionId: string
  verificationId: string
  originalFilename: string
  standardizedFilename?: string
  documentType: string
  vendorCode?: string
  pageCount: number
  storageKey: string
  checksumSha256: string
}

type DocumentVersion = {
  id: string
  documentId: string
  versionNumber: number
  supersedesVersionId?: string
  reason: 'client_resubmission' | 'internal_correction' | 'replacement'
}

type DuplicateMatch = {
  id: string
  documentId: string
  matchedDocumentId: string
  matchType: 'exact' | 'likely'
  reason: string
  clientDecision?: 'keep' | 'remove'
  sgDecision?: 'accept' | 'reject' | 'escalate'
}

type ReviewDecision = {
  id: string
  documentId: string
  decidedByUserId: string
  status: 'approved' | 'flagged' | 'rejected'
  note?: string
}

type VerifiedAmountEntry = {
  id: string
  verificationId: string
  sourceDocumentId?: string
  enteredByUserId: string
  amount: number
  method: 'manual_entry' | 'import'
}

type ContractBudget = {
  id: string
  entityId: string
  vendorCode: string
  vendorName: string
  authorizedAmount: number
  spentAmount: number
}

type AccessRequest = {
  id: string
  entityId: string
  requestedByUserId: string
  status: 'pending' | 'approved' | 'denied' | 'expired'
  expiresAt: string
}

type NotificationEvent = {
  id: string
  type: string
  targetUserId?: string
  targetEntityId?: string
  occurredAt: string
}
```

## Recommended System Architecture

### Phase 1 Default Architecture

- frontend app for client and internal portals
- relational database for entities, memberships, verifications, submissions, document metadata, duplicate decisions, verified amounts, budgets, and audit history
- object storage for originals, normalized derivatives, and preview assets
- async processing pipeline for extraction and duplicate scoring
- app-owned review and governance surfaces

### Ownership Boundaries

The application should own:

- tenancy and authorization
- entity membership and competitor isolation
- verification lifecycle
- duplicate scoring and resolution state
- filename generation
- review queues
- verified dollar entry
- audit logs
- notifications

The extraction provider should own:

- OCR
- table/form/entity extraction
- optional document classification or chunking assistance

Inference:

- Duplicate detection should not be delegated to the document AI vendor because it depends on product-specific behavior across original filenames, verification context, matched history, and human decisions.

### Processing Flow

Recommended ingest flow:

1. Upload original file
2. Persist object and metadata
3. Compute file hash
4. Run exact duplicate check
5. Run extraction provider
6. Reconcile provider output into app-level document type, vendor, amount, and naming inputs
7. Run likely-duplicate heuristics
8. Generate standardized filename
9. Create review tasks and timeline events
10. Surface status to client and internal users

### Duplicate Detection Strategy

Exact duplicate signals:

- SHA-256 hash match
- identical byte size

Likely duplicate signals:

- normalized filename similarity
- same vendor and close amount
- same verification or adjacent verification
- same page count
- same extracted invoice number or similar OCR token cluster

Recommended touchpoints:

- upload queue
- processing log
- confirmation panel
- internal override queue

## Vendor Research And Comparative Analysis

### Source Set

Official sources used for vendor research:

- [AWS Textract pricing](https://aws.amazon.com/textract/pricing/)
- [AWS AnalyzeDocument API](https://docs.aws.amazon.com/textract/latest/dg/API_AnalyzeDocument.html)
- [AWS Textract quotas](https://docs.aws.amazon.com/textract/latest/dg/limits-document.html)
- [Google Document AI pricing](https://cloud.google.com/document-ai/pricing)
- [Google Document AI processor list](https://cloud.google.com/document-ai/docs/processors-list)
- [Google Document AI supported files](https://docs.cloud.google.com/document-ai/docs/file-types)
- [Google Document AI regions](https://docs.cloud.google.com/document-ai/docs/regions)
- [Google Document AI Human-in-the-Loop overview](https://docs.cloud.google.com/document-ai/docs/hitl)
- [DocuPipe pricing](https://www.docupipe.ai/pricing)
- [DocuPipe getting started](https://docs.docupipe.ai/)
- [DocuPipe classify docs](https://docs.docupipe.ai/docs/classifying-documents)
- [DocuPipe quick start](https://docs.docupipe.ai/docs/quick-start)
- [DocuPipe workflow docs](https://docs.docupipe.ai/docs/workflows-dashboard)

### Capability Matrix

| Dimension | AWS Textract | Google Document AI | DocuPipe |
| --- | --- | --- | --- |
| Core OCR | Strong OCR with text and handwriting in Detect/Analyze flows | Enterprise OCR with handwriting and 200+ languages | Parse step includes OCR and table extraction |
| Forms / key-value | Native via `FORMS` | Form Parser | Schema-based standardization |
| Tables | Native via `TABLES` | Layout Parser / Form Parser / specialized parsers | Parse + standardize |
| Queries / extraction by prompt | Native `QUERIES` and `Custom Queries` | Custom Extractor with generative option | Analyze and schema-based extraction |
| Signatures | Native `SIGNATURES` | Signature detection supported in extractor family | Not highlighted as a first-class pricing primitive |
| Split / classify | Limited in core general product; strong only in lending-specific flow | Custom splitter and custom classifier | Native workflow building with split + classify + extract |
| Review hooks | Human loop config exists in API | Native HITL is deprecated for new customers | Visual review is part of product workflow |
| File types | JPEG, PNG, PDF, TIFF | PDF, TIFF, JPEG, PNG, GIF, BMP, WebP, plus HTML/DOCX/PPTX/XLSX for layout parser | PDF, images, CSV, Excel, Word, HTML, text, JSON, XML |
| Tenancy model | App-owned | App-owned with region selection | Product includes team workspaces, prod/dev, and enterprise on-prem option |
| Best fit | Lowest-level AWS-native building block | Best balanced document-AI platform | Fastest workflow-heavy pilot path |

### AWS Textract Findings

What the official docs say:

- AnalyzeDocument supports `TABLES`, `FORMS`, `QUERIES`, `SIGNATURES`, and `LAYOUT` feature types, and accepts JPEG, PNG, PDF, and TIFF documents.
- AnalyzeDocument exposes `HumanLoopConfig` and `HumanLoopActivationOutput`, which means AWS supports a human-review hook at the API level.
- Set quotas allow up to 3,000-page PDF/TIFF files asynchronously and 500 MB for async PDF/TIFF processing.
- Pricing examples on the official pricing page show:
  - Detect Document Text: `$0.0015/page`
  - Queries: `$0.015/page`
  - Tables: `$0.015/page`
  - Forms: `$0.05/page`
  - Expense: `$0.01/page`
  - Layout is free when used with Tables

Strengths for SG DREAM:

- very low raw OCR cost
- strong AWS-native API surface
- direct support for signatures and queries
- human-review integration path exists

Weaknesses for SG DREAM:

- workflow orchestration remains highly custom
- general-purpose document splitting/classification is weaker than Google Document AI and DocuPipe
- SG DREAM would still need a substantial app-owned interpretation layer for mixed packets and routed extraction

Inference:

- Textract is best treated as the low-cost benchmark and fallback path, not the default primary platform, unless the team strongly prefers AWS-native composability over platform convenience.

### Google Document AI Findings

What the official docs say:

- Document AI offers:
  - Enterprise Document OCR
  - Layout Parser
  - Form Parser
  - Custom Extractor
  - Custom Splitter
  - Custom Classifier
- Enterprise OCR supports more than 200 languages and handwriting.
- Document AI supports region and multi-region placement such as `us` and `eu`.
- Supported file types include PDF, TIFF, JPEG, PNG, GIF, BMP, WebP, and with layout parser also HTML and OOXML formats.
- Pricing currently lists:
  - Enterprise OCR: `$1.50 / 1,000 pages`
  - Layout Parser: `$10 / 1,000 pages`
  - Form Parser: `$30 / 1,000 pages`
  - Custom Extractor: `$30 / 1,000 pages`
  - Custom Splitter: `$5 / 1,000 pages`
  - Custom Classifier: `$5 / 1,000 pages`
  - Custom processor hosting: `$0.05 / hour / deployed processor version`
  - Invoice parser and Expense parser: `$0.10 per 10 pages in a document`
- Google's Human-in-the-Loop page now states that native HITL is deprecated and no longer available to new customers after January 16, 2025.

Strengths for SG DREAM:

- better processor coverage for mixed document pipelines than Textract
- clean path to OCR, parsing, extraction, splitting, and classification under one platform
- strong fit for a document-processing backend that still keeps business workflow in the app
- region choice is useful for governance and customer expectations

Weaknesses for SG DREAM:

- native Google HITL is no longer a dependable core feature for new builds
- custom processors introduce hosting charges and operational complexity
- verified-dollar entry and duplicate resolution still need to be app-owned

Inference:

- Google Document AI is the best balanced fit for SG DREAM because it covers the mixed-modality document pipeline better than Textract while avoiding the unit economics and lock-in profile of DocuPipe.
- Because native HITL is deprecated, SG DREAM should assume a custom internal review UI regardless of provider.

### DocuPipe Findings

What the official docs say:

- DocuPipe positions itself as a document AI workflow platform with parsing, schemas, standardization, workflows, split, classify, analyze, and visual review.
- The docs describe workflows such as classify -> extract and split -> classify -> standardize.
- Pricing currently lists:
  - Business: `$99/mo`, `2,500 credits`, `$0.08` overage
  - Premium: `$499/mo`, `20,000 credits`, `$0.05` overage
  - Enterprise: custom, plus on-prem deployment
- Core Parse + Standardize cost is `3 credits/page`:
  - Parse = `1 credit/page`
  - Standardize = `2 credits/page`
- Additional service costs include:
  - Review = `2/page`
  - Split = `0.2/page`
  - Classify = `0.1/page`
  - Analyze = `0.5/page`
  - Route = `1/call`
- The pricing page also states:
  - shared team workspaces and prod + dev environments on Premium
  - BAA for HIPAA compliance on paid plans
  - SOC 2 Type II and ISO 27001 certification
  - Enterprise on-prem deployment

Strengths for SG DREAM:

- strongest workflow ergonomics out of the box
- built-in split / classify / extract / review concepts match document operations work well
- easiest path to a pilot with less custom orchestration
- enterprise option includes on-prem deployment

Weaknesses for SG DREAM:

- the economics get much steeper once most pages flow through parse + standardize and especially review
- tenant isolation and product workflow semantics still need careful app-level design
- greater platform lock-in risk around workflow logic

Inference:

- DocuPipe is the strongest speed-to-value option, but not the best default core platform for SG DREAM at this scale if the team wants long-term governance control and predictable scale economics.

## Cost Model At The Stated Workload

### Assumptions

User-provided planning scale:

- about `1,000 documents/month max`
- mixed `4-10 pages`

Planning page envelope used in this memo:

- low case: `4,000 pages/month`
- midpoint: `7,000 pages/month`
- high case: `10,000 pages/month`

Important note:

- These are directional architecture-planning estimates, not a procurement quote.
- Some providers bill by page, some by document, and some by a mix of prediction plus hosting.

### AWS Textract Directional Costs

If every page only used Detect Document Text:

- 4,000 pages: about `$6`
- 7,000 pages: about `$10.50`
- 10,000 pages: about `$15`

If every page used Queries:

- 4,000 pages: about `$60`
- 7,000 pages: about `$105`
- 10,000 pages: about `$150`

If every page used Forms + Tables:

- 4,000 pages: about `$260`
- 7,000 pages: about `$455`
- 10,000 pages: about `$650`

If every page were treated like expense documents:

- 4,000 pages: about `$40`
- 7,000 pages: about `$70`
- 10,000 pages: about `$100`

Inference:

- Textract is extremely cost-efficient if SG DREAM only needs OCR plus selective higher-cost features.
- It becomes less attractive when many pages require broad forms/table extraction and a large amount of custom orchestration still has to be built around it.

### Google Document AI Directional Costs

If every page used Enterprise OCR only:

- 4,000 pages: about `$6`
- 7,000 pages: about `$10.50`
- 10,000 pages: about `$15`

If every page used Layout Parser:

- 4,000 pages: about `$40`
- 7,000 pages: about `$70`
- 10,000 pages: about `$100`

If every page used Form Parser:

- 4,000 pages: about `$120`
- 7,000 pages: about `$210`
- 10,000 pages: about `$300`

If every page used Custom Extractor:

- 4,000 pages: about `$120`
- 7,000 pages: about `$210`
- 10,000 pages: about `$300`

If SG DREAM deployed one custom processor continuously:

- hosting adds about `$36.50/month`

If SG DREAM deployed three custom processors continuously:

- hosting adds about `$109.50/month`

Inference:

- Google remains inexpensive at SG DREAM's expected volume, even with a balanced processor mix.
- A practical stack such as OCR + selective Layout/Form + a small number of custom processors still sits in a comfortable range for a production-grade Phase 1 system.

### DocuPipe Directional Costs

If every page used only Parse + Standardize at `3 credits/page`:

- 4,000 pages -> `12,000 credits` -> fits Premium -> about `$499/month`
- 7,000 pages -> `21,000 credits` -> Premium plus `1,000` overage -> about `$549/month`
- 10,000 pages -> `30,000 credits` -> Premium plus `10,000` overage -> about `$999/month`

If every page also used Review, total becomes `5 credits/page`:

- 4,000 pages -> `20,000 credits` -> about `$499/month`
- 7,000 pages -> `35,000 credits` -> about `$1,249/month`
- 10,000 pages -> `50,000 credits` -> about `$1,999/month`

If Parse + Standardize + Split + Classify are used at `3.3 credits/page`:

- 4,000 pages -> `13,200 credits` -> about `$499/month`
- 7,000 pages -> `23,100 credits` -> about `$654/month`
- 10,000 pages -> `33,000 credits` -> about `$1,149/month`

Inference:

- DocuPipe is still affordable in absolute terms at this scale.
- It is materially more expensive than the hyperscaler options once SG DREAM uses the full workflow stack across most pages.

## Recommendation

### Default Recommendation

Use **Google Document AI as the primary extraction platform**, with the SG DREAM application owning:

- workflow and routing
- duplicate detection and resolution
- naming
- verification lifecycle
- internal review
- verified dollar entry
- authorization and competitor isolation

Keep **AWS Textract** as:

- the low-cost benchmark
- a viable fallback if AWS alignment becomes the top priority

Treat **DocuPipe** as:

- the speed-to-value alternative
- the best option if the team wants a more workflow-opinionated document platform and accepts higher recurring processing cost and deeper workflow lock-in

### Why Google Is The Best Balanced Fit

Inference from the official sources:

- Google has the best coverage across OCR, layout parsing, structured extraction, splitting, and classification for this mixed packet environment.
- Its cost profile at `4k-10k pages/month` remains modest.
- It allows SG DREAM to keep the most important product-specific behaviors in the application layer.
- The deprecation of Google's native HITL is not a blocker, because SG DREAM needs a custom internal portal anyway.

### What This Means For Implementation

Phase 1 should assume:

- Document AI for extraction
- app-owned async jobs
- app-owned internal review UI
- manual SG verified-dollar entry
- app-owned duplicate queue
- app-owned naming engine

## Implementation Defaults

The following defaults are recommended until superseded by product decisions:

- desktop-first responsive design
- long-term retention with full audit history
- client resubmission modeled as versioning, not overwrite
- client-facing duplicate warnings, but internal governance remains richer than client status
- verified dollars entered manually in Phase 1
- workflow-specific dashboards driven by `WorkflowType`

## Acceptance Checklist

This memo is complete when future implementation planning can answer "yes" to all of the following:

- All 12 sections of the handoff are covered here.
- The image-heavy pages 7, 9, and 12 are explicitly noted as manually checked.
- The current repo is mapped against the handoff by route and major missing surfaces are called out.
- The memo defines the future top-level workflow split and domain model.
- Duplicate detection is assigned to the application layer, not the vendor.
- Naming is treated as a first-class service.
- The vendor comparison evaluates capability, workflow fit, tenancy posture, lock-in, and cost.
- The recommendation is decision-complete enough to guide backend implementation planning.

## Bottom Line

The SG DREAM handoff is not just a client portal design; it is the outline of a governed document operations platform with a workflow-specific client experience and a necessary internal operating system behind it.

Inference:

- The best default technical posture is:
  - **Google Document AI for extraction**
  - **application-owned governance and workflow**
  - **AWS Textract as fallback / benchmark**
  - **DocuPipe as optional fast-track pilot path**

- The current repo should evolve from a route mock into a workflow-typed, entity-aware system model before substantial production implementation begins.
