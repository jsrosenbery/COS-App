(function (root, factory) {
  const api = factory();
  root.COSFormatters = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function numericValue(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function formatWholeNumber(value) {
    return Math.round(numericValue(value)).toLocaleString('en-US');
  }

  function formatDecimal(value, digits = 1) {
    const places = Math.max(0, Number.isFinite(Number(digits)) ? Number(digits) : 1);
    return numericValue(value).toLocaleString('en-US', {
      minimumFractionDigits: places,
      maximumFractionDigits: places
    });
  }

  function formatPercent(value, digits = 1) {
    return `${formatDecimal(numericValue(value) * 100, digits)}%`;
  }

  function formatFactor(value) {
    return formatDecimal(value, 2);
  }

  function formatPresenceValue(value) {
    return formatWholeNumber(value);
  }

  return Object.freeze({
    formatWholeNumber,
    formatDecimal,
    formatPercent,
    formatFactor,
    formatPresenceValue
  });
});
