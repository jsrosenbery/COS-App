(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.COSArchiveService = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const DEFAULT_CONCURRENCY = 3;
  const DEFAULT_MAX_ARCHIVES = 10;
  const DEFAULT_MANIFEST_TTL_MS = 5 * 60 * 1000;
  const manifestState = { promise: null, data: null, fetchedAt: 0 };
  const archiveDataCache = new Map();
  const archiveRequestCache = new Map();

  function now() {
    return root.performance?.now ? root.performance.now() : Date.now();
  }

  function debugEnabled() {
    return root.COS_APP_CONFIG?.flags?.debug === true;
  }

  function debugTable(label, rows) {
    if (!debugEnabled() || !root.console) return;
    if (typeof root.console.table === 'function') root.console.table(rows);
    else root.console.log(label, rows);
  }

  function backendBaseUrl(options = {}) {
    return String(options.backendBaseUrl || root.BACKEND_BASE_URL || '').replace(/\/$/, '');
  }

  function cleanTerm(term) {
    return String(term || '').trim();
  }

  function termKey(term) {
    return cleanTerm(term).toUpperCase();
  }

  function manifestTerms(manifest) {
    return Array.isArray(manifest?.terms) ? manifest.terms : [];
  }

  function entryForTerm(manifest, term) {
    const key = termKey(term);
    return manifestTerms(manifest).find(entry => termKey(entry.termCode || entry.term) === key) || null;
  }

  function normalizeManifest(payload = {}) {
    const data = payload.data && !Array.isArray(payload.data) ? payload.data : payload;
    const terms = manifestTerms(data).map(entry => ({
      termCode: cleanTerm(entry.termCode || entry.term),
      displayTerm: cleanTerm(entry.displayTerm || entry.termCode || entry.term),
      rowCount: Number.isFinite(Number(entry.rowCount)) ? Number(entry.rowCount) : null,
      updatedAt: cleanTerm(entry.updatedAt || entry.lastUpdated),
      sizeBytes: Number.isFinite(Number(entry.sizeBytes)) ? Number(entry.sizeBytes) : null,
      hasArchive: entry.hasArchive !== false,
      schemaVersion: entry.schemaVersion || ''
    })).filter(entry => entry.termCode);
    return {
      schemaVersion: data.schemaVersion || 1,
      generatedAt: data.generatedAt || '',
      terms
    };
  }

  function legacyListToManifest(payload = {}) {
    const terms = (Array.isArray(payload.data) ? payload.data : []).map(entry => ({
      termCode: cleanTerm(entry.term || entry.termCode),
      displayTerm: cleanTerm(entry.displayTerm || entry.term || entry.termCode),
      rowCount: null,
      updatedAt: cleanTerm(entry.lastUpdated || entry.updatedAt),
      sizeBytes: null,
      hasArchive: true,
      schemaVersion: 'legacy-list'
    })).filter(entry => entry.termCode);
    return { schemaVersion: 0, generatedAt: '', terms };
  }

  async function fetchJsonWithTiming(url, options = {}) {
    const started = now();
    const response = await root.fetch(url, options.fetchOptions || {});
    const networkMs = now() - started;
    const parseStarted = now();
    const payload = await response.json().catch(() => ({}));
    const parseMs = now() - parseStarted;
    const contentLength = Number(response.headers?.get?.('content-length'));
    return {
      response,
      payload,
      timing: {
        networkMs,
        parseMs,
        bytes: Number.isFinite(contentLength) ? contentLength : null
      }
    };
  }

  async function getArchiveManifest(options = {}) {
    const baseUrl = backendBaseUrl(options);
    if (!baseUrl) return { schemaVersion: 0, generatedAt: '', terms: [] };
    const ttlMs = Number.isFinite(Number(options.manifestTtlMs)) ? Number(options.manifestTtlMs) : DEFAULT_MANIFEST_TTL_MS;
    const fresh = manifestState.data && (Date.now() - (manifestState.fetchedAt || 0)) < ttlMs;
    if (!options.force && fresh) return manifestState.data;
    if (!options.force && manifestState.promise) return manifestState.promise;
    manifestState.promise = (async () => {
      const started = now();
      try {
        const result = await fetchJsonWithTiming(`${baseUrl}/api/analytics-archive/manifest`);
        if (!result.response.ok) throw new Error(result.payload?.error || result.response.statusText || 'manifest unavailable');
        const manifest = normalizeManifest(result.payload);
        manifestState.data = manifest;
        manifestState.fetchedAt = Date.now();
        invalidateChangedArchives(manifest);
        debugTable('Archive manifest timing', [{
          requestMs: Number((now() - started).toFixed(1)),
          networkMs: Number(result.timing.networkMs.toFixed(1)),
          parseMs: Number(result.timing.parseMs.toFixed(1)),
          terms: manifest.terms.length,
          bytes: result.timing.bytes
        }]);
        return manifest;
      } catch (err) {
        const fallback = await fetchJsonWithTiming(`${baseUrl}/api/analytics-archive`);
        if (!fallback.response.ok) throw err;
        const manifest = legacyListToManifest(fallback.payload);
        manifestState.data = manifest;
        manifestState.fetchedAt = Date.now();
        invalidateChangedArchives(manifest);
        return manifest;
      } finally {
        manifestState.promise = null;
      }
    })();
    return manifestState.promise;
  }

  function refreshArchiveManifest(options = {}) {
    manifestState.data = null;
    manifestState.promise = null;
    return getArchiveManifest({ ...options, force: true });
  }

  function cacheKeyForTerm(term, manifest) {
    const entry = entryForTerm(manifest, term);
    return `${termKey(term)}|${entry?.updatedAt || entry?.schemaVersion || 'unknown'}`;
  }

  function invalidateChangedArchives(manifest) {
    const validKeys = new Set(manifestTerms(manifest).map(entry => cacheKeyForTerm(entry.termCode, manifest)));
    Array.from(archiveDataCache.keys()).forEach(key => {
      const term = key.split('|')[0];
      const stillCurrent = Array.from(validKeys).some(valid => valid.startsWith(`${term}|`) && valid === key);
      if (!stillCurrent) archiveDataCache.delete(key);
    });
  }

  function rememberArchive(cacheKey, payload, maxArchives = DEFAULT_MAX_ARCHIVES) {
    if (archiveDataCache.has(cacheKey)) archiveDataCache.delete(cacheKey);
    archiveDataCache.set(cacheKey, { payload, usedAt: Date.now() });
    while (archiveDataCache.size > maxArchives) {
      const oldest = archiveDataCache.keys().next().value;
      archiveDataCache.delete(oldest);
    }
  }

  async function loadArchiveTerm(term, options = {}) {
    const requestedTerm = cleanTerm(term);
    if (!requestedTerm) return { term: '', lastUpdated: null, data: [] };
    const baseUrl = backendBaseUrl(options);
    if (!baseUrl) throw new Error(`Cannot load archived term ${requestedTerm}: backend URL is not configured.`);
    const manifest = await getArchiveManifest(options);
    const cacheKey = cacheKeyForTerm(requestedTerm, manifest);
    if (!options.force && archiveDataCache.has(cacheKey)) {
      const cached = archiveDataCache.get(cacheKey);
      cached.usedAt = Date.now();
      archiveDataCache.delete(cacheKey);
      archiveDataCache.set(cacheKey, cached);
      return cached.payload;
    }
    if (!options.force && archiveRequestCache.has(cacheKey)) return archiveRequestCache.get(cacheKey);
    const requestPromise = (async () => {
      const result = await fetchJsonWithTiming(`${baseUrl}/api/analytics-archive/${encodeURIComponent(requestedTerm)}`);
      if (!result.response.ok) {
        const detail = result.payload?.error || result.payload?.message || result.response.statusText || 'archive load failed';
        throw new Error(`Could not load archived term ${requestedTerm}: ${detail}`);
      }
      if (!Array.isArray(result.payload?.data)) throw new Error(`Could not load archived term ${requestedTerm}: archive response did not include a data array`);
      const manifestEntry = entryForTerm(manifest, requestedTerm);
      const payload = {
        ...result.payload,
        term: result.payload.term || requestedTerm,
        lastUpdated: result.payload.lastUpdated || manifestEntry?.updatedAt || null,
        __archiveMetadata: manifestEntry || null,
        __archiveTiming: {
          networkMs: result.timing.networkMs,
          parseMs: result.timing.parseMs,
          rows: result.payload.data.length,
          bytes: result.timing.bytes ?? manifestEntry?.sizeBytes ?? null
        }
      };
      rememberArchive(cacheKey, payload, options.maxArchives || DEFAULT_MAX_ARCHIVES);
      debugTable('Archive term timing', [{
        termCode: requestedTerm,
        networkMs: Number(result.timing.networkMs.toFixed(1)),
        parseMs: Number(result.timing.parseMs.toFixed(1)),
        rows: payload.data.length,
        bytes: payload.__archiveTiming.bytes
      }]);
      return payload;
    })();
    archiveRequestCache.set(cacheKey, requestPromise);
    try {
      return await requestPromise;
    } finally {
      archiveRequestCache.delete(cacheKey);
    }
  }

  async function runWithConcurrency(items, worker, concurrency = DEFAULT_CONCURRENCY, onProgress = null) {
    const limit = Math.max(1, Number(concurrency) || DEFAULT_CONCURRENCY);
    const results = new Array(items.length);
    let nextIndex = 0;
    let active = 0;
    return new Promise(resolve => {
      const launch = () => {
        if (nextIndex >= items.length && active === 0) return resolve(results);
        while (active < limit && nextIndex < items.length) {
          const index = nextIndex++;
          active += 1;
          Promise.resolve()
            .then(() => worker(items[index], index))
            .then(value => {
              results[index] = { item: items[index], value, failed: false, error: '' };
            })
            .catch(err => {
              results[index] = { item: items[index], value: null, failed: true, error: err?.message || String(err) };
            })
            .finally(() => {
              active -= 1;
              onProgress?.(progressSummary(items, results));
              launch();
            });
        }
      };
      onProgress?.(progressSummary(items, results));
      launch();
    });
  }

  function progressSummary(terms = [], results = []) {
    const loaded = results.filter(result => result && !result.failed).length;
    const failed = results.filter(result => result?.failed).length;
    const rowsLoaded = results.reduce((sum, result) => sum + (Array.isArray(result?.value?.data) ? result.value.data.length : 0), 0);
    const bytes = results.reduce((sum, result) => sum + (Number(result?.value?.__archiveTiming?.bytes) || 0), 0);
    return {
      total: terms.length,
      loaded,
      failed,
      pending: Math.max(0, terms.length - loaded - failed),
      rowsLoaded,
      bytes
    };
  }

  async function loadArchiveTerms(terms = [], options = {}) {
    const requested = [...new Set((terms || []).map(cleanTerm).filter(Boolean))];
    const started = now();
    const progress = summary => {
      const withElapsed = { ...summary, elapsedMs: now() - started };
      options.onProgress?.(withElapsed);
    };
    const results = await runWithConcurrency(
      requested,
      term => loadArchiveTerm(term, options),
      options.concurrency || DEFAULT_CONCURRENCY,
      progress
    );
    const summary = progressSummary(requested, results);
    summary.elapsedMs = now() - started;
    options.onProgress?.(summary);
    return {
      selectedTerms: requested,
      results: results.map((result, index) => ({
        term: requested[index],
        payload: result?.value || null,
        rows: Array.isArray(result?.value?.data) ? result.value.data : [],
        failed: Boolean(result?.failed),
        error: result?.error || ''
      })),
      summary
    };
  }

  function clearArchiveMemoryCache() {
    archiveDataCache.clear();
    archiveRequestCache.clear();
  }

  function renderArchiveLoadingStatus(summary = {}) {
    const bytes = Number(summary.bytes || summary.approximateBytes || 0);
    const mb = bytes ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : 'N/A';
    const elapsed = Number(summary.elapsedMs || 0);
    const elapsedText = `${(elapsed / 1000).toFixed(1)}s`;
    return `
      <div class="archive-loading-status">
        <strong>Historical data</strong>
        <span>Total: ${summary.total || 0}</span>
        <span>Loaded: ${summary.loaded || 0}</span>
        <span>Pending: ${summary.pending || 0}</span>
        <span>Failed: ${summary.failed || 0}</span>
        <span>Rows loaded: ${summary.rowsLoaded || 0}</span>
        <span>Downloaded: ${mb}</span>
        <span>Elapsed: ${elapsedText}</span>
      </div>
    `;
  }

  function cacheSnapshot() {
    return {
      manifestCached: Boolean(manifestState.data),
      archiveCount: archiveDataCache.size,
      inFlightCount: archiveRequestCache.size
    };
  }

  return {
    DEFAULT_CONCURRENCY,
    DEFAULT_MAX_ARCHIVES,
    DEFAULT_MANIFEST_TTL_MS,
    getArchiveManifest,
    refreshArchiveManifest,
    loadArchiveTerm,
    loadArchiveTerms,
    clearArchiveMemoryCache,
    runWithConcurrency,
    renderArchiveLoadingStatus,
    cacheSnapshot,
    _private: {
      manifestState,
      archiveDataCache,
      archiveRequestCache,
      normalizeManifest,
      legacyListToManifest,
      progressSummary,
      cacheKeyForTerm
    }
  };
});
