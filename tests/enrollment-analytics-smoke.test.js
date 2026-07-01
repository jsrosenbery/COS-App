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
  ['js/core/csv-normalizer.js', 'js/core/section-model.js', 'js/enrollment/metrics.js', 'js/enrollment/filters.js', 'js/enrollment/consolidation.js', 'js/enrollment/dashboard.js'].forEach(file => {
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
  ['js/core/dom-utils.js', 'js/core/csv-normalizer.js', 'js/core/section-model.js', 'js/enrollment/metrics.js', 'js/enrollment/filters.js', 'js/enrollment/consolidation.js', 'js/enrollment/dashboard.js', 'js/enrollment-analytics.js'].forEach(file => {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  });
  return context.window;
}

function loadCoreModules() {
  return {
    csv: require('../js/core/csv-normalizer.js'),
    sectionModel: require('../js/core/section-model.js')
  };
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
  assert.equal(row.census1, 24);
  assert.equal(row.census2, null);
  assert.equal(row.finalEnrollment, null);
});

test('shared CSV normalizer builds canonical section fields from all-columns seating rows', () => {
  const { csv, sectionModel } = loadCoreModules();
  const row = {
    TERM: 'Fall 2026',
    CRN: '12345',
    SUBJECT: 'engl',
    COURSE: 'c1000',
    'Instructional Method': '02S',
    DAYS: 'MW',
    'Start Time': '9:10 AM',
    'End Time': '10:25 AM',
    CENSUS_ENROLL: '27',
    CENSUS_ENROLL2: '-3',
    ACTUAL_ENROLL: '29',
    CAPACITY: '35',
    BUILDING: 'TCC',
    ROOM: '101'
  };

  const normalized = csv.normalizeCsvRow(row);
  const sectionRow = sectionModel.normalizeSection(row);

  assert.equal(normalized.term, 'FALL 2026');
  assert.equal(normalized.courseCode, 'ENGL C1000');
  assert.equal(normalized.invalidNegativeCensus2, true);
  assert.equal(normalized.census2, null);
  assert.deepEqual(sectionRow.days, ['MO', 'WE']);
  assert.equal(sectionRow.start, '09:10');
  assert.equal(sectionRow.end, '10:25');
  assert.equal(sectionRow.modality, 'IN PERSON');
  assert.equal(sectionRow.timeBlock, '09:00-09:59');
});

test('canonical CRN deduplication prevents enrollment inflation from repeated meeting rows', () => {
  const { sectionModel } = loadCoreModules();
  const rows = [
    { Term: 'FALL 2026', CRN: '90001', Subject: 'MATH', Course: '021', CENSUS_ENROLL: '30', DAYS: 'MW', 'Start Time': '8:10', 'End Time': '9:25' },
    { Term: 'FALL 2026', CRN: '90001', Subject: 'MATH', Course: '021', CENSUS_ENROLL: '30', DAYS: 'MW', 'Start Time': '8:10', 'End Time': '9:25' },
    { Term: 'FALL 2026', CRN: '90002', Subject: 'MATH', Course: '021', CENSUS_ENROLL: '20', DAYS: 'TR', 'Start Time': '8:10', 'End Time': '9:25' }
  ];

  assert.equal(sectionModel.dedupeSectionsByCrn(rows).length, 2);
  assert.equal(sectionModel.sumEnrollmentByCrn(rows), 50);
});

test('student presence graph series counts enrollment by overlapping half-hour interval', () => {
  const { sectionModel } = loadCoreModules();
  const hours = [9, 9.5, 10, 10.5];
  const rows = [
    {
      Term: 'FALL 2026',
      CRN: '10001',
      Subject: 'ENGL',
      Course: 'C1000',
      DAYS: 'MW',
      'Start Time': '9:10 AM',
      'End Time': '10:25 AM',
      CENSUS_ENROLL: '20',
      ACTUAL_ENROLL: '25',
      'Instructional Method': '02S',
      BUILDING: 'TCC',
      ROOM: '101'
    },
    {
      Term: 'FALL 2026',
      CRN: '10001',
      Subject: 'ENGL',
      Course: 'C1000',
      DAYS: 'MW',
      'Start Time': '9:10 AM',
      'End Time': '10:25 AM',
      CENSUS_ENROLL: '20',
      ACTUAL_ENROLL: '25',
      'Instructional Method': '02S',
      BUILDING: 'TCC',
      ROOM: '101'
    },
    {
      Term: 'FALL 2026',
      CRN: '10002',
      Subject: 'MATH',
      Course: '021',
      DAYS: 'M',
      'Start Time': '9:45 AM',
      'End Time': '10:15 AM',
      ACTUAL_ENROLL: '5',
      'Instructional Method': 'IP',
      BUILDING: 'TCC',
      ROOM: '102'
    },
    {
      Term: 'FALL 2026',
      CRN: '10003',
      Subject: 'HIST',
      Course: '018',
      DAYS: 'M',
      'Start Time': '00:00',
      'End Time': '00:00',
      CENSUS_ENROLL: '40',
      'Instructional Method': 'ONL',
      BUILDING: 'ONLINE',
      ROOM: 'LIVE'
    }
  ];

  const presence = sectionModel.buildHalfHourPresenceSeries(rows, hours, { metric: 'presence' });
  const courseCount = sectionModel.buildHalfHourPresenceSeries(rows, hours, { metric: 'count' });

  assert.equal(presence['Monday-9'], 20);
  assert.equal(presence['Monday-9.5'], 25);
  assert.equal(presence['Monday-10'], 25);
  assert.equal(presence['Monday-10.5'], 0);
  assert.equal(presence['Wednesday-9'], 20);
  assert.equal(presence['Wednesday-9.5'], 20);
  assert.equal(courseCount['Monday-9.5'], 2);
  assert.equal(courseCount['Wednesday-9.5'], 1);
});

test('student presence graph series accepts already-normalized enrollment rows', () => {
  const { sectionModel } = loadCoreModules();
  const rows = [
    {
      term: 'FALL 2026',
      crn: '20001',
      subject: 'COMM',
      course: 'C1000',
      campus: 'COS',
      modality: 'IN PERSON',
      days: ['MO', 'WE'],
      start: '10:10',
      end: '11:25',
      census: 32,
      actual: 35,
      cap: 40,
      building: 'TCC',
      roomOnly: '101'
    }
  ];

  const presence = sectionModel.buildHalfHourPresenceSeries(rows, [10, 10.5, 11], { metric: 'presence' });

  assert.equal(presence['Monday-10'], 32);
  assert.equal(presence['Monday-10.5'], 32);
  assert.equal(presence['Monday-11'], 32);
  assert.equal(presence['Wednesday-10.5'], 32);
});

test('tutoring open lab rows are centrally identified', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();

  ['MATH 400', 'ENGL 400', 'LA 425'].forEach(course => {
    const [subject, number] = course.split(' ');
    const splitRow = COSEnrollmentAnalytics.normalizeRow({ Subject: subject, Course: number });
    const combinedRow = COSEnrollmentAnalytics.normalizeRow({ Course: course });
    assert.equal(COSEnrollmentAnalytics.isTutoringOpenLabSection(splitRow), true);
    assert.equal(COSEnrollmentAnalytics.isTutoringOpenLabSection(combinedRow), true);
    assert.equal(splitRow.isTutoringOpenLab, true);
  });

  assert.equal(COSEnrollmentAnalytics.isTutoringOpenLabSection(section({ subject: 'MATH', course: '021' })), false);
});

test('negative Census 2 normalizes as invalid missing data', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const row = COSEnrollmentAnalytics.normalizeRow({
    Term: 'FALL 2026',
    CRN: '12345',
    Subject: 'MATH',
    Course: '400',
    CENSUS_ENROLL: '10',
    CENSUS_ENROLL2: '-3',
    ACTUAL_ENROLL: '8'
  });

  assert.equal(row.census2, null);
  assert.equal(row.invalidNegativeCensus2, true);
});

test('snapshot coverage excludes omitted tutoring open lab sections after filtering', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const standard = COSEnrollmentAnalytics.normalizeRow({ Term: 'FALL 2026', CRN: 'S1', Subject: 'HIST', Course: '018' });
  const tutoring = COSEnrollmentAnalytics.normalizeRow({ Term: 'FALL 2026', CRN: 'T1', Subject: 'MATH', Course: '400' });
  const includedRows = [standard, tutoring].filter(row => !COSEnrollmentAnalytics.isTutoringOpenLabSection(row));
  const coverage = COSEnrollmentAnalytics.snapshotCoverage(includedRows, [], 'FALL 2026');

  assert.equal(coverage.sectionsInFocusTerm, 1);
  assert.equal(coverage.sectionsMissingFirstDaySnapshot, 1);
});

