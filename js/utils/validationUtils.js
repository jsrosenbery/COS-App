(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.COSValidationUtils = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function canon(value) {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  }

  function normalizeKey(value) {
    return String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  }

  function normalizeText(value) {
    return String(value || '').trim();
  }

  return Object.freeze({
    canon,
    normalizeKey,
    normalizeText
  });
});
