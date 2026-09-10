const test = require('node:test');
const assert = require('node:assert/strict');
const { analyze } = require('../js/core/instructional-delivery');
const meeting = (crn, overrides = {}) => ({ term: 'FALL 2026', crn, subject: 'BIOL', course: '020', days: ['MO'], start: '09:00', end: '12:00', startDate: '2026-08-17', endDate: '2026-12-18', campus: 'VIS', room: 'SCI 101', instructor: 'LEE', scheduleType: '2', crossList: 'BIO-A', ...overrides });

test('two STAT registrations share one delivered main class', () => {
  const result = analyze([meeting('1', { subject: 'STAT', course: 'C1000' }), meeting('2', { subject: 'STAT', course: 'C1000' })]);
  assert.equal(result.summary.registrationSections, 2);
  assert.equal(result.summary.stackedSections, 2);
  assert.equal(result.summary.stackGroups, 1);
  assert.equal(result.summary.deliveredComponents, 1);
  assert.equal(result.summary.deliveredWeeklyHours, 3);
  assert.equal(result.sectionDetails[0].sharedPercent, '100%');
  assert.equal(result.detail[0].sharedWith, '2');
});
test('biology preserves separate labs while consolidating the lecture', () => {
  const rows = [meeting('1'), meeting('2'), meeting('1', { scheduleType: '4', days: ['TU'] }), meeting('2', { scheduleType: '4', days: ['WE'] })];
  const before = JSON.stringify(rows);
  const result = analyze(rows);
  assert.equal(result.summary.sharedComponents, 1);
  assert.equal(result.summary.separateComponents, 2);
  assert.equal(result.summary.deliveredComponents, 3);
  assert.equal(result.summary.sectionWeeklyHours, 12);
  assert.equal(result.summary.deliveredWeeklyHours, 9);
  assert.equal(result.summary.consolidatedWeeklyHours, 3);
  assert.deepEqual(result.sectionDetails.map(s => s.sharedPercent), ['50%', '50%']);
  assert.equal(JSON.stringify(rows), before);
});
test('separate support increases delivery without becoming another stack', () => {
  const result = analyze([meeting('1'), meeting('2'), meeting('1', { scheduleType: 'XX', days: ['TH'], end: '10:00' })]);
  assert.equal(result.summary.stackGroups, 1);
  assert.equal(result.summary.deliveredComponents, 2);
  assert.equal(result.summary.deliveredWeeklyHours, 4);
  assert.equal(result.sectionDetails[0].sharedPercent, '75%');
});
test('repeated meeting rows and repeated days do not inflate components or hours', () => {
  const result = analyze([meeting('1'), meeting('1'), meeting('2', { days: ['MO', 'MO'] })]);
  assert.equal(result.summary.deliveredWeeklyHours, 3);
  assert.equal(result.summary.sectionWeeklyHours, 6);
});
test('same CRNs and cross-list IDs in different terms never merge', () => {
  const result = analyze([meeting('1'), meeting('2'), meeting('1', { term: 'FALL 2025' }), meeting('2', { term: 'FALL 2025' })]);
  assert.equal(result.summary.registrationSections, 4);
  assert.equal(result.summary.stackGroups, 2);
  assert.equal(result.summary.deliveredWeeklyHours, 6);
});
test('coincident classes without explicit group IDs remain possible matches', () => {
  for (const crossList of ['', 'Y', 'YES', '1']) {
    const result = analyze([meeting('1', { crossList }), meeting('2', { crossList })]);
    assert.equal(result.summary.stackedSections, 0);
    assert.equal(result.summary.possibleSharedGroups, 1);
    assert.equal(result.summary.deliveredWeeklyHours, 6);
  }
});
test('different locations, component types, dates, instructors and partial overlaps do not consolidate', () => {
  for (const overrides of [{ room: 'SCI 102' }, { scheduleType: '4' }, { startDate: '2026-10-01' }, { instructor: 'KIM' }, { start: '10:00' }, { campus: 'HAN' }]) {
    const result = analyze([meeting('1'), meeting('2', overrides)]);
    assert.equal(result.summary.sharedComponents, 0);
  }
});
test('missing date/type evidence cannot confirm sharing; US and ISO dates normalize', () => {
  for (const overrides of [{ startDate: '' }, { endDate: '2026-02-30' }, { scheduleType: '' }, { instructor: 'TBA' }, { room: 'N/A' }]) {
    const result = analyze([meeting('1', overrides), meeting('2', overrides)]);
    assert.equal(result.summary.sharedComponents, 0);
    assert.equal(result.summary.unverifiedComponents, 2);
  }
  assert.equal(analyze([meeting('1'), meeting('2', { startDate: '8/17/2026', endDate: '12/18/2026' })]).summary.sharedComponents, 1);
});
test('TBA and missing identities remain explicit data gaps', () => {
  const result = analyze([meeting('1'), meeting('1', { start: '', end: '', scheduleType: '4' }), meeting('', {}), meeting('2', { days: [] })]);
  assert.equal(result.summary.registrationSections, 2);
  assert.equal(result.summary.incompleteSections, 2);
  assert.equal(result.summary.missingIdentityRows, 1);
  assert.equal(result.sectionDetails[0].sharedPercent, 'Incomplete meeting data');
});
test('contradictory duplicate cross-list metadata does not confirm a stack', () => {
  const result = analyze([meeting('1'), meeting('1', { crossList: 'OTHER' }), meeting('2')]);
  assert.equal(result.summary.sharedComponents, 0);
  assert.equal(result.summary.unverifiedComponents, 1);
});
test('multiple shared components form one connected class group', () => {
  const result = analyze([meeting('1'), meeting('2'), meeting('1', { days: ['TU'] }), meeting('2', { days: ['TU'] })]);
  assert.equal(result.summary.stackGroups, 1);
  assert.equal(result.summary.sharedComponents, 2);
});

