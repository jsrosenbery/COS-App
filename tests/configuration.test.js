const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const config = require('../js/config/index.js');

test('centralized config exposes report identifiers access and order', () => {
  const { REPORTS, REPORT_ACCESS, REPORT_ORDER, REPORT_LABEL, REPORT_WORKFLOW_GROUPS, REPORT_DESCRIPTIONS } = config.reports;

  assert.equal(REPORTS.scheduleBuilder, 'schedule-builder');
  assert.equal(REPORTS.facultyHeatmap, 'faculty-schedule-heatmap');
  assert.equal(REPORTS.dataHub, 'source-data-hub');
  assert.equal(REPORTS.ftesReconciliation, 'ftes-reconciliation');
  assert.equal(REPORT_ACCESS[REPORTS.instructorAvailability], 'general');
  assert.equal(REPORTS.twoYearProgramFeasibility, 'two-year-program-feasibility');
  assert.equal(REPORTS.catalogProgramRequirements, 'catalog-program-requirements');
  assert.equal(REPORT_ACCESS[REPORTS.scheduleBuilder], 'dean');
  assert.equal(REPORT_ACCESS[REPORTS.twoYearProgramFeasibility], 'admin');
  assert.equal(REPORT_ACCESS[REPORTS.catalogProgramRequirements], 'admin');
  assert.equal(REPORT_ACCESS[REPORTS.dataHub], 'admin');
  assert.equal(REPORT_ACCESS[REPORTS.ftesReconciliation], 'admin');
  assert.equal(REPORT_ACCESS[REPORTS.heatmap], 'divchair');
  assert.equal(REPORT_LABEL[REPORTS.dataHub], 'Source Data Hub');
  assert.equal(REPORT_LABEL[REPORTS.ftesReconciliation], 'FTES Reconciliation');
  assert.equal(REPORT_LABEL[REPORTS.twoYearProgramFeasibility], 'Program Schedule Viability');
  assert.equal(REPORT_LABEL[REPORTS.catalogProgramRequirements], 'Catalog & Program Requirements');
  assert.equal(REPORT_LABEL[REPORTS.demand], 'Enrollment Planning Forecast');
  assert.equal(REPORT_LABEL[REPORTS.duration], 'Course Duration Heatmap');
  assert.deepEqual(REPORT_WORKFLOW_GROUPS.map(group => group.label), ['Public Reports', 'Division Chair / Administrative Assistant', 'Dean', 'Enrollment Management', 'System Administrator']);
  assert.deepEqual(REPORT_WORKFLOW_GROUPS[0].reports, [REPORTS.instructorAvailability]);
  assert.equal(REPORT_WORKFLOW_GROUPS[3].reports.includes(REPORTS.twoYearProgramFeasibility), false);
  assert.ok(REPORT_WORKFLOW_GROUPS[4].reports.includes(REPORTS.twoYearProgramFeasibility));
  assert.equal(REPORT_WORKFLOW_GROUPS[4].reports.indexOf(REPORTS.twoYearProgramFeasibility), REPORT_WORKFLOW_GROUPS[4].reports.indexOf(REPORTS.catalogProgramRequirements) + 1);
  assert.equal(REPORT_DESCRIPTIONS[REPORTS.emSnapshot], 'Review current enrollment, confirmed FTES, estimated FTES, and historically predicted FTES.');
  assert.ok(REPORT_ORDER.indexOf(REPORTS.instructorAvailability) < REPORT_ORDER.indexOf(REPORTS.heatmap));
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
