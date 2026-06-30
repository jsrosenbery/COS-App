(function (root, factory) {
  const model = root.COSFacultyModel || (typeof require === 'function' ? require('./faculty-model') : null);
  const api = factory(model);
  root.COSFacultyParser = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (model) {
  'use strict';

  if (!model) throw new Error('COSFacultyModel is required before COSFacultyParser.');

  function parseFacultyScheduleCsv(text, options = {}) {
    const rawRows = parseFacultyScheduleCsvRows(text);
    const normalizedRows = model.normalizeFacultyScheduleRows(rawRows, options);
    const meetings = options.dedupe === false ? normalizedRows : model.dedupeFacultyMeetings(normalizedRows);
    return {
      rawRows,
      rows: normalizedRows,
      meetings,
      rowCount: rawRows.length,
      meetingCount: meetings.length
    };
  }

  function parseFacultyScheduleCsvRows(text) {
    const rows = parseCsvText(text);
    if (!rows.length) return [];
    const headers = rows[0].map(header => String(header || '').trim());
    return rows.slice(1)
      .filter(row => row.some(value => String(value || '').trim()))
      .map(row => headers.reduce((item, header, index) => {
        item[header] = row[index] ?? '';
        return item;
      }, {}));
  }

  function parseCsvText(text) {
    const input = String(text || '').replace(/^\uFEFF/, '');
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    for (let index = 0; index < input.length; index += 1) {
      const char = input[index];
      const next = input[index + 1];
      if (inQuotes) {
        if (char === '"' && next === '"') {
          field += '"';
          index += 1;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          field += char;
        }
        continue;
      }
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\r') {
        if (next === '\n') index += 1;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (char === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += char;
      }
    }
    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  return {
    parseFacultyScheduleCsv,
    parseFacultyScheduleCsvRows,
    parseCsvText
  };
});
