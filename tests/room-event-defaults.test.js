const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('Room Availability event controls default to unchecked', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  for (const id of ['events-show-grid', 'events-include-search', 'events-hard-conflict']) {
    const tag = html.match(new RegExp(`<input[^>]*id=["']${id}["'][^>]*>`, 'i'))?.[0] || '';
    assert.ok(tag, `${id} checkbox should exist`);
    assert.doesNotMatch(tag, /\schecked(?:\s|=|>)/i, `${id} should be unchecked by default`);
  }
});
