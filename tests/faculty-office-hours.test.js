const assert = require('node:assert/strict');
const test = require('node:test');

const officeHours = require('../js/core/faculty-office-hours');

test('faculty office-hours parser normalizes the supplied export shape', () => {
  const csv = [
    'FACULTY,DAYS,FROM_TIME,TO_TIME,OFFICE_LOCATION,TOTAL_MINUTES_WEEKLY,FROM_DATE,TO_DATE,PHONE_NUMBER,DIVISION,FACULTY_TYPE',
    '"Ahle, Aimee S",TR,11:00 AM,12:00 PM,Kaweah 251B,120,8/10/2026,12/15/2026,661 2048843,Language,Full-Time Instructor'
  ].join('\n');
  const parsed = officeHours.parseCsv(csv, { term: 'Fall 2026' });
  const row = parsed.meetings[0];

  assert.equal(parsed.rowCount, 1);
  assert.equal(row.instructor, 'Ahle, Aimee S');
  assert.deepEqual(row.days, ['TU', 'TH']);
  assert.equal(row.start, '11:00');
  assert.equal(row.end, '12:00');
  assert.equal(row.officeLocation, 'Kaweah 251B');
  assert.equal(row.term, 'FALL 2026');
  assert.equal(row.facultyType, 'FULL_TIME');
  assert.equal(officeHours.hasFixedMeeting(row), true);
});

test('faculty office-hours deduplication preserves distinct recurring blocks', () => {
  const base = { FACULTY: 'Alvarez, Candido', DAYS: 'M', FROM_TIME: '11:00 AM', TO_TIME: '12:00 PM', FROM_DATE: '8/17/2026', TO_DATE: '12/7/2026' };
  const rows = [base, { ...base }, { ...base, DAYS: 'W' }].map(row => officeHours.normalizeRow(row, { term: 'FALL 2026' }));
  assert.equal(officeHours.dedupeRows(rows).length, 2);
});

test('faculty identity keys match expanded and abbreviated given names', () => {
  assert.equal(officeHours.facultyIdentityKey('Anderson, Christian Webster Qureshi'), officeHours.facultyIdentityKey('Anderson, Christian'));
});

test('office-hours rows without a day do not create fixed busy periods', () => {
  const row = officeHours.normalizeRow({ FACULTY: 'Aceves, Justin Michael', DAYS: '', FROM_TIME: '4:00 PM', TO_TIME: '5:00 PM' }, { term: 'FALL 2026' });
  assert.equal(officeHours.hasFixedMeeting(row), false);
});
