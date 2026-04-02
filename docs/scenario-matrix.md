# Scenario Matrix

This file maps the current Schedio mock routes back to the exact SG DREAM archive files used in the product mock.

## Scenario Packs

| Scenario | District | Verification | Package | Route coverage | Core files |
| --- | --- | --- | --- | --- | --- |
| CAB monthly close | Sterling Ranch CAB | Verification 16 | `package-cab-monthly-close` | `/`, `/review-console` | `VC_SRCAB_AGW_MSA FOR GEOTECHNICAL SERVICES_XXX.pdf`, `VT_Sterling Ranch CAB_AGW_F6-00001-005_$55,410.00.pdf`, `VO_Rusin_CO2_$3,880.01.pdf`, `VI_JDS_3601_$2,639.67.pdf`, `Unconditional Waiver and Release Form (002).pdf` |
| CAB late rollover | Sterling Ranch CAB | Verification 17 | `package-cab-rollover` | `/`, `/create-package`, `/review-workbench` | `VI_JDS_3645_$100,000.00.pdf`, `Blank Conditional Lien Waiver.pdf`, carried-forward task order `VT_Sterling Ranch CAB_AGW_F6-00001-005_$55,410.00.pdf` |
| CAB contract kickoff | Sterling Ranch CAB | Verification 17 | `package-cab-kickoff` | `/`, `/create-package`, `/review-workbench` | `VC_Atwell LLC_Master Service Agreement_(Fully Executed).pdf`, `VC_Atwell Sterling Ranch F2 Townhome - Advanced Concrete Work Order - EXECUTED.pdf`, `VO_Rusin_CO1_$2,254.00.pdf` |
| Metro finance support gap | Sterling Ranch Metro District | Verification 11 | `package-md-finance` | `/`, `/create-package`, `/review-workbench`, `/review-console` | `VI_Classic_Pay App 23_$788,747.57.pdf`, `Blank Conditional Lien Waiver.pdf` |
| MD4 archived read-only | Sterling Ranch MD4 | Verification 9 | `package-md4-archived` | `/`, `/review-console` | `VI_Classic_Pay App 17_$865,464.69.pdf`, `Unconditional Waiver and Release Form (002).pdf` |

## Preview Assets

The internal routes currently use this curated preview set in `public/review-previews/`:

| Preview asset | Exact archive source |
| --- | --- |
| `review-contract-agw-xxx.pdf` | `1.0 Examples/2.1 Contracts/AGW/VC_SRCAB_AGW_MSA FOR GEOTECHNICAL SERVICES_XXX.pdf` |
| `review-jds-3601.pdf` | `1.0 Examples/3.1 Invoices/Ver 4/VI_JDS_3601_$2,639.67.pdf` |
| `review-mcdonal-7981.pdf` | `1.0 Examples/3.1 Invoices/Ver 3/McDonal Paving/VI_McDonal Paving_7981_$.pdf` |
| `review-payapp-pages-20.pdf` | `1.0 Examples/3.1 Invoices/Ver 4/Pages from SRMD - SRD Pay App 20 - 7.31.24.pdf` |
| `review-sunflower-duplicate.pdf` | `1.0 Examples/3.1 Invoices/Ver 5/VI_Sunflower_33032_$96,141.00 (2).pdf` |
| `review-atwell-contract.pdf` | `1.0 Examples/2.1 Contracts/Atwell/VC_Atwell LLC_Master Service Agreement_(Fully Executed).pdf` |
| `review-atwell-task-order.pdf` | `1.0 Examples/2.2 Task Orders/Atwell/VC_Atwell Sterling Ranch F2 Townhome - Advanced Concrete Work Order - EXECUTED.pdf` |
| `review-rusin-co1.pdf` | `1.0 Examples/2.3 Change Orders/Rusin/VO_Rusin_CO1_$2,254.00.pdf` |
| `review-jds-3645-rollover.pdf` | `1.0 Examples/3.1 Invoices/Ver 5/VI_JDS_3645_$100,000.00.pdf` |
| `review-conditional-waiver.pdf` | `1.0 Examples/4.2 Proofs of Payments - Conditional Lien Waivers/Blank Conditional Lien Waiver.pdf` |
| `review-classic-payapp-23.pdf` | `1.0 Examples/3.2 Pay Applications/VI_Classic_Pay App 23_$788,747.57.pdf` |
| `review-classic-payapp-17.pdf` | `1.0 Examples/3.2 Pay Applications/VI_Classic_Pay App 17_$865,464.69.pdf` |

## Route Usage

### `/`

- Uses the five package scenarios for district, verification, and package drilldown.
- Filters the uploaded inventory to the selected package.
- Shows inline relationship-chain detail for the selected package only.

### `/create-package`

- `mode=monthly` maps to CAB monthly close, CAB rollover, or Metro finance depending on district and verification.
- `mode=setup` maps to CAB contract kickoff.
- Archived districts are excluded from package creation and fall back to the first non-archived permitted district.

### `/review-workbench`

- Covers drafting on:
  - pay-app variant / missing support
  - malformed amount
  - late rollover
  - contract kickoff
  - Metro support gap
- Field-confirmation states are attached only to ambiguous drafting cases.

### `/review-console`

- Covers approval on:
  - clean happy-path lock
  - duplicate suppression
  - blocked missing-support package
  - archived package with superseded history
