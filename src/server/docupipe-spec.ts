/**
 * Single source of truth for SG DREAM's DocuPipe configuration.
 *
 * Every property on `SG_DREAM_DOCUPIPE_SPEC` describes the *intended* state
 * of the DocuPipe workspace. Two consumers:
 *
 *   1. `scripts/docupipe/align.ts` — `check` reports drift between this spec
 *      and the live workspace; `sync` writes missing classes / schemas /
 *      workflow mappings to make the live workspace match.
 *   2. `src/routes/api/docupipe/webhook.ts` — derives the runtime
 *      `DOC_TYPES` enum from `classes` so the handler's known class list
 *      can never drift from the spec.
 *
 * The runtime webhook never trusts this file as ground truth for *what
 * DocuPipe actually returns* — that always comes from cached fetches
 * (`getClassMap()`, `getWorkflow()`). The spec describes intent; the API
 * describes reality. This separation means a stale spec can never poison
 * runtime decisions; it can only cause the alignment script to report
 * drift on the next run.
 *
 * ## Schema strategy (decided from corpus data)
 *
 * The SG DREAM examples folder contains 281 documents in the green flow:
 *   - INV: 233 (83%)
 *   - TO: 33 (12%)
 *   - PA: 6, CTR: 3, CO: 3, POP: 2, LSP: 0, CD: 0
 *
 * We ship three schemas:
 *   - `SG DREAM INV` — tailored for invoices (the dominant 83% of volume).
 *     Includes invoice-specific fields like `po_number` and
 *     `line_item_count` even though the app doesn't currently render them.
 *   - `SG DREAM PA` — tailored for AIA G702/G703 pay applications. Captures
 *     the full payment waterfall and pins `amount` to Current Payment Due
 *     (G702 Line 11). A shared `amount` description was too ambiguous for
 *     pay apps (the model alternated between period gross and total earned
 *     less retainage), so PA gets its own schema with the supporting
 *     waterfall fields the figure can be validated against.
 *   - `SG DREAM Universal` — the 9 fields the app actually reads from
 *     `ExtractedFields` in src/server/store/types.ts, with per-class hints
 *     baked into each field's `description`. The AI honors descriptions
 *     during extraction, which is the only mechanism for per-class
 *     guidance under a shared schema (workflow-level `guidelines` is one
 *     string per step, not per class).
 *
 * LSP and CD have no examples in the corpus but are still mapped to the
 * universal schema so any edge-case classification still terminates
 * cleanly with extracted fields populated.
 */

import type { DocType } from '#/lib/sg-dream'

type ClassSpec = {
  className: DocType
  description: string
}

type SchemaSpec = {
  schemaName: string
  /** JSON Schema (Draft-07) body, passed directly to `POST /schema`. */
  jsonSchema: Record<string, unknown>
  /** Class names this schema should be mapped to in the workflow. */
  mappedTo: ReadonlyArray<DocType>
}

type WorkflowSpec = {
  workflowName: string
  /** Step type — only `classifyStandardize` is supported by this codebase. */
  stepType: 'classifyStandardize'
  /**
   * DocuPipe standardization engine version. 3.0 is the agentic V3 engine:
   * higher extraction accuracy (~95% vs ~89% on DocuPipe's eval suite),
   * per-field page attribution, same credit cost at standard effort, and
   * fully compatible with existing schemas and webhook events.
   */
  stdVersion: 3.0
  /** Single-class classification (vs multi-label). */
  multiClass: false
  /** Whether DocuPipe should reserve an `unknown` bucket. */
  includeUnknown: boolean
}

/**
 * Common confidence-field block. The AI schema generator emits scores as
 * sibling `<field>_confidence` numbers, which our `extractFieldConfidence`
 * helper in src/server/docupipe.ts already understands.
 */
function withConfidence(
  fields: Record<string, Record<string, unknown>>,
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {}
  for (const [name, def] of Object.entries(fields)) {
    out[name] = def
    out[`${name}_confidence`] = {
      type: 'number',
      description: `Confidence score for ${name} extraction, between 0 and 1.`,
    }
  }
  return out
}

const INV_LINE_ITEM = {
  type: 'object',
  description:
    'One invoice line / task-order billing row. Return every billed line in document order.',
  properties: {
    item_number: {
      type: 'string',
      description:
        'Line number, item code, or row index as printed (e.g. "1", "TO-3", "A").',
    },
    description: {
      type: 'string',
      description:
        'Line description of work or goods billed, as printed on the invoice.',
    },
    task_order_reference: {
      type: 'string',
      description:
        'Task order, work order, or PO this line bills against. Critical for matching the line to the authorizing contract. Prefer the per-line TO/WO/PO number over the invoice-level PO when both appear.',
    },
    amount: {
      type: 'number',
      description:
        'This line\'s billed amount in USD. Strip currency symbols and commas; return a numeric value (e.g. 1250.00 not "$1,250.00").',
    },
  },
} as const

