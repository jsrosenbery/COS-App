# Schedule Opportunity: Prior-Term Comparison & Instructional Delivery

Choose a focus term and one or more Historical comparison terms in Schedule Opportunity. The new panel uses the existing report filters and compares each selected historical term separately. Its totals cover all filtered registration rows, including those without fixed meeting hours; the existing time-based heatmaps retain their own online/time treatment. Scenario changes remain in the existing Scenario Before/After report and do not change these source-schedule counts.

No comparison is calculated against an empty dataset, the focus term itself, or multiple combined focus terms. A dataset with no matching rows is identified as unavailable rather than used as a zero baseline. Added/missing courses use normalized course codes within the current filter scope. Capacity versus prior enrollment compares registration seats with enrollment registrations, not unique students or shared-room capacity. Prior waitlists are shown separately; they should not be interpreted as unique additional students.

## Counting rules

- Registration sections: distinct term + CRN.
- Confirmed stacked sections: distinct sections participating in at least one confirmed shared component.
- Stack groups: connected groups of those sections, within a term. Multiple shared meetings do not create multiple class groups.
- Shared components: matching recurring meeting components delivered jointly by two or more CRNs.
- Components not confirmed shared: each remaining known fixed component, including separate labs/support and unresolved possible sharing.
- Delivered components: shared components counted once, plus components not confirmed shared.
- Section weekly pattern hours: duration multiplied by meeting days, summed once per distinct section component.
- Delivered weekly pattern hours: section hours minus duplicated hours in confirmed shared components.
- Confirmed shared percentage: confirmed shared hours / a section's known scheduled hours. If any meeting hours are unavailable, the percentage is unavailable rather than calculated from a partial denominator.

An explicit shared identifier plus matching term, days, start/end times, complete date range, campus/room, instructor, and component type confirms sharing. Boolean/placeholder cross-list values do not establish a group. Duplicate component rows do not inflate hours; conflicting duplicate metadata prevents confirmation. Coincident patterns without sufficient explicit evidence remain possible matches and do not reduce delivery counts. Each shared component lists the other CRNs.

## Examples

Two STAT C1000 CRNs sharing a three-hour main class: two registration sections, two stacked sections, one stack group, one delivered component, and three delivered weekly hours. Separately scheduled support remains another component.

Two BIOL 020 CRNs sharing a three-hour lecture, each with a separate three-hour lab: two registration sections, two stacked sections, one stack group, one shared component, two separate components, three delivered components, and nine delivered weekly hours. Each section is 50% confirmed shared.

## Limits and source coverage

These are recurring weekly pattern hours, not term-total hours, contractual faculty load, cost savings, FTES, or unique student counts. Different date ranges and partial time/day overlaps are intentionally not consolidated. Separate short-term components can contribute different weekly patterns; the sum is not necessarily a peak simultaneous week.

The report uses normalized Schedule Opportunity source rows. It does not infer lecture/lab types from course titles or automatically join the optional Faculty Schedule dataset. Missing meeting type, instructor, room or dates is exposed through evidence coverage; TBA/online placeholders produce unavailable hours. Cross-list ID coverage is shown because zero confirmed stacks does not establish that no stacks exist. Filters may hide stack partners, so counts always describe the filtered scope.

CSV export includes all summary, comparison, offering-change, section-portion and component rows along with the existing Schedule Opportunity export rows. The visible tables cap display at 500 rows each; CSV does not apply that display cap.

Implementation: `js/core/instructional-delivery.js`; report integration: `js/enrollment-analytics.js`; regression coverage: `tests/instructional-delivery.test.js`.