test('work experience rows normalize as supplemental enrollment source', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const directFtes = COSEnrollmentAnalytics.normalizeRow({
    __sourceType: 'WORK_EXPERIENCE',
    Term: 'SPRING 2027',
    Subject: 'WKEX',
    Course: '101',
    Section: '001',
    'Current Enrollment': '12',
    FTES: '1.8',
    'ACCOUNTING METHOD': 'I'
  });
  const missingFtes = COSEnrollmentAnalytics.normalizeRow({
    __sourceType: 'WORK_EXPERIENCE',
    Term: 'SPRING 2027',
    Subject: 'WKEX',
    Course: '102',
    Section: '002',
    'Current Enrollment': '8',
    'ACCOUNTING METHOD': 'I'
  });

  assert.equal(directFtes.isWorkExperience, true);
  assert.equal(directFtes.sourceType, 'WORK EXPERIENCE');
  assert.equal(directFtes.modality, 'WORK EXPERIENCE');
  assert.equal(directFtes.days.length, 0);
  assert.equal(directFtes.timeBlock, 'WORK EXPERIENCE');
  assert.equal(directFtes.accountingReportable, true);
  assert.equal(directFtes.ftes, 1.8);
  assert.equal(missingFtes.ftesUnavailable, true);
  assert.match(missingFtes.ftesWarning, /FTES unavailable/);
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

test('snapshot coverage counts all decision sections missing first-day snapshots', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    section({ term: 'SPRING 2027', crn: 'A1' }),
    section({ term: 'SPRING 2027', crn: 'A2' }),
    section({ term: 'SPRING 2026', crn: 'H1' })
  ];

  const coverage = COSEnrollmentAnalytics.snapshotCoverage(rows, [], 'Spring 2027');

  assert.equal(coverage.sectionsInFocusTerm, 2);
  assert.equal(coverage.sectionsWithFirstDaySnapshot, 0);
  assert.equal(coverage.sectionsMissingFirstDaySnapshot, 2);
  assert.equal(coverage.firstDayCoveragePct, 0);
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

test('attrition lifecycle calculations use census 2 and matched first-day rows', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const record = COSEnrollmentAnalytics.emptyAttritionRecord('PS 200M');
  const rows = [
    section({ crn: 'L1', firstDay: 30, census1: 28, census2: 25, finalEnrollment: 20 }),
    section({ crn: 'L2', firstDay: null, census1: 22, census2: 20, finalEnrollment: 18 })
  ];
  rows.forEach(row => COSEnrollmentAnalytics.addAttritionLifecycle(record, 'decision', row));

  const metrics = COSEnrollmentAnalytics.lifecycleMetrics('decision', record, 2);

  assert.equal(metrics.decisionStartToEndMatchedCrns, 1);
  assert.equal(metrics.decisionStartToEndAttritionCount, 10);
  assert.equal(Math.round(metrics.decisionStartToEndAttritionRate * 1000) / 1000, 0.333);
  assert.equal(metrics.decisionCensus1ToCensus2AttritionCount, 5);
  assert.equal(Math.round(metrics.decisionCensus1ToCensus2AttritionRate * 1000) / 1000, 0.1);
  assert.equal(metrics.decisionCensus2ToEndAttritionCount, 7);
});

test('attrition lifecycle first-day metrics are unavailable when no first-day snapshots exist', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const record = COSEnrollmentAnalytics.emptyAttritionRecord('PS 200M');
  [
    section({ crn: 'N1', firstDay: null, census1: 28, census2: 30, finalEnrollment: 32 }),
    section({ crn: 'N2', firstDay: null, census1: 22, census2: 20, finalEnrollment: 18 })
  ].forEach(row => COSEnrollmentAnalytics.addAttritionLifecycle(record, 'decision', row));

  const metrics = COSEnrollmentAnalytics.lifecycleMetrics('decision', record, 2);

  assert.equal(metrics.decisionStartToEndMatchedCrns, 0);
  assert.equal(metrics.decisionStartToEndAttritionRate, null);
  assert.equal(COSEnrollmentAnalytics.lifecycleMetricLabel(metrics.decisionStartToEndAttritionRate), 'N/A');
  assert.equal(metrics.decisionCensus2ToEndMatchedCrns, 2);
  assert.equal(metrics.decisionCensus2ToEndAttritionCount, 0);
});

test('attrition lifecycle start-based calculations work when first-day coverage is complete', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const record = COSEnrollmentAnalytics.emptyAttritionRecord('PS 200M');
  [
    section({ crn: 'S1', firstDay: 30, census1: 28, census2: 26, finalEnrollment: 22 }),
    section({ crn: 'S2', firstDay: 20, census1: 18, census2: 16, finalEnrollment: 12 })
  ].forEach(row => COSEnrollmentAnalytics.addAttritionLifecycle(record, 'decision', row));

  const metrics = COSEnrollmentAnalytics.lifecycleMetrics('decision', record, 2);

  assert.equal(metrics.decisionStartToEndAttritionCount, 16);
  assert.equal(metrics.decisionStartToCensus1AttritionCount, 4);
  assert.equal(metrics.decisionStartToCensus2AttritionCount, 8);
  assert.equal(metrics.decisionCensus1ToEndAttritionCount, 12);
});

test('attrition lifecycle reports enrollment growth as negative attrition', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const record = COSEnrollmentAnalytics.emptyAttritionRecord('Overall');
  [
    section({ crn: 'G1', census1: 10, census2: 12, finalEnrollment: 15 }),
    section({ crn: 'G2', census1: 24, census2: 22, finalEnrollment: 25 })
  ].forEach(row => COSEnrollmentAnalytics.addAttritionLifecycle(record, 'decision', row));
  const metrics = COSEnrollmentAnalytics.lifecycleMetrics('decision', record, 2);

  assert.equal(metrics.decisionCensus2ToEndAttritionCount, -6);
  assert.equal(Math.round(metrics.decisionCensus2ToEndAttritionRate * 10000) / 10000, -0.1765);
  assert.equal(COSEnrollmentAnalytics.lifecycleMetricLabel(metrics.decisionCensus2ToEndAttritionRate), '-17.6%');
});

test('attrition lifecycle uses matched CRNs when milestone populations differ', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const record = COSEnrollmentAnalytics.emptyAttritionRecord('Overall');
  [
    section({ crn: 'A1', census1: 10, census2: null }),
    section({ crn: 'A2', census1: 20, census2: 18 }),
    section({ crn: 'A3', census: null, census1: null, census2: 15 })
  ].forEach(row => COSEnrollmentAnalytics.addAttritionLifecycle(record, 'decision', row));
  const metrics = COSEnrollmentAnalytics.lifecycleMetrics('decision', record, 3);

  assert.equal(metrics.decisionCensus1ToCensus2MatchedCrns, 1);
  assert.equal(metrics.decisionCensus1ToCensus2AttritionCount, 2);
  assert.equal(metrics.decisionCensus1ToCensus2AttritionRate, 0.1);
  assert.equal(metrics.decisionMilestonePopulationMismatch, true);
  assert.equal(metrics.decisionMilestoneCrnCounts.firstDay, 0);
  assert.equal(metrics.decisionMilestoneCrnCounts.census1, 2);
  assert.equal(metrics.decisionMilestoneCrnCounts.census2, 2);
  assert.equal(metrics.decisionMilestoneCrnCounts.final, 3);
});

test('lifecycle diagnostics presentation keeps mismatch warnings out of headline cards', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const metricStart = text.indexOf("metric('attritionMetrics'");
  const metricEnd = text.indexOf('renderAttritionDiagnosticRates', metricStart);
  const detailStart = text.indexOf("table('attritionTable'");
  const detailEnd = text.indexOf('renderAttritionLegend', detailStart);
  const metricsBlock = text.slice(metricStart, metricEnd);
  const detailBlock = text.slice(detailStart, detailEnd);

  assert.match(text, /Enrollment Attrition Trend/);
  assert.match(text, /Diagnostic Attrition Rates/);
  assert.match(text, /Planning Term Excluded/);
  assert.match(text, /Historical Overall Attrition/);
  assert.doesNotMatch(text, /attrIncludeHistory/);
  assert.doesNotMatch(metricsBlock, /N\/A - Different section populations/);
  [
    'firstDayToCensus1Attrition',
    'firstDayToCensus2Attrition',
    'firstDayToEndFinalAttrition',
    'census1ToCensus2Attrition',
    'census1ToEndFinalAttrition',
    'census2ToEndFinalAttrition'
  ].forEach(column => assert.match(detailBlock, new RegExp(column)));
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
  assert.equal(rows[0].availableReceivingCapacity, 22);
  assert.equal(rows[0].netAvailableCapacity, 16);
  assert.equal(rows[0].finalEnrollmentContext, '8');
});

