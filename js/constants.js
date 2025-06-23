// constants.js - App-wide static configuration and shared values

// Days of the week used throughout the app
export const hmDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Official Term Start Dates for calendar navigation
export const termStartDates = {
  'Summer 2025': '2025-06-05',
  'Fall 2025': '2025-08-11',
  'Spring 2026': '2026-01-12',
  'Summer 2026': '2026-06-01',
  'Fall 2026': '2026-08-10',
  'Spring 2027': '2027-01-19',
  'Summer 2027': '2027-06-07',
  'Fall 2027': '2027-08-10',
  'Spring 2028': '2028-01-18'
};

// Holiday date ranges (inclusive, in ISO YYYY-MM-DD)
export const holidayRanges = [
  ['2025-06-19','2025-06-19'],
  ['2025-07-04','2025-07-04'],
  ['2025-09-01','2025-09-01'],
  ['2025-11-11','2025-11-11'],
  ['2025-11-24','2025-11-28'],
  ['2025-12-24','2025-12-31'],
  ['2026-01-01','2026-01-01'],
  ['2026-01-19','2026-01-19'],
  ['2026-02-13','2026-02-13'],
  ['2026-02-16','2026-02-16'],
  ['2026-03-30','2026-03-31'],
  ['2026-04-01','2026-04-03'],
  ['2026-05-25','2026-05-25'],
  ['2026-06-19','2026-06-19'],
  ['2026-07-03','2026-07-03'],
  ['2026-09-07','2026-09-07'],
  ['2026-11-11','2026-11-11'],
  ['2026-11-23','2026-11-27'],
  ['2026-12-24','2026-12-31'],
  ['2027-01-01','2027-01-01'],
  ['2027-01-18','2027-01-18'],
  ['2027-02-12','2027-02-15'],
  ['2027-03-22','2027-03-26'],
  ['2027-05-31','2027-05-31'],
  ['2027-06-18','2027-06-18'],
  ['2027-07-05','2027-07-05'],
  ['2027-09-06','2027-09-06'],
  ['2027-11-11','2027-11-11'],
  ['2027-11-22','2027-11-26'],
  ['2027-12-23','2027-12-31'],
  ['2028-01-17','2028-01-17'],
  ['2028-02-18','2028-02-21'],
  ['2028-04-10','2028-04-14'],
  ['2028-05-29','2028-05-29'],
];

// Set of all holidays for fast lookup (flattened from holidayRanges)
export const holidaySet = (() => {
  const out = new Set();
  for (const [start, end] of holidayRanges) {
    let d = new Date(start);
    const endD = new Date(end);
    while (d <= endD) {
      out.add(d.toISOString().slice(0,10));
      d.setDate(d.getDate() + 1);
    }
  }
  return out;
})();
