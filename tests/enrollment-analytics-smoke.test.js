const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadEnrollmentModules() {
  const context = {
    window: {},
    console
  };
  context.window.window = context.window;
  vm.createContext(context);
  ['js/enrollment/metrics.js', 'js/enrollment/filters.js', 'js/enrollment/consolidation.js', 'js/enrollment/dashboard.js'].forEach(file => {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  });
  return context.window;
}

function loadEnrollmentAnalyticsRuntime() {
  const context = {
    window: {},
    document: {
      readyState: 'loading',
      addEventListener() {},
      getElementById() { return null; },
      querySelectorAll() { return []; }
    },
    console
  };
  context.window.window = context.window;
  context.window.document = context.document;
  vm.createContext(context);
  ['js/enrollment/metrics.js', 'js/enrollment/filters.js', 'js/enrollment/consolidation.js', 'js/enrollment/dashboard.js', 'js/enrollment-analytics.js'].forEach(file => {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  });
  return context.window;
}

function loadConfigModule() {
  const context = {
    window: {},
    location: { hostname: 'localhost' }
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, '..', 'js/config.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'js/config.js' });
  return context.window.COS_APP_CONFIG;
}

function section(overrides = {}) {
  return {
    term: 'FALL 2026',
    subject: 'PS',
    course: '200M',
    campus: 'VIS',
    modality: 'IN PERSON',
    dayPattern: 'MW',
    days: ['MO', 'WE'],
    start: '09:00',
    end: '10:15',
    timeBlock: '09:00-09:59',
    crn: overrides.crn || '10000',
    cap: 30,
    actual: 12,
    census: 12,
    ...overrides
  };
}

test('metrics use census as the planning enrollment basis', () => {
  const { COSEnrollmentMetrics } = loadEnrollmentModules();
  const row = section({ actual: 18, census: 24, cap: 30 });

  assert.equal(COSEnrollmentMetrics.censusEnrollment(row), 24);
  assert.equal(COSEnrollmentMetrics.finalEnrollment(row), 18);
  assert.equal(COSEnrollmentMetrics.expectedEnrollment(row), 24);
  assert.equal(COSEnrollmentMetrics.expectedOpenSeats(row), 6);
  assert.equal(COSEnrollmentMetrics.expectedFillRate(row), 0.8);
});

test('config exposes future enrollment access feature placeholders', () => {
  const config = loadConfigModule();

  assert.equal(config.features.deanDashboardAccess, true);
  assert.equal(config.features.enrollmentManagementWorkbench, false);
  assert.equal(config.features.scenarioModeling, false);
  assert.equal(config.features.scheduleSimulation, false);
  assert.equal(config.features.enrollmentManagement, true);
});

test('current CSV data without milestone fields still normalizes for attrition', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const row = COSEnrollmentAnalytics.normalizeRow({
    Term: 'FALL 2026',
    CRN: '12345',
    Subject: 'PS',
    Course: '200M',
    Capacity: '30',
    ACTUAL_ENROLL: '18',
    CENSUS_ENROLL: '24'
  });

  assert.equal(row.actual, 18);
  assert.equal(row.census, 24);
  assert.equal(row.firstDay, null);
  assert.equal(row.census1, null);
  assert.equal(row.census2, null);
  assert.equal(row.finalEnrollment, null);
});

test('campus normalization does not use building or location as campus', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const row = COSEnrollmentAnalytics.normalizeRow({
    Term: 'FALL 2026',
    CRN: '12345',
    Subject: 'ART',
    Course: '001',
    Building: 'HACVEB',
    Room: '101',
    Location: 'HACVEB',
    Capacity: '30'
  });

  assert.equal(row.campus, '');
  assert.equal(row.building, 'HACVEB');
  assert.equal(row.room, 'HACVEB 101');
});

test('campus normalization keeps explicit campus fields separate from building', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const row = COSEnrollmentAnalytics.normalizeRow({
    Term: 'FALL 2026',
    Subject: 'ART',
    Course: '001',
    Campus: 'Tulare',
    Building: 'TCC',
    Room: '101'
  });

  assert.equal(row.campus, 'TUL');
  assert.equal(row.building, 'TCC');
});

test('snapshot manager appends partial first-day uploads without deleting prior records', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const firstBatch = COSEnrollmentAnalytics.buildSnapshotRecords([
    { CRN: '10001', Subject: 'ENGL', Course: 'C1000', Section: '001', ACTUAL_ENROLL: '22' }
  ], { term: 'FALL 2027', snapshotType: 'First Day', snapshotDate: '2027-08-16', uploadedAt: '2027-08-16T12:00:00Z' });
  const secondBatch = COSEnrollmentAnalytics.buildSnapshotRecords([
    { CRN: '10002', Subject: 'MATH', Course: '021', Section: '002', ACTUAL_ENROLL: '18' }
  ], { term: 'FALL 2027', snapshotType: 'First Day', snapshotDate: '2027-08-17', uploadedAt: '2027-08-17T12:00:00Z' });

  const firstSave = COSEnrollmentAnalytics.upsertSnapshotRecords([], firstBatch);
  const secondSave = COSEnrollmentAnalytics.upsertSnapshotRecords(firstSave.records, secondBatch);

  assert.equal(firstSave.appended, 1);
  assert.equal(secondSave.appended, 1);
  assert.equal(secondSave.updated, 0);
  assert.equal(secondSave.records.length, 2);
  assert.equal(secondSave.records.map(record => record.crn).sort().join(','), '10001,10002');
});

