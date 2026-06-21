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
  ['js/enrollment/metrics.js', 'js/enrollment/filters.js', 'js/enrollment/consolidation.js'].forEach(file => {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  });
  return context.window;
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
