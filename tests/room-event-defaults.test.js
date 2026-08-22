const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('Room Availability shows events by default without treating them as search conflicts', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const showGridTag = html.match(/<input[^>]*id=["']events-show-grid["'][^>]*>/i)?.[0] || '';
  assert.ok(showGridTag, 'events-show-grid checkbox should exist');
  assert.match(showGridTag, /\schecked(?:\s|=|>)/i, 'events-show-grid should be checked by default');

  for (const id of ['events-include-search', 'events-hard-conflict']) {
    const tag = html.match(new RegExp(`<input[^>]*id=["']${id}["'][^>]*>`, 'i'))?.[0] || '';
    assert.ok(tag, `${id} checkbox should exist`);
    assert.doesNotMatch(tag, /\schecked(?:\s|=|>)/i, `${id} should be unchecked by default`);
  }
});