test('snapshot manager updates same term CRN type instead of duplicating', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const first = COSEnrollmentAnalytics.buildSnapshotRecords([
    { CRN: '10001', Subject: 'ENGL', Course: 'C1000', ACTUAL_ENROLL: '22' }
  ], { term: 'FALL 2027', snapshotType: 'First Day', snapshotDate: '2027-08-16' });
  const updated = COSEnrollmentAnalytics.buildSnapshotRecords([
    { CRN: '10001', Subject: 'ENGL', Course: 'C1000', ACTUAL_ENROLL: '24' }
  ], { term: 'FALL 2027', snapshotType: 'First Day', snapshotDate: '2027-08-18' });

  const saved = COSEnrollmentAnalytics.upsertSnapshotRecords(first, updated);

  assert.equal(saved.appended, 0);
  assert.equal(saved.updated, 1);
  assert.equal(saved.records.length, 1);
  assert.equal(saved.records[0].enrollment, 24);
  assert.equal(saved.records[0].snapshotDate, '2027-08-18');
});

test('stored first-day snapshots merge into lifecycle rows by term and CRN', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    COSEnrollmentAnalytics.normalizeRow({ Term: 'FALL 2027', CRN: '10001', Subject: 'ENGL', Course: 'C1000', ACTUAL_ENROLL: '20', CENSUS_ENROLL: '25' })
  ];
  const snapshots = COSEnrollmentAnalytics.buildSnapshotRecords([
    { CRN: '10001', Subject: 'ENGL', Course: 'C1000', ACTUAL_ENROLL: '12' }
  ], { term: 'FALL 2027', snapshotType: 'First Day', snapshotDate: '2027-08-16' });

  const merged = COSEnrollmentAnalytics.mergeSnapshotsIntoRows(rows, snapshots);

  assert.equal(snapshots[0].sourceFieldUsed, 'ACTUAL_ENROLL');
  assert.equal(merged[0].firstDay, 12);
  assert.match(merged[0].firstDaySource, /Stored FIRST DAY snapshot/);
});

test('snapshot coverage counts missing first-day sections', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    COSEnrollmentAnalytics.normalizeRow({ Term: 'FALL 2027', CRN: '10001', Subject: 'ENGL', Course: 'C1000' }),
    COSEnrollmentAnalytics.normalizeRow({ Term: 'FALL 2027', CRN: '10002', Subject: 'MATH', Course: '021' })
  ];
  const snapshots = COSEnrollmentAnalytics.buildSnapshotRecords([
    { CRN: '10001', Subject: 'ENGL', Course: 'C1000', ACTUAL_ENROLL: '12' }
  ], { term: 'FALL 2027', snapshotType: 'First Day', snapshotDate: '2027-08-16' });

  const coverage = COSEnrollmentAnalytics.snapshotCoverage(rows, snapshots, 'FALL 2027');

  assert.equal(coverage.sectionsInFocusTerm, 2);
  assert.equal(coverage.sectionsWithFirstDaySnapshot, 1);
  assert.equal(coverage.sectionsMissingFirstDaySnapshot, 1);
  assert.equal(coverage.firstDayCoveragePct, 0.5);
});

test('future lifecycle milestone fields normalize when present', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const row = COSEnrollmentAnalytics.normalizeRow({
    Term: 'FALL 2026',
    Subject: 'PS',
    Course: '200M',
    'First Day Enrollment': '31',
    Census_1: '28',
    CENSUS_2: '26',
    FINAL_ENROLLMENT: '22',
    ACTUAL_ENROLL: '20',
    CENSUS_ENROLL: '25'
  });

  assert.equal(row.firstDay, 31);
  assert.equal(row.census1, 28);
  assert.equal(row.census2, 26);
  assert.equal(row.finalEnrollment, 22);
  assert.equal(row.actual, 20);
  assert.equal(row.census, 25);
});

