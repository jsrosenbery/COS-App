# Schedule CSV Schema

The frontend accepts Banner-style schedule exports with flexible header aliases. Required fields are the minimum needed for room scheduling views; analytics fields are optional but improve report quality.

## Required Fields

| Canonical field | Common aliases | Notes |
| --- | --- | --- |
| `CRN` | `Course Reference Number`, `CRN_KEY` | Used to deduplicate multi-meeting sections. |
| `Subject` | `SUBJECT`, `Discipline`, `DISCIPLINE` | Course discipline. |
| `Course` | `COURSE`, `Course_Number`, `Course Number`, `Catalog` | Catalog number. Supports common-course numbers such as `C1000`. |
| `Building` | `BUILDING`, `Bldg`, `Facility Building` | Ignored when value is `ONLINE`. |
| `Room` | `ROOM`, `Room Number`, `Facility Room` | Blank, `N/A`, and `LIVE` are ignored. |
| `Days` | `DAYS`, `Meeting Days`, `Mtg Days`, `Meeting Pattern` | Supports `MTWRFSU` style or day names. |
| `Start_Time` | `Start Time`, `Begin Time`, `Meeting Start` | Can also be parsed from a combined `Time` field. |
| `End_Time` | `End Time`, `Stop Time`, `Meeting End` | Can also be parsed from a combined `Time` field. |
| `Start_Date` | `Start Date`, `Section Start Date` | Used by availability and calendar views. |
| `End_Date` | `End Date`, `Section End Date` | Used by availability and calendar views. |

## Optional Fields

| Canonical field | Common aliases | Notes |
| --- | --- | --- |
| `Title` | `Course Title`, `Section Title` | Display and report context. |
| `Division` | `Academic Division`, `School`, `Area` | Analysis filters. |
| `Campus` | `CAMPUS`, `Campus Code`, `Location` | Analysis and availability filters. |
| `Instructor` | `Faculty`, `Primary Instructor` | Instructor availability report. |
| `Instructional_Method` | `Instructional Method`, `Method`, `Modality` | Modality balance and analytics omissions. |
| `Capacity` | `Seats`, `Max Enrollment`, `MAX ENROLL` | Fill-rate and demand calculations. |
| `Actual_Enroll` | `Enrollment`, `Enroll`, `Current Enrollment` | Enrollment analytics. |
| `Census_Enroll` | `Census Enrollment`, `Census Enroll` | Attrition and FTES calculations. |
| `Waitlist` | `Waitlist Count`, `WAIT_COUNT` | Demand forecast. |
| `FTES` | `Full Time Equivalent Students` | Used directly when present. |
| `ACCOUNTING METHOD` | `Accounting Method`, `ACCOUNTING_METHOD` | FTES estimation and report omissions. |
| `TOTAL_CONTACT_HOURS` | `Total Contact Hours`, `Contact Hours` | FTES estimation. |
| `HOURS_PER_WEEK` | `Weekly Hours`, `WSCH` | Weekly census FTES estimation. |
| `HOURS_PER_DAY` | `Daily Hours` | Daily census FTES estimation. |
| `Units` | `Credit Hours`, `SESSION_CREDIT_HOURS` | Fallback FTES estimation. |
