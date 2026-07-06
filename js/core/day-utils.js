(function (root, factory) {
  const api = factory();
  root.COSDayUtils = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const dayOrder = Object.freeze(['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']);
  const dayLabels = Object.freeze({ SU: 'U', MO: 'M', TU: 'T', WE: 'W', TH: 'R', FR: 'F', SA: 'S' });
  const dayNames = Object.freeze({
    SU: 'Sunday',
    MO: 'Monday',
    TU: 'Tuesday',
    WE: 'Wednesday',
    TH: 'Thursday',
    FR: 'Friday',
    SA: 'Saturday'
  });
  const dayAliases = Object.freeze({
    U: 'SU',
    SU: 'SU',
    SUN: 'SU',
    SUNDAY: 'SU',
    M: 'MO',
    MO: 'MO',
    MON: 'MO',
    MONDAY: 'MO',
    T: 'TU',
    TU: 'TU',
    TUE: 'TU',
    TUESDAY: 'TU',
    W: 'WE',
    WE: 'WE',
    WED: 'WE',
    WEDNESDAY: 'WE',
    R: 'TH',
    TH: 'TH',
    THU: 'TH',
    THURSDAY: 'TH',
    F: 'FR',
    FR: 'FR',
    FRI: 'FR',
    FRIDAY: 'FR',
    S: 'SA',
    SA: 'SA',
    SAT: 'SA',
    SATURDAY: 'SA'
  });

  function canon(value) {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  }

  function normalizeDayCodes(values) {
    const found = new Set();
    (values || []).forEach(value => {
      const code = dayAliases[canon(value)];
      if (code) found.add(code);
    });
    return dayOrder.filter(day => found.has(day));
  }

  function dayFlags(row = {}) {
    return [
      ['MONDAY', 'MO'],
      ['TUESDAY', 'TU'],
      ['WEDNESDAY', 'WE'],
      ['THURSDAY', 'TH'],
      ['FRIDAY', 'FR'],
      ['SATURDAY', 'SA'],
      ['SUNDAY', 'SU']
    ]
      .filter(([column]) => String(row[column] || '').trim())
      .map(([, code]) => code);
  }

  function normalizeDays(value, options = {}) {
    if (Array.isArray(value)) return normalizeDayCodes(value);
    if (Array.isArray(options.row?.Days) && options.row.Days.length) return normalizeDayCodes(options.row.Days);
    const flagged = dayFlags(options.row || {});
    if (flagged.length) return normalizeDayCodes(flagged);
    const text = canon(value);
    if (!text || /ONLINE|TBA/.test(text) || text === 'XX') return [];
    const longMatches = Object.keys(dayAliases)
      .filter(key => key.length > 2 && text.includes(key))
      .map(key => dayAliases[key]);
    if (longMatches.length) return normalizeDayCodes(longMatches);
    const tokens = text.split(/[,\s/]+/).filter(Boolean);
    if (tokens.length > 1) {
      const tokenDays = normalizeDayCodes(tokens);
      if (tokenDays.length) return tokenDays;
    }
    return normalizeDayCodes(text.replace(/TH/g, 'R').replace(/[^UMTWRFSA]/g, '').split(''));
  }

  function dayPattern(days, fallback = 'TBA') {
    const normalized = normalizeDays(days);
    if (normalized.length) return normalized.map(day => dayLabels[day]).join('');
    return canon(fallback);
  }

  function dayName(code) {
    return dayNames[canon(code)] || '';
  }

  return Object.freeze({
    dayOrder,
    dayLabels,
    dayNames,
    dayAliases,
    normalizeDayCodes,
    normalizeDays,
    dayPattern,
    dayName
  });
});
