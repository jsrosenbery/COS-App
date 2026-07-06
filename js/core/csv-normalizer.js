(function (root, factory) {
  const termUtils = root.COSTermUtils || (typeof require === 'function' ? require('./term-utils') : null);
  const api = factory(termUtils);
  root.COSCsvNormalizer = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (termUtils) {
  'use strict';

  function normalizeHeaderKey(key) {
    return String(key || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  }

  function extractField(row, keys) {
    if (!row || typeof row !== 'object') return '';
    for (const key of keys || []) {
      const variants = [
        key,
        String(key).toLowerCase(),
        String(key).toUpperCase(),
        String(key).replace(/\s+/g, '_'),
        String(key).replace(/\s+/g, '_').toLowerCase(),
        String(key).replace(/\s+/g, '_').toUpperCase()
      ];
      for (const variant of variants) {
        const value = row[variant];
        if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
      }
    }
    const normalizedLookup = Object.entries(row).reduce((acc, [key, value]) => {
      const normalizedKey = normalizeHeaderKey(key);
      if (normalizedKey && acc[normalizedKey] === undefined) acc[normalizedKey] = value;
      return acc;
    }, {});
    for (const key of keys || []) {
      const value = normalizedLookup[normalizeHeaderKey(key)];
      if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
    }
    return '';
  }

  function canon(value) {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  }

  function numberValue(value, fallback = 0) {
    const text = String(value ?? '').replace(/[%,$]/g, '').trim();
    if (!text) return fallback;
    const parsed = Number(text);
    if (Number.isFinite(parsed)) return parsed;
    const leading = text.match(/-?\d+(?:\.\d+)?/);
    return leading ? Number(leading[0]) : fallback;
  }

  function nullableNumber(value) {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    const parsed = numberValue(value, NaN);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function normalizeCourseNumber(value) {
    const text = canon(value);
    const match = text.match(/^(\d{1,2})([A-Z]?)$/);
    return match ? `${match[1].padStart(3, '0')}${match[2]}` : text;
  }

  function splitSubjectCourse(value) {
    const text = canon(value);
    const match = text.match(/^([A-Z]+)\s*([A-Z]?\d{1,4}[A-Z]?)$/);
    return {
      subject: match ? match[1] : (text.match(/^([A-Z]+)/) || [])[1] || '',
      course: match ? normalizeCourseNumber(match[2]) : ''
    };
  }

  function normalizeTermLabel(value) {
    if (termUtils?.normalizeTermLabel) return termUtils.normalizeTermLabel(value);
    const text = String(value || '').trim();
    const match = text.match(/\b(SUMMER|FALL|SPRING|WINTER)\b\s*(20\d{2})/i) || text.match(/\b(20\d{2})\b.*\b(SUMMER|FALL|SPRING|WINTER)\b/i);
    if (!match) return text;
    const season = (match[1].match(/20\d{2}/) ? match[2] : match[1]).toUpperCase();
    const year = match[1].match(/20\d{2}/) ? match[1] : match[2];
    return `${season} ${year}`;
  }

  function normalizeCampus(value) {
    const raw = canon(value);
    const aliases = {
      VISALIA: 'VIS',
      VIS: 'VIS',
      COS: 'COS',
      TULARE: 'TUL',
      TUL: 'TUL',
      TCC: 'TCC',
      HANFORD: 'HAN',
      HAN: 'HAN',
      HAC: 'HAC',
      ONLINE: 'ONLINE',
      ONL: 'ONLINE',
      DISTANCE: 'ONLINE',
      'DISTANCE EDUCATION': 'ONLINE'
    };
    return aliases[raw] || raw;
  }

  const fields = {
    term: ['Term', 'TERM', 'term'],
    crn: ['CRN', 'Crn', 'crn', 'Course Reference Number', 'COURSE_REF_NUMBER', 'CRN_KEY'],
    subject: ['Subject', 'SUBJECT', 'Discipline', 'DISCIPLINE'],
    course: ['Course', 'COURSE', 'Course_Number', 'Course Number', 'Course No', 'Catalog', 'CATALOG'],
    subjectCourse: ['Subject_Course', 'Subject Course', 'Course ID', 'SUBJECT/COURSE'],
    title: ['Course Title', 'COURSE_TITLE', 'Title', 'TITLE', 'Long Title', 'Course_Name', 'Course Name'],
    division: ['Division', 'DIVISION', 'Division Name', 'DIVISION_NAME', 'Academic Division', 'Department Division', 'School', 'Area'],
    department: ['Department', 'DEPARTMENT', 'Dept', 'DEPT', 'Department Name', 'DEPARTMENT_NAME'],
    section: ['Section', 'SECTION', 'Sec', 'SEC', 'SECTION_NUMB', 'Section Number'],
    campus: ['Campus', 'CAMPUS', 'Campus Code', 'CAMPUS CODE', 'Campus_Code', 'CAMPUS_CODE'],
    instructionalMethod: ['INSTRUCTIONAL_METHOD_CODE', 'Instructional Method Code', 'Instructional Method', 'Instructional_Method', 'Instr Method', 'Instruction Method', 'Method', 'Modality', 'INSTRUCTION_METHOD_DESC', 'Instruction Method Desc', 'Schedule Type'],
    instructor: ['Instructor', 'INSTRUCTOR', 'Faculty', 'FACULTY', 'Primary Instructor'],
    days: ['DAYS', 'Days', 'Meeting Days', 'Meet Days', 'Day', 'Days Of Week', 'Mtg Days', 'Meeting Pattern', 'Meeting_Pattern', 'dayPattern', 'Day Pattern'],
    time: ['Time', 'TIME', 'Meeting Time', 'Meet Time', 'Mtg Time', 'Time Range', 'Times'],
    start: ['Start_Time', 'START_TIME', 'Start Time', 'START TIME', 'Begin Time', 'BEGIN TIME', 'Begin_Time', 'Class Begin Time', 'Meeting Start', 'Mtg Start', 'Start'],
    end: ['End_Time', 'END_TIME', 'End Time', 'END TIME', 'Stop Time', 'STOP TIME', 'Stop_Time', 'Class End Time', 'Meeting End', 'Mtg End', 'End'],
    startDate: ['Start_Date', 'START_DATE', 'Start Date', 'START DATE', 'Class Start Date', 'CLASS START DATE', 'Begin Date', 'BEGIN DATE', 'Section Start Date'],
    endDate: ['End_Date', 'END_DATE', 'End Date', 'END DATE', 'Class End Date', 'CLASS END DATE', 'Stop Date', 'STOP DATE', 'Section End Date'],
    building: ['BUILDING', 'Building', 'building', 'Bldg', 'Bldg Code', 'Building Code', 'Facility Building'],
    room: ['ROOM', 'Room', 'roomOnly', 'room', 'Room Number', 'Room No', 'Facility Room'],
    cap: ['cap', 'Capacity', 'CAPACITY', 'Seats', 'SEATS', 'Max Enrollment', 'Maximum Enrollment', 'MAX ENROLL'],
    actual: ['actual', 'Actual_Enroll', 'ACTUAL_ENROLL', 'Actual Enroll', 'Enrollment', 'Enroll', 'ENROLLED', 'Current Enrollment', 'Current_Enrollment'],
    census: ['census', 'Census_Enroll', 'CENSUS_ENROLL', 'Census Enroll', 'Census Enrollment'],
    census2: ['census2', 'Census 2', 'Census_2', 'CENSUS_2', 'CENSUS_ENROLL2', 'Census Enroll 2', 'Census Enrollment 2'],
    finalEnrollment: ['finalEnrollment', 'Final Enrollment', 'FINAL_ENROLLMENT', 'End Enrollment', 'END_ENROLLMENT'],
    waitlist: ['Waitlist', 'WAITLIST', 'Waitlist Count', 'WAITLIST_COUNT', 'WAIT COUNT', 'WAIT_COUNT', 'WL Count', 'WAITLISTED'],
    accountingMethod: ['ACCOUNTING METHOD', 'Accounting Method', 'ACCOUNTING_METHOD'],
    crossList: ['CROSS_LIST', 'Cross List', 'Cross_List', 'Cross Listed', 'Cross-Listed', 'XLIST', 'X_LIST']
  };

  function normalizeCsvRow(row, options = {}) {
    const subjectCourse = extractField(row, fields.subjectCourse);
    const directCourse = extractField(row, fields.course);
    const split = splitSubjectCourse(subjectCourse || (/^[A-Za-z]+\s+/.test(directCourse) ? directCourse : ''));
    const subject = canon(extractField(row, fields.subject) || split.subject || (directCourse.match(/^([A-Z]+)/i) || [])[1]);
    const course = normalizeCourseNumber(split.course || directCourse.replace(/^([A-Z]+)\s+/i, '') || extractField(row, fields.course));
    const census2Raw = nullableNumber(extractField(row, fields.census2));
    return {
      raw: row,
      term: normalizeTermLabel(extractField(row, fields.term) || options.term || row?.__sourceTerm || ''),
      crn: canon(extractField(row, fields.crn)),
      subject,
      course,
      courseCode: [subject, course].filter(Boolean).join(' '),
      title: canon(extractField(row, fields.title)),
      division: canon(extractField(row, fields.division)),
      department: canon(extractField(row, fields.department)),
      section: canon(extractField(row, fields.section)),
      campus: normalizeCampus(extractField(row, fields.campus)),
      instructionalMethod: canon(extractField(row, fields.instructionalMethod)),
      instructor: canon(extractField(row, fields.instructor)),
      building: canon(extractField(row, fields.building)),
      roomOnly: canon(extractField(row, fields.room)),
      cap: numberValue(extractField(row, fields.cap)),
      actual: numberValue(extractField(row, fields.actual)),
      census: nullableNumber(extractField(row, fields.census)),
      census2: census2Raw != null && census2Raw < 0 ? null : census2Raw,
      invalidNegativeCensus2: census2Raw != null && census2Raw < 0,
      finalEnrollment: nullableNumber(extractField(row, fields.finalEnrollment)),
      waitlist: numberValue(extractField(row, fields.waitlist)),
      accountingMethod: canon(extractField(row, fields.accountingMethod)),
      crossList: canon(extractField(row, fields.crossList)),
      startDate: extractField(row, fields.startDate),
      endDate: extractField(row, fields.endDate)
    };
  }

  function normalizeCsvRows(rows, options = {}) {
    return (rows || []).map(row => normalizeCsvRow(row, options));
  }

  return {
    fields,
    normalizeHeaderKey,
    extractField,
    canon,
    numberValue,
    nullableNumber,
    normalizeCourseNumber,
    splitSubjectCourse,
    normalizeTermLabel,
    normalizeCampus,
    normalizeCsvRow,
    normalizeCsvRows
  };
});