test('dashboard focus term scopes current metrics and excludes focus from history', () => {
  const { COSEnrollmentAnalytics, COSEnrollmentDashboard } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    section({ term: 'SPRING 2025', subject: 'BUS', course: '050', crn: '1', census: 80, actual: 75, cap: 100, ftes: 8 }),
    section({ term: 'SPRING 2026', subject: 'BUS', course: '050', crn: '2', census: 100, actual: 95, cap: 100, ftes: 10 }),
    section({ term: 'FALL 2026', subject: 'BUS', course: '050', crn: '4', census: 999, actual: 999, cap: 1000, ftes: 99 }),
    section({ term: 'SPRING 2027', subject: 'BUS', course: '050', crn: '3', census: 0, actual: 0, cap: 100, ftes: 0 })
  ];

  const currentRows = COSEnrollmentAnalytics.dashboardCurrentRows(rows, 'SPRING 2027');
  const historicalRows = COSEnrollmentAnalytics.dashboardHistoricalRows(rows, 'SPRING 2027');
  const summary = COSEnrollmentDashboard.dashboardSummary(currentRows, historicalRows, []);

  assert.deepEqual(Array.from(COSEnrollmentAnalytics.dashboardAvailableTerms(rows)), ['SPRING 2025', 'SPRING 2026', 'FALL 2026', 'SPRING 2027']);
  assert.equal(summary.health.currentEnrollment, 0);
  assert.equal(summary.health.sectionsReviewed, 1);
  assert.equal(summary.health.coursesReviewed, 1);
  assert.equal(summary.health.ftes, 0);
  assert.equal(summary.health.expectedEnrollment, 90);
  const coursePace = summary.pace.find(row => row.dimension === 'Course' && row.name === 'BUS 050');
  assert.equal(coursePace.currentEnrollment, 0);
  assert.equal(coursePace.expectedEnrollment, 90);
  assert.equal(coursePace.variance, -90);
  assert.equal(coursePace.variancePct, -1);
  assert.equal(coursePace.status, 'Behind Pace');
  assert.equal(historicalRows.some(row => row.term === 'SPRING 2027'), false);
  assert.equal(historicalRows.some(row => row.term === 'FALL 2026'), false);
});

test('dashboard expected enrollment is N/A without comparable same-season history', () => {
  const { COSEnrollmentAnalytics, COSEnrollmentDashboard } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    section({ term: 'FALL 2026', subject: 'BUS', course: '050', crn: '1', census: 999, actual: 999, cap: 1000 }),
    section({ term: 'SPRING 2027', subject: 'BUS', course: '050', crn: '2', census: 12, actual: 12, cap: 30 })
  ];

  const currentRows = COSEnrollmentAnalytics.dashboardCurrentRows(rows, 'SPRING 2027');
  const historicalRows = COSEnrollmentAnalytics.dashboardHistoricalRows(rows, 'SPRING 2027');
  const summary = COSEnrollmentDashboard.dashboardSummary(currentRows, historicalRows, []);
  const coursePace = summary.pace.find(row => row.dimension === 'Course' && row.name === 'BUS 050');

  assert.equal(historicalRows.length, 0);
  assert.equal(summary.health.expectedEnrollment, null);
  assert.equal(coursePace.expectedEnrollment, null);
  assert.equal(coursePace.variance, null);
  assert.equal(coursePace.variancePct, null);
  assert.equal(coursePace.status, 'N/A');
});

test('dashboard all loaded terms is explicit gross-total mode', () => {
  const { COSEnrollmentAnalytics, COSEnrollmentDashboard } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    section({ term: 'SPRING 2025', subject: 'BUS', course: '050', crn: '1', census: 80, actual: 75, cap: 100 }),
    section({ term: 'SPRING 2027', subject: 'BUS', course: '050', crn: '2', census: 10, actual: 10, cap: 100 })
  ];

  const allRows = COSEnrollmentAnalytics.dashboardCurrentRows(rows, '');
  const summary = COSEnrollmentDashboard.dashboardSummary(allRows, [], []);

  assert.equal(summary.health.currentEnrollment, 90);
  assert.equal(summary.health.sectionsReviewed, 2);
});

test('dashboard scope panel warns on all loaded terms and multiple current terms', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    section({ term: 'SPRING 2025', subject: 'BUS', course: '050', crn: '1' }),
    section({ term: 'SPRING 2027', subject: 'BUS', course: '050', crn: '2' })
  ];
  const context = COSEnrollmentAnalytics.dashboardScopeContext(rows, rows, '');

  assert.equal(context.focusLabel, 'All Loaded Terms');
  assert.equal(context.currentRowsCount, 2);
  assert.deepEqual(Array.from(context.currentTerms), ['SPRING 2025', 'SPRING 2027']);
  assert.ok(context.warnings.includes('All Loaded Terms shows gross totals and should not be used as a decision-term dashboard.'));
  assert.ok(context.warnings.includes('No focus term selected. Select a decision/focus term for decision-term metrics.'));
  assert.ok(context.warnings.includes('Current rows include multiple terms. Confirm All Loaded Terms was selected intentionally.'));
});

test('dashboard scope panel warns when comparable history is unavailable', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const currentRows = [section({ term: 'SPRING 2027', subject: 'BUS', course: '050' })];
  const context = COSEnrollmentAnalytics.dashboardScopeContext(currentRows, [], 'SPRING 2027');

  assert.equal(context.focusTerm, 'SPRING 2027');
  assert.equal(context.historicalRowsCount, 0);
  assert.deepEqual(Array.from(context.historicalTerms), []);
  assert.ok(context.warnings.includes('Expected enrollment has no historical comparison terms for the selected focus term.'));
});