test('limited consolidation history is not labeled high confidence', () => {
  const { COSConsolidationAnalytics } = loadEnrollmentModules();
  const sections = [
    section({ crn: '41001', census: 8, actual: 8, expectedEnrollment: 8, cap: 30, expectedFillRate: 8 / 30 }),
    section({ crn: '41002', census: 20, actual: 20, expectedEnrollment: 20, cap: 30, expectedFillRate: 20 / 30 }),
    section({ crn: '41003', census: 20, actual: 20, expectedEnrollment: 20, cap: 30, expectedFillRate: 20 / 30 })
  ];
  const history = new Map([[COSConsolidationAnalytics.patternKey(sections[0]), { terms: 1, low: 1 }]]);

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
  assert.equal(rows[0].historicalTerms, 1);
  assert.equal(rows[0].label, 'Limited History Review');
  assert.equal(rows[0].confidenceLevel, 'Limited History');
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

test('online reductions require decision-term expected vacancy', () => {
  const { COSConsolidationAnalytics } = loadEnrollmentModules();
  const decision = [
    section({ term: 'FALL 2026', subject: 'HIST', course: '018', modality: 'ONLINE', crn: '50001', cap: 25 }),
    section({ term: 'FALL 2026', subject: 'HIST', course: '018', modality: 'ONLINE', crn: '50002', cap: 25 })
  ];
  const historical = [
    section({ term: 'FALL 2025', subject: 'HIST', course: '018', modality: 'ONLINE', crn: 'H1', census: 30, cap: 50 }),
    section({ term: 'FALL 2025', subject: 'HIST', course: '018', modality: 'ONLINE', crn: 'H2', census: 30, cap: 50 }),
    section({ term: 'FALL 2024', subject: 'HIST', course: '018', modality: 'ONLINE', crn: 'H3', census: 30, cap: 50 }),
    section({ term: 'FALL 2024', subject: 'HIST', course: '018', modality: 'ONLINE', crn: 'H4', census: 30, cap: 50 })
  ];

  const rows = COSConsolidationAnalytics.onlineReductionRows(decision, historical, { vacancyBasis: 'census' });

  assert.equal(rows.length, 0);
});

test('consolidation crosswalk maps old English history into ENGL C1000 online demand', () => {
  const runtime = loadEnrollmentAnalyticsRuntime();
  const { COSConsolidationAnalytics, COSEnrollmentAnalytics } = runtime;
  runtime.CURRICULUM_CROSSWALK = [
    { sourceCourse: 'ENGL 001', synonymCourse: 'ENGL C1000' }
  ];
  const decision = COSEnrollmentAnalytics.applyCurriculumCrosswalkToRows([
    section({ term: 'FALL 2026', subject: 'ENGL', course: 'C1000', modality: 'ONLINE', crn: 'D1', cap: 25 }),
    section({ term: 'FALL 2026', subject: 'ENGL', course: 'C1000', modality: 'ONLINE', crn: 'D2', cap: 25 }),
    section({ term: 'FALL 2026', subject: 'ENGL', course: 'C1000', modality: 'ONLINE', crn: 'D2', cap: 25 })
  ]);
  const historical = COSEnrollmentAnalytics.applyCurriculumCrosswalkToRows([
    section({ term: 'FALL 2025', subject: 'ENGL', course: '001', modality: 'ONLINE', crn: 'H1', census: 20, cap: 25 }),
    section({ term: 'FALL 2024', subject: 'ENGL', course: '001', modality: 'ONLINE', crn: 'H2', census: 18, cap: 25 })
  ]);

  const rows = COSConsolidationAnalytics.onlineReductionRows(decision, historical, { vacancyBasis: 'census' });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].course, 'ENGL C1000');
  assert.equal(rows[0].sectionsReviewed, 2);
  assert.equal(rows[0].expectedEnrollment, 19);
  assert.equal(rows[0].historicalAverageEnrollment, 19);
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

  assert.equal(presence.rows.length, 3);
  assert.equal(presence.rows.reduce((sum, row) => sum + row.studentsPresent, 0), 60);
  assert.equal(presence.rows.every(row => row.campus === 'VIS'), true);
});

test('detailed student presence report excludes non-physical rows and groups room buckets', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const report = COSEnrollmentDashboard.studentPresenceReport([
    section({ crn: 'P1', modality: 'IN PERSON', campus: 'VIS', building: 'KERN', roomOnly: '101', room: 'KERN 101', days: ['MO'], start: '10:00', census: 20, cap: 30 }),
    section({ crn: 'P2', modality: 'HYBRID', campus: 'VIS', building: 'KERN', roomOnly: '101', room: 'KERN 101', days: ['MO'], start: '10:00', census: 10, cap: 20 }),
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

test('student presence deduplicates duplicate meeting rows within the same bucket', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const report = COSEnrollmentDashboard.studentPresenceReport([
    section({ crn: 'DUP1', campus: 'VIS', building: 'KERN', roomOnly: '101', room: 'KERN 101', days: ['MO'], start: '10:00', census: 25, cap: 30 }),
    section({ crn: 'DUP1', campus: 'VIS', building: 'KERN', roomOnly: '101', room: 'KERN 101', days: ['MO'], start: '10:00', census: 25, cap: 30 })
  ], 'roomDayHour');

  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].studentsPresent, 25);
  assert.equal(report.rows[0].sectionsActive, 1);
  assert.equal(report.rows[0].distinctCrns, 1);
  assert.equal(report.rows[0].meetingRowsIncluded, 2);
  assert.equal(report.metrics.totalSections, 1);
  assert.equal(report.metrics.distinctCrns, 1);
  assert.equal(report.metrics.meetingRowsIncluded, 2);
});

test('student presence counts one CRN in multiple buckets but only once overall', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const report = COSEnrollmentDashboard.studentPresenceReport([
    section({ crn: 'MULTI1', campus: 'VIS', building: 'KERN', roomOnly: '101', room: 'KERN 101', days: ['MO'], start: '09:00', census: 20, cap: 30 }),
    section({ crn: 'MULTI1', campus: 'VIS', building: 'KERN', roomOnly: '101', room: 'KERN 101', days: ['WE'], start: '09:00', census: 20, cap: 30 })
  ], 'campusDayHour');

  assert.equal(report.rows.length, 6);
  assert.equal(report.rows.reduce((sum, row) => sum + row.studentsPresent, 0), 120);
  assert.equal(report.rows.every(row => row.sectionsActive === 1), true);
  assert.equal(report.metrics.totalSections, 1);
  assert.equal(report.metrics.distinctCrns, 1);
  assert.equal(report.metrics.meetingRowsIncluded, 2);
});

test('student presence defaults to physical in-person hybrid rows and supports explicit expansion', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const rows = [
    section({ crn: 'IP1', modality: 'IN PERSON', campus: 'COS', days: ['MO'], start: '09:00', end: '09:30', census: 10 }),
    section({ crn: 'HY1', modality: 'HYBRID', campus: 'TCC', days: ['MO'], start: '09:00', end: '09:30', census: 20 }),
    section({ crn: 'DE1', modality: 'DUAL ENROLLMENT', campus: 'COS', days: ['MO'], start: '09:00', end: '09:30', census: 30 }),
    section({ crn: 'ON1', modality: 'ONLINE', campus: 'COS', days: ['MO'], start: '09:00', end: '09:30', census: 40 }),
    section({ crn: 'OT1', modality: 'IN PERSON', campus: 'SATELLITE', days: ['MO'], start: '09:00', end: '09:30', census: 50 })
  ];

  const defaults = COSEnrollmentDashboard.studentPresenceReport(rows, 'hour');
  assert.equal(defaults.metrics.totalStudents, 30);
  assert.equal(defaults.metrics.totalSections, 2);

  const withDualEnrollment = COSEnrollmentDashboard.studentPresenceReport(rows, 'hour', { includeDualEnrollment: true });
  assert.equal(withDualEnrollment.metrics.totalStudents, 60);
  assert.equal(withDualEnrollment.metrics.totalSections, 3);

  const expanded = COSEnrollmentDashboard.studentPresenceReport(rows, 'hour', { includeDualEnrollment: true, includeOtherModalities: true, physicalCampuses: [] });
  assert.equal(expanded.metrics.totalStudents, 150);
  assert.equal(expanded.metrics.totalSections, 5);
});

test('conflict check flags partial overlaps and deduplicates duplicate meetings', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    section({ term: 'FALL 2027', crn: 'C1', subject: 'ENGL', course: 'C1000', instructor: 'ONE, A', building: 'KERN', roomOnly: '101', room: 'KERN 101', days: ['MO', 'WE'], dayPattern: 'MW', start: '09:00', end: '10:15' }),
    section({ term: 'FALL 2027', crn: 'C1', subject: 'ENGL', course: 'C1000', instructor: 'ONE, A', building: 'KERN', roomOnly: '101', room: 'KERN 101', days: ['MO', 'WE'], dayPattern: 'MW', start: '09:00', end: '10:15' }),
    section({ term: 'FALL 2027', crn: 'C2', subject: 'MATH', course: '021', instructor: 'TWO, B', building: 'KERN', roomOnly: '101', room: 'KERN 101', days: ['MO'], dayPattern: 'M', start: '10:00', end: '11:00' }),
    section({ term: 'FALL 2027', crn: 'C3', subject: 'HIST', course: '018', instructor: 'ONE, A', building: 'KERN', roomOnly: '102', room: 'KERN 102', days: ['MO'], start: '09:30', end: '10:30' }),
    section({ term: 'FALL 2027', crn: 'C4', subject: 'HIST', course: '018', instructor: 'THREE, C', building: 'KERN', roomOnly: '103', room: 'KERN 103', days: ['TBA'], start: '', end: '' })
  ];

  const conflicts = COSEnrollmentAnalytics.conflictRows(rows, ['roomOverlap', 'instructorOverlap']);

  assert.equal(conflicts.length, 2);
  assert.equal(conflicts.filter(row => row.conflictType === 'Same room overlap').length, 1);
  assert.equal(conflicts.filter(row => row.conflictType === 'Same instructor overlap').length, 1);
  assert.equal(conflicts.find(row => row.conflictType === 'Same room overlap').overlapMinutes, 15);
  assert.equal(conflicts.find(row => row.conflictType === 'Same room overlap').day, 'MO');
  assert.equal(conflicts.find(row => row.conflictType === 'Same room overlap').meetingDays1, 'MW');
  assert.equal(conflicts.find(row => row.conflictType === 'Same room overlap').meetingDays2, 'M');
  assert.equal(conflicts.find(row => row.conflictType === 'Same instructor overlap').overlapMinutes, 45);
  assert.equal(conflicts.some(row => row.crn1 === row.crn2), false);
});

