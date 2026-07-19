# TIMBER Current Architecture Inventory

This document captures the current architecture before any architectural extraction work. It is intended as a regression baseline and risk map, not as a redesign.

## Application Startup

`index.html` loads the static TIMBER frontend, third-party browser libraries, shared core modules, `js/app.js`, `js/enrollment-analytics.js`, and the Schedule Change Form scripts. The app is initialized primarily through browser `DOMContentLoaded` handlers.

`js/app.js` initializes the Room Availability and Scheduling Workspace. It creates the term tabs, selects the default term, loads schedule data for the active term, wires the room availability grid, room catalog utilities, event utilities, legacy analytics panels, exports, and publishes `window.COSScheduleApp` for other scripts.

`js/enrollment-analytics.js` initializes the report launcher and report-specific panels. It registers report IDs, labels, access levels, report order, workflow groups, and report descriptions. It also wires report navigation, password-gated access, report runners, archive loaders, and export actions.

## Navigation Flow

The top term tabs in `app.js` control the workspace active term and trigger backend schedule loading for that term. The main view selector switches between the Room Availability Grid and Room Schedule Calendar.

The analytics launcher in `enrollment-analytics.js` groups reports into the existing report categories:

- Division Chair / Administrative Assistant
- Dean / Enrollment Management
- Development
- Administration

Report visibility and access are driven by the `REPORTS`, `REPORT_ACCESS`, `REPORT_LABEL`, `REPORT_ORDER`, `REPORT_WORKFLOW_GROUPS`, and related maps in `js/enrollment-analytics.js`. Some report tiles call back into `window.COSScheduleApp` for legacy reports that are still implemented in `app.js`.

## Data Upload and Persistence Flow

Section seating and schedule data are loaded and saved by term through backend schedule routes such as `/api/schedule/:term`. `app.js` owns the active workspace schedule load and normalizes rows into the shared `currentData` array.

Analytics archive uploads use separate archive routes such as `/api/analytics-archive/:term` and are managed mostly by `js/enrollment-analytics.js`. These archives support historical reporting, planning comparisons, and report-specific term selectors.

Faculty schedule archives are intentionally separate from section seating and schedule data. `js/enrollment-analytics.js` loads and saves them through `/api/faculty-schedules` and `/api/faculty-schedules/:term`; faculty reports then parse them through the faculty parser/model helpers.

Administrative datasets include Room Catalog, Room Events, Modality Definitions, CAL-GETC Mapping, Curriculum Crosswalk, Enrollment Snapshots, and Work Experience data. These are loaded through a mix of backend API calls, file uploads, and local fallback state depending on the dataset and report.

## Report Rendering Flow

`js/app.js` directly renders the Room Availability grid, Room Schedule Calendar integration, Course Start-Time Heatmap, Active Class Demand chart, Modality Balance, Room Utilization Map, Room Fit Analysis, room catalog administration, and several export surfaces.

`js/enrollment-analytics.js` renders the report launcher and most enrollment/development/admin reports, including the Enrollment Analytics Dashboard, Enrollment Planning Forecast, Student Presence, Instructor Availability, Faculty Schedule Heatmap, Faculty Modality, Prime Time Analysis, Supply vs. Demand, Schedule Opportunity, Schedule Recommendation, Schedule Optimization Lab, Schedule Builder, Conflict Check, Archive Inspection, Snapshot Manager, and Work Experience Enrollment.

Shared calculations are gradually moving into `js/core/*` and `js/enrollment/*`, but many renderers still combine DOM construction, filtering, calculations, export preparation, and state mutation in the same function.

## Shared State

The main shared state in `app.js` includes the active term, active schedule rows, room catalog, room event data, loaded timestamps, filters, and DOM-bound controls. `window.COSScheduleApp` exposes selected getters and report hooks to other modules.

`js/enrollment-analytics.js` maintains a large `state` object for report data, archived terms, loaded rows, snapshots, faculty schedule rows, work experience rows, report run flags, cached term loads, and report results.

Important cross-module dependencies include:

- `enrollment-analytics.js` reading `window.COSScheduleApp.getCurrentData()` and `getCurrentTerm()`.
- Analytics reports calling legacy renderers on `window.COSScheduleApp`.
- Shared globals for browser libraries such as `Papa`, `Chart`, `Choices`, DataTables, `html2canvas`, and `jspdf`.
- DOM IDs used as implicit contracts between `index.html`, `app.js`, and `enrollment-analytics.js`.

## Export Flow

CSV and Excel-style exports are generally produced in browser code by building row objects and passing them to helper functions or `Papa.unparse`. Visualization exports use shared helpers in `js/shared/utils.js`, including heatmap/chart PNG, PDF, copy image, and CSV helpers.

The Schedule Change Form keeps a separate DOCX-first workflow in `js/schedule-change-form.js`, with backend support for DOCX-to-PDF conversion and email scaffolding when backend capabilities allow it.

Exports often include report context, filters, selected terms, methodology notes, and timestamps, but the implementation is spread across report-specific code and shared utilities.

## Major Responsibilities Currently Handled by `app.js`

- Application bootstrapping for the room workspace.
- Term tab creation and active-term schedule loading.
- Backend section schedule upload and load.
- Room Availability grid rendering and room search.
- Room Schedule Calendar integration.
- Room Catalog import, display, export, local fallback, and backend synchronization.
- Room Events import, display, export, local fallback, and backend synchronization.
- CAL-GETC, curriculum crosswalk, modality definition, and room-related admin utilities.
- Course Start-Time Heatmap and Active Class Demand chart surfaces.
- Room Utilization Map and Room Fit report surfaces.
- Modality Balance report logic and exports.
- Shared browser hooks published through `window.COSScheduleApp`.