test('dashboard scope panel reports lifecycle milestone availability', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const missingContext = COSEnrollmentAnalytics.dashboardScopeContext([
    section({ term: 'SPRING 2027', subject: 'BUS', course: '050' })
  ], [], 'SPRING 2027');
  const available = COSEnrollmentAnalytics.summaryLifecycleAvailability([
    section({ firstDay: 10, census1: 9, census2: 8, finalEnrollment: 7 })
  ]);

  assert.deepEqual(Array.from(missingContext.missingMilestones), ['First Day', 'Census 1', 'Census 2', 'Final']);
  assert.ok(missingContext.warnings.includes('Lifecycle milestone data unavailable in current upload.'));
  assert.deepEqual(Array.from(available.missing), []);
});

test('grouped consolidation returns one opportunity for reciprocal section matches', () => {
  const { COSConsolidationAnalytics } = loadEnrollmentModules();
  const sections = [
    section({ crn: '20359', census: 10, actual: 8, expectedEnrollment: 10, cap: 30, expectedFillRate: 10 / 30 }),
    section({ crn: '20358', census: 19, actual: 17, expectedEnrollment: 19, cap: 30, expectedFillRate: 19 / 30 }),
    section({ crn: '20360', census: 19, actual: 18, expectedEnrollment: 19, cap: 30, expectedFillRate: 19 / 30 })
  ];
  const history = new Map([[COSConsolidationAnalytics.patternKey(sections[0]), { terms: 4, low: 3 }]]);

  const rows = COSConsolidationAnalytics.consolidationGroupRows('PS 200M', sections, history, 0.5, null, {
    sameCampus: true,
    sameModality: true,
    dayMatch: 'exact',
    timeWindowHours: 0,
    absorbPct: 0.6,
    chronicThreshold: 0.75,
    minHist: 3
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, 'In-Person Consolidation');
  assert.equal(rows[0].sectionsReviewed, 3);
  assert.equal(rows[0].potentialSectionsRemoved, 1);
  assert.equal(rows[0].expectedEnrollment, 48);
  assert.equal(rows[0].availableReceivingCapacity, 16);
  assert.equal(rows[0].finalEnrollmentContext, '8');
});

test('TBA consolidation confidence is capped', () => {
  const { COSConsolidationAnalytics } = loadEnrollmentModules();
  const sections = [
    section({ crn: '30001', dayPattern: 'TBA', start: '', end: '', timeBlock: 'ONLINE/TBA', census: 5, expectedEnrollment: 5, cap: 30, expectedFillRate: 5 / 30 }),
    section({ crn: '30002', dayPattern: 'TBA', start: '', end: '', timeBlock: 'ONLINE/TBA', census: 10, expectedEnrollment: 10, cap: 30, expectedFillRate: 10 / 30 })
  ];
  const rows = COSConsolidationAnalytics.consolidationGroupRows('ART 101', sections, new Map(), 0.5, null, {
    sameCampus: true,
    sameModality: true,
    dayMatch: 'exact',
    timeWindowHours: 0,
    absorbPct: 0.6,
    chronicThreshold: 0.75,
    minHist: 3
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].tba, true);
  assert.ok(rows[0].score <= 70);
});

test('online reduction candidates stay course-level and census-based', () => {
  const { COSConsolidationAnalytics } = loadEnrollmentModules();
  const decision = [
    section({ term: 'FALL 2026', subject: 'STAT', course: '321', modality: 'ONLINE', crn: '40001', cap: 35 }),
    section({ term: 'FALL 2026', subject: 'STAT', course: '321', modality: 'ONLINE', crn: '40002', cap: 35 }),
    section({ term: 'FALL 2026', subject: 'STAT', course: '321', modality: 'ONLINE', crn: '40003', cap: 35 })
  ];
  const historical = [
    section({ term: 'FALL 2025', subject: 'STAT', course: '321', modality: 'ONLINE', census: 20, actual: 12, cap: 35 }),
    section({ term: 'FALL 2024', subject: 'STAT', course: '321', modality: 'ONLINE', census: 25, actual: 11, cap: 35 })
  ];

  const rows = COSConsolidationAnalytics.onlineReductionRows(decision, historical, { vacancyBasis: 'census' });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, 'Online Reduction');
  assert.equal(rows[0].sectionsReviewed, 3);
  assert.equal(rows[0].expectedEnrollment, 23);
  assert.match(rows[0].projectionSource, /Historical Average \(2 terms\)/);
});

test('division filter changes consolidation row count and exported rows', () => {
  const { COSConsolidationAnalytics, COSEnrollmentFilters } = loadEnrollmentModules();
  const rows = [
    section({ division: 'Arts', crn: 'A1', expectedEnrollment: 10, census: 10, cap: 30, expectedFillRate: 10 / 30 }),
    section({ division: 'Arts', crn: 'A2', expectedEnrollment: 19, census: 19, cap: 30, expectedFillRate: 19 / 30 }),
    section({ division: 'Business', crn: 'B1', subject: 'BUS', course: '101', expectedEnrollment: 10, census: 10, cap: 30, expectedFillRate: 10 / 30 }),
    section({ division: 'Business', crn: 'B2', subject: 'BUS', course: '101', expectedEnrollment: 19, census: 19, cap: 30, expectedFillRate: 19 / 30 })
  ];
  const filtered = COSEnrollmentFilters.filterRowsByDivision(rows, ['Arts']);
  const opportunities = COSConsolidationAnalytics.consolidationGroupRows('PS 200M', filtered, new Map(), 0.5, null, {
    sameCampus: true,
    sameModality: true,
    dayMatch: 'exact',
    timeWindowHours: 0,
    absorbPct: 0.6
  });
  const exportedRows = opportunities.map(row => ({ course: row.course, division: filtered[0].division }));

  assert.equal(filtered.length, 2);
  assert.equal(opportunities.length, 1);
  assert.equal(exportedRows.length, 1);
  assert.equal(exportedRows[0].division, 'Arts');
});