test('conflict check suppresses pairs with non-overlapping section date ranges', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    section({ term: 'FALL 2027', crn: 'D1', subject: 'ENGL', course: 'C1000', instructor: 'ONE, A', room: 'KERN 101', days: ['MO'], start: '09:00', end: '10:00', startDate: '08/17/2027', endDate: '10/15/2027' }),
    section({ term: 'FALL 2027', crn: 'D2', subject: 'MATH', course: '021', instructor: 'TWO, B', room: 'KERN 101', days: ['MO'], start: '09:00', end: '10:00', startDate: '10/18/2027', endDate: '12/10/2027' }),
    section({ term: 'FALL 2027', crn: 'D3', subject: 'HIST', course: '018', instructor: 'THREE, C', room: 'KERN 101', days: ['MO'], start: '09:30', end: '10:30', startDate: '10/01/2027', endDate: '11/01/2027' })
  ];

  const conflicts = COSEnrollmentAnalytics.conflictRows(rows, ['roomOverlap']);

  assert.equal(conflicts.length, 2);
  assert.equal(conflicts.some(row => [row.crn1, row.crn2].includes('D1') && [row.crn1, row.crn2].includes('D2')), false);
  assert.equal(conflicts.every(row => row.dateRange1 && row.dateRange2), true);
});

test('conflict check parses all-caps start and end date headers into table fields', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    {
      TERM: 'FALL 2027',
      CRN: 'SD1',
      'SUBJECT/COURSE': 'ENGL C1000',
      FACULTY: 'ONE, A',
      BUILDING: 'KERN',
      ROOM: '101',
      MONDAY: 'Y',
      'START TIME': '09:00',
      'END TIME': '10:00',
      'START DATE': '08/17/2027',
      'END DATE': '10/15/2027'
    },
    {
      TERM: 'FALL 2027',
      CRN: 'SD2',
      'SUBJECT/COURSE': 'MATH 021',
      FACULTY: 'TWO, B',
      BUILDING: 'KERN',
      ROOM: '101',
      MONDAY: 'Y',
      'START TIME': '09:30',
      'END TIME': '10:30',
      'START DATE': '09/01/2027',
      'END DATE': '12/10/2027'
    }
  ].map(row => COSEnrollmentAnalytics.normalizeRow(row));

  const conflicts = COSEnrollmentAnalytics.conflictRows(rows, ['roomOverlap']);

  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].startDate1, '8/17/2027');
  assert.equal(conflicts[0].endDate1, '10/15/2027');
  assert.equal(conflicts[0].startDate2, '9/1/2027');
  assert.equal(conflicts[0].endDate2, '12/10/2027');
  assert.equal(conflicts[0].dateRange1, '8/17/2027-10/15/2027');
});

test('conflict check omits cross-listed pairs and combines room instructor overlaps by default', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    section({ term: 'SPRING 2027', crn: 'X1', subject: 'COMM', course: 'C1000', instructor: 'ONE, A', room: 'KERN 101', days: ['MO'], start: '09:00', end: '10:00', crossList: 'XL100' }),
    section({ term: 'SPRING 2027', crn: 'X2', subject: 'COMM', course: 'C1000', instructor: 'ONE, A', room: 'KERN 101', days: ['MO'], start: '09:00', end: '10:00', crossList: 'XL100' }),
    section({ term: 'SPRING 2027', crn: 'X3', subject: 'COMM', course: 'C1000', instructor: 'ONE, A', room: 'KERN 101', days: ['MO'], start: '09:00', end: '10:00', crossList: 'XL200' }),
    section({ term: 'SPRING 2027', crn: 'C1', subject: 'HIST', course: '018', instructor: 'TWO, B', room: 'KERN 102', days: ['MO'], start: '11:00', end: '12:00', crossList: '' }),
    section({ term: 'SPRING 2027', crn: 'C2', subject: 'HIST', course: '018', instructor: 'TWO, B', room: 'KERN 102', days: ['MO'], start: '11:15', end: '12:15', crossList: '' })
  ];

  const defaultConflicts = COSEnrollmentAnalytics.conflictRows(rows, ['roomOverlap', 'instructorOverlap']);
  assert.equal(defaultConflicts.length, 1);
  assert.equal(defaultConflicts[0].conflictType, 'Same Room + Same Instructor');
  assert.equal(defaultConflicts[0].overlapMinutes, 45);

  const withCrossListed = COSEnrollmentAnalytics.conflictRows(rows, ['roomOverlap', 'instructorOverlap'], { omitCrossListed: false });
  assert.equal(withCrossListed.length, 4);
  assert.equal(withCrossListed.filter(row => row.conflictType === 'Same Room + Same Instructor').length, 4);
  assert.equal(withCrossListed.some(row => row.crossList1 === 'XL100' && row.crossList2 === 'XL100'), true);
  assert.equal(withCrossListed.some(row => row.crossList1 === 'XL100' && row.crossList2 === 'XL200'), true);

  const separateTypes = COSEnrollmentAnalytics.conflictRows(rows, ['roomOverlap', 'instructorOverlap'], { separateConflictTypes: true });
  assert.equal(separateTypes.length, 2);
  assert.equal(separateTypes.some(row => row.conflictType === 'Same room overlap'), true);
  assert.equal(separateTypes.some(row => row.conflictType === 'Same instructor overlap'), true);
});

test('conflict check ignores STAFF for instructor conflicts', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    section({ term: 'FALL 2027', crn: 'S1', subject: 'MATH', course: '021', instructor: 'STAFF', room: 'KERN 101', days: ['MO'], start: '09:00', end: '10:00' }),
    section({ term: 'FALL 2027', crn: 'S2', subject: 'ENGL', course: 'C1000', instructor: 'STAFF', room: 'KERN 102', days: ['MO'], start: '09:30', end: '10:30' }),
    section({ term: 'FALL 2027', crn: 'S3', subject: 'HIST', course: '018', instructor: 'STAFF', room: 'KERN 101', days: ['MO'], start: '09:30', end: '10:30' })
  ];

  const instructorConflicts = COSEnrollmentAnalytics.conflictRows(rows, ['instructorOverlap']);
  const roomConflicts = COSEnrollmentAnalytics.conflictRows(rows, ['roomOverlap']);

  assert.equal(instructorConflicts.length, 0);
  assert.equal(roomConflicts.length, 1);
  assert.equal(roomConflicts[0].conflictType, 'Same room overlap');
});

test('detailed student presence report supports campus and building group metrics', () => {
  const { COSEnrollmentDashboard } = loadEnrollmentModules();
  const rows = [
    section({ campus: 'VIS', building: 'KERN', roomOnly: '101', room: 'KERN 101', days: ['MO'], start: '09:00', census: 20, cap: 30 }),
    section({ campus: 'TCCB', building: 'TCCB', roomOnly: '201', room: 'TCCB 201', days: ['TU'], start: '11:00', end: '12:15', census: 40, cap: 50 })
  ];
  const campusReport = COSEnrollmentDashboard.studentPresenceReport(rows, 'campus');
  const buildingReport = COSEnrollmentDashboard.studentPresenceReport(rows, 'building');

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
  assert.match(text, /Enrollment Attrition Trend/);
  assert.match(text, /Diagnostic Attrition Rates/);
  assert.match(text, /attritionDiagnosticRates/);
  assert.match(text, /Section Consolidation Opportunities/);
  assert.match(text, /Room Utilization Map/);
  assert.match(text, /Conflict Check Report/);
  assert.match(text, /REPORTS\.conflictCheck/);
  assert.match(text, /Student Presence Analytics/);
  assert.match(text, /Open Student Presence Report/);
  assert.match(text, /REPORTS\.studentPresence/);
  assert.match(text, /Instructor Availability - Planning View/);
  assert.match(text, /Enrollment Snapshot Manager/);
  assert.match(text, /REPORTS\.snapshotManager/);
  assert.match(text, /snapSeason/);
  assert.match(text, /snapYear/);
  assert.match(text, /function snapshotTerm/);
  assert.match(text, /Term \+ CRN \+ Snapshot Type/);
  assert.match(text, /snapshotKey\(record\)/);
  assert.doesNotMatch(text, /id="snapTerm"/);
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
  assert.match(loadBlock, /readArchivedRows\('conArchiveTerms'\)/);
  assert.match(loadBlock, /applyCurriculumCrosswalkToRows/);
  assert.doesNotMatch(historicalBlock, /api\/schedule/);
  assert.doesNotMatch(historicalBlock, /visibleScheduleTerms/);
  assert.match(text, /Selected Archived Terms/);
  assert.match(text, /Uploaded Terms/);
  assert.match(text, /Historical Comparison Terms Used/);
  assert.match(text, /Current Rows Count/);
  assert.match(text, /Historical Rows Count/);
  assert.match(text, /does not silently pull every archived term/);
  assert.match(text, /Curriculum Crosswalk/);
  assert.match(text, /ENGL 001 history can support ENGL C1000/);
  assert.match(text, /ONL, 71, 72, O1, OL, ONN, ONS, OO, OS, OSS, OT, OTS/);
  assert.match(text, /IP, 02, 22, 022, 02H, 02O, 02S, 02T, 02N/);
  assert.match(text, /HYB, OH, OHF, FLX, and OHS/);
});

