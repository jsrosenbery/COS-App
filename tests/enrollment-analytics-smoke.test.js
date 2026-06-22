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