test('division filter changes attrition row count and exported rows', () => {
  const { COSEnrollmentFilters, COSEnrollmentMetrics } = loadEnrollmentModules();
  const rows = [
    section({ division: 'Arts', subject: 'ART', course: '101', census: 20, actual: 15, cap: 30 }),
    section({ division: 'Business', subject: 'BUS', course: '101', census: 25, actual: 20, cap: 30 })
  ];
  const filtered = COSEnrollmentFilters.filterRowsByDivision(rows, ['Arts']);
  const exportedRows = filtered.map(row => ({
    course: `${row.subject} ${row.course}`,
    division: row.division,
    census: COSEnrollmentMetrics.censusEnrollment(row),
    final: COSEnrollmentMetrics.finalEnrollment(row),
    attritionCount: Math.max(0, COSEnrollmentMetrics.censusEnrollment(row) - COSEnrollmentMetrics.finalEnrollment(row))
  }));

  assert.equal(filtered.length, 1);
  assert.equal(exportedRows.length, 1);
  assert.equal(exportedRows[0].division, 'Arts');
  assert.equal(exportedRows[0].attritionCount, 5);
});

test('dashboard summary loads decision-support sections', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const rows = [
    section({ division: 'Arts', census: 20, actual: 18, cap: 25, waitlist: 4 }),
    section({ division: 'Arts', subject: 'ART', course: '102', census: 15, actual: 14, cap: 20, waitlist: 0 })
  ];
  const historical = [
    section({ term: 'FALL 2025', division: 'Arts', census: 18, actual: 17, cap: 25 }),
    section({ term: 'FALL 2024', division: 'Arts', census: 16, actual: 15, cap: 25 })
  ];

  const summary = COSEnrollmentDashboard.dashboardSummary(rows, historical, [{ course: 'PS 200M', type: 'In-Person Consolidation' }]);

  assert.equal(summary.health.currentEnrollment, 35);
  assert.ok(summary.pace.length > 0);
  assert.ok(summary.growth.length > 0);
  assert.equal(summary.reduction.length, 1);
  assert.ok(summary.rotation.length > 0);
});

test('dashboard lifecycle displays N/A when milestone fields are missing', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const summary = COSEnrollmentDashboard.dashboardSummary([
    section({ census: 24, actual: 18 }),
    section({ census: 20, actual: 15 })
  ], [], []);

  assert.deepEqual(Array.from(summary.health.lifecycle.map(item => item.value)), [null, null, null, null]);
  const exportRows = COSEnrollmentDashboard.dashboardSummaryExportRows(summary, {});
  const lifecycleRows = exportRows.filter(row => row.Section === 'Enrollment Health' && row.Group === 'Lifecycle Milestone');
  assert.equal(lifecycleRows.every(row => row.Value === 'N/A'), true);
});

test('dashboard lifecycle totals future milestone fields when available', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const summary = COSEnrollmentDashboard.dashboardSummary([
    section({ firstDay: 30, census1: 28, census2: 26, finalEnrollment: 22 }),
    section({ firstDay: 20, census1: 18, census2: 16, finalEnrollment: 12 })
  ], [], []);

  assert.deepEqual(Array.from(summary.health.lifecycle.map(item => item.value)), [50, 46, 42, 34]);
});

test('dashboard division filter changes row count and exported rows', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const rows = [
    section({ division: 'Arts', subject: 'ART', course: '101' }),
    section({ division: 'Business', subject: 'BUS', course: '101' })
  ];

  const filtered = COSEnrollmentDashboard.applyDashboardFilters(rows, { division: ['Arts'] });
  const exportedRows = COSEnrollmentDashboard.rotationRows(filtered);

  assert.equal(filtered.length, 1);
  assert.equal(exportedRows.length, 1);
  assert.equal(exportedRows[0].division, 'Arts');
});

test('growth opportunities use existing viable seats before recommending capacity', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const rows = [
    section({ subject: 'ART', course: '110', crn: 'A1', waitlist: 8, census: 30, cap: 30, modality: 'IN PERSON', campus: 'VIS', days: ['MO', 'WE'], start: '09:00' }),
    section({ subject: 'ART', course: '110', crn: 'A2', waitlist: 0, census: 10, cap: 25, modality: 'IN PERSON', campus: 'VIS', days: ['WE'], start: '10:00' })
  ];

  const [opportunity] = COSEnrollmentDashboard.growthOpportunities(rows);

  assert.equal(opportunity.waitlist, 8);
  assert.equal(opportunity.openSeats, 15);
  assert.equal(opportunity.viableOpenSeats, 15);
  assert.equal(opportunity.recommendation, 'Use Existing Seats First');
});

