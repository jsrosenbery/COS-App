const assert = require('node:assert/strict');
const test = require('node:test');

const dateUtils = require('../js/utils/dateUtils.js');
const timeUtils = require('../js/utils/timeUtils.js');
const mathUtils = require('../js/utils/mathUtils.js');
const validationUtils = require('../js/utils/validationUtils.js');
const exportUtils = require('../js/utils/exportUtils.js');
const utils = require('../js/utils/index.js');

test('time utils preserve existing parsing and half-hour formatting behavior', () => {
  assert.equal(timeUtils.parseHour('12:00 AM'), 0);
  assert.equal(timeUtils.parseHour('12:30 PM'), 12.5);
  assert.equal(timeUtils.parseHour('8:15'), 8.25);
  assert.equal(timeUtils.parseHour('bad'), null);
  assert.equal(timeUtils.minutesFromTime('08:10'), 490);
  assert.equal(timeUtils.minutesFromTime('8:10'), 490);
  assert.equal(timeUtils.minutesFromTime('8:10 AM'), null);
  assert.deepEqual(timeUtils.buildHalfHourSlots(8, 9.5), [8, 8.5, 9]);
  assert.equal(timeUtils.formatHourLabel(13.5), '1:30 PM');
  assert.equal(timeUtils.formatMinutesAsHourLabel(0), '12:00 AM');
  assert.equal(timeUtils.overlapMinutes(8 * 60, 10 * 60, 9 * 60, 11 * 60), 60);
  assert.equal(timeUtils.intervalsOverlap(8 * 60, 9 * 60, 9 * 60, 10 * 60), false);
  assert.equal(timeUtils.intervalsOverlap(8 * 60, 9.5 * 60, 9 * 60, 10 * 60), true);
});

test('date utils preserve local date parsing and display behavior', () => {
  assert.equal(dateUtils.parseDateOnly('2026-08-10').getFullYear(), 2026);
  assert.equal(dateUtils.parseDateOnly('8/10/26').getFullYear(), 2026);
  assert.equal(dateUtils.parseDateOnly(''), null);
  assert.equal(dateUtils.formatMonthDay(new Date(2026, 7, 10)), '8/10');
  assert.equal(dateUtils.formatSectionDate('8/10/26'), '8/10/2026');
  assert.equal(dateUtils.formatSectionDate('not-a-date'), 'not-a-date');
  assert.equal(dateUtils.dateRangesOverlap({ start: 1, end: 3 }, { start: 3, end: 4 }), true);
  assert.equal(dateUtils.dateRangesOverlap({ start: 1, end: 2 }, { start: 3, end: 4 }), false);
  assert.equal(dateUtils.dateRangesOverlap(null, { start: 3, end: 4 }), true);
});

test('math validation and export utils preserve primitive helper behavior', () => {
  assert.equal(mathUtils.safeDiv(10, 2), 5);
  assert.equal(mathUtils.safeDiv(10, 0), 0);
  assert.equal(mathUtils.roundTo(12.34, 1), 12.3);
  assert.equal(mathUtils.percentLabel(0.1234), '12.3%');
  assert.equal(mathUtils.clamp(12, 0, 10), 10);
  assert.equal(validationUtils.canon('  fall   2026 '), 'FALL 2026');
  assert.equal(validationUtils.normalizeKey('Room Priority_2'), 'roompriority2');
  assert.equal(exportUtils.slugify('Fall 2026 Summary'), 'fall-2026-summary');
  assert.equal(exportUtils.slugify('', 'loaded-source'), 'loaded-source');
  assert.equal(exportUtils.csvSafe('A,B'), '"A,B"');
  assert.equal(exportUtils.csvSafe('A "quote"'), '"A ""quote"""');
});

test('combined utility index exposes utility groups for browser-style consumers', () => {
  assert.equal(utils.time.formatHourLabel(8), '8:00 AM');
  assert.equal(utils.date.formatMonthDay(new Date(2026, 0, 2)), '1/2');
  assert.equal(utils.math.safeDiv(1, 0), 0);
  assert.equal(utils.validation.canon(' a '), 'A');
  assert.equal(utils.export.slugify('A B'), 'a-b');
});