const INV_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  description:
    'Schema for extracting key invoice data with confidence scores for each field.',
  properties: {
    ...withConfidence({
      vendor_name: {
        type: 'string',
        description:
          'Vendor or counterparty name as printed on the invoice header.',
      },
      vendor_id_guess: {
        type: 'string',
        description:
          'Vendor tax ID, EIN, or internal vendor number if visible on the invoice.',
      },
      document_number: {
        type: 'string',
        description: 'Invoice number or document identifier.',
      },
      amount: {
        type: 'number',
        description:
          'Total amount due in USD. Strip currency symbols and return as a numeric value.',
      },
      currency: {
        type: 'string',
        description:
          'ISO 4217 currency code. Default to USD if not explicitly stated.',
        examples: ['USD', 'EUR', 'CAD'],
      },
      document_date: {
        type: 'string',
        format: 'date',
        description: 'Invoice issue date in YYYY-MM-DD format.',
      },
      contract_reference: {
        type: 'string',
        description:
          'Parent contract number or reference if mentioned on the invoice, separate from PO number.',
      },
      po_number: {
        type: 'string',
        description: 'Purchase order number referenced on the invoice.',
      },
      line_item_count: {
        type: 'integer',
        description: 'Number of distinct line items listed on the invoice.',
      },
    }),
    // Arrays are not wrapped by withConfidence — no sibling confidence fields.
    line_items: {
      type: 'array',
      description:
        'Every invoice line-item / task-order billing row in document order. Return ALL rows present on the invoice (typically ~8 for task-order invoices such as CORE Engineering). Do not summarize or omit rows. Strip currency symbols and commas from numeric amounts.',
      items: INV_LINE_ITEM,
    },
  },
} as const

/**
 * Pay-application schema (AIA G702/G703 and vendor draws).
 *
 * Pay apps carry a payment waterfall, and the single number that matters for
 * verification is **Current Payment Due** (G702 Line 11 / "AMOUNT DUE THIS
 * APPLICATION") — total earned less retainage, minus amounts already certified
 * on prior applications. The previous universal schema collapsed this to a
 * vague "amount due this billing period", which the model read inconsistently
 * (sometimes the period gross, sometimes total-earned-less-retainage). We map
 * `amount` explicitly to Current Payment Due and capture the rest of the
 * waterfall so the figure can be validated rather than trusted blindly.
 */
const PA_LINE_ITEM = {
  type: 'object',
  description:
    'One AIA G703 continuation-sheet row (Schedule of Values line). Return every row in document order, including change-order and summary rows that appear on the sheet.',
  properties: {
    item_number: {
      type: 'string',
      description:
        'G703 column A — Item No. as printed (e.g. "1", "3.2", "CO-1").',
    },
    description_of_work: {
      type: 'string',
      description:
        'G703 column B — Description of Work as printed on the continuation sheet.',
    },
    scheduled_value: {
      type: 'number',
      description:
        'G703 column C — Scheduled Value for this line. Strip currency symbols and commas; return a numeric USD value.',
    },
    from_previous_application: {
      type: 'number',
      description:
        'G703 column D — Work Completed From Previous Application. Strip currency symbols and commas.',
    },
    this_period: {
      type: 'number',
      description:
        'G703 column E — Work Completed This Period. Strip currency symbols and commas.',
    },
    materials_stored: {
      type: 'number',
      description:
        'G703 column F — Materials Presently Stored (not in D or E). Strip currency symbols and commas.',
    },
    total_completed_and_stored: {
      type: 'number',
      description:
        'G703 column G — Total Completed and Stored To Date (D+E+F). Strip currency symbols and commas.',
    },
    percent_complete: {
      type: 'number',
      description:
        'G703 "% (G ÷ C)" — percent complete as printed on the sheet (typically 0–100). Return the printed percentage number, not a 0–1 fraction.',
    },
    balance_to_finish: {
      type: 'number',
      description:
        'G703 column H — Balance to Finish (C − G). Strip currency symbols and commas.',
    },
    retainage: {
      type: 'number',
      description:
        'G703 column I — Retainage for this line. Strip currency symbols and commas.',
    },
  },
} as const