test('dashboard source does not silently load all archived terms', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const sourceStart = text.indexOf('function dashboardSourceRows');
  const loadStart = text.indexOf('async function loadDashboardRows');
  const loadEnd = text.indexOf('function dashboardAvailableTerms', loadStart);
  const sourceBlock = text.slice(sourceStart, loadStart);
  const loadBlock = text.slice(loadStart, loadEnd);

  assert.doesNotMatch(sourceBlock, /readArchivedRows/);
  assert.doesNotMatch(sourceBlock, /analytics-archive/);
  assert.match(sourceBlock, /state\.dashboardInput/);
  assert.doesNotMatch(sourceBlock, /state\.enrollment/);
  assert.doesNotMatch(sourceBlock, /state\.demandInput/);
  assert.doesNotMatch(sourceBlock, /state\.consolidationInput/);
  assert.match(text, /id="dashboardCsv"/);
  assert.match(text, /id="dashArchiveTerms"/);
  assert.match(loadBlock, /readArchivedRows\('dashArchiveTerms', \{ reportLabel: 'Enrollment Analytics Dashboard' \}\)/);
});

test('demand forecast is scoped to selected demand uploads and archives', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const loadStart = text.indexOf('async function loadDemandRows');
  const loadEnd = text.indexOf('async function runDemand', loadStart);
  const defaultsStart = text.indexOf('function setDemandTargetDefaults');
  const defaultsEnd = text.indexOf('function captureFilterState', defaultsStart);
  const archiveStart = text.indexOf('async function readArchivedRows');
  const archiveEnd = text.indexOf('async function refreshAnalyticsArchiveOptions', archiveStart);
  const loadBlock = text.slice(loadStart, loadEnd);
  const defaultsBlock = text.slice(defaultsStart, defaultsEnd);
  const archiveBlock = text.slice(archiveStart, archiveEnd);

  assert.match(loadBlock, /readArchivedRows\('demArchiveTerms', \{ reportLabel: 'Demand Forecast' \}\)/);
  assert.match(loadBlock, /const rows = rowsWithWorkExperience\(uploaded, 'dem'\)/);
  assert.doesNotMatch(loadBlock, /currentRows\(\)/);
  assert.match(archiveBlock, /Could not load archived term/);
  assert.match(archiveBlock, /reportLabel/);
  assert.match(defaultsBlock, /academicYearTrailingYear/);
  assert.match(defaultsBlock, /dataset\.autoDefault/);
  assert.match(text, /Demand source load failed:/);
});

test('archive inspection exposes parsed archived schedule validation', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.match(text, /archiveInspection: 'archive-inspection'/);
  assert.match(text, /Archived Schedule Inspector/);
  assert.match(text, /archiveInspectionTerm/);
  assert.match(text, /archiveInspectionCsv/);
  assert.match(text, /inspectArchivedSchedule/);
  assert.match(text, /Export Parsed Archive CSV/);
  assert.match(text, /Raw Row Count/);
  assert.match(text, /Normalized Row Count/);
  assert.match(text, /Distinct CRN Count/);
  assert.match(text, /Distinct Physical CRNs/);
  assert.match(text, /Online CRNs/);
  assert.match(text, /TBA\/No Fixed Time Rows/);
  assert.match(text, /Cross-Listed Rows/);
  assert.match(text, /Dual Enrollment Rows/);
  assert.match(text, /Work Experience Rows/);
  assert.match(text, /Term Value Detected/);
  assert.match(text, /Campus Distribution/);
  assert.match(text, /Modality Distribution/);
  assert.match(text, /Instructional Method Code Distribution/);
  assert.match(text, /Day\/Time Distribution/);
  assert.match(text, /archiveInspectionRows/);
  assert.match(text, /exportArchiveInspection/);
});

test('online placeholder times normalize to Online/TBA', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const row = COSEnrollmentAnalytics.normalizeRow({
    Term: 'SPRING 2027',
    CRN: '90001',
    Subject: 'HIST',
    Course: '018',
    'Instructional Method': 'ONL',
    Days: 'TBA',
    Start_Time: '00:00',
    End_Time: '00:59',
    CENSUS_ENROLL: '20',
    'Max Enrollment': '40'
  });

  assert.equal(row.modality, 'ONLINE');
  assert.equal(row.timeBlock, 'ONLINE/TBA');
  assert.equal(COSEnrollmentAnalytics.isOnlinePlaceholderTime(row), true);
});

test('instructor availability keeps Monday-only lab separate from MWF lecture', () => {
  const { COSEnrollmentAnalytics } = loadEnrollmentAnalyticsRuntime();
  const rows = [
    COSEnrollmentAnalytics.normalizeRow({
      Term: 'FALL 2027',
      CRN: '70001',
      Subject: 'BIOL',
      Course: '001',
      Section: '01',
      Instructor: 'DOE, J',
      Days: 'MWF',
      Start_Time: '10:10',
      End_Time: '11:00'
    }),
    COSEnrollmentAnalytics.normalizeRow({
      Term: 'FALL 2027',
      CRN: '70001',
      Subject: 'BIOL',
      Course: '001',
      Section: '01',
      Instructor: 'DOE, J',
      Days: 'M',
      Start_Time: '13:10',
      End_Time: '19:00'
    })
  ];
  const scheduleRows = COSEnrollmentAnalytics.instructorScheduleRows(rows);

  assert.equal(scheduleRows.length, 2);
  assert.equal(JSON.stringify(scheduleRows.map(row => `${row.dayPattern} ${row.start}-${row.end}`).sort()), JSON.stringify([
    'M 13:10-19:00',
    'MWF 10:10-11:00'
  ]));
});

