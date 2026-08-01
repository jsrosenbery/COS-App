# Academic Planning Platform

The Academic Planning Platform is the shared architectural foundation for catalog-driven planning features in TIMBER. It is intentionally introduced as a compatibility layer first: existing Program Schedule Viability and Schedule Builder behavior is preserved while their entry points move behind one reusable API.

## Shared Engine

`js/core/academic-planning-platform.js` exposes the shared planning surface:

- `evaluateProgram()`
- `evaluatePortfolio()`
- `buildStudentSchedule()`
- `simulateScheduleChange()`
- `evaluateCampusScenario()`

The first implementation delegates to the existing Schedule Builder and Program Feasibility engines. This keeps calculations stable while giving future features one place to call for schedule solving, portfolio analysis, and non-mutating scenario simulation.

## Catalog Model

The platform normalizes shared catalog entities for:

- Catalog year
- Program
- Award
- Requirement group
- Requirement rule
- Course
- Course relationship
- Catalog revision
- Source evidence

Programs carry revision metadata, active revision status, source evidence, and separate confidence buckets. The underlying `COSProgramRequirements` model now recognizes `published` and `archived` review states in addition to the legacy states.

## Review Workflow

Catalog records use this administrative lifecycle:

`Draft -> Needs Review -> Approved -> Published -> Archived`

The platform defaults portfolio analysis to active Published records. Existing Program Schedule Viability report calls pass a legacy compatibility flag so current Approved pilot records continue to work until the catalog validation process is fully moved to Published records.

## Revisions

Programs are modeled as revisioned records. A revision transition creates a new revision ID, preserves the previous revision ID, marks the new revision active, and appends a review-history entry. This establishes the no-overwrite pattern for future repository persistence work.

## Recommendations And Simulation

Portfolio recommendations are normalized into scored recommendation objects with:

- impact score
- programs improved
- estimated configurations added
- campus improvements
- single-campus improvements
- confidence
- supporting evidence
- executable in-memory change

Simulation is non-mutating. It evaluates before and after states using cloned schedule rows and records a deterministic fingerprint for repeatability.

## Confidence Buckets

The platform keeps confidence dimensions separate:

- extraction
- reconciliation
- scheduling
- portfolio
- recommendations

These values are presentation and diagnostics metadata. They do not alter calculations.

## Diagnostics

The first diagnostic helper returns administrator-facing validation lists for unresolved catalog warnings, unmatched courses, ambiguous requirements, prerequisite gaps, stale catalog revisions, inactive approved programs, and orphaned requirements.

## Cache Fingerprints

Planning cache keys are structured from:

- catalog revision fingerprint
- schedule fingerprint
- analysis settings fingerprint
- campus constraints fingerprint
- term window fingerprint

Changing any one of those inputs changes the resulting cache key.

## Extension Points

The platform advertises future extension points for:

- GE pattern evaluation
- CSU/UC transfer patterns
- Guided Pathways
- Student Education Plans
- AI-assisted schedule recommendations

These are placeholders only. They are not active calculations.

## Remaining Technical Debt

- Persisting full revision history in IndexedDB/server storage should be completed in a later data-access phase.
- Existing Program Feasibility internals still filter legacy Approved records, so the platform adapts Published records into the legacy solver shape internally.
- Recommendation generation is normalized from existing portfolio outputs; deeper portfolio-native scoring can be added after the shared engine stabilizes.
- Administrator diagnostic dashboards should consume `validationDiagnostics()` in a later UI phase.
