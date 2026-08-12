const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

globalThis.COSTermUtils = require('../js/core/term-utils.js');
globalThis.COSCampusClassification = require('../js/core/campus-classification.js');
globalThis.COSScheduleBuilder = require('../js/core/schedule-builder.js');
globalThis.COSProgramRequirements = require('../js/core/program-requirements.js');
globalThis.COSFeasibilityTermWindow = require('../js/core/feasibility-term-window.js');
const catalog = require('../js/core/catalog-extraction.js');
const feasibility = require('../js/core/program-feasibility.js');
const pdfjs = require('../vendor/pdfjs/pdf.min.js');

function page(pageNumber, text) {
  return catalog.pageTextRecord(pageNumber, text);
}

function fileFromBuffer(filename, buffer, type = 'application/pdf') {
  return {
    name: filename,
    type,
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  };
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
Associate in Science in Business Administration for Transfer 2.0 (AS-T)
Associate of Science in Business (AS)
Certificate of Achievement in Business
Certificate of Achievement in Business Financial Recordkeeping
Associate in Science in Business Administration for Transfer 2.0 (AS-T)
  `),
  page(11, `
Associate in Science in Business Administration for Transfer 2.0 (AS-T)
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
Associate of Science in Business (AS)
Program total 18 units
Required Core
BUS 20 Business Law 3 units
ECON 1 Principles of Economics 3 units
BUS 18 or BUS 19 3 units
  `),
  page(13, `
Certificate of Achievement in Business
Program total 12 units
Required Core
BUS 20 Business Law 3 units
ACCT 1 Financial Accounting 3 units
MKT 1 Marketing 3 units
MGMT 1 Management 3 units
  `),
  page(14, `
Certificate of Achievement in Business Financial Recordkeeping
Program total 9 units
Required Core
BUS 20 Business Law 3 units
ACCT 1 Financial Accounting 3 units
BUS 180 Business Finance Applications 3 units
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
  assert.ok(pilots.some(candidate => candidate.programName === 'Business' && candidate.awardType === 'Certificate of Achievement'));
  assert.ok(pilots.some(candidate => candidate.programName === 'Business Financial Recordkeeping' && candidate.awardType === 'Certificate of Achievement'));
  assert.ok(pilots.every(candidate => candidate.sourceEvidence?.[0]?.pageNumber));
  assert.ok(pilots.every(candidate => candidate.pageRange?.startPage && candidate.pageRange?.endPage));
});

test('catalog PDF ingestion supports 717-page progress and cancellation without external services', async () => {
  const pages = Array.from({ length: 717 }, (_, index) => page(index + 1, index === 234
    ? 'Associate in Science in Business Administration for Transfer 2.0 (AS-T)\nProgram total 27 units\nBUS 20 3 units'
    : `Catalog page ${index + 1}`));
  const progress = [];
  const result = await catalog.ingestCatalogPdf(null, {
    filename: 'College of the Sequoias 2026-2027 Catalog.pdf',
    catalogYear: '2026-2027',
    pageCount: 717,
    pageTexts: pages,
    chunkSize: 100,
    onProgress: update => progress.push(update)
  });

  assert.equal(result.pageCount, 717);
  assert.equal(result.pagesExtracted, 717);
  assert.equal(result.state, 'Ready for inventory extraction');
  assert.ok(progress.some(update => update.pagesProcessed === 700));

  const controller = new AbortController();
  const cancelled = catalog.ingestCatalogPdf(null, {
    filename: 'College of the Sequoias 2026-2027 Catalog.pdf',
    pageTexts: pages,
    chunkSize: 1,
    signal: controller.signal,
    onProgress: update => {
      if (update.pagesProcessed >= 2) controller.abort();
    }
  });
  await assert.rejects(cancelled, /Catalog extraction cancelled/);
});

test('catalog PDF extraction refuses to begin when browser PDF engine is unavailable', async () => {
  const result = await catalog.ingestCatalogPdf(fileFromBuffer('catalog.pdf', Buffer.from('%PDF-1.4')), {
    catalogYear: '2026-2027',
    pdfjsLib: null
  });

  assert.equal(result.state, 'Extraction failed');
  assert.equal(result.pageCount, 0);
  assert.match(result.warnings.join(' '), /pdfjsLib is not loaded/);
});

test('small PDF fixture produces page-text records through vendored browser PDF.js', async () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'catalog-small.pdf');
  pdfjs.GlobalWorkerOptions.workerSrc = path.join(__dirname, '..', 'vendor', 'pdfjs', 'pdf.worker.min.js');

  const result = await catalog.ingestCatalogPdf(fileFromBuffer('catalog-small.pdf', fs.readFileSync(fixturePath)), {
    catalogYear: '2026-2027',
    pdfjsLib: pdfjs
  });

  assert.equal(result.state, 'Ready for inventory extraction');
  assert.equal(result.pageCount, 1);
  assert.equal(result.pagesExtracted, 1);
  assert.match(result.pageTexts[0].text, /Catalog PDF Fixture BUS 20 3 units/);
});