test('TIMBER report organization moves analytics tools into enrollment management', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');
  const reportOrderStart = text.indexOf('const REPORT_ORDER = [');
  const reportOrderEnd = text.indexOf('];', reportOrderStart);
  const reportOrderBlock = text.slice(reportOrderStart, reportOrderEnd);

  assert.match(text, /REPORT_GROUP_ORDER = \['dean', 'em', 'admin', 'development'\]/);
  assert.match(text, /function reportGroupsHtml/);
  assert.match(text, /class="em-report-groups"/);
  assert.match(text, /class="em-report-button"/);
  assert.match(text, /data-report-role="\$\{role\}"/);
  assert.match(text, /id="emReportSelect" hidden/);
  [
    'REPORTS.archiveInspection',
    'REPORTS.snapshotManager',
    'REPORTS.workExperience',
    'REPORTS.duration',
    'REPORTS.dashboard',
    'REPORTS.heatmap',
    'REPORTS.instructorAvailability',
    'REPORTS.modality',
    'REPORTS.conflictCheck',
    'REPORTS.attrition',
    'REPORTS.demand',
    'REPORTS.roomFit',
    'REPORTS.utilization',
    'REPORTS.consolidation',
    'REPORTS.studentPresence'
  ].reduce((lastIndex, report) => {
    const indexOfReport = reportOrderBlock.indexOf(report);
    assert.ok(indexOfReport > lastIndex, `${report} should appear in grouped report order`);
    return indexOfReport;
  }, -1);

  assert.doesNotMatch(index, /<option value="heatmap">/);
  assert.doesNotMatch(index, /<option value="modality">/);
  assert.doesNotMatch(index, /<option value="linechart">/);
  assert.match(text, /document\.getElementById\('analyticsReports'\)\.appendChild\(tool\)/);
  assert.match(text, /roomFitReport/);
  assert.match(index, /heatmap-archive-terms/);
  assert.match(index, /heatmap-source-status/);
  assert.match(index, /modality-archive-terms/);
  assert.match(index, /linechart-archive-terms/);
  assert.match(index, /linechart-source-status/);
  assert.match(text, /roomFitArchiveTerms/);
  assert.match(app, /renderRoomFitReport/);
  assert.match(app, /function setScheduleAnalysisStatus/);
  assert.match(app, /Choose a CSV or archived term, then click Load Source/);
  assert.match(app, /Loaded \$\{rows\.length\} row\(s\)/);
  assert.match(app, /parseHour\(row\[5\]\?\.split/);
  assert.match(app, /r\.Days \|\| r\.days \|\| r\.dayPattern/);
  assert.match(app, /'roomOnly', 'room'/);
  assert.match(app, /'Start_Time', 'Start Time', 'start', 'Start'/);
  assert.match(app, /dayColumnMap/);
  assert.match(app, /'MONDAY', 'Monday'/);
  assert.match(app, /'INSTRUCTIONAL_METHOD_CODE'/);
  assert.match(app, /Underutilized Room/);
  assert.match(app, /Over Capacity Risk/);
  assert.match(app, /Enrollment Exceeds Room Capacity/);
  assert.match(text, /#roomFitReportMetrics button\.room-fit-card/);
  assert.match(text, /#roomFitReportMetrics button\.room-fit-card\.is-active/);
  assert.match(text, /#f59e0b/);
  assert.match(app, /requestPassword/);
  assert.doesNotMatch(app, /prompt\(/);
  assert.doesNotMatch(text, /prompt\(/);
  assert.match(text, /type="password"/);
  assert.match(css, /password-eye/);
  assert.match(text, /defaultCampusCodes = \['COS', 'TCC', 'HAC', 'ONT', 'ONH', 'ONC'\]/);
  assert.match(text, /physicalCampusCodes = \['COS', 'TCC', 'HAC'\]/);
});

test('TIMBER role-based access is centralized and report scoped', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const backend = fs.readFileSync(path.join(__dirname, '..', '..', 'App-Backend', 'server.js'), 'utf8');

  assert.match(text, /const ROLE_LEVEL = \{/);
  assert.match(text, /development: 4/);
  assert.match(text, /const REPORT_ACCESS = \{/);
  assert.match(text, /\[REPORTS\.dashboard\]: 'dean'/);
  assert.match(text, /\[REPORTS\.modality\]: 'dean'/);
  assert.match(text, /\[REPORTS\.consolidation\]: 'em'/);
  assert.match(text, /\[REPORTS\.archiveInspection\]: 'admin'/);
  assert.match(text, /\[REPORTS\.snapshotManager\]: 'admin'/);
  assert.match(text, /\[REPORTS\.workExperience\]: 'admin'/);
  assert.match(text, /function canAccess\(reportName\)/);
  assert.match(text, /Access Level/);
  assert.match(text, /id="currentAccessLevel"/);
  assert.match(text, /Lock Reports/);
  assert.match(text, /\[Locked\]/);
  assert.match(text, /Requires \$\{ROLE_LABEL\[requiredRole\]\}/);
  assert.match(text, /data-unlock-report/);
  assert.match(text, /api\/auth\/role/);
  assert.match(text, /General supports file upload and maintenance passwords only/);
  assert.match(text, /Administrator is reserved for system configuration, archive inspection, snapshot management, Work Experience uploads/);
  assert.match(text, /Development is for experimental and in-progress reports/);
  assert.doesNotMatch(text, /Developer/);
  assert.doesNotMatch(text, /Upload2025/);
  assert.match(backend, /GENERAL_PASSWORD/);
  assert.match(backend, /DEAN_PASSWORD/);
  assert.match(backend, /EM_PASSWORD/);
  assert.match(backend, /DEV_PASSWORD/);
  assert.match(backend, /ADMIN_PASSWORD/);
  assert.match(backend, /app\.post\('\/api\/auth\/role'/);
});

test('faculty schedule heatmap is a standalone Development report', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.match(text, /facultyHeatmap: 'faculty-schedule-heatmap'/);
  assert.match(text, /\[REPORTS\.facultyHeatmap\]: 'development'/);
  assert.match(text, /Faculty Schedule Heatmap/);
  assert.match(text, /id="facultyHeatmapReport"/);
  assert.match(text, /id="facultyScheduleCsv"/);
  assert.match(text, /id="fhMetric"/);
  assert.match(text, /<option value="sections">Sections<\/option>/);
  assert.match(text, /<option value="facultyCount">Faculty Count<\/option>/);
  assert.match(text, /<option value="enrollment">Enrollment<\/option>/);
  assert.match(text, /<option value="seats">Seats<\/option>/);
  assert.match(text, /<option value="lhe">LHE<\/option>/);
  assert.match(text, /id="fhFacultyType"/);
  assert.match(text, /FULL_TIME/);
  assert.match(text, /PART_TIME/);
  assert.match(text, /id="fhMeetingType"/);
  assert.match(text, /Lecture/);
  assert.match(text, /Lab/);
  assert.match(text, /Activity/);
  assert.match(text, /id="fhCampus"/);
  assert.match(text, /id="fhDivision"/);
  assert.match(text, /id="fhDepartment"/);
  assert.match(text, /id="fhSubject"/);
  assert.match(text, /id="fhCourse"/);
  assert.match(text, /id="fhTerm"/);
  assert.match(text, /id="fhModality"/);
  assert.match(text, /function readFacultyScheduleFiles/);
  assert.match(text, /COSFacultyParser\.parseFacultyScheduleCsv/);
  assert.match(text, /function renderFacultyScheduleHeatmap/);
  assert.match(text, /heatmap-cell heatmap-\$\{level\}/);
  assert.match(text, /Peak teaching time/);
  assert.match(text, /Peak FT teaching/);
  assert.match(text, /Peak PT teaching/);
  assert.match(text, /Peak enrollment/);
  assert.match(text, /Peak LHE/);
  assert.match(text, /Most active day/);
  assert.match(text, /Least active day/);
});

test('faculty modality is a standalone Development report using INSM codes', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.match(text, /facultyModality: 'faculty-modality'/);
  assert.match(text, /\[REPORTS\.facultyModality\]: 'development'/);
  assert.match(text, /Faculty Modality/);
  assert.match(text, /id="facultyModalityReport"/);
  assert.match(text, /id="facultyModalityCsv"/);
  assert.match(text, /id="fmCampus"/);
  assert.match(text, /id="fmDivision"/);
  assert.match(text, /id="fmDepartment"/);
  assert.match(text, /id="fmCourse"/);
  assert.match(text, /id="fmTerm"/);
  assert.match(text, /id="exportFacultyModality"/);
  assert.match(text, /function facultyInstructionModality/);
  assert.match(text, /row\?\.insmCode/);
  assert.match(text, /normalizeModality\(row\?\.insmCode/);
  assert.match(text, /Full-Time/);
  assert.match(text, /Part-Time/);
  assert.match(text, /Unknown/);
  assert.match(text, /In Person/);
  assert.match(text, /Hybrid/);
  assert.match(text, /Online/);
  assert.match(text, /Other/);
  assert.match(text, /faculty-modality-bar/);
  assert.match(text, /facultyModalityTableRows/);
  assert.match(text, /faculty-modality\.csv/);
  assert.match(text, /INSM_CODE_SSBSECT/);
});

test('prime time analysis is a standalone Development report with custom definition controls', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.match(text, /primeTimeAnalysis: 'prime-time-analysis'/);
  assert.match(text, /\[REPORTS\.primeTimeAnalysis\]: 'development'/);
  assert.match(text, /Prime Time Analysis/);
  assert.match(text, /id="primeTimeAnalysisReport"/);
  assert.match(text, /id="primeTimeCsv"/);
  assert.match(text, /id="ptStart" type="time" value="09:00"/);
  assert.match(text, /id="ptEnd" type="time" value="15:00"/);
  assert.match(text, /class="ptDay" type="checkbox" value="MO" checked/);
  assert.match(text, /class="ptDay" type="checkbox" value="TH" checked/);
  assert.match(text, /id="ptCampus"/);
  assert.match(text, /id="ptDivision"/);
  assert.match(text, /id="ptDepartment"/);
  assert.match(text, /id="ptCourse"/);
  assert.match(text, /id="ptTerm"/);
  assert.match(text, /id="exportPrimeTimeAnalysis"/);
  assert.match(text, /function primeTimeDefinition/);
  assert.match(text, /function rowOverlapsPrimeTime/);
  assert.match(text, /function primeTimeAnalysisRows/);
  assert.match(text, /Full-Time Sections/);
  assert.match(text, /Part-Time Sections/);
  assert.match(text, /Lecture Sections/);
  assert.match(text, /Lab Sections/);
  assert.match(text, /Activity Sections/);
  assert.match(text, /Student Enrollment/);
  assert.match(text, /LHE/);
  assert.match(text, /prime-time-gauge/);
  assert.match(text, /prime-time-analysis\.csv/);
});

test('supply vs demand is a standalone Development report with heatmap line and table views', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.match(text, /supplyDemand: 'supply-demand-analysis'/);
  assert.match(text, /\[REPORTS\.supplyDemand\]: 'development'/);
  assert.match(text, /Supply vs Demand/);
  assert.match(text, /id="supplyDemandReport"/);
  assert.match(text, /id="supplyDemandCsv"/);
  assert.match(text, /id="sdArchiveTerms"/);
  assert.match(text, /id="sdView"/);
  assert.match(text, /id="sdMetric"/);
  assert.match(text, /Sections/);
  assert.match(text, /Seats Offered/);
  assert.match(text, /Student Presence/);
  assert.match(text, /Fill Rate/);
  assert.match(text, /Waitlist/);
  assert.match(text, /Empty Seats/);
  assert.match(text, /id="sdCampus"/);
  assert.match(text, /id="sdDivision"/);
  assert.match(text, /id="sdDepartment"/);
  assert.match(text, /id="sdCourse"/);
  assert.match(text, /id="sdCalGetc"/);
  assert.match(text, /id="sdModality"/);
  assert.match(text, /function runSupplyDemand/);
  assert.match(text, /function buildSupplyDemandBuckets/);
  assert.match(text, /function renderSupplyDemandHeatmap/);
  assert.match(text, /function renderSupplyDemandLineGraph/);
  assert.match(text, /High Demand/);
  assert.match(text, /Hidden Demand/);
  assert.match(text, /Balanced/);
  assert.match(text, /Oversupplied/);
  assert.match(text, /Low Activity/);
  assert.match(text, /enrollment alone cannot prove student preference/i);
  assert.match(text, /supply-vs-demand\.csv/);
});

test('busy time dashboard is a standalone Development report summarizing core busy-time signals', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.match(text, /busyTimeDashboard: 'busy-time-dashboard'/);
  assert.match(text, /\[REPORTS\.busyTimeDashboard\]: 'development'/);
  assert.match(text, /Busy Time Dashboard/);
  assert.match(text, /id="busyTimeDashboardReport"/);
  assert.match(text, /id="busyTimeCsv"/);
  assert.match(text, /id="busyTimeArchiveTerms"/);
  assert.match(text, /id="busyTimeFacultyCsv"/);
  assert.match(text, /Prime Time Score/);
  assert.match(text, /Faculty Concentration/);
  assert.match(text, /Student Concentration/);
  assert.match(text, /Seat Supply/);
  assert.match(text, /Demand Pressure/);
  assert.match(text, /Room Utilization/);
  assert.match(text, /High enrollment appears to coincide with high section supply/);
  assert.match(text, /Evening sections have limited supply but consistently high fill/);
  assert.match(text, /Full-time faculty are concentrated between 9 AM and 2 PM/);
  assert.match(text, /Student demand remains strong after 4 PM/);
  assert.match(text, /summarizes data only and does not make scheduling recommendations/i);
  assert.match(text, /function runBusyTimeDashboard/);
  assert.match(text, /function buildBusyTimeBuckets/);
  assert.match(text, /function buildBusyTimeFacultyBuckets/);
  assert.match(text, /busy-time-dashboard\.csv/);
});

test('student choice opportunity is a standalone Development report with choice metrics', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.match(text, /studentChoiceOpportunity: 'student-choice-opportunity'/);
  assert.match(text, /\[REPORTS\.studentChoiceOpportunity\]: 'development'/);
  assert.match(text, /Student Choice Opportunity/);
  assert.match(text, /id="studentChoiceOpportunityReport"/);
  assert.match(text, /id="studentChoiceCsv"/);
  assert.match(text, /id="studentChoiceArchiveTerms"/);
  assert.match(text, /id="studentChoiceFacultyCsv"/);
  assert.match(text, /Unique courses/);
  assert.match(text, /Unique CAL-GETC courses/);
  assert.match(text, /Seats offered/);
  assert.match(text, /Enrollment present/);
  assert.match(text, /Fill rate/);
  assert.match(text, /Empty seats/);
  assert.match(text, /Course Choice Count/);
  assert.match(text, /GE Choice Count/);
  assert.match(text, /Subject Breadth Count/);
  assert.match(text, /Seat Choice Count/);
  assert.match(text, /Modality Choice Count/);
  assert.match(text, /Campus Choice Count/);
  assert.match(text, /High choice \/ high demand/);
  assert.match(text, /High choice \/ weaker demand/);
  assert.match(text, /Low choice \/ high demand/);
  assert.match(text, /Low choice \/ limited evidence/);
  assert.match(text, /Low choice \/ low demand/);
  assert.match(text, /studentChoiceExcludeTutoring/);
  assert.match(text, /isTutoringOpenLabSection\(row\)/);
  assert.match(text, /row\.timeBlock !== 'ONLINE\/TBA'/);
  assert.match(text, /sectionKey\(row\), day, row\.start, row\.end/);
  assert.match(text, /function buildStudentChoiceBuckets/);
  assert.match(text, /function renderStudentChoiceHeatmap/);
  assert.match(text, /function renderStudentChoiceLineGraph/);
  assert.match(text, /student-choice-opportunity\.csv/);
});

test('scheduling recommendation engine is advisory and covers recommendation categories', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.match(text, /recommendationEngine: 'scheduling-recommendation-engine'/);
  assert.match(text, /\[REPORTS\.recommendationEngine\]: 'development'/);
  assert.match(text, /Scheduling Recommendation Engine/);
  assert.match(text, /id="recommendationEngineReport"/);
  assert.match(text, /id="recommendationCsv"/);
  assert.match(text, /id="recommendationArchiveTerms"/);
  assert.match(text, /id="recommendationFacultyCsv"/);
  assert.match(text, /advisory-only/);
  assert.match(text, /does not automatically change schedules/);
  assert.match(text, /does not claim to prove student preference/);
  assert.match(text, /Hidden Demand/);
  assert.match(text, /Oversupply/);
  assert.match(text, /Choice Gap/);
  assert.match(text, /Faculty Concentration/);
  assert.match(text, /Room Opportunity/);
  assert.match(text, /Modality Imbalance/);
  assert.match(text, /Consolidation Candidate/);
  assert.match(text, /Expansion Candidate/);
  assert.match(text, /Insufficient evidence/);
  assert.match(text, /function recommendationConfidence/);
  assert.match(text, /High/);
  assert.match(text, /Medium/);
  assert.match(text, /Low/);
  assert.match(text, /observed enrollment/);
  assert.match(text, /available supply/);
  assert.match(text, /student choice opportunity/);
  assert.match(text, /faculty assignment pattern/);
  assert.match(text, /room availability/);
  assert.match(text, /recommendationTitle/);
  assert.match(text, /confidenceLevel/);
  assert.match(text, /affectedTermSource/);
  assert.match(text, /evidenceSummary/);
  assert.match(text, /metricsUsed/);
  assert.match(text, /whyThisMatters/);
  assert.match(text, /suggestedAction/);
  assert.match(text, /cautionsLimitations/);
  assert.match(text, /scheduling-recommendations\.csv/);
  assert.match(text, /scheduling-recommendations\.pdf/);
});

test('enrollment analytics supports supplemental work experience upload controls', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.match(text, /Work Experience Enrollment Upload/);
  assert.match(text, /id="workExperienceCsv"/);
  assert.match(text, /session only until archive support is added/);
  assert.match(text, /dashIncludeWorkExperience/);
  assert.match(text, /attrIncludeWorkExperience/);
  assert.match(text, /demIncludeWorkExperience/);
  assert.match(text, /WORK EXPERIENCE/);
  assert.match(text, /FTES unavailable/);
  assert.match(text, /!row\.isWorkExperience/);
  assert.match(text, /dashboardSourceRows/);
  assert.match(text, /rowsWithWorkExperience/);
  assert.match(text, /studentPresence.*filter\(row => !row\.isWorkExperience\)/s);
});

