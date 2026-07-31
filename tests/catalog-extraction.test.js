const assert = require('node:assert/strict');
const test = require('node:test');

globalThis.COSTermUtils = require('../js/core/term-utils.js');
globalThis.COSCampusClassification = require('../js/core/campus-classification.js');
globalThis.COSScheduleBuilder = require('../js/core/schedule-builder.js');
globalThis.COSProgramRequirements = require('../js/core/program-requirements.js');
globalThis.COSFeasibilityTermWindow = require('../js/core/feasibility-term-window.js');
const catalog = require('../js/core/catalog-extraction.js');
const feasibility = require('../js/core/program-feasibility.js');

function page(pageNumber, text) {
  return catalog.pageTextRecord(pageNumber, text);
}

function section(overrides = {}) {
  return {
    term: overrides.term || 'FALL 2026',
    crn: overrides.crn || '10001',
    subject: overrides.subject || 'BUS',
    course: overrides.course || '20',
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

const pilotPages = [
  page(10, `
Business
Business Administration for Transfer 2.0 AS-T
Business AS
Business Certificate of Achievement
Business Office Skill Certificate
Business Administration for Transfer 2.0 AS-T
  `),
  page(11, `
Business Administration for Transfer 2.0 AS-T
Program: 27 units
Required Core
BUS 20 Business Law 3 units
ECON 1 Principles of Economics 3 units
Choose one
MATH 21 Statistics 4 units
MATH 22 Calculus 4 units
Select 3 units from the following
ACCT 1 Financial Accounting 3 units
ACCT 2 Managerial Accounting 3 units *
  `),
  page(12, `
Business AS
Program total 18 units
Required Core
BUS 20 Business Law 3 units
ECON 1 Principles of Economics 3 units
BUS 18 or BUS 19 3 units
  `),
  page(13, `
Business Certificate of Achievement
Program total 12 units
Required Core
BUS 20 Business Law 3 units
ACCT 1 Financial Accounting 3 units
  `),
  page(14, `
Business Office Skill Certificate
Program total 9 units
Required Core
BUS 20 Business Law 3 units
ACCT 1 Financial Accounting 3 units
  `)
];

test('catalog inventory detects pilot awards, dedupes headings, and retains page evidence', () => {
  const source = catalog.normalizeCatalogSource({ catalogYear: '2026-2027', filename: 'COS Catalog.pdf', pageCount: 400 });
  const candidates = catalog.extractProgramInventory(pilotPages, source);
  const pilots = catalog.selectPilotCandidates(candidates);

  assert.equal(candidates.filter(candidate => candidate.programName === 'Business Administration for Transfer 2.0').length, 1);
  assert.equal(pilots.length, 4);
  assert.ok(pilots.some(candidate => candidate.awardType === 'AS-T'));
  assert.ok(pilots.some(candidate => candidate.awardType === 'AS'));
  assert.ok(pilots.some(candidate => candidate.awardType === 'Certificate of Achievement'));
  assert.ok(pilots.some(candidate => candidate.awardType === 'Skill Certificate'));
  assert.ok(pilots.every(candidate => candidate.sourceEvidence?.[0]?.pageNumber));
});

test('catalog requirement parser separates all-required, choose-one, choose-units, and review warnings', () => {
  const candidate = catalog.extractProgramInventory(pilotPages, { catalogYear: '2026-2027' })
    .find(item => item.programName === 'Business Administration for Transfer 2.0');
  const detail = catalog.parseRequirementDetail(candidate, pilotPages, { filename: 'COS Catalog.pdf' });
  const groups = detail.program.requirementGroups;

  assert.ok(groups.some(group => group.rule === 'all'));
  assert.ok(groups.some(group => group.rule === 'or'));
  assert.ok(groups.some(group => group.rule === 'choose-units' && group.unitsRequired === 3));
  assert.ok(detail.warnings.some(warning => /Footnote marker/.test(warning)));
  assert.ok(detail.requirementEvidence.every(evidence => Number.isFinite(evidence.pageNumber)));
  assert.ok(groups.flatMap(group => group.courses).some(course => course.sourceEvidence?.length));
});

test('catalog parser flags ambiguous OR language and missing units for review', () => {
  const candidate = {
    candidateId: 'candidate-warning',
    catalogYear: '2026-2027',
    programName: 'Warning Certificate',
    awardType: 'Certificate',
    likelyStartPage: 20,
    likelyEndPage: 20
  };
  const detail = catalog.parseRequirementDetail(candidate, [page(20, `
Warning Certificate
Program total 6 units
Required Core
BUS 20 or BUS 21
MATH 21 Statistics
  `)]);

  assert.ok(detail.warnings.some(warning => /Ambiguous OR/.test(warning)));
  assert.ok(detail.warnings.some(warning => /Missing unit value/.test(warning)));
  assert.equal(catalog.validateExtractionCandidate(candidate, detail).valid, false);
});

test('course-key reconciliation handles zero padding, CCN keys, ambiguous matches, and unmatched courses', () => {
  const rows = [
    section({ crn: '1', subject: 'BUS', course: '020' }),
    section({ crn: '2', subject: 'BUS', course: '20' }),
    section({ crn: '3', subject: 'STAT', course: 'C1000' })
  ];
  const reconciled = catalog.reconcileCourseKeys(['BUS 20', 'STAT C1000', 'NOPE 1'], rows, ['STAT C1000 Introduction to Statistics']);

  assert.equal(reconciled.find(item => item.extractedCourseKey === 'BUS 20').status, 'ambiguous');
  assert.equal(reconciled.find(item => item.extractedCourseKey === 'STAT C1000').status, 'matched');
  assert.equal(reconciled.find(item => item.extractedCourseKey === 'NOPE 1').status, 'not-found');
});

test('prerequisite extraction keeps prerequisites, corequisites, and recommended preparation separate', () => {
  const rows = catalog.extractPrerequisites([page(30, 'BUS 20 Business Law. Prerequisite: BUS 10. Corequisite: ACCT 1. Recommended Preparation: ENGL 1.')]);

  assert.deepEqual(rows[0].prerequisiteCourseKeys, ['BUS 10']);
  assert.deepEqual(rows[0].corequisiteCourseKeys, ['ACCT 1']);
  assert.deepEqual(rows[0].recommendedPreparationCourseKeys, ['ENGL 1']);
});

test('catalog review workflow keeps extracted records out of feasibility until approved', async () => {
  const repo = COSProgramRequirements.createMemoryRepository();
  const candidate = catalog.extractProgramInventory(pilotPages, { catalogYear: '2026-2027' })
    .find(item => item.programName === 'Business' && item.awardType === 'Certificate of Achievement');
  const detail = catalog.parseRequirementDetail(candidate, pilotPages, { filename: 'COS Catalog.pdf' });

  await repo.saveCatalogRequirementDetail(detail);
  assert.equal((await repo.getPrograms()).length, 0);

  const approved = catalog.approveExtractedProgram(detail, 'Reviewer');
  await repo.savePrograms([approved.program]);
  await repo.saveCatalogReviewDecision(approved.reviewDecision);

  const programs = await repo.getPrograms();
  assert.equal(programs.length, 1);
  assert.equal(programs[0].reviewStatus, 'approved');
  assert.equal(programs[0].source.sourceType, 'catalog-pdf');
  assert.ok(programs[0].requirementGroups.flatMap(group => group.courses).some(course => course.sourceEvidence?.length));
  assert.equal((await repo.getCatalogReviewDecisions()).length, 1);
});

test('approved catalog pilot records can run through program feasibility', () => {
  const candidate = catalog.extractProgramInventory(pilotPages, { catalogYear: '2026-2027' })
    .find(item => item.programName === 'Business' && item.awardType === 'Certificate of Achievement');
  const detail = catalog.parseRequirementDetail(candidate, pilotPages, { filename: 'COS Catalog.pdf' });
  const approved = catalog.approveExtractedProgram(detail, 'Reviewer').program;
  const rows = [
    section({ subject: 'BUS', course: '20' }),
    section({ crn: '10002', subject: 'ACCT', course: '1', start: '10:30', end: '11:30' })
  ];
  const result = feasibility.evaluateProgramFeasibility(approved, rows, { selectedTerm: 'FALL 2026' });

  assert.equal(result.availability.coveragePct, 1);
  assert.ok(result.configurationCounts.rawCrnConfigurationCount > 0);
  assert.equal(result.requirementsSourceConfidence.courseReconciliation, 'Needs review');
});
