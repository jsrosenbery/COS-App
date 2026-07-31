const assert = require('node:assert/strict');
const test = require('node:test');

globalThis.COSTermUtils = require('../js/core/term-utils.js');
globalThis.COSScheduleBuilder = require('../js/core/schedule-builder.js');
globalThis.COSProgramRequirements = require('../js/core/program-requirements.js');
globalThis.COSFeasibilityTermWindow = require('../js/core/feasibility-term-window.js');
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

test('program requirements validate all, alternatives, electives, and prerequisites', () => {
  const program = COSProgramRequirements.templatePrograms[0];
  const result = COSProgramRequirements.validateProgram(program);

  assert.equal(result.valid, true);
  assert.equal(result.program.requirementGroups.some(group => group.rule === 'choose-units'), true);
  assert.equal(result.program.requirementGroups.flatMap(group => group.courses).some(course => course.prerequisiteCourseKeys.length), true);
});

test('program repository persists records without localStorage', async () => {
  const repo = COSProgramRequirements.createMemoryRepository();
  await repo.savePrograms(COSProgramRequirements.templatePrograms);
  const programs = await repo.getPrograms();
  const loaded = await repo.getProgram('BUS-AS-TEMPLATE', '2026-2027');

  assert.equal(programs.length, 2);
  assert.equal(loaded.programName, 'Business Administration AS Template');
});

test('term window derives selected Fall, Spring, and Summer windows', () => {
  const fall = COSFeasibilityTermWindow.determineFeasibilityTermWindow('FALL 2026', ['SPRING 2025', 'SUMMER 2025', 'FALL 2025', 'SPRING 2026', 'SUMMER 2026', 'FALL 2026']);
  const spring = COSFeasibilityTermWindow.determineFeasibilityTermWindow('SPRING 2027', ['FALL 2025', 'SPRING 2026', 'SUMMER 2026', 'FALL 2026', 'SPRING 2027']);
  const summer = COSFeasibilityTermWindow.determineFeasibilityTermWindow('SUMMER 2027', ['FALL 2025', 'SPRING 2026', 'SUMMER 2026', 'FALL 2026', 'SPRING 2027', 'SUMMER 2027']);

  assert.deepEqual(fall.fullTerms, ['SPRING 2025', 'SUMMER 2025', 'FALL 2025', 'SPRING 2026', 'SUMMER 2026', 'FALL 2026']);
  assert.deepEqual(spring.standardTerms, ['FALL 2025', 'SPRING 2026', 'FALL 2026', 'SPRING 2027']);
  assert.deepEqual(summer.fullTerms, ['FALL 2025', 'SPRING 2026', 'SUMMER 2026', 'FALL 2026', 'SPRING 2027', 'SUMMER 2027']);
});

test('feasibility engine reports coverage, pathways, conflict-free configurations, and meaningful patterns', () => {
  const program = COSProgramRequirements.normalizeProgram({
    programId: 'TEST-AS',
    catalogYear: '2026-2027',
    programName: 'Test AS',
    awardType: 'AS',
    source: { sourceType: 'manual' },
    reviewStatus: 'approved',
    requirementGroups: [
      { groupId: 'core', label: 'Core', rule: 'all', courses: [
        { courseKey: 'BUS 001', units: 3 },
        { courseKey: 'MATH 010', units: 3 },
        { courseKey: 'ACCT 001', units: 4, prerequisiteCourseKeys: ['MATH 010'] }
      ] },
      { groupId: 'choice', label: 'Choice', rule: 'choose-count', chooseCount: 1, courses: [
        { courseKey: 'ECON 001', units: 3 },
        { courseKey: 'ECON 002', units: 3 }
      ] }
    ]
  });
  const rows = [
    section({ term: 'SPRING 2026', crn: '10001', subject: 'BUS', course: '001', start: '09:00', end: '10:00' }),
    section({ term: 'SPRING 2026', crn: '10002', subject: 'MATH', course: '010', start: '10:30', end: '11:30' }),
    section({ term: 'FALL 2026', crn: '10003', subject: 'ACCT', course: '001', start: '12:00', end: '13:00', units: 4 }),
    section({ term: 'FALL 2026', crn: '10004', subject: 'ECON', course: '001', start: '13:30', end: '14:30' }),
    section({ term: 'FALL 2026', crn: '10005', subject: 'ECON', course: '002', start: '13:30', end: '14:30' })
  ];

  const result = feasibility.evaluateProgramFeasibility(program, rows, { selectedTerm: 'FALL 2026' });

  assert.equal(result.availability.coveragePct, 1);
  assert.ok(result.pathwayResult.count >= 1);
  assert.ok(result.configurationCounts.rawCrnConfigurationCount >= 1);
  assert.ok(result.configurationCounts.meaningfulPatternCount >= 1);
  assert.equal(result.configurationCounts.exact, true);
});

test('feasibility engine reports missing required courses as blockers', () => {
  const program = COSProgramRequirements.normalizeProgram({
    programId: 'MISSING-AS',
    catalogYear: '2026-2027',
    programName: 'Missing AS',
    awardType: 'AS',
    source: { sourceType: 'manual' },
    reviewStatus: 'approved',
    requirementGroups: [{ groupId: 'core', label: 'Core', rule: 'all', courses: [{ courseKey: 'BUS 127', units: 3 }] }]
  });

  const result = feasibility.evaluateProgramFeasibility(program, [section({ subject: 'BUS', course: '001' })], { selectedTerm: 'FALL 2026' });

  assert.equal(result.pathwayResult.count, 0);
  assert.match(result.blockers.map(blocker => blocker.issue).join(' '), /BUS 127/);
});
