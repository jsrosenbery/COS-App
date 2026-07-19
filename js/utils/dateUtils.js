(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.COSDateUtils = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function parseDateOnly(value) {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (slash) {
      let year = Number(slash[3]);
      if (year < 100) year += 2000;
      return new Date(year, Number(slash[1]) - 1, Number(slash[2]));
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  function parseSectionDate(value) {
    const text = String(value || '').trim();
    if (!text) return null;
    const serial = Number(text);
    if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
      const excelEpoch = Date.UTC(1899, 11, 30);
      return new Date(excelEpoch + serial * 24 * 60 * 60 * 1000);
    }
    const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (match) {
      const month = Number(match[1]) - 1;
      const day = Number(match[2]);
      const rawYear = Number(match[3]);
      const year = rawYear < 100 ? 2000 + rawYear : rawYear;
      const date = new Date(year, month, day);
      return Number.isFinite(date.getTime()) ? date : null;
    }
    const parsed = Date.parse(text);
    return Number.isFinite(parsed) ? new Date(parsed) : null;
  }

  function formatMonthDay(date) {
    if (!date || Number.isNaN(date.getTime())) return '';
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  function formatSectionDate(value) {
    const date = parseSectionDate(value);
    if (!date) return String(value || '');
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  }

  function dateRangesOverlap(left, right) {
    if (!left || !right) return true;
    return left.start <= right.end && right.start <= left.end;
  }

  return Object.freeze({
    parseDateOnly,
    parseSectionDate,
    formatMonthDay,
    formatSectionDate,
    dateRangesOverlap
  });
});