test('snapshot manager defaults first day as primary manual snapshot', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const snapBlock = text.slice(text.indexOf('<select id="snapType">'), text.indexOf('</select>', text.indexOf('<select id="snapType">')));

  assert.ok(snapBlock.indexOf('<option>First Day</option>') < snapBlock.indexOf('<option>Census 1</option>'));
  assert.match(text, /First Day is the primary manual snapshot/);
  assert.match(text, /Census 1, Census 2, and Final are already present in Banner source exports/);
});

test('modality balance includes dual enrollment toggle and methodology note', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');

  assert.match(index, /modality-include-de/);
  assert.match(index, /Dual Enrollment is excluded by default/);
  ['modality-campus-select', 'modality-division-select', 'modality-discipline-select', 'modality-department-select', 'modality-course-select', 'modality-modality-select'].forEach(id => {
    assert.match(index, new RegExp(`id="${id}"[^>]*multiple`));
  });
  assert.match(index, /% of Sections/);
  assert.match(index, /% of Enrollment/);
  assert.match(index, /Class counts and enrollment are shown as separate comparison views/);
  assert.match(index, /modality-source-status/);
  assert.match(index, /modality-export-btn/);
  assert.match(index, /modality-course-comparison-table/);
  assert.match(index, /Course-Level Term Differences/);
  assert.match(app, /includeDualEnrollment/);
  assert.match(app, /code === 'DE'/);
  assert.match(app, /category === 'Dual Enrollment'/);
  assert.match(app, /loadModalityArchiveRowsFromBackend/);
  assert.match(app, /api\/analytics-archive/);
  assert.match(app, /let modalityLoadedSourceRows = null/);
  assert.match(app, /modalityLoadedSourceRows = modalityUploadRows/);
  assert.match(app, /return modalityLoadedSourceRows\?\.\length \? modalityLoadedSourceRows : currentData/);
  assert.match(app, /const terms = \[\.\.\.new Set\(rows\.map\(getSectionTerm\)/);
  assert.match(app, /function getModalityComparisonTerms/);
  assert.match(app, /function getModalityComparisonSourceRows/);
  assert.match(app, /resetSelect\(select, comparisonTerms, 'None', ''\)/);
  assert.match(app, /calculateModalityBalance\(\{ term, sourceRows: getModalityComparisonSourceRows\(term\) \}\)/);
  assert.match(app, /selectedValues\(modalityCampusSelect\)/);
  assert.match(app, /selectedValues\(modalityCourseSelect\)/);
  assert.match(app, /selectedValues\(modalityModalitySelect\)/);
  assert.match(app, /function modalityFilteredSections/);
  assert.match(app, /function modalityCourseComparisonRows/);
  assert.match(app, /function renderModalityCourseComparisonTable/);
  assert.match(app, /function modalityCourseComparisonExportRows/);
  assert.match(app, /modalityPieCard\('Class Count Mix'/);
  assert.match(app, /modalityPieCard\('Enrollment Mix'/);
  assert.match(app, /function exportModalityBalance/);
  assert.match(app, /modalityExportBtn\.addEventListener\('click', exportModalityBalance\)/);
  assert.match(app, /Graph Data/);
  assert.match(app, /Comparison Results/);
  assert.match(app, /modality-balance-\$\{slug\}\.csv/);
  assert.match(app, /Class Count by Modality/);
  assert.match(app, /Enrollment by Modality/);
  assert.match(app, /Course-Level Term Differences/);
  assert.match(app, /Focus term minus comparison term by unique CRN course\/modality grouping/);
  assert.match(app, /signedPctChange/);
  assert.match(app, /Current Loaded Term/);
});

test('requested analytics regression coverage is represented in smoke tests', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');

  [
    /function conflictRows/,
    /crossList: \['CROSS_LIST'/,
    /conflictOmitCrossListed/,
    /conflictSeparateTypes/,
    /hasCrossList/,
    /Same Room \+ Same Instructor/,
    /function conflictInspectionRows/,
    /inspectConflictArchive/,
    /overlapMinutes/,
    /CENSUS_ENROLL2/,
    /lifecycleMetricLabel\(value\)/,
    /sectionsMissingFirstDaySnapshot/,
    /handleAttritionError/,
    /runAttrition\(\)\.catch\(handleAttritionError\)/,
    /conDecisionSeason/,
    /conDecisionYear/,
    /function consolidationDecisionTerm/,
    /dashDecisionSeason/,
    /dashDecisionYear/,
    /function dashboardFocusTerm/,
    /snapSeason/,
    /snapYear/,
    /function snapshotTerm/,
    /spHideOnline/,
    /spIncludeDualEnrollment/,
    /spIncludeOtherModalities/,
    /spCampusScope/,
    /function studentPresenceCampusScope/,
    /function studentPresenceScopedRows/,
    /campuses\.has\(canon\(row\.campus\)\)/,
    /studentPresenceExportRows/,
    /function exportStudentPresenceRows/,
    /All COS\/HAC\/TCC/,
    /spCompareTerms/,
    /function renderStudentPresenceCurve/,
    /function studentPresenceHasUsableFixedTime/,
    /start >= 6 \* 60/,
    /studentPresenceChartFilter/,
    /getElementsAtEventForMode/,
    /Clear graph filter/,
    /studentPresenceChartSources/,
    /sourceRows: termRows/,
    /studentPresenceFilteredSectionRows/,
    /rowStart < end && rowEnd > start/,
    /borderDash: sourceIndex \? \[6, 4\] : \[\]/,
    /distinctCrns/,
    /meetingRowsIncluded/
  ].forEach(pattern => assert.match(text, pattern));

  [
    /getModalityCategory/,
    /code === 'DE'/,
    /modality-include-de/,
    /calculateRoomFitFlags/,
    /Underutilized Room/,
    /Over Capacity Risk/,
    /Enrollment Exceeds Room Capacity/
  ].forEach(pattern => assert.match(app, pattern));
});

test('room utilization includes room capacity fit flags', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');

  assert.match(index, /Room Capacity Fit Flags/);
  assert.match(index, /Room Capacity/);
  assert.match(index, /Section Capacity/);
  assert.match(index, /Census\/Current Enrollment/);
  assert.match(index, /Fit Ratio/);
  assert.match(app, /calculateRoomFitFlags/);
  assert.match(app, /Underutilized Room/);
  assert.match(app, /Over Capacity Risk/);
  assert.match(app, /Enrollment Exceeds Room Capacity/);
  assert.match(app, /room-capacity-fit-flags\.csv/);
  assert.match(css, /\.room-fit-table/);
});

test('room utilization uses component scoring instead of fixed prime bump', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');
  const enrollment = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const consolidation = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment/consolidation.js'), 'utf8');

  assert.match(index, /js\/core\/csv-normalizer\.js/);
  assert.match(index, /js\/core\/section-model\.js/);
  assert.match(app, /function getCanonicalSection/);
  assert.match(app, /canonicalSection/);
  assert.match(enrollment, /sectionModel\?\.normalizeSection/);
  assert.match(consolidation, /sectionModel\.sectionIdentity/);
  assert.match(index, /component model instead of a fixed prime-time multiplier/);
  assert.match(index, /Overall Room Utilization Score = Overall Utilization 40% \+ Prime-Time Utilization 25% \+ Distribution Score 20% \+ Fragmentation Score 15%/);
  assert.match(index, /Opportunity Score/);
  assert.match(index, /utilization-sort-select/);
  assert.match(index, /utilization-building-select/);
  assert.match(index, /utilization-min-capacity/);
  assert.match(index, /utilization-max-capacity/);
  assert.match(index, /utilization-min-overall/);
  assert.match(index, /utilization-min-prime/);
  assert.match(index, /utilization-min-opportunity/);
  assert.match(index, /utilization-min-distribution/);
  assert.match(index, /utilization-min-fragmentation/);
  assert.doesNotMatch(index, /receive an extra 0\.5x bump/);
  assert.match(app, /utilizationConfig/);
  assert.match(app, /weights:\s*{\s*overall: 0\.4,\s*prime: 0\.25,\s*distribution: 0\.2,\s*fragmentation: 0\.15/s);
  assert.match(app, /const score =\s*\(overallUtilization \* utilizationConfig\.weights\.overall\)/s);
  assert.match(app, /roomUtilizationRecommendation/);
  assert.match(app, /Prime-time demand exists, but room is underutilized outside peak periods/);
  assert.match(app, /Usage is concentrated; review for schedule balancing/);
  assert.match(app, /Fragmented usage; review for cleaner scheduling blocks/);
  assert.match(app, /Available for additional scheduling/);
  assert.match(app, /longestEmptyPrimeBlockHours/);
  assert.match(app, /utilizationBuildingSelect/);
  assert.match(app, /minOpportunity/);
  assert.match(app, /activeTimeBlocks/);
  assert.match(app, /selectedUtilizationStatus/);
  assert.match(app, /dataset\.utilizationStatus/);
  assert.match(app, /utilization-pill-filter/);
  assert.match(app, /room\.status\.label === selectedUtilizationStatus/);
  assert.doesNotMatch(app, /peakCreditMinutes \* 1\.5/);
});

test('heatmap exposes optional metric modes and summary cards', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'css/style.css'), 'utf8');

  assert.match(index, /heatmap-metric-select/);
  assert.match(index, /Enrollment-weighted/);
  assert.match(index, /Seat capacity/);
  assert.match(index, /Fill-rate/);
  assert.match(index, /heatmap-prime-only/);
  assert.match(index, /heatmap-underutilized-only/);
  assert.match(index, /heatmap-summary-cards/);
  assert.match(index, /distinct CRNs/);
  assert.match(index, /00:00-00:59 placeholder/);
  assert.match(app, /heatmapMetricMode/);
  assert.match(app, /renderHeatmapSummaryCards/);
  assert.match(app, /isPrimeHeatmapSlot/);
  assert.match(app, /isUnderutilizedHeatmapRow/);
  assert.match(app, /rowEnrollment/);
  assert.match(app, /rowCapacity/);
  assert.match(app, /title: 'CRN\(s\)'/);
  assert.match(app, /function dedupeHeatmapRows/);
  assert.match(app, /function heatmapCrnKey/);
  assert.match(app, /function isOnlineTbaHeatmapRow/);
  assert.match(app, /cells\[d\]\[startIndex\]\.crns\.has\(bucketKey\)/);
  assert.match(css, /\.analysis-summary-cards/);
});