## Report Implementation Inventory

Reports implemented primarily in `js/app.js`:

- Room Availability Grid
- Room Schedule Calendar
- Course Start-Time Heatmap
- Active Class Demand
- Room Utilization Map
- Room Fit Analysis
- Modality Balance
- Room Catalog, Room Events, Modality Definitions, CAL-GETC, and Curriculum Crosswalk admin utilities

Reports implemented primarily in `js/enrollment-analytics.js` with support from `js/core/*` and `js/enrollment/*`:

- Enrollment Analytics Dashboard
- Enrollment Planning Forecast
- Enrollment Attrition
- Section Consolidation
- Student Presence
- Instructor Availability
- Faculty Schedule Heatmap
- Faculty Modality
- Prime Time Analysis
- Supply vs. Demand
- Busy Time Dashboard
- Schedule Opportunity
- Schedule Recommendation
- Schedule Optimization Lab
- Schedule Builder
- Conflict Check Report
- Archived Schedule
- Enrollment Snapshot
- Work Experience Enrollment
- Data Validation

## Shared Calculations and Duplicated Patterns

Shared helpers already exist for term normalization, day parsing, modality normalization, physical time handling, section modeling, enrollment metrics, consolidation, dashboard summaries, schedule building, optimization, faculty parsing/modeling, formatting, metric definitions, and visualization export utilities.

Duplicated or high-risk calculation patterns remain in several report renderers:

- CRN and meeting deduplication rules are repeated or adapted across time-based reports.
- Enrollment basis selection appears in multiple places.
- Term filtering and like-term comparison logic is spread across reports.
- CSV row construction and export metadata are report-specific.
- Report filters often normalize campus, division, discipline, modality, and term values independently.
- DOM table rendering and summary card rendering are repeatedly hand-built.

## Direct File and API Access by Reports

Report and admin code directly performs browser file reads, CSV parsing, and backend `fetch` calls. Important route families include:

- `/api/schedule/:term`
- `/api/analytics-archive` and `/api/analytics-archive/:term`
- `/api/faculty-schedules` and `/api/faculty-schedules/:term`
- `/api/rooms` and room import/export routes
- `/api/events` and event import/export routes
- `/api/modalities`
- `/api/cal-getc`
- `/api/curriculum-crosswalk`
- `/api/enrollment-snapshots`
- `/api/work-experience`
- `/api/export-capabilities`
- `/api/schedule-change/convert-docx-to-pdf`
- `/api/schedule-change/send-email`

The direct API access is functional but creates tight coupling between report code, storage shape, and backend route names.

## Hard-Coded Configuration Values

Hard-coded configuration currently includes:

- Term lists and term start dates.
- Holiday ranges and planning calendar assumptions.
- Backend endpoint paths.
- Report category names, labels, order, access levels, and descriptions.
- Role labels and access behavior.
- Campus defaults and physical-campus assumptions.
- Prime-time and practical planning windows.
- Utilization thresholds and opportunity categories.
- Export filenames and report titles.
- Room Availability display intervals and grid behavior.

These should be extracted carefully after regression coverage is stable.

## Architectural Risks

- `app.js` remains a large module with startup, state, calculations, rendering, persistence, and exports mixed together.
- `enrollment-analytics.js` is also large and combines report registration, access control, state management, data loading, rendering, calculations, and exports.
- DOM IDs are implicit module boundaries; renaming an element can break multiple reports.
- Several reports depend on `window.COSScheduleApp`, making load order and global shape important.
- Similar datasets use similar names but must remain separate, especially section schedule archives versus faculty schedule archives.
- Async backend loads can update shared state while reports are rendering.
- Fake-DOM tests catch logic regressions but do not fully verify browser layout, real file downloads, or third-party widget behavior.
- Export code is spread across shared utilities and report-specific functions.

## Existing Test Coverage

The current baseline uses Node's built-in test runner. Existing tests cover schedule building, schedule optimization, faculty parsing, room catalog parsing/export behaviors, room events, modality balance calculations, student presence, enrollment dashboard summaries, collapsible sections, visualization export helper presence, and many report calculation edge cases.

Important coverage gaps:

- No full real-browser end-to-end runner is currently part of `npm test`.
- Limited verification of visual layout, chart rendering, and downloaded binary files.
- Backend API contract tests are not part of this frontend test suite.
- Performance and long-running report responsiveness are not measured.
- Some report navigation behavior is verified by static wiring and fake DOM rather than a live browser.

## Recommended Extraction Order

1. Keep expanding regression coverage and preserve fixtures for known good report behavior.
2. Extract static configuration: terms, report registry, role mapping, endpoints, planning windows, and thresholds.
3. Extract backend data services for schedules, analytics archives, faculty schedules, room catalog, events, snapshots, and work experience.
4. Extract shared state adapters so reports read data through explicit services instead of globals.
5. Extract upload/import parsing services by dataset.
6. Extract export services and report-context builders.
7. Extract report registration/access/navigation into a small report shell.
8. Extract Room Availability last or in small slices because it is the primary workspace and has special "do not break" constraints.
9. Extract individual reports one at a time, starting with reports that already rely mostly on `js/core/*` helpers.
10. Standardize summary cards, tables, collapsible sections, and visualization containers after behavior is protected by tests.
