# Meeting Confirmed Details

Primary source: `/Users/matthewgraham/Code/proposals/clients/schedio-group/artifacts/2026-03-12-meeting/transcript.txt`

Meeting date: March 12, 2026

Confirmed needs from Tim:

- The main request is a standardized portal where clients can drag and drop documents instead of relying on scattered intake paths.
- One user may upload for multiple districts or entities, so the interface must make routing obvious and hard to get wrong.
- Clients need visibility into where their submissions are in process.
- Clients should be able to access organized documents, but the product does not need to replace the underlying repository in the first phase.
- The source documents are mixed: clean PDFs, scanned county-recorded documents, and other inconsistent inputs.
- The workflow must preserve original-file traceability while still organizing records into a consistent structure.
- The system should feel trustworthy, reviewable, and operational rather than speculative or overly automated.
- Phase 0, Phase 1, and Phase 2 are the active path. Phase 3 remains deferred.

Transcript anchors used for planning:

- Intake portal ask: around line 245
- Multi-district routing: around line 303
- Status visibility and document access: around line 319
- Phase 3 deferred: around line 461
- PE-license trust requirement: around line 557

How those details map into this repo:

- Two client-facing mockups focus on intake, routing, and status visibility.
- Two internal workflow roles show how the governed package is prepared and approved.
- Document access in the current mock is modeled through Egnyte custody language because the SG DREAM governance materials use repository/custody framing rather than pure upload tooling language.
- The internal story is intentionally split:
  - drafting prepares the governed package
  - approval changes authority state
