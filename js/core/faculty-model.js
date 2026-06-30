(function (root, factory) {
  const csv = root.COSCsvNormalizer || (typeof require === 'function' ? require('./csv-normalizer') : null);
  const utils = root.COSFacultyUtils || (typeof require === 'function' ? require('./faculty-utils') : null);
  const api = factory(csv, utils);
  root.COSFacultyModel = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (csv, utils) {
  'use strict';

  if (!csv) throw new Error('COSCsvNormalizer is required before COSFacultyModel.');
  if (!utils) throw new Error('COSFacultyUtils is required before COSFacultyModel.');

  const { facultyFields } = utils;

  function field(row, key) {
    return csv.extractField(row, facultyFields[key]);
  }

  function normalizeFacultyScheduleRow(row, options = {}) {
    const subjCourseRaw = field(row, 'subjCourse');
    const parts = utils.subjectCourseParts(subjCourseRaw);
    const daysRaw = field(row, 'days');
    const days = utils.normalizeDays(daysRaw);
    const fcntCode = utils.normalizeCode(field(row, 'fcntCode'));
    const schdCode = utils.normalizeCode(field(row, 'schdCode'));
    const facultyName = utils.normalizeFacultyName(field(row, 'facultyName'));
    const startTime = utils.normalizeTime(field(row, 'startTime'));
    const endTime = utils.normalizeTime(field(row, 'endTime'));
    const normalized = {
      raw: row,
      canonical: true,
      facultyId: String(field(row, 'facultyId') || '').trim(),
      facultyName,
      instructor: facultyName,
      fcntCode,
      facultyType: utils.facultyTypeFromFcnt(fcntCode),
      divisionId: utils.normalizeCode(field(row, 'divisionId')),
      departmentId: utils.normalizeCode(field(row, 'departmentId')),
      subjCourse: utils.normalizeCode(subjCourseRaw),
      subject: parts.subject,
      course: parts.course,
      courseCode: [parts.subject, parts.course].filter(Boolean).join(' '),
      courseTitle: String(field(row, 'courseTitle') || '').trim(),
      crn: utils.normalizeCode(field(row, 'crn')),
      days,
      dayPattern: utils.dayPattern(days, daysRaw),
      startTime,
      endTime,
      start: startTime,
      end: endTime,
      campus: utils.normalizeCode(field(row, 'campus')),
      building: utils.normalizeCode(field(row, 'building')),
      room: utils.normalizeCode(field(row, 'room')),
      actualEnroll: csv.numberValue(field(row, 'actualEnroll')),
      maxEnroll: csv.numberValue(field(row, 'maxEnroll')),
      lhe: csv.numberValue(field(row, 'lhe')),
      insmCode: utils.normalizeCode(field(row, 'insmCode')),
      schdCode,
      schdCodeNormalized: utils.numericCode(schdCode),
      meetingType: utils.meetingTypeFromSchd(schdCode),
      xlist: utils.normalizeCode(field(row, 'xlist')),
      startDate: field(row, 'startDate'),
      endDate: field(row, 'endDate'),
      sourceTerm: options.term || row?.__sourceTerm || ''
    };
    normalized.deduplicationKey = facultyMeetingDeduplicationKey(normalized);
    return normalized;
  }

  function facultyMeetingDeduplicationKey(row) {
    const item = row?.canonical ? row : normalizeFacultyScheduleRow(row);
    const instructor = item.facultyId || item.facultyName || item.instructor || '';
    return [
      item.crn,
      item.startTime || item.start || '',
      item.endTime || item.end || '',
      item.dayPattern || '',
      item.schdCodeNormalized || utils.numericCode(item.schdCode || ''),
      instructor
    ].map(value => String(value || '').trim().toUpperCase()).join('|');
  }

  function dedupeFacultyMeetings(rows) {
    const map = new Map();
    (rows || []).forEach(row => {
      const item = row?.canonical ? row : normalizeFacultyScheduleRow(row);
      const key = item.deduplicationKey || facultyMeetingDeduplicationKey(item);
      if (!map.has(key)) map.set(key, item);
    });
    return [...map.values()];
  }

  function normalizeFacultyScheduleRows(rows, options = {}) {
    return (rows || []).map(row => normalizeFacultyScheduleRow(row, options));
  }

  function facultyMeetingsForReporting(rows, options = {}) {
    const normalized = normalizeFacultyScheduleRows(rows, options);
    return options.dedupe === false ? normalized : dedupeFacultyMeetings(normalized);
  }

  return {
    normalizeFacultyScheduleRow,
    normalizeFacultyScheduleRows,
    facultyMeetingDeduplicationKey,
    dedupeFacultyMeetings,
    facultyMeetingsForReporting
  };
});
