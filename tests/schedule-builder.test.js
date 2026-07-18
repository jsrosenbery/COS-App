const assert = require('node:assert/strict');
const test = require('node:test');

const builder = require('../js/core/schedule-builder.js');

function row(overrides = {}) {
  return {
    term: 'FALL 2026',
    crn: overrides.crn || '10001',
    subject: overrides.subject || 'ENGL',
    course: overrides.course || 'C1000',
    title: overrides.title || 'College Reading and Writing',
    section: overrides.section || '001',
    units: overrides.units ?? 3,
    campus: overrides.campus || 'COS',
    modality: overrides.modality || 'In-Person',
    days: overrides.days || 'MO',
    start: overrides.start || '09:00',
    end: overrides.end || '10:00',
    startDate: overrides.startDate,
    endDate: overrides.endDate,
    cap: overrides.cap ?? 30,
    actual: overrides.actual ?? 20,
    waitlist: overrides.waitlist ?? 0,
    SCHD_CODE_SSRMEET: overrides.component || 'LEC',
    ...overrides
  };
}

function requests(...courses) {
  return courses.map(course => typeof course === 'string' ? { course, required: true } : course);
}

test('Schedule Builder creates options from two non-overlapping sections', () => {
  const result = builder.buildScheduleOptions([
    row({ crn: '10001', subject: 'ENGL', course: 'C1000', start: '09:00', end: '10:00' }),
    row({ crn: '10002', subject: 'MATH', course: '010', start: '10:30', end: '11:30' })
  ], requests('ENGL C1000', 'MATH 010'), { requireAllRequestedCourses: true });

  assert.equal(result.schedules.length, 1);
  assert.equal(result.schedules[0].sections.length, 2);
  assert.equal(result.schedules[0].complete, true);
});

test('Schedule Builder rejects direct time conflicts and multi-day conflicts', () => {
  const result = builder.buildScheduleOptions([
    row({ crn: '10001', subject: 'ENGL', course: 'C1000', days: 'MW', start: '09:00', end: '10:00' }),
    row({ crn: '10002', subject: 'MATH', course: '010', days: 'WE', start: '09:30', end: '10:30' })
  ], requests('ENGL C1000', 'MATH 010'), { requireAllRequestedCourses: true });

  assert.equal(result.schedules.length, 0);
  assert.match(result.diagnostics.join(' '), /No conflict-free schedule/);
  assert.match(result.partialSchedules.map(item => item.warnings.join(' ')).join(' '), /overlaps/);
});

test('Schedule Builder allows overlapping times when short-term date ranges do not overlap', () => {
  const result = builder.buildScheduleOptions([
    row({ crn: '10001', subject: 'ENGL', course: 'C1000', start: '09:00', end: '10:00', startDate: '2026-08-17', endDate: '2026-10-10' }),
    row({ crn: '10002', subject: 'MATH', course: '010', start: '09:30', end: '10:30', startDate: '2026-10-12', endDate: '2026-12-12' })
  ], requests('ENGL C1000', 'MATH 010'), { requireAllRequestedCourses: true });

  assert.equal(result.schedules.length, 1);
});

test('Schedule Builder treats asynchronous online as no fixed conflict and synchronous online as timed', () => {
  const asyncResult = builder.buildScheduleOptions([
    row({ crn: '10001', subject: 'ENGL', course: 'C1000', modality: 'Asynchronous Online', days: '', start: '', end: '' }),
    row({ crn: '10002', subject: 'MATH', course: '010', days: 'MO', start: '09:00', end: '10:00' })
  ], requests('ENGL C1000', 'MATH 010'), { requireAllRequestedCourses: true });
  const syncResult = builder.buildScheduleOptions([
    row({ crn: '10003', subject: 'COMM', course: 'C1000', modality: 'Synchronous Online', days: 'TU', start: '13:00', end: '14:00' }),
    row({ crn: '10004', subject: 'PSYC', course: 'C1000', days: 'TU', start: '13:30', end: '14:30' })
  ], requests('COMM C1000', 'PSYC C1000'), { requireAllRequestedCourses: true });

  assert.equal(asyncResult.schedules.length, 1);
  assert.match(asyncResult.schedules[0].warnings.join(' '), /Asynchronous online/);
  assert.equal(syncResult.schedules.length, 0);
});

test('Schedule Builder flags hybrid sections for date verification', () => {
  const sections = builder.normalizeSections([row({ crn: '10001', modality: 'Hybrid' })]);

  assert.equal(sections.length, 1);
  assert.match(sections[0].warnings.join(' '), /Hybrid section/);
});

test('Schedule Builder deduplicates CRNs while preserving multi-component meetings', () => {
  const sections = builder.normalizeSections([
    row({ crn: '10001', days: 'MO', start: '09:00', end: '10:00', component: 'LEC' }),
    row({ crn: '10001', days: 'MO', start: '09:00', end: '10:00', component: 'LEC' }),
    row({ crn: '10001', days: 'WE', start: '11:00', end: '12:00', component: 'LAB' })
  ]);

  assert.equal(sections.length, 1);
  assert.equal(sections[0].meetings.length, 2);
});