const PA_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  description:
    'AIA G702/G703 (or vendor) pay-application extraction schema. Read the full G702 certificate; figures are dollars, numeric (strip currency symbols and commas).',
  properties: {
    ...withConfidence({
      vendor_name: {
        type: 'string',
        description:
          'Contractor / vendor being paid (the "FROM CONTRACTOR" / applicant party on the G702).',
      },
      vendor_id_guess: {
        type: 'string',
        description:
          'Contractor tax ID, EIN, or vendor number if printed. Leave blank if absent.',
      },
      document_number: {
        type: 'string',
        description:
          'Application / pay-app / draw number (G702 "APPLICATION NO."), e.g. "11" or "12".',
      },
      amount: {
        type: 'number',
        description:
          'CURRENT PAYMENT DUE — AIA G702 Line 11 (also labeled "AMOUNT DUE THIS APPLICATION" / "CURRENT PAYMENT DUE"). This equals Total Earned Less Retainage (Line 6) minus Less Previous Certificates for Payment (Line 7). It is the single dollar amount payable for THIS application only. Do NOT return the contract sum, the total completed & stored to date, the period gross, or total earned less retainage — return the Current Payment Due line specifically. If the form truly has no current-payment-due line, return null.',
      },
      current_payment_due: {
        type: 'number',
        description:
          'Same value as `amount`: the G702 Line 11 Current Payment Due. Provide it here as well for cross-checking.',
      },
      contract_sum_to_date: {
        type: 'number',
        description:
          'Contract Sum To Date — G702 Line 3 (original contract sum plus net change orders). Null if not shown.',
      },
      completed_and_stored_to_date: {
        type: 'number',
        description:
          'Total Completed & Stored To Date — G702 Line 4 (G703 column G grand total). Cumulative across all applications. Null if not shown.',
      },
      retainage: {
        type: 'number',
        description:
          'Total retainage withheld to date — G702 Line 5 (sum of line 5a + 5b). Null if not shown.',
      },
      total_earned_less_retainage: {
        type: 'number',
        description:
          'Total Earned Less Retainage — G702 Line 6 (Line 4 minus Line 5). Null if not shown.',
      },
      less_previous_payments: {
        type: 'number',
        description:
          'Less Previous Certificates for Payment — G702 Line 7 (cumulative amount certified on prior applications). Null if this is the first application or not shown.',
      },
      balance_to_finish: {
        type: 'number',
        description:
          'Balance To Finish, Including Retainage — G702 Line 9. Null if not shown.',
      },
      currency: {
        type: 'string',
        description: 'ISO 4217 currency code. Default to USD if not stated.',
        examples: ['USD'],
      },
      document_date: {
        type: 'string',
        format: 'date',
        description:
          'Application date (G702 "APPLICATION DATE" / period-to date signature date) in YYYY-MM-DD.',
      },
      period_start: {
        type: 'string',
        format: 'date',
        description: 'Start of the billing period covered, YYYY-MM-DD.',
      },
      period_end: {
        type: 'string',
        format: 'date',
        description:
          'End of the billing period covered (G702 "PERIOD TO"), YYYY-MM-DD.',
      },
      contract_reference: {
        type: 'string',
        description:
          'Project name/number or parent contract this application bills against (G702 "PROJECT" / "VIA CONTRACT").',
      },
    }),
    // Arrays are not wrapped by withConfidence — no sibling confidence fields.
    line_items: {
      type: 'array',
      description:
        'Every AIA G703 continuation-sheet row (Schedule of Values) in document order. Return ALL rows on the sheet — pay apps often have 60+ lines. Do not summarize, skip, or collapse rows. Include change-order lines. Strip currency symbols and commas from every numeric column.',
      items: PA_LINE_ITEM,
    },
  },
} as const

/**
 * Universal schema covering the 6 remaining non-INV, non-PA doc types. Field
 * descriptions include per-class instructions because DocuPipe's AI uses
 * descriptions during extraction; this is the only way to encode per-class
 * meaning under a shared schema.
 */
