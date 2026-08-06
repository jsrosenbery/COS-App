const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const service = require('../js/core/archive-service.js');

function resetService() {
  service.clearArchiveMemoryCache();
  service._private.manifestState.data = null;
  service._private.manifestState.promise = null;
  service._private.manifestState.fetchedAt = 0;
}

function jsonResponse(payload, ok = true, headers = {}) {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Error',
    headers: { get: name => headers[String(name).toLowerCase()] || null },
    json: async () => payload
  };
}

test.afterEach(() => {
  resetService();
  delete globalThis.BACKEND_BASE_URL;
  delete globalThis.fetch;
  delete globalThis.COS_APP_CONFIG;
});

test('archive manifest is fetched once per session and refresh forces a new request', async () => {
  resetService();
  globalThis.BACKEND_BASE_URL = 'https://backend.test';
  let calls = 0;
  globalThis.fetch = async url => {
    calls += 1;
    assert.equal(url, 'https://backend.test/api/analytics-archive/manifest');
    return jsonResponse({ data: { schemaVersion: 1, terms: [{ termCode: 'FALL 2026', updatedAt: 'one' }] } });
  };
  const first = await service.getArchiveManifest();
  const second = await service.getArchiveManifest();
  assert.equal(first, second);
  assert.equal(calls, 1);
  await service.refreshArchiveManifest();
  assert.equal(calls, 2);
});

test('archive manifest refreshes after the freshness ttl expires', async () => {
  resetService();
  globalThis.BACKEND_BASE_URL = 'https://backend.test';
  let manifestVersion = 'one';
  let calls = 0;
  globalThis.fetch = async url => {
    calls += 1;
    assert.equal(url, 'https://backend.test/api/analytics-archive/manifest');
    return jsonResponse({ data: { schemaVersion: 1, terms: [{ termCode: 'FALL 2026', updatedAt: manifestVersion }] } });
  };

  const first = await service.getArchiveManifest();
  assert.equal(first.terms[0].updatedAt, 'one');
  manifestVersion = 'two';
  const fresh = await service.getArchiveManifest();
  assert.equal(fresh.terms[0].updatedAt, 'one');
  service._private.manifestState.fetchedAt = Date.now() - service.DEFAULT_MANIFEST_TTL_MS - 1000;
  const stale = await service.getArchiveManifest();

  assert.equal(stale.terms[0].updatedAt, 'two');
  assert.equal(calls, 2);
});

test('archive manifest gracefully falls back to legacy archive listing', async () => {
  resetService();
  globalThis.BACKEND_BASE_URL = 'https://backend.test';
  const calls = [];
  globalThis.fetch = async url => {
    calls.push(url);
    if (url.endsWith('/manifest')) return jsonResponse({ error: 'missing' }, false);
    return jsonResponse({ data: [{ term: 'FALL 2025', lastUpdated: 'legacy' }] });
  };
  const manifest = await service.getArchiveManifest();
  assert.deepEqual(calls, ['https://backend.test/api/analytics-archive/manifest', 'https://backend.test/api/analytics-archive']);
  assert.equal(manifest.terms[0].termCode, 'FALL 2025');
  assert.equal(manifest.terms[0].schemaVersion, 'legacy-list');
});

test('archive term requests dedupe in-flight promises and then return from memory cache', async () => {
  resetService();
  globalThis.BACKEND_BASE_URL = 'https://backend.test';
  let termCalls = 0;
  globalThis.fetch = async url => {
    if (url.endsWith('/manifest')) return jsonResponse({ data: { schemaVersion: 1, terms: [{ termCode: 'FALL 2026', updatedAt: 'v1', sizeBytes: 20 }] } });
    termCalls += 1;
    await new Promise(resolve => setTimeout(resolve, 15));
    return jsonResponse({ term: 'FALL 2026', lastUpdated: 'v1', data: [{ CRN: '10001' }] });
  };
  const [first, second] = await Promise.all([
    service.loadArchiveTerm('FALL 2026'),
    service.loadArchiveTerm('FALL 2026')
  ]);
  assert.equal(first, second);
  assert.equal(termCalls, 1);
  const cached = await service.loadArchiveTerm('FALL 2026');
  assert.equal(cached, first);
  assert.equal(termCalls, 1);
});

test('archive memory cache moves hits to newest position before evicting', async () => {
  resetService();
  globalThis.BACKEND_BASE_URL = 'https://backend.test';
  const terms = ['A', 'B', 'C'];
  globalThis.fetch = async url => {
    if (url.endsWith('/manifest')) {
      return jsonResponse({ data: { schemaVersion: 1, terms: terms.map(termCode => ({ termCode, updatedAt: 'v1' })) } });
    }
    const term = decodeURIComponent(url.split('/').pop());
    return jsonResponse({ term, data: [{ term }] });
  };

  await service.loadArchiveTerm('A', { maxArchives: 2 });
  await service.loadArchiveTerm('B', { maxArchives: 2 });
  await service.loadArchiveTerm('A', { maxArchives: 2 });
  await service.loadArchiveTerm('C', { maxArchives: 2 });

  const keys = Array.from(service._private.archiveDataCache.keys());
  assert.ok(keys.some(key => key.startsWith('A|')));
  assert.ok(keys.some(key => key.startsWith('C|')));
  assert.ok(!keys.some(key => key.startsWith('B|')));
});

