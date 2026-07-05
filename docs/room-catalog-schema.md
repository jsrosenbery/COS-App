# Room Catalog Schema

Room catalog data may be imported as CSV or JSON. The backend stores normalized JSON at `rooms.json`.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `campus` | No | string | Campus or site label. |
| `building` | Yes | string | Building code. |
| `room` | Yes | string | Room number/code. |
| `buildingRoom` | Derived | string | Normalized as `building-room`. |
| `type` | No | string | Room type such as classroom, lab, lecture, office, or specialty space. |
| `capacity` | No | number/null | Seat capacity. Non-numeric values become `null`. |
| `priorityDivision1` | No | string | First scheduling preference division. Missing or blank values normalize to `Unassigned`. |
| `priorityDivision2` | No | string | Secondary scheduling preference division. Missing or blank values normalize to `None`. |
| `rawPriorityDivision1` | Derived | string | Original imported value for the first priority field, preserved for diagnostics. |
| `rawPriorityDivision2` | Derived | string | Original imported value for the second priority field, preserved for diagnostics. |
| `roomFeatures` | No | string[] | Optional room attributes parsed from comma- or semicolon-separated text. Missing values stay blank. |
| `rawRoomFeatures` | Derived | string | Original imported room feature text, preserved for diagnostics. |

CSV aliases include `Campus`, `Building`, `Room`, `Capacity`, `Room Type`, `Type`, `Cap`, and `roomType`.

Priority Division 1 aliases include `Priority Division 1`, `Priority Division`, `Room Priority`, `Primary Division`, `Assigned Division`, `Preferred Division`, `Dean Area`, and `Priority Area`.

Priority Division 2 aliases include `Priority Division 2`, `Secondary Division`, `Secondary Priority`, `Priority 2`, `Room Priority 2`, and `Room Priority_2`.

Room Features aliases include `Room Features`, `Features`, `Preferred Room Features`, `Technology Features`, `Instructional Features`, `Equipment`, and `Notes`.

`Administration` is treated as shared/general-use instructional space, not as an exclusive division preference. Priority fields currently provide metadata for future schedule optimization recommendations and do not change Room Availability behavior.

Room Features are optional room attributes intended for future room-matching and schedule-optimization tools. They do not currently restrict Room Availability results.
