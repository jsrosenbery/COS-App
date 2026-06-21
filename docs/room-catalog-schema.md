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

CSV aliases include `Campus`, `Building`, `Room`, `Capacity`, `Room Type`, `Type`, `Cap`, and `roomType`.