test('standard analytics expose tutoring open lab exclusion controls and diagnostics', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const analytics = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');

  ['MATH 400', 'ENGL 400', 'LA 425'].forEach(course => {
    assert.match(analytics, new RegExp(course));
    assert.match(app, new RegExp(course));
  });
  [
    /\$\{prefix\}ExcludeTutoringOpenLab/,
    /roomFitExcludeTutoringOpenLab/,
    /Tutoring\/Open Lab Rows Excluded/,
    /Negative Census 2 values were detected and treated as invalid/
  ].forEach(pattern => assert.match(analytics, pattern));
  [
    /heatmap-exclude-tutoring-openlab/,
    /linechart-exclude-tutoring-openlab/,
    /modality-exclude-tutoring-openlab/,
    /utilization-exclude-tutoring-openlab/
  ].forEach(pattern => assert.match(index, pattern));
  [
    /function isTutoringOpenLabSection/,
    /roomFitExcludeTutoringOpenLab/,
    /Tutoring\/Open Lab Rows Excluded/
  ].forEach(pattern => assert.match(app, pattern));
});

test('duration graph uses nice y-axis tick steps', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

  assert.match(index, /linechart-metric-select/);
  assert.match(index, /<option value="count" selected>Course Count<\/option>/);
  assert.match(index, /<option value="presence">Student Presence<\/option>/);
  assert.match(app, /buildHalfHourPresenceSeries\(filtered, hours/);
  assert.match(app, /metric: isPresenceMetric \? 'presence' : 'count'/);
  assert.match(app, /Estimated Students Present/);
  assert.match(app, /niceTickStep/);
  assert.match(app, /\[2, 5, 10, 20, 25, 50/);
});

test('student presence graph uses course duration line chart pattern inside presence analytics', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'js/enrollment-analytics.js'), 'utf8');

  assert.match(text, /Student Presence Graph/);
  assert.match(text, /studentPresenceLineChart/);
  assert.match(text, /buildHalfHourPresenceSeries/);
  assert.match(text, /Estimated Students Present/);
  assert.match(text, /legend: \{ position: 'bottom' \}/);
  assert.match(text, /Time of Day/);
  assert.match(text, /Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday/);
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
    'js/core/dom-utils.js',
    'js/core/csv-normalizer.js',
    'js/core/faculty-utils.js',
    'js/core/faculty-model.js',
    'js/core/faculty-parser.js',
    'js/core/section-model.js',
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
