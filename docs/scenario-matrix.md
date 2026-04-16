# SG DREAM Scenario Seed

The mock is static. All runtime data comes from `src/lib/sg-dream.ts` and is fully typed. This document is the human-readable map of what's in that seed.

## Logged-in user

- Amy Lee (`AL`), `amy.lee@districts.example`, role `entity_owner`.
- Permitted clients: `hca`, `srm`, `dbi`. Per the PDF isolation rule, no other entities are visible in this session.

## Clients (District Direct Pay)

| Code | Name | Region | Status |
| --- | --- | --- | --- |
| `HCA` | Highlands Creek Authority | Arapahoe County, CO | Active |
| `SRM` | SR Metro District | Douglas County, CO | Active |
| `DBI` | Downtown BID | Denver, CO | Active |

## Verifications

Each client has multiple verifications in mixed statuses. The **current demo target is HCA V4** — it is the open verification, it has enough docs to populate every inventory tile, and it contains the flagged documents used by the duplicate detection branches.

| Client | No. | Period | Cutoff | Status |
| --- | --- | --- | --- | --- |
| HCA | V1 | Oct 2025 | Nov 10 | Approved |
| HCA | V2 | Nov 2025 | Dec 10 | Approved |
| HCA | V3 | Dec 2025 | Jan 12 | Under Review |
| HCA | V4 | Jan 2026 | Feb 10 | **Open** |
| SRM | V1 | Nov 2025 | Dec 15 | Approved |
| SRM | V2 | Dec 2025 | Jan 15 | Under Review |
| SRM | V3 | Jan 2026 | Feb 15 | **Open** |
| DBI | V1 | Q4 2025 | Jan 20 | Approved |
| DBI | V2 | Q1 2026 | Apr 20 | **Open** |

## HCA V4 documents

11 documents, hitting every doc-type category used in the flow.

- 3 exact / likely duplicates cover both branches:
  - `Apex_Invoice_INV-2026-0044.pdf` — likely duplicate, matches `SGD-DP-V3-2026-0008`.
  - `Meridian-Invoice-December-2025.pdf` — exact duplicate, matches `SGD-DP-V3-2026-0008`.
  - `HighlandsCreek_Plat_Phase_2.pdf` — exact duplicate, matches `SGD-DP-V2-2026-0004`.
- Every document is renamed per the PDF convention: `SG-HCA-V004-[DOCTYPE]-[VENDOR]-2026-[SEQ].pdf`.

## Vendors + utilization

Each client has multiple vendors with authorized / spent numbers that land across the three bands:

- `APEX` on HCA — ~94% utilized → **amend** band.
- `DLTA` on HCA — ~75% utilized → **monitor** band.
- `SLNO` on HCA — ~43% utilized → **healthy** band.
- Similar distributions exist on SRM and DBI.

## Helpers

The file also exports helpers the routes depend on:

- `getOpenVerification(clientId)` — resolves the verification shown in the primary card on `/verifications`.
- `getDocumentsByVerification(verificationId)` — drives inventory, upload queue, processing, confirmation, and library.
- `formatRef({ workflow, number, year, seq })` — generates `SGD-DP-V#-YEAR-####` reference numbers.
- `getDuplicateCounts(docs)` — exact / likely / total, used for the queue summary and processing amber branch.
- `computeVendorUtilization(vendor)` + `getUtilizationBand(pct)` — drive the Contract Tracking bar + color.
- `summarizeDocTypes(docs)` — drives the 8-tile Document Inventory and the confirmation summary line.

## Not yet covered

- **Blue flow (Developer Reimbursement)** — no vendors or verifications seeded for a blue-flow entity yet. When we turn it on, add a client with `workflow: 'developer_reimb'`, plug a single-table dashboard component into `/dashboard`, and pass `dashboardKind: 'single'`.
- **Pending-approval client** — the `Client` type supports `status: 'pending_approval'`, but no such client is currently in the seed. Add one when we want to demonstrate the "blocked state" referenced in §7.3.
- **Schedio staff view** — entirely out of scope for this pass.