const UNIVERSAL_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  description:
    'Universal SG DREAM extraction schema. Covers Pay Applications, Contracts, Task Orders, Change Orders, Proofs of Payment, Land Survey Plats, and Construction Drawings. Field descriptions include per-class guidance — read them carefully before extracting.',
  properties: withConfidence({
    vendor_name: {
      type: 'string',
      description:
        'Counterparty / vendor name as printed on the document. For CTR this is the contractor party; for TO/CO/PA/POP this is the vendor being paid; for LSP/CD this is the surveying or design firm. If multiple parties appear, prefer the one that would be paid.',
    },
    vendor_id_guess: {
      type: 'string',
      description:
        'Tax ID, EIN, vendor number, license number, or other unique vendor identifier if visible on the document. Leave blank if not present.',
    },
    document_number: {
      type: 'string',
      description:
        'Primary document identifier as printed. CTR: contract number; TO: work order or PO number; CO: change order number (e.g. CO-001); POP: check number, wire confirmation number, or waiver reference; LSP: plat or survey number; CD: drawing set or sheet number.',
    },
    amount: {
      type: 'number',
      description:
        'Headline dollar amount in USD, numeric (strip currency symbols and commas). CTR: total contract value; TO: work order value; CO: change amount (positive for additive, negative for deductive — CO is the only class that may be negative); POP: the amount actually paid, ALWAYS a positive number (the magnitude disbursed — never negative, even though a payment is an outflow); LSP/CD: leave null. If no monetary amount is on the document face, return null.',
    },
    currency: {
      type: 'string',
      description:
        'ISO 4217 currency code. Default to USD if not explicitly stated. Leave blank when amount is null.',
      examples: ['USD', 'EUR', 'CAD'],
    },
    document_date: {
      type: 'string',
      format: 'date',
      description:
        'Issue / effective date on the document face in YYYY-MM-DD format. CTR: execution date; TO/CO: issue date; POP: payment date; LSP: recording date; CD: stamp / issue date.',
    },
    period_start: {
      type: 'string',
      format: 'date',
      description:
        'Billing or coverage period start in YYYY-MM-DD. Optional for POP (date range a wire / waiver covers). Leave blank for CTR/TO/CO/LSP/CD.',
    },
    period_end: {
      type: 'string',
      format: 'date',
      description:
        'Billing or coverage period end in YYYY-MM-DD. Same rules as period_start.',
    },
    contract_reference: {
      type: 'string',
      description:
        'Parent contract or master agreement number. CRITICAL for TO (the parent MSA that authorizes this work order) and CO (the contract being amended). Recommended for POP (the contract being billed against). Leave blank for CTR (which IS the contract) and LSP/CD.',
    },
  }),
} as const

export const SG_DREAM_DOCUPIPE_SPEC = {
  classes: [
    {
      className: 'INV',
      description: 'Vendor invoice requesting payment for goods or services.',
    },
    {
      className: 'PA',
      description:
        'AIA G702/G703 or vendor pay application covering a billing period.',
    },
    {
      className: 'CTR',
      description:
        'Master service agreement or executed contract between an entity and a vendor.',
    },
    {
      className: 'TO',
      description:
        'Work order or purchase order issued under a parent contract.',
    },
    {
      className: 'CO',
      description:
        'Amendment that modifies scope, price, or schedule of an existing contract.',
    },
    {
      className: 'POP',
      description:
        'Wire confirmation, canceled check, ACH receipt, or lien waiver evidencing payment.',
    },
    {
      className: 'LSP',
      description: 'Recorded land survey plat or boundary survey.',
    },
    {
      className: 'CD',
      description: 'Stamped construction drawings or design set.',
    },
  ] as const satisfies ReadonlyArray<ClassSpec>,
  schemas: [
    {
      schemaName: 'SG DREAM INV',
      jsonSchema: INV_SCHEMA,
      mappedTo: ['INV'],
    },
    {
      schemaName: 'SG DREAM PA',
      jsonSchema: PA_SCHEMA,
      mappedTo: ['PA'],
    },
    {
      schemaName: 'SG DREAM Universal',
      jsonSchema: UNIVERSAL_SCHEMA,
      mappedTo: ['CTR', 'TO', 'CO', 'POP', 'LSP', 'CD'],
    },
  ] as const satisfies ReadonlyArray<SchemaSpec>,
  workflow: {
    workflowName: 'SG DREAM Ingest',
    stepType: 'classifyStandardize',
    stdVersion: 3.0,
    multiClass: false,
    includeUnknown: true,
  } as const satisfies WorkflowSpec,
  /**
   * Webhook events the handler in src/routes/api/docupipe/webhook.ts knows
   * how to act on. Used by the align script when registering an endpoint
   * via `--register-webhook`. The `review.*` pair syncs human-review
   * decisions (hosted editor or in-app corrections) back into the store.
   * Other DocuPipe events (schema.*, split.*, merge.*) are intentionally
   * not subscribed because the handler has no logic for them and they'd
   * just generate noise.
   */
  webhookEvents: [
    'document.processed.success',
    'document.processed.error',
    'classification.processed.success',
    'classification.processed.error',
    'standardization.processed.success',
    'standardization.processed.error',
    'review.verified.success',
    'review.rejected.success',
  ] as const,
} as const

/**
 * Convenience: every class name in the spec, in the order documented above.
 * The webhook handler imports this to derive its `DOC_TYPES` array so the
 * two lists can never drift.
 */
export const SPEC_CLASS_NAMES: ReadonlyArray<DocType> =
  SG_DREAM_DOCUPIPE_SPEC.classes.map((c) => c.className)

export type DocupipeSpec = typeof SG_DREAM_DOCUPIPE_SPEC