test('PDF text items retain visual rows for downstream requirement parsing', () => {
  const text = catalog.pdfTextItemsToLines([
    { str: 'Program Award:', transform: [1, 0, 0, 1, 10, 700] },
    { str: 'Certificate of Achievement', transform: [1, 0, 0, 1, 140, 700] },
    { str: 'ACCT 001', transform: [1, 0, 0, 1, 10, 680] },
    { str: 'Financial Accounting', transform: [1, 0, 0, 1, 110, 680] },
    { str: '4', transform: [1, 0, 0, 1, 500, 680] }
  ]);
  assert.equal(text, 'Program Award: Certificate of Achievement\nACCT 001 Financial Accounting 4');
});

test('CurrIQ single-program export becomes a reviewable structured program', () => {
  const pages = [page(1, `
Viewing: Certificate of Achievement in Accounting
Program Award: Certificate of Achievement
Effective Term: Fall 2026
Department: Business
Program Title: Accounting
Program Requirements:
Code Title Units
Required Major Courses (19 units)
ACCT 001 Financial Accounting 4
ACCT 002 Managerial Accounting 4
List A - Select 3 units
BUS 020 Business Law 3
BUS 021 Business Communications 3
List B - Select 9 units
ACCT 105 Payroll Accounting 3
ACCT 110 Tax Accounting 3
ACCT 115 Accounting Applications 3
TOTAL 31
  `)];
  const parsed = catalog.parseCurriculumProgramExport(pages, {
    catalogYear: '2026-2027', filename: 'Certificate of Achievement in Accounting.pdf', catalogTitle: 'CurrIQ Program Export'
  });

  assert.ok(parsed);
  assert.equal(parsed.detail.program.programName, 'Accounting');
  assert.equal(parsed.detail.program.awardType, 'Certificate of Achievement');
  assert.equal(parsed.detail.program.reviewStatus, 'needs-review');
  assert.equal(parsed.detail.program.totalUnitsRequired, 31);
  assert.ok(parsed.detail.program.requirementGroups.some(group => group.rule === 'choose-units' && group.unitsRequired === 3));
  assert.ok(parsed.detail.program.requirementGroups.flatMap(group => group.courses).some(course => course.courseKey === 'ACCT 1'));
});

