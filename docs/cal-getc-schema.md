# CAL-GETC Mapping Schema

CAL-GETC mappings connect normalized course codes to CAL-GETC areas and divisions for analysis filters.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `code` | Yes | string | Normalized course code, for example `ENGL C1000`. |
| `areas` | One of `areas` or `divisions` | string[] | CAL-GETC area labels. CSV values may be separated by semicolon, comma, or pipe. |
| `divisions` | One of `areas` or `divisions` | string[] | CAL-GETC division labels. CSV values may be separated by semicolon, comma, or pipe. |

CSV aliases include `Code`, `Course`, `Course Code`, `Areas`, `Area`, `CAL-GETC Area`, `Divisions`, `Division`, and `CAL-GETC Division`.
