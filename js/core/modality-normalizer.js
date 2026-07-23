(function (root, factory) {
  const api = factory(root.COSCsvNormalizer || {});
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.COSModalityNormalizer = api;
})(typeof window !== 'undefined' ? window : globalThis, function (csv) {
  'use strict';
  csv = csv || {};

  const canon = csv.canon || (value => String(value || '').trim().toUpperCase());

  const KNOWN_CODES = {
    online: ['ONL', '71', '72', 'O1', 'OL', 'ONN', 'ONS', 'OO', 'OS', 'OSS', 'OT', 'OTS', 'ON', 'OSL'],
    inPerson: ['IP', '02', '22', '022', '02H', '02O', '02S', '02T', '02N', '04', '06', '07', '08', '09', '12', 'XX', 'YY'],
    hybrid: ['HYB', 'OH', 'OHF', 'FLX', 'OHS'],
    dualEnrollment: ['DE'],
    workExperience: ['20'],
    omitted: ['CPL', 'CBE', '98']
  };

  const GROUPS = {
    online: new Set(KNOWN_CODES.online),
    inPerson: new Set(KNOWN_CODES.inPerson),
    hybrid: new Set(KNOWN_CODES.hybrid),
    dualEnrollment: new Set(KNOWN_CODES.dualEnrollment),
    workExperience: new Set(KNOWN_CODES.workExperience),
    omitted: new Set(KNOWN_CODES.omitted)
  };

  const DISPLAY_LABELS = {
    'IN PERSON': 'In-Person',
    HYBRID: 'Hybrid',
    ONLINE: 'Online',
    'DUAL ENROLLMENT': 'Dual Enrollment',
    'WORK EXPERIENCE': 'Work Experience',
    UNKNOWN: 'Unknown',
    OMIT: 'Omitted'
  };

  function extractInstructionalCode(row = {}, fallback = '') {
    const extract = csv.extractField || ((source, names) => {
      for (const name of names) {
        if (source && source[name] != null && source[name] !== '') return source[name];
      }
      return '';
    });
    return canon(extract(row, [
      'INSTRUCTIONAL_METHOD_CODE',
      'Instructional Method Code',
      'INSM_CODE_SSBSECT',
      'Instructional Method',
      'Instruction Method',
      'Method',
      'Modality'
    ]) || fallback);
  }

  function normalize(value, row = {}) {
    const raw = canon(value || extractInstructionalCode(row));
    const code = extractInstructionalCode(row, raw);
    if (!raw && !code) return 'UNKNOWN';
    if (GROUPS.dualEnrollment.has(code) || /DUAL\s*ENROLL/.test(raw)) return 'DUAL ENROLLMENT';
    if (GROUPS.workExperience.has(code) || /WORK\s*EXP/.test(raw)) return 'WORK EXPERIENCE';
    if (GROUPS.omitted.has(code)) return 'OMIT';
    if (GROUPS.online.has(code)) return 'ONLINE';
    if (GROUPS.inPerson.has(code)) return 'IN PERSON';
    if (GROUPS.hybrid.has(code)) return 'HYBRID';
    if (/ONLINE|WEB|ASYNC|REMOTE|VIRTUAL|INTERNET|DISTANCE/.test(raw)) return 'ONLINE';
    if (/HYBRID|BLENDED|PARTIAL/.test(raw)) return 'HYBRID';
    if (/IN[ -]?PERSON|FACE[ -]?TO[ -]?FACE|ON[ -]?CAMPUS/.test(raw)) return 'IN PERSON';
    return 'UNKNOWN';
  }

  function displayLabel(category) {
    return DISPLAY_LABELS[canon(category)] || DISPLAY_LABELS.UNKNOWN;
  }

  function isReportable(category) {
    return ['IN PERSON', 'HYBRID', 'ONLINE', 'DUAL ENROLLMENT', 'WORK EXPERIENCE'].includes(canon(category));
  }

  function diagnosticRows(rows = [], getCode = row => row.instructionalMethod || row.insmCode || row.modality || '') {
    const map = new Map();
    rows.forEach(row => {
      const code = extractInstructionalCode(row.raw || row, getCode(row)) || 'BLANK';
      const category = normalize(code, row.raw || row);
      if (category !== 'UNKNOWN') return;
      if (!map.has(code)) {
        map.set(code, { originalInstructionalMethodCode: code, count: 0, currentMappedCategory: 'UNKNOWN', examples: [] });
      }
      const item = map.get(code);
      item.count += 1;
      if (item.examples.length < 5) {
        item.examples.push([row.crn, row.courseCode || [row.subject, row.course].filter(Boolean).join(' ')].filter(Boolean).join(' / '));
      }
    });
    return [...map.values()].map(row => ({
      ...row,
      exampleCrnsCourses: row.examples.filter(Boolean).join('; ')
    }));
  }

  return {
    KNOWN_CODES,
    GROUPS,
    normalize,
    displayLabel,
    isReportable,
    diagnosticRows,
    extractInstructionalCode
  };
});
