# FTES reconciliation hardening

## Verified baseline

The supplied institutional comparison establishes these audit targets; they are not correction factors.

| Term | Institutional FTES | Previous TIMBER FTES | Previous variance |
| --- | ---: | ---: | ---: |
| Fall 2026 | 5,729.04 | 6,054.86 | +325.82 |
| Summer 2026 | 956.47 | 930.04 | -26.43 |

No revised aggregate is claimed here because the repository does not contain the CRN-level Fall 2026 and Summer 2026 institutional validation workbooks needed to run the reconciliation. The in-app FTES Formula Reconciliation export is the authoritative way to produce revised totals, accounting-method summaries, CRNs outside the 0.01 tolerance, and largest residuals once those files are loaded.

## Source-supported production corrections

- A supplied direct FTES value now supersedes standardized and legacy calculations.
- `RES_CENSUS`/resident/reportable census is used as the FTES enrollment basis when present. Total census remains the documented fallback; no resident adjustment is invented.
- P/E uses a direct FTES value or an explicit actual positive-attendance-hours field. Scheduled contact hours are no longer treated as actual positive attendance. Without actual hours/direct FTES, production FTES is unavailable; historical prediction remains a separate planning value.
- Work Experience uses a supplied dedicated FTES value. Generic W/IW/D/ID or units-based fallback is no longer used. The observed threefold variance was not converted into an unsupported divide-by-three rule.
- Provenance (`DIRECT`, `CALCULATED_STANDARDIZED`, `CALCULATED_LEGACY`, `POSITIVE_ATTENDANCE_ACTUAL`, `UNAVAILABLE`) and maturity (`CONFIRMED`, `ESTIMATED`, `UNAVAILABLE`) are recorded separately.

## Reconciliation additions

The CRN-level reconciliation now carries:

- current, census, Census 2, and reportable/resident enrollment bases;
- institutional Census, Res Census, DCH, WCH, DSCH, WSCH, Positive Hours, contact hours, and FTES where supplied;
- units, hours, included/excluded meeting components, production method, provenance, maturity, direct FTES, predicted FTES, and calculated FTES;
- variance, absolute variance sorting, and expanded failure categories for enrollment basis, P/E basis, Work Experience, DSCH/WSCH eligibility, and standardized components.

## Intentionally unresolved

- D/ID multi-component aggregation was not changed without CRN-level evidence that identifies which repeated meeting rows are distinct institutional components.
- IW aggregation was not globally changed to MAX or SUM. Existing component diagnostics remain available because either blanket rule would regress legitimate cases.
- A scheduled-hours row with institutional DSCH/WSCH of zero cannot be classified correctly unless Section Seating supplies an eligibility/reportability field or the institutional intermediate DSCH/WSCH value.
- Fall 2026 standardized 18/36/54 conversions remain in place. Direct institutional FTES now wins when it is supplied, and missing/mismatched component units remain unavailable rather than falling back silently.

## Requested source fields

For complete reconciliation, add these authoritative fields to the current Section Seating export where available: `RES_CENSUS`, actual `POSITIVE_HOURS`, `DCH`, `WCH`, `DSCH`, `WSCH`, an explicit FTES-reportability/eligibility indicator, component schedule type, lecture/lab/activity units, and direct institutional FTES with source/as-of metadata.