test('Schedule Builder enforces unit minimum and maximum', () => {
  const rows = [
    row({ crn: '10001', subject: 'ENGL', course: 'C1000', units: 3 }),
    row({ crn: '10002', subject: 'MATH', course: '010', units: 5, start: '10:30', end: '11:30' })
  ];

  assert.equal(builder.buildScheduleOptions(rows, requests('ENGL C1000'), { minUnits: 4 }).schedules.length, 0);
  assert.equal(builder.buildScheduleOptions(rows, requests('ENGL C1000', 'MATH 010'), { maxUnits: 7 }).schedules.length, 0);
});

test('Schedule Builder respects excluded days earliest latest campus max gap and transition preferences', () => {
  const rows = [
    row({ crn: '10001', subject: 'ENGL', course: 'C1000', campus: 'COS', days: 'FR', start: '09:00', end: '10:00' }),
    row({ crn: '10002', subject: 'MATH', course: '010', campus: 'TCC', days: 'MO', start: '07:30', end: '08:30' }),
    row({ crn: '10003', subject: 'COMM', course: 'C1000', campus: 'COS', days: 'MO', start: '09:00', end: '10:00' }),
    row({ crn: '10004', subject: 'PSYC', course: 'C1000', campus: 'COS', days: 'MO', start: '10:05', end: '11:00' }),
    row({ crn: '10005', subject: 'HIST', course: '017', campus: 'COS', days: 'MO', start: '14:00', end: '15:00' })
  ];

  assert.equal(builder.buildScheduleOptions(rows, requests('ENGL C1000'), { excludedDays: ['FR'] }).schedules.length, 0);
  assert.equal(builder.buildScheduleOptions(rows, requests('MATH 010'), { earliestStart: '08:00' }).schedules.length, 0);
  assert.equal(builder.buildScheduleOptions(rows, requests('HIST 017'), { latestEnd: '14:30' }).schedules.length, 0);
  assert.equal(builder.buildScheduleOptions(rows, requests('MATH 010'), { preferredCampuses: ['COS'] }).schedules.length, 0);
  assert.equal(builder.buildScheduleOptions(rows, requests('COMM C1000', 'PSYC C1000'), { minimumTransitionMinutes: 10 }).schedules.length, 0);
  assert.equal(builder.buildScheduleOptions(rows, requests('COMM C1000', 'HIST 017'), { maxGapMinutes: 60 }).schedules.length, 0);
});

test('Schedule Builder handles required and optional courses without optional conflicts', () => {
  const result = builder.buildScheduleOptions([
    row({ crn: '10001', subject: 'ENGL', course: 'C1000', start: '09:00', end: '10:00' }),
    row({ crn: '10002', subject: 'ART', course: '001', start: '09:30', end: '10:30' })
  ], requests({ course: 'ENGL C1000', required: true }, { course: 'ART 001', required: false }), {
    requireAllRequestedCourses: false
  });

  assert.equal(result.schedules.length, 1);
  assert.equal(result.schedules[0].sections.length, 1);
  assert.deepEqual(result.schedules[0].omittedOptionalCourses, ['ART 001']);
});

test('Schedule Builder filters full waitlisted and unknown-seat sections according to preferences', () => {
  assert.equal(builder.buildScheduleOptions([row({ cap: 10, actual: 10 })], requests('ENGL C1000'), { includeFullSections: false }).schedules.length, 0);
  assert.equal(builder.buildScheduleOptions([row({ waitlist: 3 })], requests('ENGL C1000'), { includeWaitlistedSections: false }).schedules.length, 0);
  assert.equal(builder.buildScheduleOptions([row({ cap: 0, actual: 0 })], requests('ENGL C1000'), { includeUnknownSeatStatus: false }).schedules.length, 0);
  assert.equal(builder.buildScheduleOptions([row({ cap: 10, actual: 10 })], requests('ENGL C1000'), { includeFullSections: true }).schedules.length, 1);
});

test('Schedule Builder prevents duplicate same-course selections by default and can allow them', () => {
  const rows = [
    row({ crn: '10001', subject: 'ENGL', course: 'C1000', start: '09:00', end: '10:00' }),
    row({ crn: '10002', subject: 'ENGL', course: 'C1000', start: '10:30', end: '11:30' })
  ];
  const duplicateRequests = requests('ENGL C1000', 'ENGL C1000');

  assert.equal(builder.buildScheduleOptions(rows, duplicateRequests, {}).schedules[0].sections.length, 1);
  assert.equal(builder.buildScheduleOptions(rows, duplicateRequests, { allowMultipleSectionsOfSameCourse: true }).schedules[0].sections.length, 2);
});

test('Schedule Builder returns partial schedules and prunes to maximum results', () => {
  const partial = builder.buildScheduleOptions([
    row({ crn: '10001', subject: 'ENGL', course: 'C1000' })
  ], requests('ENGL C1000', 'MATH 010'), { requireAllRequestedCourses: true });
  const manyRows = Array.from({ length: 5 }, (_, index) => row({
    crn: `2000${index}`,
    subject: 'ENGL',
    course: 'C1000',
    start: `${9 + index}:00`,
    end: `${9 + index}:30`
  }));
  const pruned = builder.buildScheduleOptions(manyRows, requests('ENGL C1000'), { maxResults: 2 });

  assert.equal(partial.schedules.length, 0);
  assert.equal(partial.partialSchedules.length, 1);
  assert.match(partial.diagnostics.join(' '), /MATH 010 has no sections/);
  assert.equal(pruned.schedules.length, 2);
});
