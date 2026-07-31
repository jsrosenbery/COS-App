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
  const missing = await repo.getProgram('NOPE', '2026-2027');
  const batch = await repo.saveImportBatch({ id: 'batch-1', filename: 'programs.json' });
  await repo.setMetadata('lastImport', { id: batch.id });

  assert.equal(programs.length, 2);
  assert.equal(loaded.programName, 'Business Administration AS Template');
  assert.equal(missing, null);
  assert.equal((await repo.getImportBatches()).length, 1);
  assert.deepEqual(await repo.getMetadata('lastImport'), { id: 'batch-1' });
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

test('term matching canonicalizes display labels and Banner-style operational codes', () => {
  const program = COSProgramRequirements.normalizeProgram({
    programId: 'TERM-AS',
    catalogYear: '2026-2027',
    programName: 'Term AS',
    awardType: 'Certificate',
    totalUnitsRequired: 3,
    source: { sourceType: 'manual' },
    requirementGroups: [{ groupId: 'core', label: 'Core', rule: 'all', courses: [{ courseKey: 'BUS 001', units: 3 }] }]
  });
  const rows = [section({ term: '202710', crn: '20001', subject: 'BUS', course: '001' })];
  const result = feasibility.evaluateProgramFeasibility(program, rows, { selectedTerm: 'Fall 2026' });

  assert.deepEqual(result.termsAnalyzed.slice(-1), ['FALL 2026']);
  assert.equal(result.availability.courseRows[0].termsOffered[0], 'FALL 2026');
  assert.equal(result.configurationCounts.rawCrnConfigurationCount, 1);
});

test('schedule builder counting mode separates viable count from retained examples', () => {
  const rows = [
    section({ crn: 'A1', subject: 'BUS', course: '001', start: '09:00', end: '10:00' }),
    section({ crn: 'A2', subject: 'BUS', course: '001', start: '10:30', end: '11:30' }),
    section({ crn: 'B1', subject: 'MATH', course: '010', start: '12:00', end: '13:00' }),
    section({ crn: 'B2', subject: 'MATH', course: '010', start: '13:00', end: '14:00' })
  ];
  const result = COSScheduleBuilder.buildScheduleOptions(rows, [{ course: 'BUS 001' }, { course: 'MATH 010' }], { countMode: true, maxResults: 1, requireAllRequestedCourses: true });

  assert.equal(result.schedules.length, 1);
  assert.equal(result.count.viableConfigurationCount, 4);
  assert.equal(result.count.exact, true);
});

test('schedule builder counting mode reports one pruned conflict from exact two-by-two case', () => {
  const rows = [
    section({ crn: 'A1', subject: 'BUS', course: '001', start: '09:00', end: '10:00' }),
    section({ crn: 'A2', subject: 'BUS', course: '001', start: '10:30', end: '11:30' }),
    section({ crn: 'B1', subject: 'MATH', course: '010', start: '09:30', end: '10:30' }),
    section({ crn: 'B2', subject: 'MATH', course: '010', start: '12:00', end: '13:00' })
  ];
  const result = COSScheduleBuilder.buildScheduleOptions(rows, [{ course: 'BUS 001' }, { course: 'MATH 010' }], { countMode: true, maxResults: 10, requireAllRequestedCourses: true });

  assert.equal(result.count.viableConfigurationCount, 3);
  assert.equal(result.count.combinationsPruned, 1);
});

test('schedule builder reports 100 plus viable combinations while retaining only 10 examples', () => {
  const rows = [];
  for (let i = 0; i < 11; i += 1) rows.push(section({ crn: `A${i}`, subject: 'BUS', course: '001', start: '08:00', end: '09:00' }));
  for (let i = 0; i < 10; i += 1) rows.push(section({ crn: `B${i}`, subject: 'MATH', course: '010', start: '10:00', end: '11:00' }));
  const result = COSScheduleBuilder.buildScheduleOptions(rows, [{ course: 'BUS 001' }, { course: 'MATH 010' }], { countMode: true, maxResults: 10, requireAllRequestedCourses: true });

  assert.equal(result.schedules.length, 10);
  assert.equal(result.count.viableConfigurationCount, 110);
  assert.equal(result.count.capReached, false);
});

test('program feasibility counts equivalent CRNs as fewer meaningful weekly patterns', () => {
  const program = COSProgramRequirements.normalizeProgram({
    programId: 'PATTERN-CERT',
    catalogYear: '2026-2027',
    programName: 'Pattern Certificate',
    awardType: 'Certificate',
    totalUnitsRequired: 3,
    source: { sourceType: 'manual' },
    requirementGroups: [{ groupId: 'core', label: 'Core', rule: 'all', courses: [{ courseKey: 'BUS 001', units: 3 }] }]
  });
  const rows = [
    section({ crn: '30001', subject: 'BUS', course: '001', start: '09:00', end: '10:00' }),
    section({ crn: '30002', subject: 'BUS', course: '001', start: '09:00', end: '10:00' })
  ];
  const result = feasibility.evaluateProgramFeasibility(program, rows, { selectedTerm: 'FALL 2026' });

  assert.equal(result.configurationCounts.rawCrnConfigurationCount, 2);
  assert.equal(result.configurationCounts.meaningfulPatternCount, 1);
});

