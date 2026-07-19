(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.COSMathUtils = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function safeDiv(numerator, denominator, fallback = 0) {
    return denominator ? numerator / denominator : fallback;
  }

  function roundTo(value, places = 1) {
    const factor = 10 ** places;
    return Math.round((Number(value) || 0) * factor) / factor;
  }

  function percentLabel(value) {
    return `${Math.round((value || 0) * 1000) / 10}%`;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  return Object.freeze({
    safeDiv,
    roundTo,
    percentLabel,
    clamp
  });
});
