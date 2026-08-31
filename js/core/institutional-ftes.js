(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.COSInstitutionalFtes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const METHOD_FORMULAS = Object.freeze({
    W: record => divide(record.wsch, 30),
    IW: record => divide(record.wsch, 30),
    D: record => divide(record.dsch, 525),
    ID: record => divide(record.dsch, 525),
    P: record => divide(record.positiveHoursResident, 525),
    E: record => divide(record.positiveHoursResident, 525),
    O: () => 0
  });

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function number(value) {
    if (value == null || value === '') return null;
    const parsed = Number(String(value).replace(/[$,%\s,]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function divide(value, divisor) {
    const parsed = number(value);
    return parsed == null ? null : parsed / divisor;
  }

  function round2(value) {
    return value == null || !Number.isFinite(Number(value)) ? null : Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  function normalizeTerm(value) {
    return text(value).replace(/\s+/g, ' ').toUpperCase();
  }

  function normalizeCrn(value) {
    return text(value).replace(/\.0$/, '');
  }

  function normalizeHeader(value) {
    return text(value)
      .replace(/<br\s*\/?\s*>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;|\u00a0/gi, ' ')
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function findHeaderIndex(rows) {
    return rows.findIndex(row => {
      const cells = (row || []).map(normalizeHeader);
      return cells.includes('CRN') && cells.some(value => value === 'ACCT METHOD' || value === 'ACCOUNTING METHOD') && cells.some(value => value.includes('TOTAL FTES CENSUS'));
    });
  }

  function findTerm(rows, fallback = '') {
    for (const row of rows.slice(0, 20)) {
      for (const cell of row || []) {
        const match = text(cell).match(/\b(FALL|SPRING|SUMMER|WINTER)\s+20\d{2}\b/i);
        if (match) return normalizeTerm(match[0]);
      }
    }
    return normalizeTerm(fallback);
  }

  function parseWorksheetRows(rows, options = {}) {
    const headerIndex = findHeaderIndex(rows || []);
    const errors = [];
    const warnings = [];
    if (headerIndex < 0) return { valid: false, term: '', records: [], errors: ['Could not find the Full-Time Equivalent Student Analysis column header.'], warnings, audit: {} };
    const term = findTerm(rows, options.term);
    if (!term) errors.push('The institutional report term could not be identified.');
    const seen = new Set();
    const records = [];
    for (const row of (rows || []).slice(headerIndex + 1)) {
      const crn = normalizeCrn(row?.[2]);
      if (!/^\d+$/.test(crn)) continue;
      if (seen.has(crn)) {
        errors.push(`Duplicate CRN ${crn} appears in the institutional report.`);
        continue;
      }
      seen.add(crn);
      const record = {
        term,
        campus: text(row[0]), course: text(row[1]), crn,
        startDate: text(row[3]), endDate: text(row[4]), faculty: text(row[5]), status: text(row[6]),
        accountingMethod: text(row[7]).toUpperCase(), meetings: text(row[8]),
        dch: number(row[9]), wch: number(row[10]), positiveHoursResident: number(row[11]),
        censusEnrollment: number(row[12]), currentEnrollment: number(row[13]), reportableCensus: number(row[14]),
        totalContactHours: number(row[15]), dsch: number(row[16]), wsch: number(row[17]),
        censusFtes: number(row[18]), ftef: number(row[19]), lastDayFtes: number(row[20]),
        ftesDifference: number(row[21]), creditStatus: text(row[22]), instructionalMethod: text(row[23])
      };
      const formula = METHOD_FORMULAS[record.accountingMethod];
      const formulaFtes = formula ? round2(formula(record)) : null;
      record.formulaAuditFtes = formulaFtes;
      record.formulaVariance = formulaFtes == null || record.censusFtes == null ? null : round2(record.censusFtes - formulaFtes);
      if (record.censusFtes == null) warnings.push(`CRN ${crn} has no Total FTES Census value.`);
      records.push(record);
    }
    if (!records.length) errors.push('The institutional report contains no section-level CRN rows.');
    const reportedTotal = round2(records.reduce((sum, record) => sum + (record.censusFtes || 0), 0));
    const formulaMismatchCount = records.filter(record => record.formulaVariance != null && Math.abs(record.formulaVariance) > Number(options.tolerance ?? 0.02)).length;
    return {
      valid: errors.length === 0,
      term,
      records,
      errors,
      warnings,
      audit: { recordCount: records.length, censusFtesTotal: reportedTotal, formulaMismatchCount, headerRow: headerIndex + 1 }
    };
  }

  function recordKey(term, crn) {
    return `${normalizeTerm(term)}::${normalizeCrn(crn)}`;
  }

  function indexRecords(records) {
    return new Map((records || []).map(record => [recordKey(record.term, record.crn), record]));
  }

  function findRecord(index, row) {
    if (!index || !row) return null;
    const term = row.term || row.termCode || row.__sourceTerm || row.raw?.TERM || row.raw?.Term;
    const crn = row.crn || row.CRN || row.raw?.CRN;
    return index.get(recordKey(term, crn)) || null;
  }

  return Object.freeze({ parseWorksheetRows, indexRecords, findRecord, recordKey, round2, normalizeHeader });
});