test('unavailable alternative does not block a choose-one requirement group', () => {
  const program = COSProgramRequirements.normalizeProgram({
    programId: 'ALT-CERT',
    catalogYear: '2026-2027',
    programName: 'Alternative Certificate',
    awardType: 'Certificate',
    totalUnitsRequired: 3,
    source: { sourceType: 'manual' },
    requirementGroups: [{ groupId: 'choice', label: 'Choice', rule: 'or', courses: [{ courseKey: 'BUS 001', units: 3 }, { courseKey: 'BUS 127', units: 3 }] }]
  });
  const result = feasibility.evaluateProgramFeasibility(program, [section({ subject: 'BUS', course: '001' })], { selectedTerm: 'FALL 2026' });

  assert.equal(result.pathwayResult.count, 1);
  assert.equal(result.blockers.some(blocker => /BUS 127/.test(blocker.issue)), false);
});

test('prerequisite offered only in same term as dependent course is infeasible', () => {
  const program = COSProgramRequirements.normalizeProgram({
    programId: 'SEQ-CERT',
    catalogYear: '2026-2027',
    programName: 'Sequence Certificate',
    awardType: 'Certificate',
    totalUnitsRequired: 6,
    source: { sourceType: 'manual' },
    requirementGroups: [{ groupId: 'core', label: 'Core', rule: 'all', courses: [
      { courseKey: 'MATH 010', units: 3 },
      { courseKey: 'ACCT 001', units: 3, prerequisiteCourseKeys: ['MATH 010'] }
    ] }]
  });
  const rows = [
    section({ term: 'FALL 2026', crn: '40001', subject: 'MATH', course: '010' }),
    section({ term: 'FALL 2026', crn: '40002', subject: 'ACCT', course: '001' })
  ];
  const result = feasibility.evaluateProgramFeasibility(program, rows, { selectedTerm: 'FALL 2026' });

  assert.equal(result.pathwayResult.count, 0);
  assert.match(result.blockers.map(blocker => blocker.issue).join(' '), /chronological|valid term|ACCT 001/i);
});

test('circular prerequisites are reported separately', () => {
  const program = COSProgramRequirements.normalizeProgram({
    programId: 'CYCLE-CERT',
    catalogYear: '2026-2027',
    programName: 'Cycle Certificate',
    awardType: 'Certificate',
    totalUnitsRequired: 6,
    source: { sourceType: 'manual' },
    requirementGroups: [{ groupId: 'core', label: 'Core', rule: 'all', courses: [
      { courseKey: 'BUS 001', units: 3, prerequisiteCourseKeys: ['BUS 002'] },
      { courseKey: 'BUS 002', units: 3, prerequisiteCourseKeys: ['BUS 001'] }
    ] }]
  });
  const rows = [
    section({ term: 'SPRING 2026', crn: '50001', subject: 'BUS', course: '001' }),
    section({ term: 'FALL 2026', crn: '50002', subject: 'BUS', course: '002' })
  ];
  const result = feasibility.evaluateProgramFeasibility(program, rows, { selectedTerm: 'FALL 2026' });

  assert.match(result.blockers.map(blocker => blocker.issue).join(' '), /Circular prerequisite/);
});

test('18-unit certificate is not automatically penalized for sub-12-unit terms', () => {
  const program = COSProgramRequirements.templatePrograms.find(item => item.programId === 'IT-CERT-TEMPLATE');
  const rows = ['COMP 001', 'COMP 005', 'COMP 020', 'COMP 040', 'COMP 050'].map((courseKey, index) => {
    const [subject, course] = courseKey.split(' ');
    return section({ term: index < 2 ? 'SPRING 2026' : 'FALL 2026', crn: `6000${index}`, subject, course, start: `${9 + index}:00`, end: `${10 + index}:00` });
  });
  const result = feasibility.evaluateProgramFeasibility(program, rows, { selectedTerm: 'FALL 2026' });

  assert.equal(result.pathwayResult.pathways.every(pathway => pathway.loadStatus === 'Within configured load limits'), true);
});

test('60-unit degree with only 24 modeled units is labeled partial scope', () => {
  const program = COSProgramRequirements.normalizeProgram({
    programId: 'PARTIAL-AS',
    catalogYear: '2026-2027',
    programName: 'Partial AS',
    awardType: 'AS',
    totalUnitsRequired: 60,
    source: { sourceType: 'manual' },
    requirementGroups: [{ groupId: 'core', label: 'Core', rule: 'all', courses: Array.from({ length: 8 }, (_, index) => ({ courseKey: `BUS ${String(index + 1).padStart(3, '0')}`, units: 3 })) }]
  });
  const rows = Array.from({ length: 8 }, (_, index) => section({ term: index < 4 ? 'SPRING 2026' : 'FALL 2026', crn: `7000${index}`, subject: 'BUS', course: String(index + 1).padStart(3, '0'), start: `${8 + (index % 4)}:00`, end: `${9 + (index % 4)}:00` }));
  const result = feasibility.evaluateProgramFeasibility(program, rows, { selectedTerm: 'FALL 2026' });

  assert.equal(result.analysisScope.structuredUnitsRepresented, 24);
  assert.equal(result.analysisScope.unmodeledUnits, 36);
  assert.equal(result.analysisScope.programOnlyAnalysis, true);
  assert.match(result.overallFeasibility, /Partial Scope/);
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
