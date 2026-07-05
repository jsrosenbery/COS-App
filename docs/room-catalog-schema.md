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
| `priority` | No | string | Room priority division/area. Missing or blank values normalize to `Unassigned`. |

CSV aliases include `Campus`, `Building`, `Room`, `Capacity`, `Room Type`, `Type`, `Cap`, `roomType`, `Room Priority`, `Priority Division`, `Priority Area`, `Primary Division`, `Dean Area`, `Assigned Division`, and `Preferred Division`.