test('growth opportunities recommend review when viable seats are insufficient', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const rows = [
    section({ subject: 'BUS', course: '120', crn: 'B1', waitlist: 12, census: 30, cap: 30, modality: 'IN PERSON', campus: 'VIS', days: ['MO'], start: '09:00' }),
    section({ subject: 'BUS', course: '120', crn: 'B2', waitlist: 0, census: 20, cap: 40, modality: 'IN PERSON', campus: 'TCCB', days: ['TH'], start: '18:00' })
  ];

  const [opportunity] = COSEnrollmentDashboard.growthOpportunities(rows);

  assert.equal(opportunity.openSeats, 20);
  assert.equal(opportunity.viableOpenSeats, 0);
  assert.equal(opportunity.recommendation, 'Consider Added Capacity');
});

test('growth opportunities report online, campus, and modality seat buckets', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const rows = [
    section({ subject: 'STAT', course: '130', crn: 'S1', waitlist: 9, census: 30, cap: 30, modality: 'ONLINE', campus: 'ONLINE', days: [], start: '' }),
    section({ subject: 'STAT', course: '130', crn: 'S2', waitlist: 0, census: 10, cap: 20, modality: 'ONLINE', campus: 'ONLINE', days: [], start: '' }),
    section({ subject: 'STAT', course: '130', crn: 'S3', waitlist: 0, census: 12, cap: 20, modality: 'IN PERSON', campus: 'VIS', days: ['MO'], start: '09:00' })
  ];

  const [opportunity] = COSEnrollmentDashboard.growthOpportunities(rows);

  assert.equal(opportunity.onlineSeats, 10);
  assert.equal(opportunity.sameModalitySeats, 10);
  assert.equal(opportunity.sameCampusSeats, 10);
  assert.equal(opportunity.viableOpenSeats, 10);
  assert.equal(opportunity.recommendation, 'Use Existing Seats First');
});

test('student presence analytics excludes online sections', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const presence = COSEnrollmentDashboard.studentPresence([
    section({ modality: 'IN PERSON', census: 20, days: ['MO'], campus: 'VIS', start: '09:00' }),
    section({ modality: 'ONLINE', census: 99, days: ['MO'], campus: 'WEB', start: '' }),
    section({ modality: 'HYBRID', census: 50, days: ['SA'], campus: 'ONLINE', start: '00:00' }),
    section({ modality: 'IN PERSON', census: 30, days: ['TBA'], campus: 'VIS', start: '00:00' })
  ]);

  assert.equal(presence.rows.length, 1);
  assert.equal(presence.rows[0].studentsPresent, 20);
  assert.equal(presence.rows[0].campus, 'VIS');
});

test('detailed student presence report excludes non-physical rows and groups room buckets', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const report = COSEnrollmentDashboard.studentPresenceReport([
    section({ modality: 'IN PERSON', campus: 'VIS', building: 'KERN', roomOnly: '101', room: 'KERN 101', days: ['MO'], start: '10:00', census: 20, cap: 30 }),
    section({ modality: 'HYBRID', campus: 'VIS', building: 'KERN', roomOnly: '101', room: 'KERN 101', days: ['MO'], start: '10:00', census: 10, cap: 20 }),
    section({ modality: 'ONLINE', campus: 'ONLINE', building: '', roomOnly: '', room: '', days: ['MO'], start: '', census: 99, cap: 100 }),
    section({ modality: 'IN PERSON', campus: 'VIS', building: 'KERN', roomOnly: '102', room: 'KERN 102', days: ['TBA'], start: '00:00', census: 50, cap: 60 })
  ], 'roomDayHour');

  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].group, '101 / MO / 10:00');
  assert.equal(report.rows[0].studentsPresent, 30);
  assert.equal(report.rows[0].sectionsActive, 2);
  assert.equal(report.rows[0].seatsScheduled, 50);
  assert.equal(report.rows[0].availableRoomCapacity, 20);
  assert.equal(report.metrics.totalStudents, 30);
  assert.equal(report.metrics.peakRoom.group, '101');
});

test('detailed student presence report supports campus and building group metrics', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const campusReport = COSEnrollmentDashboard.studentPresenceReport([
    section({ campus: 'VIS', building: 'KERN', roomOnly: '101', room: 'KERN 101', days: ['MO'], start: '09:00', census: 20, cap: 30 }),
    section({ campus: 'TCCB', building: 'TCCB', roomOnly: '201', room: 'TCCB 201', days: ['TU'], start: '11:00', census: 40, cap: 50 })
  ], 'campus');
  const buildingReport = COSEnrollmentDashboard.studentPresenceReport(campusReport.rows.map(row => ({
    ...section(),
    campus: row.campus,
    building: row.building,
    roomOnly: row.room,
    room: row.room,
    days: [row.day],
    start: row.hour.replace(':00', ':00'),
    census: row.studentsPresent,
    cap: row.seatsScheduled
  })), 'building');

  assert.equal(campusReport.rows.length, 2);
  assert.equal(campusReport.metrics.peakCampus.group, 'TCCB');
  assert.equal(buildingReport.rows.some(row => row.group === 'KERN'), true);
});

