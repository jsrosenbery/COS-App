(function (root, factory) {
  const api = factory(root.COSTermUtils);
  root.COSFeasibilityTermWindow = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (termUtils) {
  'use strict';

  termUtils = termUtils || {};
  const normalizeTermLabel = termUtils.normalizeTermLabel || function (term) {
    const text = String(term || '').trim().toUpperCase().replace(/\s+/g, ' ');
    const year = (text.match(/\b(20\d{2})\b/) || [])[1];
    const season = (text.match(/\b(FALL|SPRING|SUMMER|WINTER)\b/) || [])[1];
    return year && season ? `${season} ${year}` : text;
  };
  const termParts = termUtils.termParts || function (term) {
    const text = normalizeTermLabel(term);
    return { season: (text.match(/FALL|SPRING|SUMMER|WINTER/) || [''])[0], year: Number((text.match(/\b(20\d{2})\b/) || [])[1] || 0) };
  };

  const SEASON_SEQUENCE = ['SPRING', 'SUMMER', 'FALL'];
  const PRIMARY_SEQUENCE = ['SPRING', 'FALL'];

  function previousTerm(term, includeSummer = true) {
    const parts = termParts(term);
    const sequence = includeSummer ? SEASON_SEQUENCE : PRIMARY_SEQUENCE;
    const index = sequence.indexOf(parts.season);
    if (!parts.year || index < 0) return '';
    if (index > 0) return `${sequence[index - 1]} ${parts.year}`;
    return `${sequence[sequence.length - 1]} ${parts.year - 1}`;
  }

  function termSequenceEnding(selectedTerm, count, includeSummer = true) {
    const terms = [];
    let cursor = normalizeTermLabel(selectedTerm);
    while (cursor && terms.length < count) {
      terms.unshift(cursor);
      cursor = previousTerm(cursor, includeSummer);
    }
    return terms;
  }

  function collectRowTerms(rows = []) {
    return [...new Set((rows || []).map(row => normalizeTermLabel(row.term || row.Term)).filter(Boolean))];
  }

  function determineFeasibilityTermWindow(selectedTerm, availableTermsOrRows = []) {
    const selected = normalizeTermLabel(selectedTerm);
    const availableTerms = new Set(
      (availableTermsOrRows || []).map(item => typeof item === 'string' ? normalizeTermLabel(item) : normalizeTermLabel(item.term || item.Term)).filter(Boolean)
    );
    const standardTerms = termSequenceEnding(selected, 4, false);
    const fullTerms = termSequenceEnding(selected, 6, true);
    const requiredTerms = [...new Set([...standardTerms, ...fullTerms])];
    return {
      selectedTerm: selected,
      standardTerms,
      fullTerms,
      termsAvailableInRepository: requiredTerms.filter(term => availableTerms.has(term)),
      missingTerms: requiredTerms.filter(term => !availableTerms.has(term))
    };
  }

  return Object.freeze({
    previousTerm,
    termSequenceEnding,
    collectRowTerms,
    determineFeasibilityTermWindow
  });
});