test('non-CurrIQ catalog text stays on the existing catalog extraction path', () => {
  assert.equal(catalog.parseCurriculumProgramExport(pilotPages, { catalogYear: '2026-2027' }), null);
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

test('catalog validation blocks an empty requirement group after an extracted row is removed', () => {
  const detail = {
    program: COSProgramRequirements.normalizeProgram({
      programId: 'EMPTY-GROUP', catalogYear: '2026-2027', programName: 'Empty Group', awardType: 'Certificate of Achievement',
      totalUnitsRequired: 3,
      requirementGroups: [{ groupId: 'required', label: 'Required Courses', rule: 'all', courses: [], subgroups: [], pageNumber: 1 }],
      source: { sourceType: 'catalog-pdf', filename: 'program.pdf' }, reviewStatus: 'needs-review'
    }),
    pageRange: { boundaryConfidence: 0.9 }, warnings: []
  };
  const validation = catalog.validateExtractionCandidate({ catalogYear: '2026-2027', detailedSourceFound: true }, detail);
  assert.equal(validation.valid, false);
  assert.ok(validation.warnings.some(warning => /Missing courses or nested requirements/.test(warning)));
});

test('catalog validation blocks a newly added course row until its key and units are completed', () => {
  const detail = {
    program: COSProgramRequirements.normalizeProgram({
      programId: 'NEW-ROW', catalogYear: '2026-2027', programName: 'New Row', awardType: 'Certificate of Achievement',
      totalUnitsRequired: 3,
      requirementGroups: [{ groupId: 'required', label: 'Required Courses', rule: 'all', courses: [{ courseKey: '', units: undefined }], pageNumber: 1 }],
      source: { sourceType: 'catalog-pdf', filename: 'program.pdf' }, reviewStatus: 'needs-review'
    }),
    pageRange: { boundaryConfidence: 0.9 }, warnings: []
  };
  detail.program.requirementGroups[0].courses = [{ courseKey: '', units: undefined }];
  const validation = catalog.validateExtractionCandidate({ catalogYear: '2026-2027', detailedSourceFound: true }, detail);
  assert.equal(validation.valid, false);
  assert.ok(validation.warnings.some(warning => /Missing course key/.test(warning)));
  assert.ok(validation.warnings.some(warning => /Missing unit value/.test(warning)));
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

test('approval blocks unresolved parser warnings and records approved revisions', async () => {
  const repo = COSProgramRequirements.createMemoryRepository();
  const warningCandidate = {
    candidateId: 'candidate-warning-approval',
    catalogYear: '2026-2027',
    programName: 'Warning Certificate',
    awardType: 'Certificate of Achievement',
    likelyStartPage: 20,
    likelyEndPage: 20,
    detailedSourceFound: true,
    pageRange: { startPage: 20, endPage: 20, pages: [20], boundaryConfidence: 0.82 }
  };
  const warningDetail = catalog.parseRequirementDetail(warningCandidate, [page(20, `
Certificate of Achievement in Warning Certificate
Program total 6 units
Required Core
BUS 20 or BUS 21
  `)]);
  warningDetail.pageRange = warningCandidate.pageRange;

  assert.throws(() => catalog.approveExtractedProgram(warningDetail, 'Reviewer'), /cannot be approved/);

  const candidate = catalog.extractProgramInventory(pilotPages, { catalogYear: '2026-2027' })
    .find(item => item.programName === 'Business' && item.awardType === 'Certificate of Achievement');
  const detail = catalog.parseRequirementDetail(candidate, pilotPages, { filename: 'COS Catalog.pdf' });
  const approved = catalog.approveExtractedProgram(detail, 'Reviewer');
  await repo.savePrograms([approved.program]);
  await repo.saveProgramRequirementRevision(approved.revision);

  assert.equal((await repo.getProgramRequirementRevisions(approved.program.programId, approved.program.catalogYear)).length, 1);
});

test('approval allows non-blocking single-program review warnings without override', () => {
  const parsed = catalog.parseCurriculumProgramExport([
    page(1, `
Program Award: Certificate of Achievement
Program Title: Accounting
Effective Term: 2026-2027
Department: Business
Program Requirements:
Required Core
ACCT 001 Financial Accounting 4
TOTAL 4
    `)
  ], { catalogYear: '2026-2027', filename: 'accounting-program.pdf', catalogTitle: 'CurrIQ Program Export' });

  assert.ok(parsed.detail.warnings.some(warning => /single-program PDF/i.test(warning)));
  const validation = catalog.validateExtractionCandidate(parsed.candidate, parsed.detail);
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.blockers, []);

  const approved = catalog.approveExtractedProgram(parsed.detail, 'Reviewer');
  assert.equal(approved.program.reviewStatus, 'approved');
  assert.equal(approved.reviewDecision.overrideReason, '');
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

test('catalog repository persists page text revisions and active published pointers', async () => {
  const repo = COSProgramRequirements.createMemoryRepository();
  const source = catalog.normalizeCatalogSource({ catalogYear: '2026-2027', filename: 'COS Catalog.pdf', pageCount: 2 });
  await repo.saveCatalogSource(source);
  await repo.saveCatalogPages(source.catalogSourceId, [page(1, 'Catalog page one'), page(2, 'Catalog page two')]);
  const pages = await repo.getCatalogPages(source.catalogSourceId);
  const candidate = catalog.extractProgramInventory(pilotPages, source)
    .find(item => item.programName === 'Business' && item.awardType === 'Certificate of Achievement');
  const detail = catalog.parseRequirementDetail(candidate, pilotPages, { filename: source.filename });
  const approved = catalog.approveExtractedProgram(detail, 'Reviewer');
  await repo.savePrograms([approved.program]);
  await repo.saveProgramRequirementRevision(approved.revision);
  const revisions = await repo.getProgramRequirementRevisions(approved.program.programId, approved.program.catalogYear);
  const published = await repo.publishProgramRevision(revisions[0].revisionId, { reason: 'Publish test revision.' });
  const pointers = await repo.getProgramActiveRevisionPointers();

  assert.equal(pages.length, 2);
  assert.equal(pages[0].text, 'Catalog page one');
  assert.equal(published.status, 'published');
  assert.equal(published.programSnapshot.reviewStatus, 'published');
  assert.equal(pointers.some(pointer => pointer.activeRevisionId === published.revisionId), true);
});

test('approved catalog pilot records can run through program feasibility', () => {
  const candidate = catalog.extractProgramInventory(pilotPages, { catalogYear: '2026-2027' })
    .find(item => item.programName === 'Business' && item.awardType === 'Certificate of Achievement');
  const detail = catalog.parseRequirementDetail(candidate, pilotPages, { filename: 'COS Catalog.pdf' });
  const approved = catalog.approveExtractedProgram(detail, 'Reviewer').program;
  const rows = [
    section({ subject: 'BUS', course: '20' }),
    section({ crn: '10002', subject: 'ACCT', course: '1', start: '10:30', end: '11:30' }),
    section({ crn: '10003', subject: 'MKT', course: '1', start: '12:00', end: '13:00' }),
    section({ crn: '10004', subject: 'MGMT', course: '1', start: '13:30', end: '14:30' })
  ];
  const result = feasibility.evaluateProgramFeasibility(approved, rows, { selectedTerm: 'FALL 2026' });

  assert.equal(result.availability.coveragePct, 1);
  assert.ok(result.configurationCounts.rawCrnConfigurationCount > 0);
  assert.equal(result.requirementsSourceConfidence.courseReconciliation, 'Needs review');
});
