(function (root, factory) {
  const api = factory();
  root.COSTermUtils = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function canon(value) {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  }

  function termFromFilename(filename) {
    const text = String(filename || '').toUpperCase();
    const match = text.match(/\b(20\d{2})(10|20|30|40)\b/);
    if (!match) return '';
    const year = Number(match[1]);
    const code = match[2];
    if (code === '10') return `FALL ${year - 1}`;
    if (code === '20') return `SPRING ${year}`;
    if (code === '30') return `SUMMER ${year}`;
    if (code === '40') return `WINTER ${year}`;
    return '';
  }

  function academicYearLabel(trailingYear) {
    return `FY/AY ${trailingYear}`;
  }

  function normalizeTermLabel(term) {
    const text = canon(term);
    if (!text) return '';
    const bannerTerm = termFromFilename(text);
    if (bannerTerm) return bannerTerm;
    const year = (text.match(/\b(20\d{2})\b/) || [])[1];
    const season = (text.match(/\b(FALL|SPRING|SUMMER|WINTER)\b/) || [])[1];
    if (year && season) return `${season} ${year}`;
    const ay = text.match(/\b(?:FY\/AY|AY|FY)\s*(20\d{2})\b/);
    if (ay) return academicYearLabel(Number(ay[1]));
    return text;
  }

  function termSortValue(term) {
    const text = normalizeTermLabel(term);
    const year = Number((text.match(/\b(20\d{2})\b/) || [])[1] || 0);
    const season = (text.match(/FALL|SPRING|SUMMER|WINTER/) || [''])[0];
    const seasonOrder = { WINTER: 1, SPRING: 2, SUMMER: 3, FALL: 4 };
    return year * 10 + (seasonOrder[season] || 0);
  }

  function termParts(term) {
    const text = normalizeTermLabel(term);
    return {
      season: (text.match(/FALL|SPRING|SUMMER|WINTER/) || [''])[0],
      year: Number((text.match(/\b(20\d{2})\b/) || [])[1] || 0)
    };
  }

  function academicYearTrailingYear(term) {
    const parts = termParts(term);
    if (!parts.year) return 0;
    return parts.season === 'SPRING' ? parts.year : parts.year + 1;
  }

  function targetTermFromFiscalYear(season, fiscalYear) {
    const normalizedSeason = canon(season);
    const year = normalizedSeason === 'SPRING' ? fiscalYear : fiscalYear - 1;
    return `${normalizedSeason} ${year}`;
  }

  return Object.freeze({
    termFromFilename,
    normalizeTermLabel,
    termSortValue,
    termParts,
    academicYearTrailingYear,
    academicYearLabel,
    targetTermFromFiscalYear
  });
});
