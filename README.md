# COS Scheduling App

Static frontend for College of the Sequoias scheduling, room utilization, and enrollment planning workflows. The deployed app is plain HTML, CSS, and browser JavaScript backed by the Render API in `js/config.js`.

## Run Locally

```bash
npm install
npm start
```

The start script uses the local `live-server` dev dependency on `127.0.0.1:8080`. The active browser entrypoint is `index.html`, which loads `js/config.js`, `js/parser.js`, mapping/catalog data files, and then `js/app.js`.

## Tests

```bash
npm test
```

The current smoke tests exercise the extracted Enrollment Management metric and consolidation modules under Node's built-in test runner.

## Runtime Config

Frontend API calls read `window.BACKEND_BASE_URL`, initialized by `js/config.js`.

```js
window.COS_APP_CONFIG = {
  backendBaseUrl: 'https://app-backend-pp98.onrender.com'
};
```

For a different backend, override `window.COS_APP_CONFIG.backendBaseUrl` before `js/config.js` loads or edit `js/config.js` for that deployment.

## Architecture

- `index.html`: static shell, view containers, admin mounts, and script load order.
- `js/app.js`: active scheduling app, term tabs, uploads, room availability, heatmap, modality balance, room utilization, schedule grid, FullCalendar view, and admin imports.
- `js/config.js`: single frontend configuration surface for backend URL, environment flags, and feature toggles.
- `js/shared/utils.js`: shared browser utilities for gradual extraction from `app.js`.
- `js/admin.js`, `js/availability.js`, `js/heatmap.js`, `js/modality.js`, `js/utilization.js`: feature namespaces used as landing zones while `app.js` is split.
- `js/parser.js`: CSV parsing/normalization plus compatibility shims for the enrollment analytics module.
- `js/enrollment-analytics.js`: supplemental Enrollment Management report UI/orchestration loaded by `parser.js`.
- `js/enrollment/metrics.js`: shared enrollment metric calculations used by reports and smoke tests.
- `js/enrollment/consolidation.js`: Section Consolidation recommendation logic used by the report and smoke tests.
- `js/cal_getc_mapping.js`, `js/curriculum_crosswalk.js`, `js/roomCatalog.js`: bundled fallback data used when backend data is missing.

`js/main.js` was an older modular entrypoint. It expected DOM IDs that are not present in `index.html` and was not loaded by the app shell, so it was removed as orphaned code.

## Backend

Production API: `https://app-backend-pp98.onrender.com`

Repository: `jsrosenbery/App-Backend`

Important endpoints used by the frontend:

- `GET /api/schedule/:term`
- `POST /api/schedule/:term`
- `GET /api/rooms`
- `POST /api/rooms/export`
- `POST /api/rooms/import`
- `GET /api/modalities`
- `POST /api/modalities/import`
- `GET /api/cal-getc`
- `POST /api/cal-getc/import`
- `GET /api/curriculum-crosswalk`
- `POST /api/curriculum-crosswalk/import`
- `GET /api/analytics-archive`
- `GET /api/analytics-archive/:term`
- `POST /api/analytics-archive/:term`
- `POST /api/auth/enrollment-management`

Write endpoints are protected by the backend `UPLOAD_PASSWORD` environment variable. Do not commit upload or admin passwords to this public frontend repository.

Enrollment Management unlock uses `POST /api/auth/enrollment-management`. The backend validates the entered password and returns a short-lived session token; the frontend stores only that token in `sessionStorage`.

## Data Notes

Schedule uploads are expected to include fields such as term, CRN, subject/course, title, division, campus, building, room, days, meeting time, date range, instructor, modality/instructional method, capacity, enrollment, census, waitlist, FTES/contact-hour fields, and accounting method. The frontend contains normalization helpers for common header variants.

Developer schema references:

- [Schedule CSV schema](docs/csv-schema.md)
- [Room catalog schema](docs/room-catalog-schema.md)
- [CAL-GETC schema](docs/cal-getc-schema.md)
- [Curriculum crosswalk schema](docs/curriculum-crosswalk-schema.md)
- [Enrollment analytics schema](docs/enrollment-analytics-schema.md)

## Cleanup Priorities

1. Continue moving large report/tool sections out of `js/app.js` only after each extraction has focused browser regression testing.
2. Convert feature namespaces into deeper modules as local state is untangled from the `DOMContentLoaded` closure.
3. Expand automated coverage from enrollment analytics smoke tests into browser smoke tests for upload, room availability, heatmap, modality, utilization, and Enrollment Management unlock flows.
