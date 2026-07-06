(function (root, factory) {
  const csv = root.COSCsvNormalizer || (typeof require === 'function' ? require('./csv-normalizer') : null);
  const dayUtils = root.COSDayUtils || (typeof require === 'function' ? require('./day-utils') : null);
  const api = factory(csv, dayUtils);
  root.COSFacultyUtils = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (csv, dayUtils) {
  'use strict';

  if (!csv) throw new Error('COSCsvNormalizer is required before COSFacultyUtils.');

  const facultyFields = {
    facultyId: ['FACULTYID', 'Faculty ID', 'facultyId'],
    facultyName: ['FacultyName', 'Faculty Name', 'FACULTY_NAME', 'Instructor', 'INSTRUCTOR'],
    fcntCode: ['FCNT_CODE', 'FCNT CODE', 'Faculty Type Code'],
    divisionId: ['DIVISIONID', 'Division ID', 'DIVISION_ID'],
    departmentId: ['DEPARTMENTID', 'Department ID', 'DEPARTMENT_ID'],
    subjCourse: ['SUBJ_COURSE', 'Subject Course', 'SUBJ COURSE'],
    crn: ['CRN', 'Crn'],
    days: ['DAYS', 'Days'],
    startTime: ['STARTTIME', 'Start Time', 'START_TIME'],
    endTime: ['ENDTIME', 'End Time', 'END_TIME'],
    campus: ['CAMPUS', 'Campus'],
    building: ['BUILDING', 'Building'],
    room: ['ROOM', 'Room'],
    actualEnroll: ['ActualEnroll', 'Actual Enroll', 'ACTUAL_ENROLL'],
    maxEnroll: ['MaxEnroll', 'Max Enroll', 'MAX_ENROLL'],
    lhe: ['LHE'],
    insmCode: ['INSM_CODE_SSBSECT', 'INSM CODE SSBSECT', 'Instructional Method'],
    schdCode: ['SCHD_CODE_SSRMEET', 'SCHD CODE SSRMEET', 'Schedule Code'],
    xlist: ['XLIST', 'Cross List', 'CROSS_LIST'],
    courseTitle: ['COURSE', 'Course Title', 'TITLE'],
    startDate: ['StartDate', 'Start Date', 'START_DATE'],
    endDate: ['EndDate', 'End Date', 'END_DATE']
  };

  const dayOrder = dayUtils?.dayOrder || ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const dayLabels = dayUtils?.dayLabels || { SU: 'U', MO: 'M', TU: 'T', WE: 'W', TH: 'R', FR: 'F', SA: 'S' };
  const dayAliases = {
    U: 'SU',
    SU: 'SU',
    SUNDAY: 'SU',
    M: 'MO',
    MO: 'MO',
    MONDAY: 'MO',
    T: 'TU',
    TU: 'TU',
    TUESDAY: 'TU',
    W: 'WE',
    WE: 'WE',
    WEDNESDAY: 'WE',
    R: 'TH',
    TH: 'TH',
    THURSDAY: 'TH',
    F: 'FR',
    FR: 'FR',
    FRIDAY: 'FR',
    SA: 'SA',
    SATURDAY: 'SA'
  };

  function normalizeFacultyName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
  }

  function normalizeCode(value) {
    return csv.canon(value);
  }

  function numericCode(value) {
    const text = normalizeCode(value);
    if (/^\d+$/.test(text)) return String(Number(text));
    return text;
  }

  function facultyTypeFromFcnt(value) {
    const code = normalizeCode(value);
    if (code === 'JP') return 'PART_TIME';
    if (code === 'FT' || code === 'TE') return 'FULL_TIME';
    if (code === 'AE' || code === 'X') return 'OMIT';
    return 'UNKNOWN';
  }

  function meetingTypeFromSchd(value) {
    const code = numericCode(value);
    if (code === '2') return 'Lecture';
    if (code === '4') return 'Lab';
    if (code === 'XX') return 'Activity';
    return 'Other';
  }

  function normalizeTime(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    const match = text.match(/^(\d{1,2})(?::?(\d{2}))?\s*(AM|PM)?$/i);
    if (!match) return '';
    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    const meridian = (match[3] || '').toUpperCase();
    if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute > 59) return '';
    if (meridian === 'PM' && hour < 12) hour += 12;
    if (meridian === 'AM' && hour === 12) hour = 0;
    if (!meridian && hour === 24) hour = 0;
    if (hour > 23) return '';
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  function normalizeDays(value) {
    if (dayUtils?.normalizeDays) return dayUtils.normalizeDays(value);
    if (Array.isArray(value)) return normalizeDayCodes(value);
    const text = normalizeCode(value);
    if (!text || text === 'XX' || text === 'TBA') return [];
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

  function normalizeDayCodes(values) {
    if (dayUtils?.normalizeDayCodes) return dayUtils.normalizeDayCodes(values);
    const found = new Set();
    (values || []).forEach(value => {
      const code = dayAliases[normalizeCode(value)];
      if (code) found.add(code);
    });
    return dayOrder.filter(day => found.has(day));
  }

  function dayPattern(days, fallback = '') {
    if (dayUtils?.dayPattern) return dayUtils.dayPattern(days, fallback || '');
    const normalized = normalizeDays(days);
    if (normalized.length) return normalized.map(day => dayLabels[day]).join('');
    return normalizeCode(fallback);
  }

  function subjectCourseParts(value) {
    return csv.splitSubjectCourse(value);
  }

  return {
    facultyFields,
    dayOrder,
    dayLabels,
    normalizeFacultyName,
    normalizeCode,
    numericCode,
    facultyTypeFromFcnt,
    meetingTypeFromSchd,
    normalizeTime,
    normalizeDays,
    dayPattern,
    subjectCourseParts
  };
});
