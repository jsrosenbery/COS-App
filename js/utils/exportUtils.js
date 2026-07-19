(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.COSExportUtils = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function slugify(value, fallback = 'export') {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || fallback;
  }

  function csvSafe(value) {
    const text = String(value ?? '');
    if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  }

  return Object.freeze({
    slugify,
    csvSafe
  });
});
