const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

test('Schedule Change Form maps Timber campus codes to editable campus choices', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'schedule-change-form.js'), 'utf8');
  const extractStart = source.indexOf('  function extractField(');
  const extractEnd = source.indexOf('  function setFieldValue(', extractStart);
  const campusStart = source.indexOf('  function getCampusValue(');
  const campusEnd = source.indexOf('  function getRoomCapacityValue(', campusStart);
  assert.ok(extractStart >= 0 && extractEnd > extractStart);
  assert.ok(campusStart >= 0 && campusEnd > campusStart);

  const context = {};
  vm.createContext(context);
  vm.runInContext(
    `${source.slice(extractStart, extractEnd)}\n${source.slice(campusStart, campusEnd)}\nthis.getCampusValue = getCampusValue;`,
    context
  );

  assert.equal(context.getCampusValue({ CAMPUS: 'COS' }), 'Visalia');
  assert.equal(context.getCampusValue({ Campus: 'TCC' }), 'Tulare');
  assert.equal(context.getCampusValue({ campus: 'HAC' }), 'Hanford');
  assert.equal(context.getCampusValue({ CAMPUS: 'ONC' }), 'Online');
  assert.equal(context.getCampusValue({ CAMPUS: 'ONT' }), 'Online');
  assert.equal(context.getCampusValue({ CAMPUS: 'ONH' }), 'Online');
  assert.equal(context.getCampusValue({ CAMPUS: '', BUILDING: 'TCCB' }), 'Tulare');
});
