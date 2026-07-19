const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const config = require('../js/config/index.js');

test('centralized config exposes report identifiers access and order', () => {
  const { REPORTS, REPORT_ACCESS, REPORT_ORDER, REPORT_LABEL } = config.reports;

  assert.equal(REPORTS.scheduleBuilder, 'schedule-builder');
  assert.equal(REPORTS.facultyHeatmap, 'faculty-schedule-heatmap');
  assert.equal(REPORT_ACCESS[REPORTS.scheduleBuilder], 'dean');
  assert.equal(REPORT_ACCESS[REPORTS.heatmap], 'divchair');
  assert.equal(REPORT_LABEL[REPORTS.demand], 'Enrollment Planning Forecast');
  assert.ok(REPORT_ORDER.indexOf(REPORTS.instructorAvailability) < REPORT_ORDER.indexOf(REPORTS.dashboard));
});

test('centralized campus config preserves default campus behavior', () => {
  assert.deepEqual(config.campuses.CAMPUS_CODES, ['COS', 'TCC', 'HAC', 'ONT', 'ONH', 'ONC']);
  assert.deepEqual(config.campuses.PHYSICAL_CAMPUS_CODES, ['COS', 'TCC', 'HAC']);
  assert.deepEqual(config.campuses.SCHEDULE_BUILDER_DEFAULT_CAMPUS_CODES, ['ONC', 'ONT', 'ONH', 'HAC', 'TCC', 'COS']);
});

test('centralized scheduling and threshold config preserves planning constants', () => {
  assert.equal(config.scheduling.DEFAULT_TERM, 'Fall 2026');
  assert.equal(config.scheduling.TERM_START_DATES['Fall 2026'], '2026-08-10');
  assert.equal(config.scheduling.HALF_HOUR_MINUTES, 30);
  assert.equal(config.scheduling.INSTRUCTOR_AVAILABILITY.minSharedAvailabilityMinutes, 30);
  assert.equal(config.thresholds.ROOM_UTILIZATION.weights.overall, 0.4);
  assert.equal(config.thresholds.ROOM_UTILIZATION.underutilizedRoomCapacityShare, 0.7);
});

test('centralized modality config preserves reportable labels and chart colors', () => {
  assert.deepEqual(config.modalities.REPORTABLE_MODALITY_LABELS, ['In-Person', 'Hybrid', 'Online']);
  assert.deepEqual(config.modalities.PHYSICAL_MODALITY_LABELS, ['In-Person', 'Hybrid']);
  assert.deepEqual(config.modalities.MODALITY_BALANCE_CATEGORY_ORDER, ['In-Person', 'Hybrid', 'Online', 'Dual Enrollment']);
  assert.equal(config.modalities.FACULTY_MODALITY_COLORS.Online, '#7c3aed');
});

test('index loads centralized config before application modules', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const configIndex = index.indexOf('src="js/config/index.js"');

  assert.ok(configIndex > index.indexOf('src="js/config.js"'));
  assert.ok(configIndex < index.indexOf('src="js/app.js"'));
  assert.ok(configIndex < index.indexOf('src="js/enrollment-analytics.js"'));
});
