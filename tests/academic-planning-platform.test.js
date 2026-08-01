const assert = require('node:assert/strict');
const test = require('node:test');

globalThis.COSTermUtils = require('../js/core/term-utils.js');
globalThis.COSCampusClassification = require('../js/core/campus-classification.js');
globalThis.COSScheduleBuilder = require('../js/core/schedule-builder.js');
globalThis.COSProgramRequirements = require('../js/core/program-requirements.js');
globalThis.COSCatalogExtraction = require('../js/core/catalog-extraction.js');
globalThis.COSFeasibilityTermWindow = require('../js/core/feasibility-term-window.js');
globalThis.COSProgramFeasibility = require('../js/core/program-feasibility.js');

const platform = require('../js/core/academic-planning-platform.js');
const feasibility = require('../js/core/program-feasibility.js');

function section(overrides = {}) {
  return {
    term: overrides.term || 'FALL 2026',
    crn: overrides.crn || '10001',
    subject: overrides.subject || 'BUS',
    course: overrides.course || '001',
    units: overrides.units ?? 3,
    campus: overrides.campus || 'COS',
    modality: overrides.modality || 'In-Person',
    days: overrides.days || 'MO',
    start: overrides.start || '09:00',
    end: overrides.end || '10:00',
    cap: overrides.cap ?? 30,
    actual: overrides.actual ?? 20,
    ...overrides
  };
}

function program(overrides = {}) {
  return COSProgramRequirements.normalizeProgram({
    programId: overrides.programId || 'TEST-AS',
    catalogYear: overrides.catalogYear || '2026-2027',
    programName: overrides.programName || 'Test AS',
    awardType: overrides.awardType || 'AS',
    reviewStatus: overrides.reviewStatus || 'published',
    revisionId: overrides.revisionId || 'rev-1',
    isActiveRevision: overrides.isActiveRevision !== false,
    totalUnitsRequired: overrides.totalUnitsRequired ?? 6,
    requirementGroups: overrides.requirementGroups || [{
      groupId: 'core',
      label: 'Core',
      rule: 'all',
      courses: [
        { courseKey: 'BUS 001', units: 3 },
        { courseKey: 'MATH 010', units: 3 }
      ]
    }]
  });
}

test('Academic Planning Platform exposes shared engine APIs', () => {
  ['evaluateProgram', 'evaluatePortfolio', 'buildStudentSchedule', 'simulateScheduleChange', 'evaluateCampusScenario'].forEach(name => {
    assert.equal(typeof platform[name], 'function');
  });
  assert.deepEqual(platform.REVIEW_WORKFLOW, ['draft', 'needs-review', 'approved', 'published', 'archived']);
});

test('Schedule Builder still functions through the shared platform', () => {
  const rows = [
    section({ crn: '10001', subject: 'BUS', course: '001', start: '09:00', end: '10:00' }),
    section({ crn: '10002', subject: 'MATH', course: '010', start: '10:30', end: '11:30' })
  ];
  const requests = [{ course: 'BUS 001' }, { course: 'MATH 010' }];
  const direct = COSScheduleBuilder.buildScheduleOptions(rows, requests, { requireAllRequestedCourses: true });
  const viaPlatform = platform.buildStudentSchedule(rows, requests, { requireAllRequestedCourses: true });

  assert.equal(viaPlatform.schedules.length, direct.schedules.length);
  assert.equal(viaPlatform.schedules[0].sections.length, 2);
  assert.equal(viaPlatform.planningEngine, 'academic-planning-platform');
});

test('Program Schedule Viability core result remains identical through the platform facade', () => {
  const rows = [
    section({ crn: '10001', subject: 'BUS', course: '001', start: '09:00', end: '10:00' }),
    section({ crn: '10002', subject: 'MATH', course: '010', start: '10:30', end: '11:30' })
  ];
  const targetProgram = program({ reviewStatus: 'approved' });
  const options = { selectedTerm: 'FALL 2026' };
  const direct = feasibility.evaluateProgramFeasibility(targetProgram, rows, options);
  const viaPlatform = platform.evaluateProgram(targetProgram, rows, options);

  assert.equal(viaPlatform.overallFeasibility, direct.overallFeasibility);
  assert.equal(viaPlatform.configurationCounts.rawCrnConfigurationCount, direct.configurationCounts.rawCrnConfigurationCount);
  assert.equal(viaPlatform.pathwayResult.count, direct.pathwayResult.count);
  assert.equal(viaPlatform.planningEngine, 'academic-planning-platform');
});