test('failed archive term requests are not permanently cached and force refresh bypasses cache', async () => {
  resetService();
  globalThis.BACKEND_BASE_URL = 'https://backend.test';
  let termCalls = 0;
  globalThis.fetch = async url => {
    if (url.endsWith('/manifest')) return jsonResponse({ data: { schemaVersion: 1, terms: [{ termCode: 'FALL 2026', updatedAt: 'v1' }] } });
    termCalls += 1;
    if (termCalls === 1) return jsonResponse({ error: 'temporary' }, false);
    return jsonResponse({ term: 'FALL 2026', data: [{ CRN: String(termCalls) }] });
  };
  await assert.rejects(() => service.loadArchiveTerm('FALL 2026'), /temporary/);
  const loaded = await service.loadArchiveTerm('FALL 2026');
  assert.equal(loaded.data[0].CRN, '2');
  const forced = await service.loadArchiveTerm('FALL 2026', { force: true });
  assert.equal(forced.data[0].CRN, '3');
});

test('archive term loading respects three-request concurrency and preserves result order with failures', async () => {
  resetService();
  const active = { count: 0, max: 0 };
  const terms = ['A', 'B', 'C', 'D', 'E'];
  const results = await service.runWithConcurrency(terms, async term => {
    active.count += 1;
    active.max = Math.max(active.max, active.count);
    await new Promise(resolve => setTimeout(resolve, 10));
    active.count -= 1;
    if (term === 'C') throw new Error('bad term');
    return { term };
  }, service.DEFAULT_CONCURRENCY);
  assert.equal(active.max, 3);
  assert.deepEqual(results.map(result => result.item), terms);
  assert.equal(results[2].failed, true);
  assert.equal(results.filter(result => result && !result.failed).length, 4);
});

test('archive manifest timestamp change invalidates cached archive data', async () => {
  resetService();
  globalThis.BACKEND_BASE_URL = 'https://backend.test';
  let manifestVersion = 'v1';
  let termCalls = 0;
  globalThis.fetch = async url => {
    if (url.endsWith('/manifest')) {
      return jsonResponse({ data: { schemaVersion: 1, terms: [{ termCode: 'FALL 2026', updatedAt: manifestVersion }] } });
    }
    termCalls += 1;
    return jsonResponse({ term: 'FALL 2026', data: [{ version: manifestVersion }] });
  };
  const first = await service.loadArchiveTerm('FALL 2026');
  assert.equal(first.data[0].version, 'v1');
  manifestVersion = 'v2';
  await service.refreshArchiveManifest();
  const second = await service.loadArchiveTerm('FALL 2026');
  assert.equal(second.data[0].version, 'v2');
  assert.equal(termCalls, 2);
});

test('archive service is loaded before app and enrollment analytics scripts', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(index.indexOf('js/core/archive-service.js') < index.indexOf('js/app.js'));
  assert.ok(index.indexOf('js/core/archive-service.js') < index.indexOf('js/enrollment-analytics.js'));
});

test('archive service debug timing is silent unless debug flag is enabled', async () => {
  resetService();
  globalThis.BACKEND_BASE_URL = 'https://backend.test';
  let tables = 0;
  const priorConsole = globalThis.console;
  globalThis.console = { ...priorConsole, table: () => { tables += 1; } };
  globalThis.fetch = async url => {
    if (url.endsWith('/manifest')) return jsonResponse({ data: { schemaVersion: 1, terms: [{ termCode: 'FALL 2026', updatedAt: 'v1' }] } });
    return jsonResponse({ term: 'FALL 2026', data: [] });
  };
  try {
    await service.loadArchiveTerm('FALL 2026');
    assert.equal(tables, 0);
    resetService();
    globalThis.COS_APP_CONFIG = { flags: { debug: true } };
    await service.loadArchiveTerm('FALL 2026');
    assert.ok(tables >= 1);
  } finally {
    globalThis.console = priorConsole;
  }
});

test('archive loading status includes elapsed loading time', () => {
  const html = service.renderArchiveLoadingStatus({
    total: 2,
    loaded: 1,
    pending: 1,
    failed: 0,
    rowsLoaded: 25,
    bytes: 1024,
    elapsedMs: 1234
  });

  assert.match(html, /Loaded: 1/);
  assert.match(html, /Pending: 1/);
  assert.match(html, /Rows loaded: 25/);
  assert.match(html, /Elapsed: 1\.2s/);
});
