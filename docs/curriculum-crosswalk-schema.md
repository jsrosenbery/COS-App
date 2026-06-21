# Curriculum Crosswalk Schema

The curriculum crosswalk maps legacy/source COS courses to common-course or synonym courses.

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `sourceCourse` | Yes | string | Existing COS/source course code. |
| `synonymCourse` | Yes | string | New/common/synonym course code. |
| `sourceTitle` | No | string | Existing COS/source title. |
| `synonymTitle` | No | string | New/common/synonym title. |
| `changeType` | No | string | Defaults to `Curriculum Crosswalk`. |
| `phase` | No | string | Implementation phase. |
| `cid` | No | string | C-ID or external identifier. |
| `template` | No | string | Template reference. |
| `effectiveTerm` | No | string | First effective term. |
| `notes` | No | string | Free-form context. |

CSV aliases are intentionally broad, including `Source Course`, `Old Course`, `COS Course`, `Synonym Course`, `New Course`, `Common Course`, `Source Title`, `Common Title`, `Change Type`, `Effective Term`, and `Notes`.
