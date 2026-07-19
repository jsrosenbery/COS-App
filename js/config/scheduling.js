(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.COSTimberScheduling = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const PLANNING_TERMS = Object.freeze([
    'Summer 2026', 'Fall 2026', 'Spring 2027',
    'Summer 2027', 'Fall 2027', 'Spring 2028',
    'Summer 2028', 'Fall 2028', 'Spring 2029',
    'Summer 2029', 'Fall 2029', 'Spring 2030',
    'Summer 2030', 'Fall 2030'
  ]);
  const DEFAULT_TERM = 'Fall 2026';
  const TERM_START_DATES = Object.freeze({
    'Summer 2026': '2026-06-01',
    'Fall 2026': '2026-08-10',
    'Spring 2027': '2027-01-19',
    'Summer 2027': '2027-06-07',
    'Fall 2027': '2027-08-10',
    'Spring 2028': '2028-01-18',
    'Summer 2028': '2028-06-05',
    'Fall 2028': '2028-08-14',
    'Spring 2029': '2029-01-16',
    'Summer 2029': '2029-06-04',
    'Fall 2029': '2029-08-13',
    'Spring 2030': '2030-01-14',
    'Summer 2030': '2030-06-03',
    'Fall 2030': '2030-08-12'
  });

  const DAY_CODES = Object.freeze(['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']);
  const DAY_NAMES = Object.freeze({
    SU: 'Sunday',
    MO: 'Monday',
    TU: 'Tuesday',
    WE: 'Wednesday',
    TH: 'Thursday',
    FR: 'Friday',
    SA: 'Saturday'
  });
  const DAY_NAME_LIST = Object.freeze(DAY_CODES.map(code => DAY_NAMES[code]));
  const WEEKDAY_NAMES = Object.freeze(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  const PRIME_DAY_NAMES = Object.freeze(['Monday', 'Tuesday', 'Wednesday', 'Thursday']);
  const HALF_HOUR_MINUTES = 30;
  const FIVE_MINUTE_SECONDS = 300;
  const STANDARD_TIME_GRID = Object.freeze({
    startMinutes: 6 * 60,
    endMinutes: 22 * 60,
    incrementMinutes: HALF_HOUR_MINUTES
  });
  const ROOM_UTILIZATION_WINDOW = Object.freeze({
    instructionalStart: 8 * 60,
    instructionalEnd: 17 * 60,
    primeStart: 9 * 60,
    primeEnd: 15 * 60,
    blockMinutes: HALF_HOUR_MINUTES,
    days: WEEKDAY_NAMES,
    primeDays: PRIME_DAY_NAMES
  });
  const INSTRUCTOR_AVAILABILITY = Object.freeze({
    minSharedAvailabilityMinutes: 30
  });

  return Object.freeze({
    PLANNING_TERMS,
    DEFAULT_TERM,
    TERM_START_DATES,
    DAY_CODES,
    DAY_NAMES,
    DAY_NAME_LIST,
    WEEKDAY_NAMES,
    PRIME_DAY_NAMES,
    HALF_HOUR_MINUTES,
    FIVE_MINUTE_SECONDS,
    STANDARD_TIME_GRID,
    ROOM_UTILIZATION_WINDOW,
    INSTRUCTOR_AVAILABILITY
  });
});
