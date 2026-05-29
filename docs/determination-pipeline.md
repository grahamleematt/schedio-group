# Determination Pipeline

Purpose: give Tim a real Dawson Trails workbench for capturing PPP judgment now,
then let those captured determinations become the first retrieval corpus for AI.

## Current Vertical Slice

Route: `/determinations?client=dawson-trails-md1`

Data path:

1. Source corpus comes from `SG_DREAM_SOURCE_ZIP`, defaulting to
   `/Users/matthewgraham/Downloads/____SG DREAM (1).zip`.
2. The server indexes real Dawson marked-up contracts, marked-up plats, the
   active verification workbook, and governance files directly from the zip.
3. PDF documents stream from the zip through
   `/api/determination-documents?sourceId=...`; source files are not copied or
   modified.
4. The route parses the real `PLAT_PPPs` worksheet from the active Dawson
   verification workbook and exposes PDP / filing PPP records.
5. Tim saves PPP assertions through `/api/determinations`.
6. Assertions are append-only rows in `.data/determinations.json`.

## Assertion Shape

Each saved row records:

- source document id, zip entry path, and original filename
- project and district
- vendor, filing / phase, and optional plat binding
- scope item
- PPP percentage
- method: `SCOPE_INTERPRETATION` or `PLAT_GEOMETRY`
- evidence stage
- training scope: filing, project, district, or firm-wide
- rationale
- reason tags
- author initials and timestamp

## Next Layer

Once Tim creates real rows, the AI layer should retrieve from this same store:

1. classify the incoming source scope
2. retrieve matching assertions by vendor, filing, scope text, tags, and method
3. propose PPP value with cited assertions only
4. show confidence and low-evidence flags
5. save engineer response as another append-only assertion or supersession

No AI output should become authoritative without engineer approval.
