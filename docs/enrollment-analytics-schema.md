# Enrollment Analytics Schema

Enrollment analytics uses schedule CSV rows plus optional historical CSV uploads or archived analytics terms. Fields are normalized from the same source data as the scheduling app.

## Core Fields

| Canonical field | Required | Notes |
| --- | --- | --- |
| `term` | Strongly recommended | Derived from row data, filename, or current selected term. |
| `crn` | Strongly recommended | Used to deduplicate multi-meeting rows. |
| `subject` | Yes | Discipline/grouping key. |
| `course` | Yes | Course/grouping key. |
| `section` | No | Section-level grouping. |
| `campus` | No | Campus filters and grouping. |
| `modality` | No | Online/in-person/hybrid grouping and omissions. |
| `instructor` | No | Instructor availability. |
| `days` | No | Instructor availability and time patterns. |
| `start` / `end` | No | Instructor availability and time patterns. |

## Enrollment Metrics

| Canonical field | Required | Notes |
| --- | --- | --- |
| `cap` | Recommended | Capacity/fill-rate calculations. |
| `actual` | Recommended | Final/current enrollment. |
| `census` | Recommended | Attrition and FTES basis; falls back to `actual` when absent. |
| `waitlist` | Optional | Demand forecast pressure signal. |
| `fillRate` | Derived | Uses `actual / cap` when capacity is present. |
| `closedPriorCensus` | Optional | Demand forecast signal. |

## FTES Fields

| Canonical field | Required | Notes |
| --- | --- | --- |
| `ftes` | Optional | Used directly when present. |
| `accountingMethod` | Recommended | `W`, `D`, `P`, `E`, `IW`, `ID`, `I`, or `O`. |
| `units` | Optional | Fallback FTES estimation. |
| `weeklyHours` | Optional | Weekly census FTES estimation. |
| `dailyHours` | Optional | Daily census FTES estimation. |
| `totalContactHours` | Optional | Daily/positive attendance FTES estimation. |

`I` and `O` accounting methods are omitted from reportable FTES calculations. `E` is treated as open-entry/open-exit positive attendance.
