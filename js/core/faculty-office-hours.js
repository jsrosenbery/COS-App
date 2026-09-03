(function (root, factory) {
  const csv = root.COSCsvNormalizer || (typeof require === 'function' ? require('./csv-normalizer') : null);
  const facultyUtils = root.COSFacultyUtils || (typeof require === 'function' ? require('./faculty-utils') : null);
  const facultyParser = root.COSFacultyParser || (typeof require === 'function' ? require('./faculty-parser') : null);
  const api = factory(csv, facultyUtils, facultyParser);
  root.COSFacultyOfficeHours = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (csv, facultyUtils, facultyParser) {
  'use strict';

  if (!csv || !facultyUtils || !facultyParser) throw new Error('Faculty Office Hours requires CSV and faculty normalization utilities.');

  const fields = {
    faculty: ['FACULTY', 'Faculty', 'faculty'],
    days: ['DAYS', 'Days', 'days'],
    start: ['FROM_TIME', 'From Time', 'fromTime'],
    end: ['TO_TIME', 'To Time', 'toTime'],
    location: ['OFFICE_LOCATION', 'Office Location', 'officeLocation'],
    totalMinutes: ['TOTAL_MINUTES_WEEKLY', 'Total Minutes Weekly', 'totalMinutesWeekly'],
    startDate: ['FROM_DATE', 'From Date', 'fromDate'],
    endDate: ['TO_DATE', 'To Date', 'toDate'],
    phone: ['PHONE_NUMBER', 'Phone Number', 'phoneNumber'],
    division: ['DIVISION', 'Division', 'division'],
    facultyType: ['FACULTY_TYPE', 'Faculty Type', 'facultyType']
  };

  function field(row, key) {
    return csv.extractField(row, fields[key]);
  }

  function facultyIdentityKey(value) {
    const name = facultyUtils.normalizeFacultyName(value).toUpperCase();
    if (!name) return '';
    const parts = name.includes(',')
      ? name.split(',').map(item => item.trim())
      : name.split(/\s+/);
    const last = name.includes(',') ? parts[0] : parts[parts.length - 1];
    const given = name.includes(',') ? parts.slice(1).join(' ') : parts.slice(0, -1).join(' ');
    const first = (given.match(/[A-Z][A-Z'-]*/) || [''])[0];
    return [last.replace(/[^A-Z'-]/g, ''), first.replace(/[^A-Z'-]/g, '')].filter(Boolean).join('|');
  }

  function facultyType(value) {
    const text = csv.canon(value);
    if (/FULL[- ]?TIME/.test(text)) return 'FULL_TIME';
    if (/PART[- ]?TIME/.test(text)) return 'PART_TIME';
    return 'UNKNOWN';
  }

  function normalizeRow(row, options = {}) {
    const instructor = facultyUtils.normalizeFacultyName(field(row, 'faculty'));
    const days = facultyUtils.normalizeDays(field(row, 'days'));
    const start = facultyUtils.normalizeTime(field(row, 'start'));
    const end = facultyUtils.normalizeTime(field(row, 'end'));
    const location = String(field(row, 'location') || '').trim();
    return {
      raw: row,
      canonical: true,
      sourceType: 'FACULTY_OFFICE_HOURS',
      sourceTerm: csv.normalizeTermLabel(options.term || row?.__sourceTerm || ''),
      term: csv.normalizeTermLabel(options.term || row?.__sourceTerm || ''),
      instructor,
      facultyName: instructor,
      facultyIdentityKey: facultyIdentityKey(instructor),
      facultyType: facultyType(field(row, 'facultyType')),
      division: String(field(row, 'division') || '').trim(),
      divisionId: String(field(row, 'division') || '').trim(),
      days,
      dayPattern: facultyUtils.dayPattern(days, field(row, 'days')),
      start,
      end,
      startTime: start,
      endTime: end,
      startDate: field(row, 'startDate'),
      endDate: field(row, 'endDate'),
      officeLocation: location,
      building: location,
      room: location,
      roomOnly: location,
      phoneNumber: field(row, 'phone'),
      totalMinutesWeekly: csv.numberValue(field(row, 'totalMinutes'), 0),
      activityType: 'Office Hours',
      courseCode: 'Office Hours',
      subject: '',
      course: '',
      section: '',
      crn: ''
    };
  }

  function dedupeRows(rows) {
    const map = new Map();
    (rows || []).forEach(row => {
      const item = row?.sourceType === 'FACULTY_OFFICE_HOURS' ? row : normalizeRow(row);
      const key = [item.facultyIdentityKey, item.dayPattern, item.start, item.end, item.startDate, item.endDate, item.officeLocation]
        .map(value => csv.canon(value)).join('|');
      if (!map.has(key)) map.set(key, item);
    });
    return [...map.values()];
  }

  function parseCsv(text, options = {}) {
    const rawRows = facultyParser.parseFacultyScheduleCsvRows(text);
    const rows = rawRows.map(row => normalizeRow(row, options));
    return { rawRows, rows, meetings: dedupeRows(rows), rowCount: rawRows.length };
  }

  function hasFixedMeeting(row) {
    return Boolean(row?.instructor && row?.days?.length && row?.start && row?.end && row.start !== row.end);
  }

  return { fields, facultyIdentityKey, facultyType, normalizeRow, dedupeRows, parseCsv, hasFixedMeeting };
});