test('course rotation export rows include planning fields', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const rows = COSEnrollmentDashboard.rotationRows([
    section({ term: 'FALL 2024', division: 'Arts', subject: 'ART', course: '101' }),
    section({ term: 'FALL 2025', division: 'Arts', subject: 'ART', course: '101' }),
    section({ term: 'FALL 2026', division: 'Arts', subject: 'ART', course: '101' })
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].course, 'ART 101');
  assert.equal(rows[0].termsOfferedCount, 3);
  assert.ok(Object.hasOwn(rows[0], 'rotationStatus'));
  assert.ok(Object.hasOwn(rows[0], 'expectedNextOffering'));
});

test('dashboard consolidation summary consumes existing consolidation output', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const existingOutput = [{ type: 'Online Reduction', course: 'PS 200M', potentialSectionsRemoved: 1 }];
  const summary = COSEnrollmentDashboard.dashboardSummary([section()], [], existingOutput);

  assert.equal(summary.reduction.length, 1);
  assert.deepEqual(summary.reduction[0], existingOutput[0]);
});

test('dashboard summary export includes methodology and context rows', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const summary = COSEnrollmentDashboard.dashboardSummary([section({ division: 'Arts', census: 18, cap: 25 })], [], []);
  const rows = COSEnrollmentDashboard.dashboardSummaryExportRows(summary, {
    methodologyVersion: 'Methodology Version 1.2',
    exportedAt: '2026-06-22 10:00',
    selectedTerm: 'FALL 2026',
    divisionFilter: 'Arts',
    campusFilter: 'VIS',
    modalityFilter: 'IN PERSON',
    disciplineCourseFilter: 'Discipline: PS',
    dataSourceNote: 'Uploaded and/or archived enrollment CSV rows'
  });

  assert.ok(rows.some(row => row.Section === 'Context' && row.Metric === 'Prepared using' && row.Value === 'TIMBER Enrollment Analytics'));
  assert.ok(rows.some(row => row.Section === 'Context' && row.Metric === 'Methodology Version' && row.Value === 'Methodology Version 1.2'));
  assert.ok(rows.some(row => row.Section === 'Context' && row.Metric === 'Selected Division Filter' && row.Value === 'Arts'));
  assert.ok(rows.some(row => row.Section === 'Enrollment Health' && row.Metric === 'Current Enrollment'));
});

test('dashboard summary export respects selected division filter', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const rows = [
    section({ division: 'Arts', subject: 'ART', course: '101', waitlist: 4, census: 30, cap: 30 }),
    section({ division: 'Business', subject: 'BUS', course: '101', waitlist: 4, census: 30, cap: 30 })
  ];
  const filtered = COSEnrollmentDashboard.applyDashboardFilters(rows, { division: ['Arts'] });
  const summary = COSEnrollmentDashboard.dashboardSummary(filtered, [], []);
  const exportRows = COSEnrollmentDashboard.dashboardSummaryExportRows(summary, { divisionFilter: 'Arts' });
  const groups = exportRows.map(row => row.Group).join(' ');

  assert.match(groups, /ART 101/);
  assert.doesNotMatch(groups, /BUS 101/);
  assert.ok(exportRows.some(row => row.Section === 'Context' && row.Metric === 'Selected Division Filter' && row.Value === 'Arts'));
});

test('dashboard summary export excludes fully online rows from student presence', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const summary = COSEnrollmentDashboard.dashboardSummary([
    section({ modality: 'IN PERSON', campus: 'VIS', days: ['MO'], start: '10:00', census: 20 }),
    section({ modality: 'ONLINE', campus: 'ONLINE', days: ['MO'], start: '', census: 99 })
  ], [], []);
  const exportRows = COSEnrollmentDashboard.dashboardSummaryExportRows(summary, {});
  const presenceRows = exportRows.filter(row => row.Section === 'Student Presence Analytics');
  const text = presenceRows.map(row => `${row.Group} ${row.Value}`).join(' ');

  assert.match(text, /VIS \/ MO \/ 10:00/);
  assert.doesNotMatch(text, /ONLINE/);
  assert.doesNotMatch(text, /99/);
});

test('user-facing terminology uses Part-Time Faculty wording', () => {
  const root = path.join(__dirname, '..');
  const files = [
    'index.html',
    'README.md',
    'js/enrollment-analytics.js',
    'js/enrollment/dashboard.js'
  ];
  const text = files
    .filter(file => fs.existsSync(path.join(root, file)))
    .map(file => fs.readFileSync(path.join(root, file), 'utf8'))
    .join('\n');
  const legacyWord = ['ad', 'junct'].join('');

  assert.match(text, /Part-Time Faculty/);
  assert.equal(new RegExp(legacyWord, 'i').test(text), false);
});