test('online placeholder hours are unavailable, not all-day teaching', () => {
  const result = analyze([meeting('1', { start: '00:00', end: '23:59', timeBlock: 'ONLINE/TBA' })]);
  assert.equal(result.summary.deliveredWeeklyHours, 0);
  assert.equal(result.summary.incompleteSections, 1);
});

function reportHarness(focusTerm = 'FALL 2026') {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const source = fs.readFileSync(require.resolve('../js/enrollment-analytics.js'), 'utf8');
  const nodes = new Map();
  const tables = new Map();
  const getNode = id => { if (!nodes.has(id)) nodes.set(id, { innerHTML: '', value: id === 'studentChoiceTerm' ? focusTerm : '' }); return nodes.get(id); };
  const context = { window: { COSInstructionalDelivery: { analyze } }, document: { getElementById: getNode },
    normalizeTermLabel: value => String(value).toUpperCase(),
    distinctScheduleSections: rows => [...new Map(rows.map(row => [row.term + row.crn, row])).values()],
    calGetcCourseCode: row => `${row.subject} ${row.course}`,
    scheduleOpportunityEnrollment: row => row.census ?? row.actual ?? 0,
    round1: value => Math.round(value * 10) / 10,
    escapeAttr: value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    table: (id, rows) => tables.set(id, rows) };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('  function renderStudentChoiceDelivery('), source.indexOf('  function renderStudentChoiceOpportunity()')), context);
  return { render: context.renderStudentChoiceDelivery, tables, nodes, context, source, vm };
}

test('comparison uses term-specific identities and preserves every selected baseline separately', () => {
  const h = reportHarness();
  const rows = [meeting('1', { cap: 30 }), meeting('2', { cap: 30 })];
  const prior = [meeting('1', { term: 'FALL 2025', cap: 20, census: 18 }), meeting('1', { term: 'FALL 2024', cap: 25, census: 22 })];
  const exported = h.render(rows, prior, ['FALL 2025', 'FALL 2024']);
  const comparisons = exported.filter(row => row.rowType === 'Prior-term fitness comparison' && row.metric === 'Registration sections');
  assert.equal(comparisons.length, 2);
  assert.equal(comparisons[0].prior, 1);
  assert.equal(comparisons[0].change, 1);
  assert.equal(exported.find(row => row.metric === 'Proposed seats versus prior enrollment').change, 42);
});
test('missing and self comparison terms never create a zero-demand baseline', () => {
  const h = reportHarness();
  const rows = [meeting('1')];
  for (const terms of [[], ['FALL 2025'], ['FALL 2026']]) {
    assert.equal(h.render(rows, [], terms).some(row => row.rowType === 'Prior-term fitness comparison'), false);
  }
  assert.match(h.nodes.get('studentChoiceFitnessComparison').innerHTML, /Missing data is not treated as a zero baseline/);
});
test('course changes, shared portions and hostile text are present safely in rendered detail', () => {
  const h = reportHarness();
  const rows = [meeting('1', { subject: '<img src=x>' })];
  const prior = [meeting('9', { term: 'FALL 2025', subject: 'STAT' })];
  const exported = h.render(rows, prior, ['FALL 2025']);
  assert.equal(exported.filter(row => row.rowType === 'Course offering change').length, 2);
  assert.match(h.tables.get('studentChoiceDeliverySections')[0].course, /&lt;IMG SRC=X&gt;/);
  assert.equal(exported.find(row => row.rowType === 'Shared section portions').weeklyHours, 3);
});
test('CSV handler retains the union of summary, comparison and component columns', () => {
  const h = reportHarness();
  let listener, exported;
  h.context.state = { studentChoiceExportRows: [{ rowType: 'summary', registrationSections: 2 }, { rowType: 'component', crn: '1', sharedWith: '2', weeklyHours: 3 }] };
  h.context.document.getElementById = () => ({ addEventListener: (event, callback) => { listener = callback; } });
  h.context.exportRowsWithoutMethodology = rows => { exported = rows; };
  const start = h.source.indexOf("    document.getElementById('exportStudentChoiceOpportunity')?.addEventListener");
  const end = h.source.indexOf('\n    });', start) + '\n    });'.length;
  h.vm.runInContext(h.source.slice(start, end), h.context);
  listener();
  assert.equal(exported[0].crn, '');
  assert.equal(exported[1].sharedWith, '2');
  assert.equal(exported[1].registrationSections, '');
});
