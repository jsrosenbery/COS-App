const assert = require('assert');
const theme = require('../js/core/theme.js');

assert.strictEqual(theme.normalizeTheme('dark'), 'dark');
assert.strictEqual(theme.normalizeTheme('light'), 'light');
assert.strictEqual(theme.normalizeTheme('unexpected'), 'light');

const stored = {};
const documentStub = { documentElement: { dataset: {} } };
const storageStub = { setItem(key, value) { stored[key] = value; } };

assert.strictEqual(theme.applyTheme('dark', { document: documentStub, storage: storageStub }), 'dark');
assert.strictEqual(documentStub.documentElement.dataset.theme, 'dark');
assert.strictEqual(stored[theme.STORAGE_KEY], 'dark');

assert.strictEqual(theme.applyTheme('light', { document: documentStub, storage: storageStub }), 'light');
assert.strictEqual(documentStub.documentElement.dataset.theme, 'light');
assert.strictEqual(stored[theme.STORAGE_KEY], 'light');

console.log('Theme tests passed.');