test('enrollment analytics report labels are operational', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.doesNotMatch(text, /WIP/);
  assert.match(text, /Enrollment Analytics Dashboard/);
  assert.match(text, /Enrollment Demand Forecast/);
  assert.match(text, /Enrollment Attrition \/ Lifecycle/);
  assert.match(text, /Section Consolidation Opportunities/);
  assert.match(text, /Room Utilization Map/);
  assert.match(text, /Student Presence Analytics/);
  assert.match(text, /Open Student Presence Report/);
  assert.match(text, /REPORTS\.studentPresence/);
  assert.match(text, /Instructor Availability - Planning View/);
  assert.match(text, /Enrollment Snapshot Manager/);
  assert.match(text, /REPORTS\.snapshotManager/);
  assert.match(text, /dashDecisionSeason/);
  assert.match(text, /dashDecisionYear/);
  assert.match(text, /Use season\/year below/);
  assert.match(text, /The current selection is internally consistent and no obvious data-scope issue was detected/);
  assert.match(text, /spArchiveTerms/);
  assert.match(text, /conDecisionSeason/);
  assert.match(text, /conDecisionYear/);
  assert.match(text, /Consolidation Scope/);
  assert.doesNotMatch(text, /conDecisionTermManual/);
  assert.match(text, /iaDivision/);
  assert.match(text, /iaSubject/);
  assert.match(text, /Select All Visible Instructors/);
});

test('consolidation scope is limited to selected report inputs', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const loadStart = text.indexOf('async function loadConsolidationRows');
  const loadEnd = text.indexOf('function lowEnrollmentThreshold', loadStart);
  const historicalStart = text.indexOf('async function historicalPatterns');
  const historicalEnd = text.indexOf('function finalizeHistoricalMap', historicalStart);
  const loadBlock = text.slice(loadStart, loadEnd);
  const historicalBlock = text.slice(historicalStart, historicalEnd);

  assert.match(loadBlock, /const rows = uploaded;/);
  assert.doesNotMatch(loadBlock, /currentRows\(\)/);
  assert.doesNotMatch(historicalBlock, /api\/schedule/);
  assert.doesNotMatch(historicalBlock, /visibleScheduleTerms/);
});

test('dashboard source does not silently load all archived terms', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const sourceStart = text.indexOf('function dashboardSourceRows');
  const sourceEnd = text.indexOf('function dashboardAvailableTerms', sourceStart);
  const sourceBlock = text.slice(sourceStart, sourceEnd);

  assert.doesNotMatch(sourceBlock, /readArchivedRows/);
  assert.doesNotMatch(sourceBlock, /analytics-archive/);
  assert.match(sourceBlock, /state\.enrollment/);
  assert.match(sourceBlock, /state\.demandInput/);
  assert.match(sourceBlock, /state\.consolidationInput/);
});

test('modality balance includes dual enrollment toggle and methodology note', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');

  assert.match(index, /modality-include-de/);
  assert.match(index, /Dual Enrollment is excluded by default/);
  assert.match(app, /includeDualEnrollment/);
  assert.match(app, /category === 'Dual Enrollment'/);
});

test('duration graph uses nice y-axis tick steps', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');

  assert.match(app, /niceTickStep/);
  assert.match(app, /\[2, 5, 10, 20, 25, 50/);
});

test('dashboard compact tables use short headers and nowrap CSS', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.match(text, /currentEnrollment: 'Current'/);
  assert.match(text, /expectedEnrollment: 'Expected'/);
  assert.match(text, /sameModalitySeats: 'Same Mod\.'/);
  assert.match(text, /availableReceivingCapacity: 'Receiving Cap\.'/);
  assert.match(text, /studentsPresent: 'Students'/);
  assert.match(text, /availableRoomCapacity: 'Open Cap\.'/);
  assert.match(text, /title="\$\{escapeAttr\(full\)\}"/);
  assert.match(text, /aria-label="\$\{escapeAttr\(full\)\}"/);
  assert.match(text, /white-space:nowrap/);
  assert.match(text, /overflow-x:auto/);
  assert.doesNotMatch(text, /dashboard-panel th,\\.dashboard-panel td\\{overflow-wrap:anywhere/);
});

test('index owns enrollment analytics script order', () => {
  const root = path.join(__dirname, '..');
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const parser = fs.readFileSync(path.join(root, 'js/parser.js'), 'utf8');
  const expectedOrder = [
    'js/config.js',
    'js/shared/utils.js',
    'js/admin.js',
    'js/availability.js',
    'js/heatmap.js',
    'js/modality.js',
    'js/utilization.js',
    'js/parser.js',
    'js/cal_getc_mapping.js',
    'js/curriculum_crosswalk.js',
    'js/roomCatalog.js',
    'js/app.js',
    'js/enrollment/metrics.js',
    'js/enrollment/filters.js',
    'js/enrollment/consolidation.js',
    'js/enrollment/dashboard.js',
    'js/enrollment-analytics.js'
  ];
  const positions = expectedOrder.map(script => index.indexOf(`src="${script}"`));

  assert.equal(positions.every(position => position >= 0), true);
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  assert.equal(parser.includes('loadScriptOnce'), false);
  assert.equal(parser.includes('js/enrollment-analytics.js'), false);
});
