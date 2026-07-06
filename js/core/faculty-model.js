(function (root, factory) {
  const csv = root.COSCsvNormalizer || (typeof require === 'function' ? require('./csv-normalizer') : null);
  const utils = root.COSFacultyUtils || (typeof require === 'function' ? require('./faculty-utils') : null);
  const modality = root.COSModalityNormalizer || (typeof require === 'function' ? require('./modality-normalizer') : null);
  const api = factory(csv, utils, modality);
  root.COSFacultyModel = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (csv, utils, modalityNormalizer) {
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

  function reportableFacultyRows(rows) {
    return (rows || []).filter(row => row && row.facultyType !== 'OMIT');
  }

  function minutesFromTime(value) {
    const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function overlaps(start, end, slotStart, slotEnd) {
    return end > slotStart && start < slotEnd;
  }

  function defaultSlots(rows) {
    let min = 6 * 60;
    let max = 22 * 60;
    reportableFacultyRows(rows).forEach(row => {
      const start = minutesFromTime(row.startTime || row.start);
      const end = minutesFromTime(row.endTime || row.end);
      if (start != null && end != null && end > start) {
        min = Math.min(min, Math.floor(start / 30) * 30);
        max = Math.max(max, Math.ceil(end / 30) * 30);
      }
    });
    const slots = [];
    for (let minutes = min; minutes < max; minutes += 30) slots.push(minutes);
    return slots;
  }

  function buildFacultyHeatmapBuckets(rows, metricName = 'sections', slots = defaultSlots(rows)) {
    const dayKeys = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const map = new Map();
    dayKeys.forEach(day => slots.forEach(minutes => map.set(`${day}|${minutes}`, {
      day,
      minutes,
      sections: 0,
      facultyCount: 0,
      enrollment: 0,
      seats: 0,
      lhe: 0,
      faculty: new Set(),
      meetings: new Set()
    })));
    reportableFacultyRows(rows).forEach(row => {
      const start = minutesFromTime(row.startTime || row.start);
      const end = minutesFromTime(row.endTime || row.end);
      if (start == null || end == null || end <= start) return;
      const facultyKey = row.facultyId || row.facultyName || row.instructor || 'Unknown';
      (row.days || []).forEach(day => {
        slots.forEach(minutes => {
          if (!overlaps(start, end, minutes, minutes + 30)) return;
          const cell = map.get(`${day}|${minutes}`);
          if (!cell) return;
          const meetingKey = row.deduplicationKey || [row.crn, row.dayPattern, row.startTime || row.start, row.endTime || row.end, row.meetingType, facultyKey].join('|');
          if (cell.meetings.has(meetingKey)) return;
          cell.meetings.add(meetingKey);
          cell.sections += 1;
          cell.enrollment += row.actualEnroll || 0;
          cell.seats += row.maxEnroll || 0;
          cell.lhe += row.lhe || 0;
          cell.faculty.add(facultyKey);
          cell.facultyCount = cell.faculty.size;
        });
      });
    });
    return [...map.values()].map(cell => ({
      ...cell,
      metricValue: metricName === 'facultyCount' ? cell.facultyCount : cell[metricName] || 0
    }));
  }

  function buildFacultyModalityRows(rows) {
    const buckets = new Map();
    ['FULL_TIME', 'PART_TIME', 'UNKNOWN'].forEach(facultyType => {
      ['In-Person', 'Hybrid', 'Online'].forEach(modality => {
        buckets.set(`${facultyType}|${modality}`, {
          facultyType,
          modality,
          classOfferings: new Set(),
          instructionalMeetingRows: 0,
          enrollmentByOffering: new Map(),
          seatsByOffering: new Map(),
          lhe: 0
        });
      });
    });
    const modalityFor = row => {
      const category = modalityNormalizer?.normalize ? modalityNormalizer.normalize(row.insmCode || '', { INSM_CODE_SSBSECT: row.insmCode || '' }) : 'UNKNOWN';
      return modalityNormalizer?.displayLabel ? modalityNormalizer.displayLabel(category) : ({ 'IN PERSON': 'In-Person', HYBRID: 'Hybrid', ONLINE: 'Online' }[category] || 'Unknown');
    };
    const offeringKeyFor = row => {
      const crn = String(row?.crn || '').trim().toUpperCase();
      if (crn) return `${String(row?.sourceTerm || 'UNKNOWN').trim().toUpperCase() || 'UNKNOWN'}|${crn}`;
      return String(row?.deduplicationKey || [
        row?.sourceTerm || 'UNKNOWN',
        row?.courseCode || '',
        row?.facultyId || row?.facultyName || '',
        row?.startTime || row?.start || '',
        row?.endTime || row?.end || ''
      ].join('|')).trim().toUpperCase();
    };
    reportableFacultyRows(rows).forEach(row => {
      const key = `${row.facultyType}|${modalityFor(row)}`;
      const bucket = buckets.get(key);
      if (!bucket) return;
      const offeringKey = offeringKeyFor(row);
      bucket.classOfferings.add(offeringKey);
      bucket.instructionalMeetingRows += 1;
      bucket.enrollmentByOffering.set(offeringKey, Math.max(bucket.enrollmentByOffering.get(offeringKey) || 0, row.actualEnroll || 0));
      bucket.seatsByOffering.set(offeringKey, Math.max(bucket.seatsByOffering.get(offeringKey) || 0, row.maxEnroll || 0));
      bucket.lhe += row.lhe || 0;
    });
    return [...buckets.values()].map(bucket => ({
      facultyType: bucket.facultyType,
      modality: bucket.modality,
      classOfferings: bucket.classOfferings.size,
      sections: bucket.classOfferings.size,
      instructionalMeetingRows: bucket.instructionalMeetingRows,
      enrollment: [...bucket.enrollmentByOffering.values()].reduce((total, value) => total + value, 0),
      seats: [...bucket.seatsByOffering.values()].reduce((total, value) => total + value, 0),
      lhe: bucket.lhe
    }));
  }

  function buildPrimeTimeRows(rows, definition = {}) {
    const days = new Set(definition.days || ['MO', 'TU', 'WE', 'TH']);
    const startPrime = definition.start ?? 9 * 60;
    const endPrime = definition.end ?? 15 * 60;
    return reportableFacultyRows(rows).map(row => {
      const start = minutesFromTime(row.startTime || row.start);
      const end = minutesFromTime(row.endTime || row.end);
      const isPrimeTime = start != null && end != null && end > start &&
        (row.days || []).some(day => days.has(day)) &&
        overlaps(start, end, startPrime, endPrime);
      return { ...row, isPrimeTime };
    });
  }

  function buildBusyTimeFacultyBuckets(rows, slots = defaultSlots(rows)) {
    const dayKeys = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const map = new Map();
    dayKeys.forEach(day => slots.forEach(minutes => map.set(`${day}|${minutes}`, {
      day,
      minutes,
      fullTime: 0,
      partTime: 0,
      total: 0,
      seen: new Set()
    })));
    reportableFacultyRows(rows).forEach(row => {
      const start = minutesFromTime(row.startTime || row.start);
      const end = minutesFromTime(row.endTime || row.end);
      if (start == null || end == null || end <= start) return;
      (row.days || []).forEach(day => {
        slots.forEach(minutes => {
          if (!overlaps(start, end, minutes, minutes + 30)) return;
          const cell = map.get(`${day}|${minutes}`);
          if (!cell) return;
          const key = row.deduplicationKey || [row.crn, day, row.startTime || row.start, row.endTime || row.end, row.facultyId || row.facultyName].join('|');
          if (cell.seen.has(key)) return;
          cell.seen.add(key);
          cell.total += 1;
          if (row.facultyType === 'FULL_TIME') cell.fullTime += 1;
          if (row.facultyType === 'PART_TIME') cell.partTime += 1;
        });
      });
    });
    return [...map.values()];
  }

  function facultyCrnsByType(rows, facultyType) {
    return new Set(reportableFacultyRows(rows)
      .filter(row => !facultyType || row.facultyType === facultyType)
      .map(row => String(row.crn || '').trim().toUpperCase())
      .filter(Boolean));
  }

  return {
    normalizeFacultyScheduleRow,
    normalizeFacultyScheduleRows,
    facultyMeetingDeduplicationKey,
    dedupeFacultyMeetings,
    facultyMeetingsForReporting,
    reportableFacultyRows,
    buildFacultyHeatmapBuckets,
    buildFacultyModalityRows,
    buildPrimeTimeRows,
    buildBusyTimeFacultyBuckets,
    facultyCrnsByType
  };
});
