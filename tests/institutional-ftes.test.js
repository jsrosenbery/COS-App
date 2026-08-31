const assert = require('node:assert/strict');
const test = require('node:test');
const institutional = require('../js/core/institutional-ftes.js');

function fixture() {
  const rows = Array.from({ length: 19 }, () => []);
  rows[1] = ['Fall 2026'];
  rows[18] = ['Campus', 'Subj Course No', 'CRN', 'Start Date', 'End Date', 'Faculty', 'Status', 'Acct Method', 'Meetings', 'DCH', 'WCH', 'Pos Hrs Res', 'Census Enroll', 'Current Enroll', 'Res Census', 'Total Contact Hrs', 'DSCH', 'WSCH', 'Total FTES Census', 'FTEF', 'Total FTES Last Day', 'FTES Diff', 'Credit', 'Instr Method'];
  rows.push(['COS', 'ENGL 001', '10001', '', '', '', 'A', 'W', '', '', '', '', 30, 30, 30, '', '', 900, 30, '', '', '', 'Credit', 'IP']);
  rows.push(['COS', 'NURS 100', '10002', '', '', '', 'A', 'D', '', '', '', '', 20, 20, 20, '', 525, '', 1, '', '', '', 'Credit', 'IP']);
  rows.push(['COS', 'PE 100', '10003', '', '', '', 'A', 'P', '', '', '', 525, 10, 10, 10, '', '', '', 1.25, '', '', '', 'Credit', 'IP']);
  return rows;
}

test('parses authoritative Total FTES Census and audits standard formulas', () => {
  const result = institutional.parseWorksheetRows(fixture());
  assert.equal(result.valid, true);
  assert.equal(result.term, 'FALL 2026');
  assert.equal(result.records.length, 3);
  assert.equal(result.audit.censusFtesTotal, 32.25);
  assert.equal(result.records[0].formulaAuditFtes, 30);
  assert.equal(result.records[1].formulaAuditFtes, 1);
  assert.equal(result.records[2].censusFtes, 1.25);
  assert.equal(result.records[2].formulaAuditFtes, 1);
});

test('indexes and joins institutional actuals by normalized term and CRN', () => {
  const records = institutional.parseWorksheetRows(fixture()).records;
  const index = institutional.indexRecords(records);
  assert.equal(institutional.findRecord(index, { term: 'Fall 2026', crn: 10002 }).censusFtes, 1);
  assert.equal(institutional.findRecord(index, { term: 'Spring 2026', crn: 10002 }), null);
});

test('duplicate CRNs block import', () => {
  const rows = fixture();
  rows.push([...rows[19]]);
  const result = institutional.parseWorksheetRows(rows);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /Duplicate CRN 10001/);
});

test('accepts Argos XLS headers containing HTML breaks and nonbreaking spaces', () => {
  const rows = fixture();
  rows[1] = ['Spring 2025'];
  rows[18] = [
    'Campus', 'Subj\u00a0Course\u00a0No', 'CRN', 'Start Date', 'End Date', 'Faculty', 'Status',
    'Acct Method', 'Meetings', 'DCH', 'WCH', 'Pos Hrs Res', 'Census Enroll', 'Current Enroll',
    'Res Census', 'Total<br>Contact Hrs', 'DSCH', 'WSCH', 'Total\u00a0FTES<br>Census', 'FTEF',
    'Total\u00a0FTES<br>Last\u00a0Day', 'FTES<br>Diff', 'Credit', 'Instr<br />Method'
  ];
  const result = institutional.parseWorksheetRows(rows);
  assert.equal(result.valid, true);
  assert.equal(result.term, 'SPRING 2025');
  assert.equal(result.records.length, 3);
  assert.equal(result.audit.headerRow, 19);
  assert.equal(institutional.normalizeHeader('Total\u00a0FTES<br>Census'), 'TOTAL FTES CENSUS');
});
