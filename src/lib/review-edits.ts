/**
 * Pure helpers for typing review corrections against overlay fields.
 * Shared by the document detail route (which owns the corrections state)
 * so the parsing rules are testable without React.
 */

import { formatCurrencyPrecise } from '#/lib/sg-dream'
import type { ExtractionOverlayField } from '#/server/fns/extractionOverlay'
import type { ReviewEdit } from '#/server/docupipe'

/** Raw editable representation of a field value (round-trips through Number). */
export function rawFieldValue(field: ExtractionOverlayField): string {
  return String(field.value ?? '')
}

/**
 * Money fields dominate the DocuPipe schemas; anything that looks like a
 * dollar amount gets currency formatting, while small integers (counts,
 * item numbers) stay plain.
 */
export function isMoneyPath(path: string): boolean {
  return /amount|due|sum|retainage|payments|finish|stored|earned|value|total|price/i.test(
    path,
  )
}

/**
 * Display representation used to seed the editable rail inputs: dollar
 * amounts render as "$1,234.56" the way reviewers are used to seeing them.
 * `parseEdit` strips the currency formatting back off, so a reviewer can
 * edit the formatted text in place without producing a phantom correction.
 */
export function displayFieldValue(field: ExtractionOverlayField): string {
  if (typeof field.value === 'number' && isMoneyPath(field.path)) {
    return formatCurrencyPrecise(field.value)
  }
  return rawFieldValue(field)
}

export type ParsedEdit =
  | { ok: true; edit: ReviewEdit }
  | { ok: false; message: string }

/**
 * Parse a typed correction back to the field's original scalar type.
 *
 * Numeric fields accept currency formatting ("$1,234.56") but reject input
 * that doesn't parse — the caller surfaces the message inline and blocks
 * Finalize, so a typo like "1,2x4" can never silently flip an amount into a
 * string on the DocuPipe review.
 */
export function parseEdit(
  field: ExtractionOverlayField,
  raw: string,
): ParsedEdit {
  const trimmed = raw.trim()
  if (typeof field.value === 'number') {
    const n = Number(trimmed.replace(/[$,\s]/g, ''))
    if (!Number.isFinite(n) || trimmed.length === 0) {
      return {
        ok: false,
        message: 'Enter a number — this value was extracted as an amount.',
      }
    }
    return { ok: true, edit: { path: field.path, value: n } }
  }
  return { ok: true, edit: { path: field.path, value: trimmed } }
}

/** True for flattened `line_items.*` leaves, which the rail hides (the
 * line-item table owns them) while their boxes stay drawn on the page. */
export function isLineItemPath(path: string): boolean {
  return path === 'line_items' || path.startsWith('line_items.')
}