test('Published programs only participate in default portfolio analysis', () => {
  const rows = [
    section({ crn: '10001', subject: 'BUS', course: '001' }),
    section({ crn: '10002', subject: 'MATH', course: '010', start: '10:30', end: '11:30' })
  ];
  const programs = [
    program({ programId: 'DRAFT', programName: 'Draft', reviewStatus: 'draft' }),
    program({ programId: 'APPROVED', programName: 'Approved', reviewStatus: 'approved' }),
    program({ programId: 'PUBLISHED', programName: 'Published', reviewStatus: 'published' })
  ];

  const publishedOnly = platform.evaluatePortfolio(programs, rows, { selectedTerm: 'FALL 2026' });
  const legacyCompatible = platform.evaluatePortfolio(programs, rows, { selectedTerm: 'FALL 2026', includeLegacyApproved: true });

  assert.equal(publishedOnly.programsEvaluated, 1);
  assert.equal(legacyCompatible.programsEvaluated, 2);
});

test('Catalog revisions preserve history and review workflow transitions', () => {
  const original = program({ revisionId: 'rev-original', reviewStatus: 'draft' });
  const revised = platform.createCatalogRevision(original, { programName: 'Revised Program' }, { user: 'admin' });
  const published = platform.transitionCatalogReview(revised, 'published', { user: 'reviewer' });

  assert.equal(original.programName, 'Test AS');
  assert.equal(revised.previousRevisionId, 'rev-original');
  assert.notEqual(revised.revisionId, original.revisionId);
  assert.equal(published.reviewStatus, 'published');
  assert.ok(published.reviewHistory.length >= 2);
});

test('Recommendation simulation is deterministic and non-mutating', () => {
  const targetProgram = program();
  const rows = [section({ crn: '10001', subject: 'BUS', course: '001' })];
  const change = {
    action: 'add-section',
    section: section({ crn: 'SIM-1', subject: 'MATH', course: '010', start: '10:30', end: '11:30' })
  };
  const first = platform.simulateScheduleChange([targetProgram], rows, change, { selectedTerm: 'FALL 2026' });
  const second = platform.simulateScheduleChange([targetProgram], rows, change, { selectedTerm: 'FALL 2026' });

  assert.equal(first.deterministicFingerprint, second.deterministicFingerprint);
  assert.equal(rows.length, 1);
  assert.equal(first.sourceRowsMutated, false);
});

test('Fingerprint cache objects invalidate when catalog revisions schedules or settings change', () => {
  const baseProgram = program({ revisionId: 'rev-a' });
  const rows = [section({ crn: '10001', subject: 'BUS', course: '001' })];
  const base = platform.planningCacheKey({ program: baseProgram, rows, options: { selectedTerm: 'FALL 2026' } });
  const changedRevision = platform.planningCacheKey({ program: program({ revisionId: 'rev-b' }), rows, options: { selectedTerm: 'FALL 2026' } });
  const changedSchedule = platform.planningCacheKey({ program: baseProgram, rows: [...rows, section({ crn: '10002', subject: 'MATH', course: '010' })], options: { selectedTerm: 'FALL 2026' } });
  const changedSettings = platform.planningCacheKey({ program: baseProgram, rows, options: { selectedTerm: 'FALL 2026', windowType: 'standard' } });

  assert.notEqual(base.key, changedRevision.key);
  assert.notEqual(base.key, changedSchedule.key);
  assert.notEqual(base.key, changedSettings.key);
  assert.ok(base.catalogRevisionFingerprint);
  assert.ok(base.scheduleFingerprint);
});

test('Validation diagnostics and independent confidence buckets are available', () => {
  const result = platform.evaluateProgram(program(), [
    section({ crn: '10001', subject: 'BUS', course: '001' }),
    section({ crn: '10002', subject: 'MATH', course: '010', start: '10:30', end: '11:30' })
  ], { selectedTerm: 'FALL 2026' });
  const diagnostics = platform.validationDiagnostics({
    programs: [program()],
    catalogRequirementDetails: [{
      warnings: ['Ambiguous requirement group'],
      courseReconciliation: [{ status: 'not-found', courseKey: 'ART 001' }]
    }],
    revisions: [{ programId: 'OLD', catalogYear: '2026-2027', revisionId: 'stale' }]
  });

  assert.deepEqual(Object.keys(result.planningConfidence), ['extraction', 'reconciliation', 'scheduling', 'portfolio', 'recommendation']);
  assert.equal(diagnostics.ambiguousRequirements.length, 1);
  assert.equal(diagnostics.unmatchedCourses.length, 1);
  assert.equal(diagnostics.staleCatalogRevisions.length, 1);
});
