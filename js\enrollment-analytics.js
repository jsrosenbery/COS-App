(function () {
  'use strict';

  const REPORTS = {
    dashboard: 'enrollment-dashboard',
    attrition: 'enrollment-attrition',
    consolidation: 'section-consolidation',
    demand: 'enrollment-demand-forecast',
    utilization: 'room-utilization',
    studentPresence: 'student-presence-analytics',
    instructorAvailability: 'instructor-availability'
  };
  const ACCOUNTING_METHODS = {
    W: { category: 'weekly', label: 'Weekly Census', reportable: true },
    D: { category: 'daily', label: 'Daily Census', reportable: true },
    P: { category: 'positive', label: 'Positive Attendance', reportable: true },
    E: { category: 'positive', label: 'Open Entry/Open Exit - Positive Attendance', reportable: true },
    IW: { category: 'independentWeekly', label: 'Independent/Alternative Weekly Census', reportable: true },
    ID: { category: 'independentDaily', label: 'Independent/Alternative Daily Census', reportable: true },
    I: { category: 'omit', label: 'Independent Study/Work Experience - omitted from reporting', reportable: false },
    O: { category: 'omit', label: 'Not reportable for 320 - omitted from reporting', reportable: false }
  };
  const state = {
    enrollment: [],
    consolidationInput: [],
    consolidationRows: [],
    demandInput: [],
    demandRows: [],
    dashboardRows: [],
    rotationRows: [],
    dashboardRan: false,
    studentPresenceRows: [],
    studentPresenceRan: false,
    attritionRows: [],
    attritionRan: false,
    attritionTerms: [],
    consolidationRan: false,
    consolidationTerms: [],
    demandRan: false,
    demandTerms: [],
    archivedAnalyticsTerms: []
  };
  const analyticsChoices = new Map();
  const metrics = window.COSEnrollmentMetrics;
  const filterUtils = window.COSEnrollmentFilters;
  const consolidation = window.COSConsolidationAnalytics;
  const dashboard = window.COSEnrollmentDashboard;
  if (!metrics || !filterUtils || !consolidation || !dashboard) {
    throw new Error('Enrollment analytics modules must load before js/enrollment-analytics.js');
  }
  const {
    censusEnrollment,
    finalEnrollment,
    expectedEnrollment,
    expectedFillRate,
    expectedOpenSeats
  } = metrics;
  const {
    isOnlineSection,
    enrollmentForBasis,
    isLowEnrollmentSection,
    historicalDemandMap,
    withHistoricalEstimate,
    consolidationGroupRows,
    onlineReductionRows
  } = consolidation;
  installScheduleHistoryFetchShim();
  const dayLabels = {
    MO: 'M',
    TU: 'T',
    WE: 'W',
    TH: 'R',
    FR: 'F',
    SA: 'S',
    SU: 'U',
    TBA: 'TBA'
  };
  const dayOrder = Object.keys(dayLabels);
  const modalityGroups = {
    online: new Set(['ONL', '71', '72', 'O1', 'OL', 'ONN', 'ONS', 'OO', 'OS', 'OSS', 'OT', 'OTS', 'ON', 'OSL']),
    inPerson: new Set(['IP', '02', '22', '022', '02H', '02O', '02S', '02T', '02N', '04', '06', '07', '08', '09', '12', 'XX', 'YY']),
    hybrid: new Set(['HYB', 'OH', 'OHF', 'FLX', 'OHS']),
    omitted: new Set(['CPL', 'DE', 'CBE', '98'])
  };

  const fields = {
    term: ['Term', 'TERM', 'term'],
    crn: ['CRN', 'Crn', 'crn', 'Course Reference Number', 'COURSE REFERENCE NUMBER', 'Course Ref Number', 'COURSE_REF_NUMBER', 'CRN_KEY'],
    subject: ['Subject', 'SUBJECT', 'Discipline', 'DISCIPLINE'],
    course: ['Course', 'COURSE', 'Course_Number', 'Course Number', 'Course No', 'Catalog', 'CATALOG'],
    title: ['Course Title', 'COURSE_TITLE', 'Title', 'TITLE', 'Long Title', 'Course_Name', 'Course Name'],
    division: ['Division', 'DIVISION', 'Division Name', 'DIVISION_NAME'],
    department: ['Department', 'DEPARTMENT', 'Dept', 'DEPT', 'Department Name', 'DEPARTMENT_NAME'],
    section: ['Section', 'SECTION', 'Sec', 'SEC', 'SECTION_NUMB', 'Section Number'],
    campus: ['Campus', 'CAMPUS', 'Campus Code', 'CAMPUS_CODE', 'Location', 'LOCATION'],
    modality: ['Modality', 'MODALITY', 'Instructional Method', 'INSTRUCTIONAL METHOD', 'Instruction_Mode', 'Instruction Mode', 'Method', 'INSTRUCTIONAL_METHOD_CODE', 'INSTRUCTION_METHOD_DESC'],
    instructor: ['Instructor', 'INSTRUCTOR', 'Faculty', 'FACULTY', 'FACULTY'],
    days: ['Days', 'DAYS', 'Meeting Days', 'Meet Days', 'Day', 'Days Of Week', 'Mtg Days', 'Meeting Pattern', 'Meeting_Pattern'],
    time: ['Time', 'TIME', 'Meeting Time', 'Meet Time', 'Mtg Time', 'Time Range', 'Times'],
    start: ['Start_Time', 'START_TIME', 'Start Time', 'START TIME', 'Begin Time', 'BEGIN TIME', 'Begin_Time', 'BEGIN_TIME', 'Class Begin Time', 'Meeting Start', 'Mtg Start', 'Start'],
    end: ['End_Time', 'END_TIME', 'End Time', 'END TIME', 'Stop Time', 'STOP TIME', 'Stop_Time', 'STOP_TIME', 'Class End Time', 'Meeting End', 'Mtg End', 'End'],
    room: ['Room', 'ROOM'],
    building: ['Building', 'BUILDING'],
    cap: ['Capacity', 'CAPACITY', 'Seats', 'SEATS', 'Max Enrollment', 'Maximum Enrollment', 'MAX ENROLL'],
    units: ['Units', 'UNITS', 'Credit Hours', 'CREDIT_HOURS', 'Credits', 'CREDITS', 'SESSION_CREDIT_HOURS', 'Session Credit Hours'],
    weeklyHours: ['HOURS_PER_WEEK', 'Hours Per Week', 'Weekly Hours', 'WSCH'],
    dailyHours: ['HOURS_PER_DAY', 'Hours Per Day', 'Daily Hours'],
    totalContactHours: ['TOTAL_CONTACT_HOURS', 'Total Contact Hours', 'Contact Hours'],
    accountingMethod: ['ACCOUNTING METHOD', 'Accounting Method', 'ACCOUNTING_METHOD'],
    ftes: ['FTES', 'Ftes', 'Full Time Equivalent Students', 'Full-Time Equivalent Students'],
    actual: ['Actual_Enroll', 'ACTUAL_ENROLL', 'Actual Enroll', 'Enrollment', 'Enroll', 'ENROLLED', 'Current Enrollment'],
    census: ['Census_Enroll', 'CENSUS_ENROLL', 'Census Enroll', 'Census Enrollment'],
    firstDay: ['First Day Enrollment', 'First_Day_Enrollment', 'FIRST_DAY_ENROLLMENT', 'First Day'],
    census1: ['Census 1', 'Census_1', 'CENSUS_1'],
    census2: ['Census 2', 'Census_2', 'CENSUS_2'],
    finalEnrollment: ['Final Enrollment', 'FINAL_ENROLLMENT', 'End Enrollment', 'END_ENROLLMENT'],
    waitlist: ['Waitlist', 'WAITLIST', 'Waitlist Count', 'WAITLIST_COUNT', 'WAIT COUNT', 'WAIT_COUNT', 'WL Count', 'WAITLISTED'],
    fill: ['Fill_Rate', 'Fill Rate', 'Percent Full', '% Full'],
    closed: ['Closed Prior to Census', 'CLOSED_PRIOR_TO_CENSUS', 'Closed Before Census', 'Closed', 'CLOSED'],
    status: ['Status', 'STATUS', 'Section Status']
  };

  function val(row, names) {
    for (const name of names) {
      if (row && row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== '') return String(row[name]).trim();
    }
    return '';
  }

  function num(value) {
    const text = String(value || '').replace(/[%,$]/g, '').trim();
    const parsed = Number(text);
    if (Number.isFinite(parsed)) return parsed;
    const leading = text.match(/-?\d+(?:\.\d+)?/);
    if (leading) return Number(leading[0]);
    return 0;
  }

  function strictNum(value) {
    const parsed = Number(String(value || '').replace(/[%,$]/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function pct(value) {
    return `${Math.round((value || 0) * 1000) / 10}%`;
  }

  function round1(value) {
    return Math.round((value || 0) * 10) / 10;
  }

  function canon(value) {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  }

  function roomCatalogBuildingCampusMap() {
    if (roomCatalogBuildingCampusMap.cache) return roomCatalogBuildingCampusMap.cache;
    const map = new Map();
    const catalog = Array.isArray(window.ROOM_CATALOG) ? window.ROOM_CATALOG : [];
    catalog.forEach(room => {
      const building = canon(room?.building || room?.Building);
      const campus = canon(room?.campus || room?.Campus);
      if (building && campus && !map.has(building)) map.set(building, campus);
    });
    roomCatalogBuildingCampusMap.cache = map;
    return map;
  }

  function campusForBuilding(building) {
    return roomCatalogBuildingCampusMap().get(canon(building)) || '';
  }

  function normalizeCampusAndBuilding(row) {
    const rawBuilding = canon(val(row, fields.building));
    const rawCampus = canon(val(row, fields.campus));
    const campusValueAsBuilding = campusForBuilding(rawCampus);
    let building = rawBuilding || (campusValueAsBuilding ? rawCampus : '');
    let campus = rawCampus;

    if (campusValueAsBuilding) {
      campus = campusValueAsBuilding;
    } else if (!campus) {
      campus = campusForBuilding(building);
    }

    return { campus, building };
  }

  function installScheduleHistoryFetchShim() {
    window.BACKEND_BASE_URL = window.BACKEND_BASE_URL || window.COS_APP_CONFIG?.backendBaseUrl || 'https://app-backend-pp98.onrender.com';
    if (window.__cosAnalyticsTermsShim || typeof window.fetch !== 'function') return;
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url === `${window.BACKEND_BASE_URL}/terms`) {
        const terms = Array.from(document.querySelectorAll('#term-tabs .tab'))
          .map(tab => tab.textContent.trim())
          .filter(Boolean);
        return Promise.resolve(new Response(JSON.stringify(terms), {
          headers: { 'Content-Type': 'application/json' }
        }));
      }
      if (url.startsWith(`${window.BACKEND_BASE_URL}/schedule/`)) {
        const term = url.slice(`${window.BACKEND_BASE_URL}/schedule/`.length);
        return nativeFetch(`${window.BACKEND_BASE_URL}/api/schedule/${term}`, init)
          .then(response => response.json())
          .then(payload => new Response(JSON.stringify(Array.isArray(payload) ? payload : payload.data || []), {
            headers: { 'Content-Type': 'application/json' }
          }));
      }
      return nativeFetch(input, init);
    };
    window.__cosAnalyticsTermsShim = true;
  }

  function courseNumber(row) {
    const direct = val(row, fields.course);
    if (direct) return canon(direct).replace(/^([A-Z]+)\s+/, '');
    const combined = val(row, ['Subject_Course', 'Subject Course', 'Course ID', 'SUBJECT/COURSE']);
    return canon((combined.match(/[A-Z]+\s*([A-Z]?\d{1,4}[A-Z]?)/) || [])[1] || combined);
  }

  function normalize(row) {
    const subjectCourse = val(row, ['Subject_Course', 'Subject Course', 'Course ID', 'SUBJECT/COURSE']);
    const subject = canon(val(row, fields.subject) || (subjectCourse.match(/^([A-Z]+)/i) || [])[1]);
    const course = courseNumber(row);
    const normalizedLocation = normalizeCampusAndBuilding(row);
    const building = normalizedLocation.building;
    const roomOnly = canon(val(row, fields.room));
    const campus = normalizedLocation.campus;
    const modality = normalizeModality(val(row, fields.modality), row);
    const days = normalizeDays(val(row, fields.days), row);
    const times = normalizeTimes(row);
    const cap = num(val(row, fields.cap));
    const actual = num(val(row, fields.actual));
    const censusValue = val(row, fields.census);
    const census = censusValue === '' ? null : num(censusValue);
    const firstDayValue = val(row, fields.firstDay);
    const census1Value = val(row, fields.census1);
    const census2Value = val(row, fields.census2);
    const finalEnrollmentValue = val(row, fields.finalEnrollment);
    const waitlistValue = val(row, fields.waitlist);
    const units = num(val(row, fields.units));
    const weeklyHours = num(val(row, fields.weeklyHours));
    const dailyHours = num(val(row, fields.dailyHours));
    const totalContactHours = num(val(row, fields.totalContactHours));
    const accountingMethod = canon(val(row, fields.accountingMethod));
    const ftesValue = val(row, fields.ftes);
    const enrollmentForFtes = census == null ? actual : census;
    const enrollmentForPlanning = census == null ? actual : census;
    const normalized = {
      raw: row,
      term: canon(val(row, fields.term) || row.__sourceTerm || currentTerm()),
      crn: canon(val(row, fields.crn)),
      subject,
      course,
      title: canon(val(row, fields.title)),
      division: canon(val(row, fields.division)),
      department: canon(val(row, fields.department)),
      section: canon(val(row, fields.section)),
      campus,
      modality,
      instructor: canon(val(row, fields.instructor)),
      days,
      dayPattern: dayPattern(days),
      start: times.start,
      end: times.end,
      timeBlock: timeBlock(times.start, modality),
      building,
      roomOnly,
      room: canon([building, roomOnly].filter(Boolean).join(' ')),
      cap,
      units,
      weeklyHours,
      dailyHours,
      totalContactHours,
      accountingMethod,
      accountingCategory: accountingMethodInfo(accountingMethod).category,
      accountingMethodLabel: accountingMethodInfo(accountingMethod).label,
      accountingReportable: accountingMethodInfo(accountingMethod).reportable,
      ftes: ftesValue === '' ? estimatedFtes(enrollmentForFtes, { units, weeklyHours, dailyHours, totalContactHours, accountingMethod }) : num(ftesValue),
      hasFtesData: ftesValue !== '' || units > 0 || weeklyHours > 0 || totalContactHours > 0,
      hasDirectFtesData: ftesValue !== '',
      actual,
      census,
      firstDay: firstDayValue === '' ? null : num(firstDayValue),
      census1: census1Value === '' ? null : num(census1Value),
      census2: census2Value === '' ? null : num(census2Value),
      finalEnrollment: finalEnrollmentValue === '' ? null : num(finalEnrollmentValue),
      waitlist: num(waitlistValue),
      hasWaitlistData: waitlistValue !== '',
      closedPriorCensus: isTruthy(val(row, fields.closed)),
      fillRate: cap > 0 ? enrollmentForPlanning / cap : strictNum(val(row, fields.fill)) / 100,
      status: canon(val(row, fields.status))
    };
    normalized._meetingRows = [meetingRowForFtes(normalized)];
    return normalized;
  }

  function isTruthy(value) {
    return /^(Y|YES|TRUE|1|CLOSED)$/i.test(String(value || '').trim());
  }

  function accountingMethodInfo(method) {
    return ACCOUNTING_METHODS[canon(method)] || { category: 'unknown', label: canon(method) || 'Unknown', reportable: true };
  }

  function meetingRowForFtes(row) {
    return {
      weeklyHours: row.weeklyHours || 0,
      dailyHours: row.dailyHours || 0,
      totalContactHours: row.totalContactHours || 0,
      sessionCreditHours: row.units || 0,
      accountingMethod: row.accountingMethod || ''
    };
  }

  function bestFtesHours(rows = []) {
    const sourceRows = rows.length ? rows : [];
    const creditRows = sourceRows.filter(row => row.sessionCreditHours > 0);
    const candidates = creditRows.length ? creditRows : sourceRows;
    return {
      weeklyHours: Math.max(0, ...candidates.map(row => row.weeklyHours || 0)),
      dailyHours: Math.max(0, ...candidates.map(row => row.dailyHours || 0)),
      totalContactHours: Math.max(0, ...candidates.map(row => row.totalContactHours || 0)),
      sessionCreditHours: Math.max(0, ...candidates.map(row => row.sessionCreditHours || 0))
    };
  }

  function estimatedFtes(enrollment, details = {}) {
    const info = accountingMethodInfo(details.accountingMethod);
    if (!info.reportable) return 0;
    const weeklyHours = details.weeklyHours || 0;
    const totalContactHours = details.totalContactHours || 0;
    const units = details.units || details.sessionCreditHours || 0;
    if (['weekly', 'independentWeekly', 'unknown'].includes(info.category) && weeklyHours > 0) {
      return (enrollment * weeklyHours * 17.5) / 525;
    }
    if (['daily', 'independentDaily'].includes(info.category) && totalContactHours > 0) {
      return (enrollment * totalContactHours) / 525;
    }
    if (info.category === 'positive' && totalContactHours > 0) {
      return (enrollment * totalContactHours) / 525;
    }
    if (units > 0) return (enrollment * units) / 30;
    return 0;
  }

  function recalculateEstimatedFtes(row) {
    if (!row || row.hasDirectFtesData) return row;
    const hours = bestFtesHours(row._meetingRows || []);
    row.weeklyHours = hours.weeklyHours || row.weeklyHours || 0;
    row.dailyHours = hours.dailyHours || row.dailyHours || 0;
    row.totalContactHours = hours.totalContactHours || row.totalContactHours || 0;
    row.units = row.units || hours.sessionCreditHours || 0;
    row.ftes = estimatedFtes(row.census == null ? row.actual : row.census, {
      units: row.units,
      weeklyHours: row.weeklyHours,
      dailyHours: row.dailyHours,
      totalContactHours: row.totalContactHours,
      accountingMethod: row.accountingMethod
    });
    row.hasFtesData = row.hasFtesData || row.weeklyHours > 0 || row.totalContactHours > 0 || row.units > 0;
    return row;
  }

  function normalizeModality(text, row) {
    const raw = canon(text);
    const code = canon(val(row, ['INSTRUCTIONAL_METHOD_CODE', 'Instructional Method Code', 'Method Code']) || text);
    if (modalityGroups.omitted.has(code) || /DUAL\s*ENROLL/.test(raw)) return 'OMIT';
    if (modalityGroups.online.has(code)) return 'ONLINE';
    if (modalityGroups.inPerson.has(code)) return 'IN PERSON';
    if (modalityGroups.hybrid.has(code)) return 'HYBRID';
    if (/ONLINE|WEB|ASYNC/.test(raw)) return 'ONLINE';
    if (/HYBRID|PARTIAL/.test(raw)) return 'HYBRID';
    if (/TBA/.test(raw)) return 'TBA';
    return raw || 'IN PERSON';
  }

  function isOmittedInstructionalMethod(row) {
    const rawMethod = canon(val(row.raw || {}, fields.modality));
    return row.modality === 'OMIT' ||
      row.accountingReportable === false ||
      modalityGroups.omitted.has(rawMethod) ||
      /DUAL\s*ENROLL/.test(rawMethod);
  }

  function normalizeDays(raw, row = {}) {
    if (Array.isArray(row.Days) && row.Days.length) return normalizeDayArray(row.Days);
    const text = canon(raw);
    const dayFlags = [
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
    if (dayFlags.length) return dayFlags;
    if (!text || /ONLINE|TBA/.test(text)) return [];
    const longDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    const found = longDays.filter((d) => text.includes(d)).map((d) => d.slice(0, 2));
    if (found.length) return found;
    const map = { M: 'MO', T: 'TU', W: 'WE', R: 'TH', F: 'FR', S: 'SA', U: 'SU' };
    return text.replace(/[^MTWRFSU]/g, '').split('').map((d) => map[d]).filter(Boolean);
  }

  function normalizeDayArray(days) {
    const aliases = {
      MONDAY: 'MO',
      TUESDAY: 'TU',
      WEDNESDAY: 'WE',
      THURSDAY: 'TH',
      FRIDAY: 'FR',
      SATURDAY: 'SA',
      SUNDAY: 'SU',
      M: 'MO',
      T: 'TU',
      W: 'WE',
      R: 'TH',
      F: 'FR',
      S: 'SA',
      U: 'SU'
    };
    dayOrder.forEach(day => {
      aliases[day] = day;
    });
    const normalized = days.map(day => aliases[canon(day)]).filter(Boolean);
    return dayOrder.filter(day => normalized.includes(day));
  }

  function dayPattern(days) {
    const normalized = normalizeDayArray(days || []);
    return normalized.length ? normalized.map(day => dayLabels[day]).join('') : 'TBA';
  }

  function normalizeTimes(row) {
    const combined = val(row, fields.time);
    let start = val(row, fields.start);
    let end = val(row, fields.end);
    if ((!start || !end) && combined.includes('-')) {
      [start, end] = combined.split('-').map((part) => part.trim());
    }
    return { start: normalizeTime(start), end: normalizeTime(end) };
  }

  function normalizeTime(raw) {
    const text = String(raw || '').trim();
    if (!text || /TBA|ONLINE/i.test(text)) return '';
    const match = text.match(/(\d{1,2})(?::?(\d{2}))?\s*(AM|PM)?/i);
    if (!match) return '';
    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    const meridian = (match[3] || '').toUpperCase();
    if (meridian === 'PM' && hour < 12) hour += 12;
    if (meridian === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  function timeBlock(start, modality) {
    if (!start || modality === 'ONLINE' || modality === 'TBA') return 'ONLINE/TBA';
    const hour = Number(start.slice(0, 2));
    if (!Number.isFinite(hour)) return 'ONLINE/TBA';
    return `${String(hour).padStart(2, '0')}:00-${String(hour).padStart(2, '0')}:59`;
  }

  function sectionKey(section) {
    return section.crn ? `${section.term}|${section.crn}` : [section.term, section.subject, section.course, section.section].join('|');
  }

  function patternKey(section) {
    return [section.subject, section.course, section.campus, section.modality, section.dayPattern, section.start, section.end].join('-');
  }

  function currentRows() {
    return (window.COSScheduleApp?.getCurrentData?.() || window.currentData || []).map(normalize);
  }

  function currentTerm() {
    return window.COSScheduleApp?.getCurrentTerm?.() || document.getElementById('termSelect')?.value || '';
  }

  function termFromFilename(filename) {
    const text = String(filename || '');
    const match = text.match(/\b(20\d{2})(10|20|30|40)\b/);
    if (!match) return '';
    const year = Number(match[1]);
    const code = match[2];
    if (code === '10') return `FALL ${year - 1}`;
    if (code === '20') return `SPRING ${year}`;
    if (code === '30') return `SUMMER ${year}`;
    if (code === '40') return `WINTER ${year}`;
    return '';
  }

  function termSortValue(term) {
    const text = canon(term);
    const year = Number((text.match(/\b(20\d{2})\b/) || [])[1] || 0);
    const season = (text.match(/FALL|SPRING|SUMMER|WINTER/) || [''])[0];
    const seasonOrder = { WINTER: 1, SPRING: 2, SUMMER: 3, FALL: 4 };
    return year * 10 + (seasonOrder[season] || 0);
  }

  function termParts(term) {
    const text = canon(term);
    return {
      season: (text.match(/FALL|SPRING|SUMMER|WINTER/) || [''])[0],
      year: Number((text.match(/\b(20\d{2})\b/) || [])[1] || 0)
    };
  }

  function termSeason(term) {
    return termParts(term).season;
  }

  function isComparableHistoricalTerm(term, decisionTerm) {
    const rowParts = termParts(term);
    const decisionParts = termParts(decisionTerm);
    if (!rowParts.year || !decisionParts.year || !rowParts.season || !decisionParts.season) return false;
    return rowParts.season === decisionParts.season && termSortValue(term) < termSortValue(decisionTerm);
  }

  function academicYearTrailingYear(term) {
    const parts = termParts(term);
    if (!parts.year) return 0;
    return parts.season === 'SPRING' ? parts.year : parts.year + 1;
  }

  function academicYearLabel(trailingYear) {
    return `FY/AY ${trailingYear}`;
  }

  function targetTermFromFiscalYear(season, fiscalYear) {
    const year = season === 'SPRING' ? fiscalYear : fiscalYear - 1;
    return `${season} ${year}`;
  }

  function demandForecastTarget() {
    const scope = document.getElementById('demForecastScope')?.value || 'term';
    const season = canon(document.getElementById('demForecastSeason')?.value || 'FALL');
    const year = Number(document.getElementById('demForecastYear')?.value || termParts(currentTerm()).year || new Date().getFullYear());
    if (scope === 'year') {
      return {
        scope,
        label: academicYearLabel(year),
        year,
        sortValue: year * 10 + 5
      };
    }
    return {
      scope,
      season,
      year,
      term: targetTermFromFiscalYear(season, year),
      label: `${targetTermFromFiscalYear(season, year)} (${academicYearLabel(year)})`,
      sortValue: termSortValue(targetTermFromFiscalYear(season, year))
    };
  }

  function demandTargetSlug() {
    return demandForecastTarget().label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'forecast';
  }

  function updateDemandTargetControls() {
    const scope = document.getElementById('demForecastScope')?.value || 'term';
    const season = document.getElementById('demForecastSeason');
    if (season) season.disabled = scope === 'year';
  }

  function demandKnownProjectedFtes() {
    return {
      SUMMER: Number(document.getElementById('demKnownSummerFtes')?.value || 0),
      FALL: Number(document.getElementById('demKnownFallFtes')?.value || 0),
      SPRING: Number(document.getElementById('demKnownSpringFtes')?.value || 0)
    };
  }

  function demandAnnualFtesProjection(target, forecastFtes) {
    if (target.scope === 'year') {
      return {
        companionFtes: 0,
        annualFtes: forecastFtes,
        includedTerms: target.label
      };
    }
    const known = demandKnownProjectedFtes();
    const companionFtes = ['SUMMER', 'FALL', 'SPRING']
      .filter(season => season !== target.season)
      .reduce((total, season) => total + (known[season] || 0), 0);
    const includedTerms = ['SUMMER', 'FALL', 'SPRING']
      .map(season => season === target.season ? `${target.season} forecast` : `${season} known/projected`)
      .join(' + ');
    return {
      companionFtes,
      annualFtes: forecastFtes + companionFtes,
      includedTerms
    };
  }

  function isComparableDemandTerm(row, target) {
    const parts = termParts(row.term);
    if (!parts.year) return false;
    if (target.scope === 'year') {
      const trailingYear = academicYearTrailingYear(row.term);
      return trailingYear > 0 && trailingYear < target.year && ['SUMMER', 'FALL', 'SPRING'].includes(parts.season);
    }
    return parts.season === target.season && termSortValue(row.term) < target.sortValue;
  }

  function normalizeDemandAnalysisTerms(rows, target) {
    if (target.scope !== 'year') return rows;
    return rows.map(row => ({
      ...row,
      sourceTerm: row.term,
      term: academicYearLabel(academicYearTrailingYear(row.term))
    }));
  }

  function ensureOptions() {
    // Enrollment Management reports are intentionally kept out of the main Scheduling view selector.
  }

  function buildUi() {
    if (document.getElementById('analyticsReports')) return;
    const anchor = document.getElementById('admin-tools') || document.body;
    const position = anchor === document.body ? 'beforeend' : 'afterend';
    anchor.insertAdjacentHTML(position, `
      <section id="analyticsReports" class="analytics-reports" style="display:none">
        <div id="emAccessPanel" class="em-access-panel">
          <button id="unlockEnrollmentManagement" type="button" class="em-unlock">Enrollment Management</button>
          <span class="em-access-note">Decision-support summaries are hidden until opened.</span>
        </div>
        <div id="emReportControls" class="em-report-controls" hidden>
          <label for="emReportSelect">Enrollment Management Report:</label>
          <select id="emReportSelect">
            <option value="${REPORTS.dashboard}">Enrollment Analytics Dashboard</option>
            <option value="${REPORTS.demand}">Enrollment Demand Forecast</option>
            <option value="${REPORTS.attrition}">Enrollment Attrition / Lifecycle</option>
            <option value="${REPORTS.consolidation}">Section Consolidation Opportunities</option>
            <option value="${REPORTS.utilization}">Room Utilization Map</option>
            <option value="${REPORTS.studentPresence}">Student Presence Analytics</option>
            <option value="${REPORTS.instructorAvailability}">Instructor Availability - Planning View</option>
          </select>
          <label class="em-methodology-export"><input id="includeMethodologyExport" type="checkbox"> Include Methodology in exports</label>
          <span class="em-workbench-note">Dashboard and factual reports support dean/division review. Scenario modeling and schedule simulation are future Enrollment Management Workbench tools.</span>
        </div>
        <div id="dashboardReport" class="analytics-view">
          <div class="analytics-report-intro">
            <h2>Enrollment Analytics Dashboard</h2>
            <p>A compact decision-support summary for enrollment health, registration pace, growth pressure, reduction opportunities, physical student presence, schedule structure, and course rotation health. It summarizes factual report data; scenario modeling and simulation are future Enrollment Management Workbench tools.</p>
            <div class="analytics-methodology">
              <div>
                <h3>How to Use This Dashboard</h3>
                <ul>
                  <li>Use the filters to focus the summary by division, campus, modality, discipline, course, instructor, day, or start hour.</li>
                  <li>Review the top cards first, then use the drill-down buttons for detailed factual demand, attrition, consolidation, rotation, room, and methodology views.</li>
                  <li>Scenario modeling and schedule simulation are intentionally not enabled here yet; those controls are reserved for a future Enrollment Management Workbench once backend support exists.</li>
                  <li>Growth prompts review viable existing seats before suggesting added capacity. Reduction prompts summarize the existing consolidation report output rather than creating separate cancellation logic.</li>
                  <li>Expected enrollment uses same-season historical comparison terms and excludes the selected focus term.</li>
                </ul>
              </div>
              <div>
                <h3>Methodology</h3>
                <ul>
                  <li>Prepared using TIMBER Enrollment Analytics. Methodology Version 1.2.</li>
                  <li>Part-Time Faculty terminology is used for part-time instructional staffing references.</li>
                  <li>Student Presence Analytics excludes online rows and summarizes in-person/hybrid sections by campus, day, and hour.</li>
                  <li>Dashboard exports include the selected term, division, campus, modality, data source, and methodology version when methodology export is enabled.</li>
                </ul>
              </div>
            </div>
          </div>
          <div class="analytics-toolbar dashboard-toolbar">
            <label>Dashboard Focus Term <select id="dashFocusTerm"></select></label>
            ${filters('dash', { includeGroup: false, includeCancelled: false, includeDivision: true })}
            <button id="runDashboard" type="button">Refresh Dashboard</button>
            <button id="exportDashboardSummary" type="button">Export Dashboard Summary CSV</button>
            <button id="exportRotation" type="button">Export Course Rotation CSV</button>
          </div>
          <div class="dashboard-actions">
            <button type="button" data-report-target="${REPORTS.demand}">Demand Forecast</button>
            <button type="button" data-report-target="${REPORTS.attrition}">Enrollment Lifecycle/Attrition</button>
            <button type="button" data-report-target="${REPORTS.consolidation}">Consolidation</button>
            <button type="button" data-report-target="${REPORTS.utilization}">Room Utilization</button>
            <button type="button" data-report-target="${REPORTS.dashboard}" data-scroll-target="dashboardRotationTable">Course Rotation Analysis</button>
            <button type="button" data-scroll-target="dashboardLegend">Methodology</button>
          </div>
          <div id="dashboardScopePanel" class="dashboard-scope-panel"></div>
          <div id="dashboardMetrics" class="analytics-metrics"></div>
          <div id="dashboardInsights" class="dashboard-grid"></div>
          <div id="dashboardRotationTable" class="analytics-table"></div>
          <div id="dashboardLegend" class="analytics-legend"></div>
        </div>
        <div id="studentPresenceReport" class="analytics-view">
          <div class="analytics-report-intro">
            <h2>Student Presence Analytics</h2>
            <p>Estimates physical student presence from loaded scheduled sections and enrollment. It excludes fully online sections, TBA/no fixed meeting times, and online/web/virtual campuses.</p>
            <div class="analytics-methodology">
              <div>
                <h3>How to Use This Report</h3>
                <ul>
                  <li>Select a focus term, then filter by division, department, discipline, course, campus, building, room, modality, day, or time block.</li>
                  <li>Use grouping to switch between campus, building, room, day, hour, and day/hour combinations.</li>
                  <li>Use this as a physical presence estimate for scheduling and facilities planning, not a full campus traffic count.</li>
                </ul>
              </div>
              <div>
                <h3>Methodology</h3>
                <ul>
                  <li>Students present uses census enrollment when available and current enrollment otherwise.</li>
                  <li>Only in-person and hybrid sections with fixed day/time patterns are included.</li>
                  <li>This report does not count unscheduled student presence, online attendance, tutoring, library use, athletics, events, or services traffic.</li>
                </ul>
              </div>
            </div>
          </div>
          <div class="analytics-toolbar">
            <label>Student Presence CSV(s) <input id="studentPresenceCsv" type="file" accept=".csv" multiple></label>
            <button id="archiveStudentPresenceUploads" type="button">Archive Uploads</button>
            <label>Archived terms <select id="spArchiveTerms" multiple data-placeholder="No archived terms"></select></label>
            <label>Focus Term <select id="spFocusTerm"></select></label>
            ${filters('sp', { includeGroup: false, includeCancelled: false, includeDivision: true, includeRoom: true })}
            <label>Group by
              <select id="spGroup">
                <option value="all">All campuses</option>
                <option value="campus">Campus</option>
                <option value="building">Building</option>
                <option value="room">Room</option>
                <option value="day">Day</option>
                <option value="hour">Hour/time block</option>
                <option value="campusDayHour" selected>Campus + Day + Hour</option>
                <option value="buildingDayHour">Building + Day + Hour</option>
                <option value="roomDayHour">Room + Day + Hour</option>
              </select>
            </label>
            <button id="runStudentPresence" type="button">Run</button>
            <button id="exportStudentPresence" type="button">Export CSV</button>
          </div>
          <div id="studentPresenceMetrics" class="analytics-metrics"></div>
          <div id="studentPresenceHeatmap" class="analytics-insights"></div>
          <div id="studentPresenceTable" class="analytics-table"></div>
          <div id="studentPresenceLegend" class="analytics-legend"></div>
        </div>
        <div id="instructorAvailabilityReport" class="analytics-view">
          <div class="analytics-report-intro">
            <h2>Instructor Availability - Planning View</h2>
            <p>This first-layer planning view uses the loaded schedule/class data to identify when instructors are already scheduled. It does not prove contractual or personal availability; it only separates known schedule conflicts from open windows where no loaded teaching assignment is found.</p>
            <div class="analytics-methodology">
              <div>
                <h3>How to Use This Report</h3>
                <ul>
                  <li>Select one or more instructors, then select a day and time window to find known teaching conflicts and shared open schedule windows.</li>
                  <li>Leave all instructors selected for a broad first pass, or select a smaller group to compare schedules side by side.</li>
                  <li>Online/TBA rows are excluded from day/time conflict checks because they do not provide a fixed meeting window.</li>
                </ul>
              </div>
              <div>
                <h3>Methodology</h3>
                <ul>
                  <li>Known Busy means a loaded section for that instructor meets on the selected day and overlaps the selected time range.</li>
                  <li>Potentially Available means the instructor appears in the loaded schedule but has no overlapping scheduled section in the selected window.</li>
                  <li>The weekly grid shows loaded meetings by instructor and day. Shared available time windows are calculated by subtracting the combined loaded meetings for all selected instructors from 8:00 AM-6:00 PM, Monday-Friday.</li>
                  <li>Availability is inferred only from uploaded schedule rows; it does not include faculty preferences, office hours, reassigned time, leave, overload limits, or department-specific rules.</li>
                </ul>
              </div>
            </div>
          </div>
          <div class="analytics-toolbar">
            <label>Division <select id="iaDivision"></select></label>
            <label>Discipline <select id="iaDiscipline"></select></label>
            <label>Instructor <select id="iaInstructor" multiple size="4"></select></label>
            <button id="iaSelectVisible" type="button">Select Visible Instructors</button>
            <label>Day
              <select id="iaDay">
                <option value="MO">Monday</option>
                <option value="TU">Tuesday</option>
                <option value="WE">Wednesday</option>
                <option value="TH">Thursday</option>
                <option value="FR">Friday</option>
                <option value="SA">Saturday</option>
                <option value="SU">Sunday</option>
              </select>
            </label>
            <label>Start <input id="iaStart" type="time" step="300" value="09:00"></label>
            <label>End <input id="iaEnd" type="time" step="300" value="10:00"></label>
            <label>Campus <select id="iaCampus"></select></label>
            <button id="runInstructorAvailability" type="button">Run</button>
            <button id="clearInstructorAvailability" type="button">Clear</button>
          </div>
          <div id="instructorAvailabilityMetrics" class="analytics-metrics"></div>
          <div id="instructorAvailabilityCalendar" class="instructor-week-grid"></div>
          <div id="instructorAvailabilityTimes" class="instructor-available-times"></div>
          <div id="instructorAvailabilityTable" class="analytics-table"></div>
          <div id="instructorAvailabilityLegend" class="analytics-legend"></div>
        </div>
        <div id="attritionReport" class="analytics-view">
          <div class="analytics-report-intro">
            <h2>Enrollment Attrition / Lifecycle</h2>
            <p>Upload enrollment snapshot CSV files for the decision term and any comparison terms. This report uses CENSUS_ENROLL as census enrollment and ACTUAL_ENROLL as end/current enrollment, while keeping the selected decision term separate from historical terms.</p>
            <div class="analytics-methodology">
              <div>
                <h3>How to Use This Report</h3>
                <ul>
                  <li>This report requires the <strong>Seating (All Columns)</strong> version of the Section Seating report housed in Argos.</li>
                  <li>For archived uploads, name files with the Banner term code, such as <strong>202710.csv</strong>, so the app can assign the correct term automatically.</li>
                  <li>Upload the decision-term enrollment CSV and any same-season comparison files, such as Fall to Fall, Spring to Spring, or Summer to Summer.</li>
                  <li>Use comparison terms from 2022 forward only. Earlier terms should be avoided because COVID-era disruption can distort normal enrollment and attrition patterns.</li>
                  <li>Enter the decision season and year before running the report. The decision term can be a future term with no uploaded section seating report yet; in that case, decision-term columns will be zero and the report serves as a historical attrition baseline for planning.</li>
                  <li>Dual Enrollment instructional method rows are omitted from this report so the analysis focuses on general enrollment behavior.</li>
                  <li>The report is lifecycle-ready: when future source files include First Day, Census 1, Census 2, and Final milestone fields, those values can be summarized without changing the current attrition workflow.</li>
                </ul>
              </div>
              <div>
                <h3>Methodology</h3>
                <ul>
                  <li>Sections are deduplicated by CRN within term, with subject/course/section used as fallback, so multi-meeting rows are not double counted.</li>
                  <li>Attrition Count = CENSUS_ENROLL - ACTUAL_ENROLL. Attrition Rate = Attrition Count / CENSUS_ENROLL.</li>
                  <li>Census Fill Rate = CENSUS_ENROLL / MAX ENROLL. Final Fill Rate = ACTUAL_ENROLL / MAX ENROLL.</li>
                  <li>Current available lifecycle calculation uses Census Enrollment and Final/Current Enrollment because current Section Seating exports may not include all milestone fields.</li>
                  <li>Future lifecycle support will use First Day, Census 1, Census 2, and Final Enrollment when those fields are available. Missing milestone fields display as N/A rather than zero.</li>
                  <li>This report is lifecycle-ready but limited by available uploaded data until those IT report fields are delivered.</li>
                  <li>All Terms columns include the decision term plus comparison terms when decision-term rows exist. Historical Attrition excludes the decision term and uses comparison terms only, which is the correct planning view for future terms that have not opened for scheduling/enrollment yet.</li>
                  <li>Min sections controls the minimum section count a grouped row must have before it appears in the report.</li>
                </ul>
              </div>
            </div>
          </div>
          <div class="analytics-toolbar">
            <label>Enrollment CSV(s) <input id="enrollmentCsv" type="file" accept=".csv" multiple></label>
            <button id="archiveAttritionUploads" type="button">Archive Uploads</button>
            <label>Archived terms <select id="attrArchiveTerms" multiple data-placeholder="No archived terms"></select></label>
            <label>Decision season
              <select id="attrDecisionSeason">
                <option value="SUMMER">Summer</option>
                <option value="FALL">Fall</option>
                <option value="SPRING">Spring</option>
              </select>
            </label>
            <label>Decision year <input id="attrDecisionYear" type="number" min="2022" max="2035" step="1"></label>
            <label><input id="attrIncludeHistory" type="checkbox" checked> include historical comparison terms</label>
            ${filters('attr', { includeGroup: true, includeCancelled: false, includeDivision: true })}
            <button id="runAttrition" type="button">Run</button>
            <button id="clearAttrition" type="button">Clear</button>
            <button id="exportAttrition" type="button">Export CSV</button>
          </div>
          <div id="attritionMetrics" class="analytics-metrics"></div>
          <div id="attritionTable" class="analytics-table"></div>
          <div id="attritionLegend" class="analytics-legend"></div>
        </div>
        <div id="consolidationReport" class="analytics-view">
          <div class="analytics-report-intro">
            <h2>Section Consolidation Opportunities</h2>
            <p>Use this planning view to identify low-filled sections and possible receiving sections. Recommendations are review prompts, not automatic cancellation decisions.</p>
            <div class="analytics-methodology">
              <div>
                <h3>How to Use This Report</h3>
                <ul>
                  <li>This report requires the <strong>Seating (All Columns)</strong> version of the Section Seating report housed in Argos.</li>
                  <li>For archived uploads, name files with the Banner term code, such as <strong>202710.csv</strong>, so the app can assign the correct term automatically.</li>
                  <li>Start with the current decision term, then use historical context to decide whether a low-filled pattern is recurring.</li>
                  <li>Compare like terms where possible: Fall to Fall, Spring to Spring, and Summer to Summer. Limit historical review to 2022 and newer terms.</li>
                  <li>Use the filters and thresholds to create a review list, then evaluate operational constraints before making any schedule decision.</li>
                </ul>
              </div>
              <div>
                <h3>Methodology</h3>
                <ul>
                  <li>Low Fill = enrollment divided by capacity below the selected low-fill threshold.</li>
                  <li>For in-person rows, the decision term supplies the planned section pattern and capacity. Historical comparison terms supply expected enrollment and expected open seats.</li>
                  <li>Receiving sections are other planned sections of the same course with enough historically expected open seats, optionally constrained by campus, modality, days, and time.</li>
                  <li>Historical matching should be based on a stable section pattern, not CRN, because CRNs change across terms.</li>
                  <li>Min sections is the minimum number of decision-term in-person sections a course must have before it is considered for in-person flow review. Online reduction rows require at least two online sections and enough historical vacancies to remove one section.</li>
                  <li>Recommendation scores are planning indicators only. They identify candidates for review, not automatic cancellations.</li>
                </ul>
              </div>
            </div>
          </div>
          <div class="analytics-toolbar">
            <label>Consolidation CSV(s) <input id="consolidationCsv" type="file" accept=".csv" multiple></label>
            <button id="archiveConsolidationUploads" type="button">Archive Uploads</button>
            <label>Archived terms <select id="conArchiveTerms" multiple data-placeholder="No archived terms"></select></label>
            <label>Decision term <select id="conDecisionTerm"></select></label>
            <label>Future season <select id="conDecisionSeason"><option value="">Use selected term</option><option>SUMMER</option><option>FALL</option><option>SPRING</option></select></label>
            <label>Future year <input id="conDecisionYear" type="number" min="2022" max="2040" step="1" placeholder="optional"></label>
            ${filters('con', { includeGroup: false, includeCancelled: true, includeDivision: true })}
            <label>Min sections <input id="conMinSections" type="number" min="2" value="5" title="Minimum number of decision-term in-person sections a course must have before it is considered for in-person flow review."></label>
            <label>Low enrollment <input id="conLowEnroll" type="number" min="0" value="" placeholder="optional"></label>
            <label>Low fill % <input id="conLowFill" type="number" min="0" max="100" value="50"></label>
            <label>Absorb % <input id="conAbsorbPct" type="number" min="1" max="100" value="60" title="Minimum share of a source section's enrolled students that nearby receiving sections must be able to absorb before the row is flagged."></label>
            <label>Lookback terms <input id="conLookback" type="number" min="0" max="12" value="6"></label>
            <label>Chronic low enrollment threshold <input id="conMinHist" type="number" min="0" max="12" value="3" title="Number of historical terms where this course/pattern was offered that must show low enrollment before it is considered chronically under-enrolled. 1 = low in any offered historical term; 2 = low in at least two; 3 = low in at least three."></label>
            <label>Chronic % <input id="conChronic" type="number" min="0" max="100" value="75"></label>
            <label>Vacancy basis <select id="conVacancyBasis"><option value="census" selected>Historical census enrollment</option><option value="actual">Historical final/current enrollment</option></select></label>
            <label>Day match <select id="conDayMatch"><option value="exact">same day pattern</option><option value="overlap">shares any day</option><option value="any">any day</option></select></label>
            <label>Start window <select id="conTimeWindow"><option value="0">same start time</option><option value="1">+/- 1 hour</option><option value="2" selected>+/- 2 hours</option><option value="3">+/- 3 hours</option><option value="4">+/- 4 hours</option><option value="">any time</option></select></label>
            <label><input id="conSameCampus" type="checkbox" checked> same campus</label>
            <label><input id="conSameModality" type="checkbox" checked> same modality</label>
            <button id="runConsolidation" type="button">Run</button>
            <button id="clearConsolidation" type="button">Clear</button>
            <button id="exportConsolidation" type="button">Export CSV</button>
          </div>
          <div id="consolidationMetrics" class="analytics-metrics"></div>
          <div id="consolidationTable" class="analytics-table"></div>
          <div id="consolidationLegend" class="analytics-legend"></div>
        </div>
        <div id="demandReport" class="analytics-view">
          <div class="analytics-report-intro">
            <h2>Enrollment Demand Forecast</h2>
            <p>Use historical enrollment growth patterns to forecast future student demand by college, division, discipline, and course. This report is a planning forecast, not a cancellation or consolidation recommendation.</p>
            <div class="analytics-methodology">
              <div>
                <h3>How to Use This Report</h3>
                <ul>
                  <li>This report requires the <strong>Seating (All Columns)</strong> version of the Section Seating report housed in Argos.</li>
                  <li>For archived uploads, name files with the Banner term code, such as <strong>202710.csv</strong>, so the app can assign the correct term automatically.</li>
                  <li>Select three to five comparable historical terms where possible, such as Fall to Fall or Spring to Spring. For academic-year forecasts, select archived Summer, Fall, and Spring terms for each historical year.</li>
                  <li>Forecast year uses the trailing fiscal/academic-year convention. FY/AY 2027 means Summer 2026, Fall 2026, and Spring 2027; selecting FY/AY 2027 + Fall targets Fall 2026 / Banner term 202710.</li>
                  <li>Upload or select archived historical terms, then use the filters to isolate discipline, course, division, campus, modality, day pattern, or time range.</li>
                  <li>The forecast target does not need an uploaded section seating report. Select the target season/year or academic year directly, then the report uses only comparable finalized historical rows before that target.</li>
                  <li>For a single-term forecast, enter known or projected FTES for the other terms in the same FY/AY so the cap comparison reflects the whole year.</li>
                </ul>
              </div>
              <div>
                <h3>Methodology</h3>
                <ul>
                  <li>Single-term forecasts compare like terms only. Academic-year forecasts aggregate Summer, Fall, and Spring into annual historical buckets before calculating growth.</li>
                  <li>Forecast Growth blends course-specific growth, discipline growth, division growth, and college-wide growth.</li>
                  <li>The overall enrollment modifier lets you apply a planning assumption, such as an expected 3% college-wide enrollment increase.</li>
                  <li>FTES uses the uploaded FTES column when present; otherwise it estimates weekly-census FTES as census enrollment x weekly contact hours x 17.5 / 525, with a conservative census enrollment x units / 30 fallback when weekly hours are unavailable.</li>
                  <li>Forecasts estimate next-term enrollment, expected fill rate, section need, and confidence from historical behavior.</li>
                  <li>Use the optional FTES cap field to compare the annual FTES projection against the state-sanctioned FTES cap for planning and apportionment context.</li>
                  <li>Capacity guidance indicates whether demand is expanding, stable, or softening; it is not a direct section cancellation instruction.</li>
                </ul>
              </div>
            </div>
          </div>
          <div class="analytics-toolbar">
            <label>Demand CSV(s) <input id="demandCsv" type="file" accept=".csv" multiple></label>
            <button id="archiveDemandUploads" type="button">Archive Uploads</button>
            <label>Archived terms <select id="demArchiveTerms" multiple data-placeholder="No archived terms"></select></label>
            <label>Forecast scope <select id="demForecastScope"><option value="term">Single term</option><option value="year">Academic year</option></select></label>
            <label>Forecast season <select id="demForecastSeason"><option>FALL</option><option>SPRING</option><option>SUMMER</option></select></label>
            <label>Forecast FY/AY <input id="demForecastYear" type="number" min="2022" max="2040" value=""></label>
            ${filters('dem', { includeGroup: false, includeCancelled: false, includeOrg: true })}
            <label>Analysis window <input id="demWindow" type="number" min="1" max="10" value="5"></label>
            <label>Overall enrollment modifier % <input id="demGrowthModifier" type="number" min="-50" max="100" step="0.1" value="0" title="Optional planning adjustment applied after historical growth, such as 3 for an expected 3% overall enrollment increase."></label>
            <label>FTES cap <input id="demFtesCap" type="number" min="0" step="0.1" value="" placeholder="optional" title="Optional state-sanctioned FTES cap used to show forecast room remaining or amount over cap."></label>
            <label>Known/projected Summer FTES <input id="demKnownSummerFtes" type="number" min="0" step="0.1" value="" placeholder="optional"></label>
            <label>Known/projected Fall FTES <input id="demKnownFallFtes" type="number" min="0" step="0.1" value="" placeholder="optional"></label>
            <label>Known/projected Spring FTES <input id="demKnownSpringFtes" type="number" min="0" step="0.1" value="" placeholder="optional"></label>
            <button id="runDemand" type="button">Run</button>
            <button id="clearDemand" type="button">Clear</button>
            <button id="exportDemand" type="button">Export CSV</button>
            <button id="exportDemandExcel" type="button">Export Excel</button>
          </div>
          <div id="demandMetrics" class="analytics-metrics"></div>
          <div id="demandInsights" class="analytics-insights"></div>
          <div id="demandTable" class="analytics-table"></div>
          <div id="demandLegend" class="analytics-legend"></div>
        </div>
      </section>`);
    const utilizationTool = document.getElementById('utilization-tool');
    if (utilizationTool) {
      utilizationTool.classList.add('analytics-view');
      utilizationTool.style.display = 'none';
      document.getElementById('analyticsReports').appendChild(utilizationTool);
    }
  }

  function filters(prefix, options = {}) {
    const includeGroup = typeof options === 'boolean' ? options : Boolean(options.includeGroup);
    const includeCancelled = typeof options === 'boolean' ? true : options.includeCancelled !== false;
    const includeOrg = typeof options === 'object' && Boolean(options.includeOrg);
    const includeDivision = includeOrg || (typeof options === 'object' && Boolean(options.includeDivision));
    const includeRoom = typeof options === 'object' && Boolean(options.includeRoom);
    return `
      ${includeDivision ? `<label>Division <select id="${prefix}Division" multiple data-placeholder="All divisions"></select></label>` : ''}
      ${includeOrg ? `<label>Department <select id="${prefix}Department" multiple data-placeholder="All departments"></select></label>` : ''}
      <label>Discipline <select id="${prefix}Subject" multiple data-placeholder="All disciplines"></select></label>
      <label>Course <select id="${prefix}Course" multiple data-placeholder="All courses"></select></label>
      <label>Campus <select id="${prefix}Campus" multiple data-placeholder="All campuses"></select></label>
      ${includeRoom ? `<label>Building <select id="${prefix}Building" multiple data-placeholder="All buildings"></select></label>` : ''}
      ${includeRoom ? `<label>Room <select id="${prefix}Room" multiple data-placeholder="All rooms"></select></label>` : ''}
      <label>Modality <select id="${prefix}Modality" multiple data-placeholder="All modalities"></select></label>
      <label>Instructor <select id="${prefix}Instructor" multiple data-placeholder="All instructors"></select></label>
      <label>Day <select id="${prefix}Day" multiple data-placeholder="All days"></select></label>
      <label>Start hour <select id="${prefix}Time" multiple data-placeholder="All start hours"></select></label>
      ${includeGroup ? '<label>Group by <select id="attrGroup"><option>COURSE</option><option value="SUBJECT">DISCIPLINE</option><option>SECTION</option><option>INSTRUCTOR</option><option>CAMPUS</option><option>MODALITY</option><option>DAY PATTERN</option><option>TIME BLOCK</option><option>OVERALL</option></select></label><label>Min sections <input id="attrMinSections" type="number" min="1" value="1" title="Minimum section count required for a grouped row to appear."></label>' : ''}
      <label><input id="${prefix}HideOnline" type="checkbox"> hide online</label>
      ${includeCancelled ? `<label><input id="${prefix}HideCancelled" type="checkbox" checked> hide cancelled</label>` : ''}
      <label><input id="${prefix}HideZero" type="checkbox" checked> hide zero cap</label>`;
  }

  function getSelectedValues(id) {
    const select = document.getElementById(id);
    if (!select) return [];
    return Array.from(select.selectedOptions || []).map(option => canon(option.value)).filter(Boolean);
  }

  function valueMatchesSelection(value, selectedValues) {
    return filterUtils.valueMatchesSelection(value, selectedValues);
  }

  function uniqueOptions(rows, getter) {
    return [...new Set(rows.map(getter).filter(Boolean).map(canon))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map(value => ({ value, label: value }));
  }

  function uniqueDayOptions(rows) {
    return uniqueOptions(rows, row => row.dayPattern);
  }

  function rowsForDependentOptions(prefix, rows) {
    const selectedDivisions = getSelectedValues(prefix + 'Division');
    const selectedDepartments = getSelectedValues(prefix + 'Department');
    const selectedSubjects = getSelectedValues(prefix + 'Subject');
    const selectedCourses = getSelectedValues(prefix + 'Course');
    const selectedCampuses = getSelectedValues(prefix + 'Campus');
    return rows.filter(row => {
      if (!valueMatchesSelection(row.division, selectedDivisions)) return false;
      if (!valueMatchesSelection(row.department, selectedDepartments)) return false;
      if (!valueMatchesSelection(row.subject, selectedSubjects)) return false;
      if (!valueMatchesSelection(row.course, selectedCourses)) return false;
      if (!valueMatchesSelection(row.campus, selectedCampuses)) return false;
      return true;
    });
  }

  function updateCourseOptions(prefix, rows) {
    const selectedDivisions = getSelectedValues(prefix + 'Division');
    const selectedDepartments = getSelectedValues(prefix + 'Department');
    const selectedSubjects = getSelectedValues(prefix + 'Subject');
    const courseRows = rows.filter(row => {
      if (!valueMatchesSelection(row.division, selectedDivisions)) return false;
      if (!valueMatchesSelection(row.department, selectedDepartments)) return false;
      if (!valueMatchesSelection(row.subject, selectedSubjects)) return false;
      return true;
    });
    setSelectOptions(prefix + 'Course', uniqueOptions(courseRows, row => row.course));
    updatePatternOptions(prefix, rows);
  }

  function updatePatternOptions(prefix, rows) {
    const scopedRows = rowsForDependentOptions(prefix, rows);
    setSelectOptions(prefix + 'Day', uniqueDayOptions(scopedRows));
    setSelectOptions(prefix + 'Time', uniqueOptions(scopedRows, row => row.timeBlock));
  }

  function setSelectOptions(id, options) {
    const select = document.getElementById(id);
    if (!select) return;
    const selected = new Set(getSelectedValues(id));
    const choice = analyticsChoices.get(id);
    if (choice) {
      choice.destroy();
      analyticsChoices.delete(id);
    }
    select.replaceChildren();
    options.forEach(option => {
      const node = new Option(option.label, option.value, false, selected.has(canon(option.value)));
      select.appendChild(node);
    });
    if (window.Choices) {
      analyticsChoices.set(id, new Choices(select, {
        removeItemButton: true,
        searchEnabled: true,
        shouldSort: false,
        placeholderValue: select.dataset.placeholder || 'All'
      }));
    }
  }

  function clearSelect(id) {
    const select = document.getElementById(id);
    if (!select) return;
    const choice = analyticsChoices.get(id);
    if (choice) choice.removeActiveItems();
    Array.from(select.options || []).forEach(option => {
      option.selected = false;
    });
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function resetAnalyticsControls(prefix) {
    ['Division', 'Department', 'Subject', 'Course', 'Campus', 'Building', 'Room', 'Modality', 'Instructor', 'Day', 'Time'].forEach(name => clearSelect(prefix + name));
    const hideOnline = document.getElementById(prefix + 'HideOnline');
    if (hideOnline) hideOnline.checked = false;
    const hideCancelled = document.getElementById(prefix + 'HideCancelled');
    if (hideCancelled) hideCancelled.checked = true;
    const hideZero = document.getElementById(prefix + 'HideZero');
    if (hideZero) hideZero.checked = true;
    if (prefix === 'attr') {
      const group = document.getElementById('attrGroup');
      if (group) group.value = 'COURSE';
      const minSections = document.getElementById('attrMinSections');
      if (minSections) minSections.value = '1';
      const includeHistory = document.getElementById('attrIncludeHistory');
      if (includeHistory) includeHistory.checked = true;
      if ((state.enrollment.length || currentRows().length) && state.attritionRan) runAttrition();
    }
    if (prefix === 'con') {
      const minSections = document.getElementById('conMinSections');
      if (minSections) minSections.value = '5';
      const lowEnroll = document.getElementById('conLowEnroll');
      if (lowEnroll) lowEnroll.value = '';
      const lowFill = document.getElementById('conLowFill');
      if (lowFill) lowFill.value = '50';
      const absorbPct = document.getElementById('conAbsorbPct');
      if (absorbPct) absorbPct.value = '60';
      const lookback = document.getElementById('conLookback');
      if (lookback) lookback.value = '6';
      const minHist = document.getElementById('conMinHist');
      if (minHist) minHist.value = '3';
      const chronic = document.getElementById('conChronic');
      if (chronic) chronic.value = '75';
      const vacancyBasis = document.getElementById('conVacancyBasis');
      if (vacancyBasis) vacancyBasis.value = 'census';
      const dayMatch = document.getElementById('conDayMatch');
      if (dayMatch) dayMatch.value = 'exact';
      const timeWindow = document.getElementById('conTimeWindow');
      if (timeWindow) timeWindow.value = '2';
      const sameCampus = document.getElementById('conSameCampus');
      if (sameCampus) sameCampus.checked = true;
      const sameModality = document.getElementById('conSameModality');
      if (sameModality) sameModality.checked = true;
      if (state.consolidationRows.length) runConsolidation();
    }
    if (prefix === 'dem') {
      setDemandTargetDefaults();
      const windowInput = document.getElementById('demWindow');
      if (windowInput) windowInput.value = '5';
      const growthModifier = document.getElementById('demGrowthModifier');
      if (growthModifier) growthModifier.value = '0';
      const ftesCap = document.getElementById('demFtesCap');
      if (ftesCap) ftesCap.value = '';
      ['demKnownSummerFtes', 'demKnownFallFtes', 'demKnownSpringFtes'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = '';
      });
      if (state.demandRows.length) runDemand();
    }
    if (prefix === 'dash') {
      runDashboard();
    }
  }

  function populateAnalyticsFilters(prefix, rows) {
    setSelectOptions(prefix + 'Division', uniqueOptions(rows, row => row.division));
    setSelectOptions(prefix + 'Department', uniqueOptions(rows, row => row.department));
    setSelectOptions(prefix + 'Subject', uniqueOptions(rows, row => row.subject));
    updateCourseOptions(prefix, rows);
    setSelectOptions(prefix + 'Campus', uniqueOptions(rows, row => row.campus));
    setSelectOptions(prefix + 'Building', uniqueOptions(rows, row => row.building));
    setSelectOptions(prefix + 'Room', uniqueOptions(rows, row => row.roomOnly || row.room));
    setSelectOptions(prefix + 'Modality', uniqueOptions(rows, row => row.modality));
    setSelectOptions(prefix + 'Instructor', uniqueOptions(rows, row => row.instructor));
    updatePatternOptions(prefix, rows);
    const divisionSelect = document.getElementById(prefix + 'Division');
    if (divisionSelect) divisionSelect.onchange = () => {
      setSelectOptions(prefix + 'Department', uniqueOptions(rows.filter(row => valueMatchesSelection(row.division, getSelectedValues(prefix + 'Division'))), row => row.department));
      updateCourseOptions(prefix, rows);
    };
    const departmentSelect = document.getElementById(prefix + 'Department');
    if (departmentSelect) departmentSelect.onchange = () => updateCourseOptions(prefix, rows);
    const subjectSelect = document.getElementById(prefix + 'Subject');
    if (subjectSelect) subjectSelect.onchange = () => updateCourseOptions(prefix, rows);
    const courseSelect = document.getElementById(prefix + 'Course');
    if (courseSelect) courseSelect.onchange = () => updatePatternOptions(prefix, rows);
  }

  function applyFilters(rows, prefix) {
    const selected = {
      division: getSelectedValues(prefix + 'Division'),
      department: getSelectedValues(prefix + 'Department'),
      subject: getSelectedValues(prefix + 'Subject'),
      course: getSelectedValues(prefix + 'Course'),
      campus: getSelectedValues(prefix + 'Campus'),
      building: getSelectedValues(prefix + 'Building'),
      room: getSelectedValues(prefix + 'Room'),
      modality: getSelectedValues(prefix + 'Modality'),
      instructor: getSelectedValues(prefix + 'Instructor'),
      day: getSelectedValues(prefix + 'Day'),
      time: getSelectedValues(prefix + 'Time')
    };
    return rows.filter((r) => {
      if (!valueMatchesSelection(r.division, selected.division)) return false;
      if (!valueMatchesSelection(r.department, selected.department)) return false;
      if (!valueMatchesSelection(r.subject, selected.subject)) return false;
      if (!valueMatchesSelection(r.course, selected.course)) return false;
      if (!valueMatchesSelection(r.campus, selected.campus)) return false;
      if (!valueMatchesSelection(r.building, selected.building)) return false;
      if (!valueMatchesSelection(r.roomOnly || r.room, selected.room)) return false;
      if (!valueMatchesSelection(r.modality, selected.modality)) return false;
      if (!valueMatchesSelection(r.instructor, selected.instructor)) return false;
      if (!valueMatchesSelection(r.dayPattern, selected.day)) return false;
      if (!valueMatchesSelection(r.timeBlock, selected.time)) return false;
      if (document.getElementById(prefix + 'HideOnline')?.checked && r.modality === 'ONLINE') return false;
      if (document.getElementById(prefix + 'HideCancelled')?.checked && /CANCEL/.test(r.status)) return false;
      if (document.getElementById(prefix + 'HideZero')?.checked && r.cap <= 0) return false;
      return true;
    });
  }

  async function readCsv(input) {
    const files = Array.from(input?.files || []);
    if (!files.length) return [];
    const batches = await Promise.all(files.map(file => new Promise((resolve, reject) => {
      const sourceTerm = termFromFilename(file.name);
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (r) => resolve((r.data || []).map(row => ({ ...row, __sourceTerm: sourceTerm }))),
        error: reject
      });
    })));
    return batches.flat();
  }

  async function readArchivedRows(selectId) {
    const terms = getSelectedValues(selectId);
    if (!terms.length || !window.BACKEND_BASE_URL) return [];
    const batches = await Promise.all(terms.map(term => fetch(`${window.BACKEND_BASE_URL}/api/analytics-archive/${encodeURIComponent(term)}`)
      .then(response => response.ok ? response.json() : { data: [] })
      .then(payload => (payload.data || []).map(row => ({ ...row, __sourceTerm: payload.term || term })))));
    return batches.flat();
  }

  async function refreshAnalyticsArchiveOptions() {
    if (!window.BACKEND_BASE_URL) return;
    try {
      const payload = await fetch(`${window.BACKEND_BASE_URL}/api/analytics-archive`).then(response => response.ok ? response.json() : { data: [] });
      state.archivedAnalyticsTerms = (payload.data || []).map(item => item.term).filter(Boolean);
      const options = state.archivedAnalyticsTerms.map(term => ({ value: term, label: term }));
      setSelectOptions('attrArchiveTerms', options);
      setSelectOptions('conArchiveTerms', options);
      setSelectOptions('demArchiveTerms', options);
      setSelectOptions('spArchiveTerms', options);
    } catch (err) {
      console.warn('Analytics archive list skipped:', err);
    }
  }

  async function archiveUploads(inputId) {
    if (!window.BACKEND_BASE_URL) {
      alert('Backend is not configured, so uploads cannot be archived.');
      return;
    }
    const input = document.getElementById(inputId);
    const files = Array.from(input?.files || []);
    if (!files.length) {
      alert('Choose one or more CSV files before archiving.');
      return;
    }
    const token = enrollmentManagementToken();
    if (!token) {
      alert('Open Enrollment Management before archiving analytics CSVs.');
      updateVisibility();
      return;
    }
    const saved = [];
    for (const file of files) {
      const term = termFromFilename(file.name);
      if (!term) {
        alert(`Could not infer a term from ${file.name}. Use Banner-style filenames such as 202710.csv.`);
        continue;
      }
      const csv = await file.text();
      const response = await fetch(`${window.BACKEND_BASE_URL}/api/analytics-archive/${encodeURIComponent(term)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ csv })
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `Archive failed for ${term}`);
      }
      saved.push(term);
    }
    await refreshAnalyticsArchiveOptions();
    alert(saved.length ? `Archived ${saved.length} term file(s): ${saved.join(', ')}` : 'No files were archived.');
  }

  function collectTerms(...rowSets) {
    const terms = new Set();
    rowSets.flat().forEach(row => {
      if (row?.term) terms.add(row.term);
    });
    const active = canon(currentTerm());
    if (active) terms.add(active);
    return [...terms].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  function collectRowTerms(rows) {
    const terms = new Set();
    rows.forEach(row => {
      if (row?.term) terms.add(row.term);
    });
    return [...terms].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  function updateDecisionTermOptions(terms) {
    const seasonSelect = document.getElementById('attrDecisionSeason');
    const yearInput = document.getElementById('attrDecisionYear');
    if (!seasonSelect || !yearInput) return '';
    const prior = seasonSelect.dataset.initialized ? attritionDecisionTerm() : '';
    const activeParts = termParts(currentTerm());
    const latestParts = (terms || [])
      .map(termParts)
      .filter(parts => parts.year && ['FALL', 'SPRING', 'SUMMER'].includes(parts.season))
      .sort((a, b) => termSortValue(`${a.season} ${a.year}`) - termSortValue(`${b.season} ${b.year}`))
      .pop();
    const basis = termParts(prior).year ? termParts(prior) : activeParts.year ? activeParts : latestParts || { season: 'FALL', year: new Date().getFullYear() };
    if (!seasonSelect.dataset.initialized) {
      seasonSelect.value = basis.season || 'FALL';
      yearInput.value = String(basis.year || new Date().getFullYear());
      seasonSelect.dataset.initialized = 'true';
    } else if (!yearInput.value) {
      yearInput.value = String(basis.year || new Date().getFullYear());
    }
    return attritionDecisionTerm();
  }

  function attritionDecisionTerm() {
    const season = canon(document.getElementById('attrDecisionSeason')?.value || 'FALL');
    const year = Number(document.getElementById('attrDecisionYear')?.value || termParts(currentTerm()).year || new Date().getFullYear());
    return `${season || 'FALL'} ${year}`;
  }

  function updateConsolidationTermOptions(terms) {
    const select = document.getElementById('conDecisionTerm');
    if (!select) return '';
    const active = canon(currentTerm());
    const prior = select.value;
    select.replaceChildren();
    terms.forEach(term => select.add(new Option(term, term)));
    if (terms.includes(prior)) select.value = prior;
    else if (terms.includes(active)) select.value = active;
    else if (terms.length) select.value = terms[terms.length - 1];
    return select.value;
  }

  function consolidationDecisionTerm() {
    const season = canon(document.getElementById('conDecisionSeason')?.value || '');
    const year = Number(document.getElementById('conDecisionYear')?.value || 0);
    if (season && year) return `${season} ${year}`;
    return document.getElementById('conDecisionTerm')?.value || updateConsolidationTermOptions(state.consolidationTerms);
  }

  function updateDemandTermOptions(terms) {
    setDemandTargetDefaults(terms);
    return demandForecastTarget().label;
  }

  function setDemandTargetDefaults(terms = []) {
    const yearInput = document.getElementById('demForecastYear');
    const seasonSelect = document.getElementById('demForecastSeason');
    if (!yearInput || !seasonSelect) return;
    updateDemandTargetControls();
    if (yearInput.value && seasonSelect.value) return;
    const activeParts = termParts(currentTerm());
    const latestParts = (terms || [])
      .map(termParts)
      .filter(parts => parts.year && ['FALL', 'SPRING', 'SUMMER'].includes(parts.season))
      .sort((a, b) => termSortValue(`${a.season} ${a.year}`) - termSortValue(`${b.season} ${b.year}`))
      .pop();
    const basis = activeParts.year ? activeParts : latestParts || { season: 'FALL', year: new Date().getFullYear() };
    seasonSelect.value = basis.season || 'FALL';
    yearInput.value = String((basis.year || new Date().getFullYear()) + 1);
  }

  function captureFilterState(prefix) {
    return {
      division: getSelectedValues(prefix + 'Division'),
      department: getSelectedValues(prefix + 'Department'),
      subject: getSelectedValues(prefix + 'Subject'),
      course: getSelectedValues(prefix + 'Course'),
      campus: getSelectedValues(prefix + 'Campus'),
      building: getSelectedValues(prefix + 'Building'),
      room: getSelectedValues(prefix + 'Room'),
      modality: getSelectedValues(prefix + 'Modality'),
      instructor: getSelectedValues(prefix + 'Instructor'),
      day: getSelectedValues(prefix + 'Day'),
      time: getSelectedValues(prefix + 'Time')
    };
  }

  function restoreFilterState(prefix, saved) {
    if (!saved) return;
    [
      ['Division', saved.division],
      ['Department', saved.department],
      ['Subject', saved.subject],
      ['Course', saved.course],
      ['Campus', saved.campus],
      ['Building', saved.building],
      ['Room', saved.room],
      ['Modality', saved.modality],
      ['Instructor', saved.instructor],
      ['Day', saved.day],
      ['Time', saved.time]
    ].forEach(([name, values]) => {
      const select = document.getElementById(prefix + name);
      if (!select) return;
      const allowed = new Set((values || []).map(canon));
      Array.from(select.options || []).forEach(option => {
        option.selected = allowed.has(canon(option.value));
      });
      const choice = analyticsChoices.get(prefix + name);
      if (choice) {
        choice.removeActiveItems();
        (values || []).forEach(value => {
          if (Array.from(select.options || []).some(option => canon(option.value) === canon(value))) {
            choice.setChoiceByValue(value);
          }
        });
      }
    });
  }

  function refreshAnalyticsFilters(prefix, rows, saved = null) {
    populateAnalyticsFilters(prefix, rows);
    if (!saved) return;
    restoreFilterState(prefix, saved);
    updateCourseOptions(prefix, rows);
    restoreFilterState(prefix, saved);
    updatePatternOptions(prefix, rows);
    restoreFilterState(prefix, saved);
  }

  function dashboardSourceRows() {
    const rows = [
      ...(state.enrollment || []),
      ...(state.demandInput || []),
      ...(state.consolidationInput || [])
    ].filter(Boolean);
    return rows.length ? dedupeEnrollmentRows(rows) : currentRows().filter(row => !isOmittedInstructionalMethod(row));
  }

  function dashboardAvailableTerms(rows) {
    return collectRowTerms(rows)
      .sort((a, b) => termSortValue(a) - termSortValue(b));
  }

  function updateDashboardFocusTermOptions(rows) {
    const select = document.getElementById('dashFocusTerm');
    if (!select) return '';
    const terms = dashboardAvailableTerms(rows);
    const prior = select.value;
    const active = canon(currentTerm());
    const defaultTerm = terms.includes(prior) || prior === '__ALL__' ? prior :
      terms.includes(active) ? active :
      terms.length ? terms[terms.length - 1] : '__ALL__';
    select.replaceChildren();
    select.appendChild(new Option('All Loaded Terms', '__ALL__', false, defaultTerm === '__ALL__'));
    terms.forEach(term => select.appendChild(new Option(term, term, false, term === defaultTerm)));
    select.value = defaultTerm;
    return defaultTerm;
  }

  function updatePresenceFocusTermOptions(rows) {
    const select = document.getElementById('spFocusTerm');
    if (!select) return '';
    const terms = dashboardAvailableTerms(rows);
    const prior = select.value;
    const active = canon(currentTerm());
    const defaultTerm = terms.includes(prior) ? prior :
      terms.includes(active) ? active :
      terms.length ? terms[terms.length - 1] : '';
    select.replaceChildren();
    terms.forEach(term => select.appendChild(new Option(term, term, false, term === defaultTerm)));
    select.value = defaultTerm;
    return defaultTerm;
  }

  function dashboardFocusTerm() {
    const value = document.getElementById('dashFocusTerm')?.value || '';
    return value === '__ALL__' ? '' : canon(value);
  }

  function studentPresenceFocusTerm() {
    return canon(document.getElementById('spFocusTerm')?.value || '');
  }

  function dashboardCurrentRows(sourceRows, focusTerm) {
    if (!focusTerm) return sourceRows;
    return sourceRows.filter(row => row.term === focusTerm);
  }

  function dashboardHistoricalRows(rows, focusTerm) {
    const pool = [
      ...(state.enrollment || []),
      ...(state.demandInput || []),
      ...(state.consolidationInput || []),
      ...(rows || [])
    ].filter(row => row && !isOmittedInstructionalMethod(row));
    const focusParts = termParts(focusTerm);
    const focusSort = termSortValue(focusTerm);
    return dedupeEnrollmentRows(pool).filter(row => {
      if (!focusTerm) return true;
      if (!row.term || row.term === focusTerm) return false;
      const rowParts = termParts(row.term);
      if (focusParts.season && rowParts.season && rowParts.season !== focusParts.season) return false;
      return termSortValue(row.term) < focusSort;
    });
  }

  function dashboardReductionRows(focusTerm) {
    const rows = (state.consolidationRows || []).map(flattenOpportunity);
    if (!focusTerm) return rows;
    return rows.filter(row => (!row.term && !row.decisionTerm) || row.term === focusTerm || row.decisionTerm === focusTerm);
  }

  function runDashboard() {
    state.dashboardRan = true;
    const saved = captureFilterState('dash');
    const sourceRows = dashboardSourceRows().filter(row => !isOmittedInstructionalMethod(row));
    const focusTerm = updateDashboardFocusTermOptions(sourceRows);
    refreshAnalyticsFilters('dash', sourceRows, saved);
    const selectedFocusTerm = focusTerm === '__ALL__' ? '' : focusTerm;
    const currentRows = applyFilters(dashboardCurrentRows(sourceRows, selectedFocusTerm), 'dash');
    const historicalRows = applyFilters(dashboardHistoricalRows(sourceRows, selectedFocusTerm), 'dash');
    const reductionRows = dashboardReductionRows(selectedFocusTerm);
    const summary = dashboard.dashboardSummary(currentRows, historicalRows, reductionRows);
    state.dashboardRows = currentRows;
    state.dashboardSummary = summary;
    state.rotationRows = summary.rotation || [];
    renderDashboard(summary, dashboardScopeContext(currentRows, historicalRows, selectedFocusTerm));
  }

  function exportDashboardSummary() {
    if (!state.dashboardSummary) runDashboard();
    const rows = dashboard.dashboardSummaryExportRows(state.dashboardSummary, dashboardExportContext());
    exportRowsWithoutMethodology(rows, `enrollment-dashboard-summary-${dashboardFocusSlug()}.csv`);
  }

  function dashboardFocusSlug() {
    return (dashboardFocusTerm() || 'all-loaded-terms').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'term';
  }

  function dashboardExportContext() {
    const discipline = getSelectedValues('dashSubject');
    const course = getSelectedValues('dashCourse');
    return {
      methodologyVersion: 'Methodology Version 1.2',
      exportedAt: new Date().toLocaleString(),
      selectedTerm: dashboardFocusTerm() || 'All Loaded Terms',
      divisionFilter: filterUtils.divisionFilterLabel(getSelectedValues('dashDivision')),
      campusFilter: filterUtils.divisionFilterLabel(getSelectedValues('dashCampus')),
      modalityFilter: filterUtils.divisionFilterLabel(getSelectedValues('dashModality')),
      disciplineCourseFilter: [
        discipline.length ? `Discipline: ${discipline.join(', ')}` : '',
        course.length ? `Course: ${course.join(', ')}` : ''
      ].filter(Boolean).join('; ') || 'All disciplines/courses',
      dataSourceNote: dashboardDataSourceLabel()
    };
  }

  function dashboardScopeContext(currentRows, historicalRows, focusTerm) {
    const currentTerms = collectRowTerms(currentRows);
    const historicalTerms = collectRowTerms(historicalRows);
    const lifecycle = summaryLifecycleAvailability(currentRows);
    return {
      focusTerm,
      focusLabel: focusTerm || 'All Loaded Terms',
      currentRowsCount: currentRows.length,
      historicalRowsCount: historicalRows.length,
      historicalTerms,
      currentTerms,
      comparableBasis: focusTerm ? `${termParts(focusTerm).season || 'Same-season'} historical terms before ${focusTerm}` : 'All loaded terms selected',
      missingMilestones: lifecycle.missing,
      warnings: dashboardScopeWarnings({ focusTerm, currentRows, historicalRows, currentTerms, lifecycle })
    };
  }

  function summaryLifecycleAvailability(rows) {
    const milestones = [
      ['First Day', 'firstDay'],
      ['Census 1', 'census1'],
      ['Census 2', 'census2'],
      ['Final', 'finalEnrollment']
    ];
    const missing = milestones
      .filter(([, key]) => !rows.some(row => Number.isFinite(Number(row?.[key]))))
      .map(([label]) => label);
    return { missing };
  }

  function dashboardScopeWarnings(context) {
    const warnings = [];
    if (!context.focusTerm) warnings.push('All Loaded Terms shows gross totals and should not be used as a decision-term dashboard.');
    if (!context.focusTerm) warnings.push('No focus term selected. Select a decision/focus term for decision-term metrics.');
    if (context.focusTerm && !context.historicalRows.length) warnings.push('Expected enrollment has no historical comparison terms for the selected focus term.');
    if (context.currentTerms.length > 1) warnings.push('Current rows include multiple terms. Confirm All Loaded Terms was selected intentionally.');
    if (context.lifecycle.missing.length) warnings.push('Lifecycle milestone data unavailable in current upload.');
    return warnings;
  }

  function renderDashboardScopePanel(context) {
    const node = document.getElementById('dashboardScopePanel');
    if (!node) return;
    const missing = context.missingMilestones.length ? context.missingMilestones.join(', ') : 'None';
    const historicalTerms = context.historicalTerms.length ? context.historicalTerms.join(', ') : 'None';
    const warnings = context.warnings.length
      ? `<div class="dashboard-scope-warnings">${context.warnings.map(warning => `<p>${escapeAttr(warning)}</p>`).join('')}</div>`
      : '<div class="dashboard-scope-ok">No scope warnings detected.</div>';
    node.innerHTML = `
      <h3>Dashboard Scope &amp; Data Quality</h3>
      ${warnings}
      <dl>
        <div><dt>Focus Term</dt><dd>${escapeAttr(context.focusLabel)}</dd></div>
        <div><dt>Current Rows Included</dt><dd>${context.currentRowsCount}</dd></div>
        <div><dt>Historical Rows Included</dt><dd>${context.historicalRowsCount}</dd></div>
        <div><dt>Historical Terms Used</dt><dd>${escapeAttr(historicalTerms)}</dd></div>
        <div><dt>Comparable Term Basis</dt><dd>${escapeAttr(context.comparableBasis)}</dd></div>
        <div><dt>Missing Milestone Fields</dt><dd>${escapeAttr(missing)}</dd></div>
      </dl>`;
  }

  function renderDashboard(summary, scopeContext = null) {
    if (scopeContext) renderDashboardScopePanel(scopeContext);
    const health = summary.health || {};
    const lifecycle = health.lifecycle || [];
    metric('dashboardMetrics', [
      ['Current Enrollment', health.currentEnrollment ?? 0],
      ['Expected Enrollment', health.expectedEnrollment == null ? 'N/A' : health.expectedEnrollment],
      ['Variance', health.variance == null ? 'N/A' : health.variance],
      ['Courses Reviewed', health.coursesReviewed ?? 0],
      ['Sections Reviewed', health.sectionsReviewed ?? 0],
      ['FTES', round1(health.ftes || 0)],
      ...lifecycle.map(item => [item.label, item.value == null ? 'N/A' : item.value])
    ]);

    const presence = summary.presence || { rows: [] };
    const structure = summary.structure || { modality: [] };
    document.getElementById('dashboardInsights').innerHTML = [
      dashboardPanel('Registration Pace Monitor', miniTable(summary.pace || [], ['dimension', 'name', 'currentEnrollment', 'expectedEnrollment', 'variance', 'variancePct', 'status'], 'pace')),
      dashboardPanel('Growth Opportunities', miniTable(summary.growth || [], ['course', 'waitlist', 'openSeats', 'viableOpenSeats', 'sameModalitySeats', 'onlineSeats', 'sameCampusSeats', 'timeWindowSeats', 'fillRate', 'recommendation'], 'growth')),
      dashboardPanel('Reduction Opportunities', `${miniTable(summary.reduction || [], ['type', 'course', 'potentialSectionsRemoved', 'availableReceivingCapacity', 'recommendation'], 'reduction')}<button type="button" data-report-target="${REPORTS.consolidation}">Open Consolidation Report</button>`),
      dashboardPanel('Student Presence Analytics', `${presenceExtremes(presence)}${miniTable(presence.rows || [], ['campus', 'day', 'hour', 'studentsPresent', 'sectionsActive', 'availableRoomCapacity'], 'presence')}<button type="button" data-report-target="${REPORTS.studentPresence}">Open Student Presence Report</button>`),
      dashboardPanel('Schedule Structure', `${structureSummary(structure)}${miniTable(structure.modality || [], ['modality', 'sections', 'enrollment'], 'structure')}`)
    ].join('');

    table('dashboardRotationTable', state.rotationRows, [
      'course',
      'courseTitle',
      'division',
      'department',
      'termsOffered',
      'termsOfferedCount',
      'averageGap',
      'rotationCycle',
      'lastOffered',
      'expectedNextOffering',
      'rotationStatus'
    ]);
    renderDashboardLegend();
  }

  function dashboardPanel(title, body) {
    return `<section class="dashboard-panel"><h3>${escapeAttr(title)}</h3>${body}</section>`;
  }

  function miniTable(rows, columns, tableType = '') {
    const display = (rows || []).slice(0, 12);
    if (!display.length) return '<p class="analytics-empty">No rows match the selected criteria.</p>';
    return `<div class="dashboard-table-wrap"><table class="dashboard-mini-table dashboard-mini-table-${escapeAttr(tableType)}"><thead><tr>${columns.map(column => dashboardMiniHeader(column, tableType)).join('')}</tr></thead><tbody>${display.map(row => `<tr>${columns.map(column => `<td class="${dashboardCellClass(column)}">${escapeAttr(format(row[column], column))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function dashboardMiniHeader(column, tableType) {
    const full = label(column);
    const compact = dashboardCompactLabel(column, tableType);
    return `<th title="${escapeAttr(full)}" aria-label="${escapeAttr(full)}"><span>${escapeAttr(compact)}</span></th>`;
  }

  function dashboardCompactLabel(column, tableType) {
    const labels = {
      pace: {
        dimension: 'Type',
        name: 'Group',
        currentEnrollment: 'Current',
        expectedEnrollment: 'Expected',
        variance: 'Var.',
        variancePct: 'Var. %',
        status: 'Status'
      },
      growth: {
        course: 'Course',
        waitlist: 'WL',
        openSeats: 'Open',
        viableOpenSeats: 'Viable',
        sameModalitySeats: 'Same Mod.',
        onlineSeats: 'Online',
        sameCampusSeats: 'Campus',
        timeWindowSeats: '+/-Hr',
        fillRate: 'Fill',
        recommendation: 'Rec.'
      },
      reduction: {
        type: 'Type',
        course: 'Course',
        potentialSectionsRemoved: 'Reductions',
        availableReceivingCapacity: 'Receiving Cap.',
        recommendation: 'Recommendation'
      },
      presence: {
        campus: 'Campus',
        day: 'Day',
        hour: 'Hour',
        studentsPresent: 'Students',
        sectionsActive: 'Sections',
        availableRoomCapacity: 'Open Cap.'
      },
      structure: {
        modality: 'Modality',
        sections: 'Sections',
        enrollment: 'Enrollment'
      }
    };
    return labels[tableType]?.[column] || label(column);
  }

  function dashboardCellClass(column) {
    return column === 'recommendation' || column === 'status' ? 'dashboard-cell-text' : '';
  }

  function presenceExtremes(presence) {
    const peak = presence.peak ? `${presence.peak.campus} ${presence.peak.day} ${presence.peak.hour}: ${presence.peak.studentsPresent}` : 'N/A';
    const lightest = presence.lightest ? `${presence.lightest.campus} ${presence.lightest.day} ${presence.lightest.hour}: ${presence.lightest.studentsPresent}` : 'N/A';
    return `<p class="dashboard-note"><strong>Peak:</strong> ${escapeAttr(peak)} <strong>Lightest:</strong> ${escapeAttr(lightest)}</p>`;
  }

  function structureSummary(structure) {
    return `<p class="dashboard-note"><strong>Prime:</strong> ${structure.primeSections || 0} sections / ${structure.primeEnrollment || 0} enrollment <strong>Off-peak:</strong> ${structure.offPeakSections || 0} sections / ${structure.offPeakEnrollment || 0} enrollment</p>`;
  }

  async function loadStudentPresenceRows() {
    const uploaded = await readCsv(document.getElementById('studentPresenceCsv'));
    const archived = await readArchivedRows('spArchiveTerms');
    const reportRows = dedupeEnrollmentRows([...uploaded, ...archived].map(normalize))
      .filter(row => !isOmittedInstructionalMethod(row));
    if (reportRows.length) return { rows: reportRows, sourceLabel: 'Student Presence report data' };
    return { rows: dashboardSourceRows().filter(row => !isOmittedInstructionalMethod(row)), sourceLabel: 'Shared dashboard data' };
  }

  async function runStudentPresence() {
    state.studentPresenceRan = true;
    const saved = captureFilterState('sp');
    const loaded = await loadStudentPresenceRows();
    const sourceRows = loaded.rows;
    const focusTerm = updatePresenceFocusTermOptions(sourceRows);
    refreshAnalyticsFilters('sp', sourceRows, saved);
    const scopedRows = applyFilters(dashboardCurrentRows(sourceRows, focusTerm), 'sp');
    const report = dashboard.studentPresenceReport(scopedRows, document.getElementById('spGroup')?.value || 'campusDayHour');
    state.studentPresenceRows = report.rows;
    renderStudentPresenceReport(report, scopedRows, loaded.sourceLabel);
  }

  function renderStudentPresenceReport(report, scopedRows = [], sourceLabel = 'Student Presence report data') {
    const metrics = report.metrics || {};
    metric('studentPresenceMetrics', [
      ['Focus Term', studentPresenceFocusTerm() || 'N/A'],
      ['Data Source', sourceLabel],
      ['Students Present', metrics.totalStudents || 0],
      ['Sections Active', metrics.totalSections || 0],
      ['Seats Scheduled', metrics.totalSeats || 0],
      ['Available Capacity', metrics.totalOpen || 0],
      ['Average Fill Rate', pct(metrics.averageFillRate || 0)],
      ['Peak Hour', presenceMetricLabel(metrics.peakHour)],
      ['Lightest Hour', presenceMetricLabel(metrics.lightestHour)],
      ['Peak Campus', presenceMetricLabel(metrics.peakCampus)],
      ['Peak Building', presenceMetricLabel(metrics.peakBuilding)],
      ['Peak Room', presenceMetricLabel(metrics.peakRoom)]
    ]);
    renderDataQualityWarnings('studentPresenceMetrics', studentPresenceWarnings(scopedRows, sourceLabel));
    renderPresenceHeatmap(report.rows || []);
    table('studentPresenceTable', report.rows || [], [
      'group',
      'campus',
      'building',
      'room',
      'day',
      'hour',
      'studentsPresent',
      'sectionsActive',
      'availableRoomCapacity',
      'seatsScheduled',
      'averageFillRate'
    ]);
    renderStudentPresenceLegend();
  }

  function studentPresenceWarnings(rows, sourceLabel) {
    const warnings = [];
    if (sourceLabel === 'Shared dashboard data') warnings.push('Report is using shared dashboard data because no Student Presence CSV or archived term was selected.');
    if (!(rows || []).length) warnings.push('No fixed physical presence rows match the selected focus term and filters.');
    if ((rows || []).some(row => !row.campus)) warnings.push('Campus field missing for one or more included rows.');
    if ((rows || []).some(row => !row.building)) warnings.push('Building field missing for one or more included rows.');
    if ((rows || []).some(row => !row.roomOnly && !row.room)) warnings.push('Room field missing for one or more included rows.');
    return warnings;
  }

  function renderDataQualityWarnings(beforeId, warnings) {
    const anchor = document.getElementById(beforeId);
    if (!anchor) return;
    let node = document.getElementById(`${beforeId}Warnings`);
    if (!node) {
      node = document.createElement('div');
      node.id = `${beforeId}Warnings`;
      node.className = 'analytics-warning-panel';
      anchor.insertAdjacentElement('beforebegin', node);
    }
    node.innerHTML = (warnings || []).length
      ? `<strong>Scope & Data Quality</strong><ul>${warnings.map(warning => `<li>${escapeAttr(warning)}</li>`).join('')}</ul>`
      : '';
  }

  function presenceMetricLabel(item) {
    return item ? `${item.group} (${item.studentsPresent})` : 'N/A';
  }

  function renderPresenceHeatmap(rows) {
    const node = document.getElementById('studentPresenceHeatmap');
    if (!node) return;
    const cells = (rows || []).slice(0, 12).map(row => `
      <section>
        <h3>${escapeAttr(row.group)}</h3>
        <ul>
          <li>Students: ${row.studentsPresent}</li>
          <li>Sections: ${row.sectionsActive}</li>
          <li>Open capacity: ${row.availableRoomCapacity}</li>
        </ul>
      </section>`).join('');
    node.innerHTML = cells || '<p class="analytics-empty">No fixed in-person or hybrid presence rows match the selected filters.</p>';
  }

  function renderStudentPresenceLegend() {
    const legend = document.getElementById('studentPresenceLegend');
    if (!legend) return;
    renderMethodologyPanel(legend, {
      title: 'Student Presence Analytics Methodology & Data Dictionary',
      purpose: 'Estimates physical student presence from loaded scheduled sections and enrollment for the selected focus term.',
      methodology: 'Rows are included only when they are in-person or hybrid, have fixed meeting days and times, and do not use online, web, virtual, or TBA campus values. Students present uses census enrollment when available and current enrollment otherwise.',
      assumptions: 'Available room capacity is scheduled seats minus enrollment for the included meeting buckets. A multi-day section contributes to each scheduled meeting day/hour bucket.',
      limitations: 'This report does not count unscheduled student presence, online attendance, tutoring, library use, athletics, events, or services traffic.',
      items: [
        ['Students Present', 'Sum of census/current enrollment in the selected physical presence bucket.'],
        ['Sections Active', 'Count of scheduled section meetings represented in the bucket.'],
        ['Available Room Capacity', 'Scheduled capacity minus enrollment for the bucket, floored at zero.'],
        ['Seats Scheduled', 'Total scheduled section capacity in the bucket.'],
        ['Average Fill Rate', 'Students Present divided by Seats Scheduled.'],
        ['Peak/Lightest', 'Highest and lowest physical presence buckets after filters are applied.']
      ],
      version: 'Methodology v1.0'
    });
  }

  function emptyAttritionRecord(group) {
    return {
      group,
      sections: 0,
      census: 0,
      final: 0,
      capacity: 0,
      terms: new Set(),
      decisionSections: 0,
      decisionCensus: 0,
      decisionFinal: 0,
      decisionCapacity: 0,
      historySections: 0,
      historyCensus: 0,
      historyFinal: 0,
      historyCapacity: 0,
      historyTerms: new Set()
    };
  }

  function dedupeEnrollmentRows(rows) {
    const map = new Map();
    rows.forEach(row => {
      const key = sectionKey(row);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...row, days: [...row.days], dayPattern: row.dayPattern, _meetingRows: [...(row._meetingRows || [])] });
        return;
      }
      const daySet = new Set([...(existing.days || []), ...(row.days || [])]);
      existing.days = [...daySet];
      existing.dayPattern = dayPattern(existing.days) || existing.dayPattern || row.dayPattern || 'TBA';
      existing._meetingRows = [...(existing._meetingRows || []), ...(row._meetingRows || [])];
      if (!existing.start || (row.start && row.start < existing.start)) existing.start = row.start;
      if (!existing.end || (row.end && row.end > existing.end)) existing.end = row.end;
      existing.timeBlock = timeBlock(existing.start, existing.modality);
      existing.room = existing.room || row.room;
      existing.instructor = existing.instructor || row.instructor;
      existing.waitlist = Math.max(existing.waitlist || 0, row.waitlist || 0);
      existing.cap = Math.max(existing.cap || 0, row.cap || 0);
      existing.accountingMethod = existing.accountingMethod || row.accountingMethod;
      existing.accountingCategory = accountingMethodInfo(existing.accountingMethod).category;
      existing.accountingMethodLabel = accountingMethodInfo(existing.accountingMethod).label;
      existing.accountingReportable = accountingMethodInfo(existing.accountingMethod).reportable;
    });
    return [...map.values()].map(recalculateEstimatedFtes);
  }

  async function loadAttritionFiles() {
    const uploaded = await readCsv(document.getElementById('enrollmentCsv'));
    const archived = await readArchivedRows('attrArchiveTerms');
    state.enrollment = dedupeEnrollmentRows([...uploaded, ...archived].map(normalize))
      .filter(row => !isOmittedInstructionalMethod(row));
    const fallbackRows = currentRows().filter(row => !isOmittedInstructionalMethod(row));
    const allEnrollment = state.enrollment.length ? state.enrollment : fallbackRows;
    state.attritionTerms = collectTerms(allEnrollment);
    updateDecisionTermOptions(state.attritionTerms);
    populateAnalyticsFilters('attr', allEnrollment);
    return allEnrollment;
  }

  async function runAttrition() {
    state.attritionRan = true;
    const allEnrollment = await loadAttritionFiles();
    const decisionTerm = attritionDecisionTerm() || updateDecisionTermOptions(state.attritionTerms);
    const includeHistory = document.getElementById('attrIncludeHistory')?.checked;
    const enrollment = applyFilters(allEnrollment, 'attr')
      .filter(row => includeHistory || row.term === decisionTerm);
    const grouped = new Map();
    const groupBy = document.getElementById('attrGroup')?.value || 'COURSE';
    enrollment.forEach((row) => {
      const key = groupKey(row, groupBy);
      const item = grouped.get(key) || emptyAttritionRecord(key);
      const isDecisionTerm = row.term === decisionTerm;
      const censusEnroll = censusEnrollment(row);
      const finalEnroll = finalEnrollment(row);
      item.sections += 1;
      item.census += censusEnroll;
      item.final += finalEnroll;
      item.capacity += row.cap;
      item.terms.add(row.term || 'UNKNOWN');
      if (isDecisionTerm) {
        item.decisionSections += 1;
        item.decisionCensus += censusEnroll;
        item.decisionFinal += finalEnroll;
        item.decisionCapacity += row.cap;
      } else {
        item.historySections += 1;
        item.historyCensus += censusEnroll;
        item.historyFinal += finalEnroll;
        item.historyCapacity += row.cap;
        item.historyTerms.add(row.term || 'UNKNOWN');
      }
      grouped.set(key, item);
    });
    const min = Number(document.getElementById('attrMinSections')?.value || 1);
    state.attritionRows = [...grouped.values()].filter((r) => r.sections >= min).map((r) => ({
      ...r,
      terms: r.terms.size,
      historyTerms: r.historyTerms.size,
      totalSeats: r.capacity,
      courseHistoricalTermsIncluded: r.historyTerms.size,
      overallHistoricalTermsIncluded: collectRowTerms(enrollment.filter(row => row.term && row.term !== decisionTerm)).length,
      decisionTermIncluded: r.decisionSections > 0 ? 1 : 0,
      totalUploadedTerms: r.terms.size,
      decisionAttritionCount: Math.max(0, r.decisionCensus - r.decisionFinal),
      decisionAttritionRate: r.decisionCensus > 0 ? Math.max(0, r.decisionCensus - r.decisionFinal) / r.decisionCensus : 0,
      historicalAttritionCount: Math.max(0, r.historyCensus - r.historyFinal),
      historicalAttritionRate: r.historyCensus > 0 ? Math.max(0, r.historyCensus - r.historyFinal) / r.historyCensus : 0,
      historicalAvgCensusEnrollment: safeDiv(r.historyCensus, r.historyTerms.size || 0),
      historicalAvgFinalEnrollment: safeDiv(r.historyFinal, r.historyTerms.size || 0),
      historicalAvgCensusFillRate: safeDiv(r.historyCensus, r.historyCapacity),
      historicalAvgFinalFillRate: safeDiv(r.historyFinal, r.historyCapacity),
      historicalAvgAttritionRate: r.historyCensus > 0 ? Math.max(0, r.historyCensus - r.historyFinal) / r.historyCensus : 0,
      historicalTotalAttritionCount: Math.max(0, r.historyCensus - r.historyFinal),
      attritionCount: Math.max(0, r.census - r.final),
      attritionRate: r.census > 0 ? Math.max(0, r.census - r.final) / r.census : 0,
      censusFillRate: r.capacity > 0 ? r.census / r.capacity : 0,
      finalFillRate: r.capacity > 0 ? r.final / r.capacity : 0,
      emptySeatsAtCensus: Math.max(0, r.capacity - r.census),
      emptySeatsAtFinal: Math.max(0, r.capacity - r.final),
      availableAtCensus: Math.max(0, r.capacity - r.census),
      availableAtEnd: Math.max(0, r.capacity - r.final)
    })).sort((a, b) => b.attritionCount - a.attritionCount || b.historicalAttritionCount - a.historicalAttritionCount);
    const decisionRows = state.attritionRows.filter(row => row.decisionSections > 0);
    const filteredTerms = collectRowTerms(enrollment);
    const historicalTerms = collectRowTerms(enrollment.filter(row => row.term && row.term !== decisionTerm));
    metric('attritionMetrics', [
      ['Decision Term', decisionTerm || 'N/A'],
      ['Historical Terms Included', historicalTerms.length],
      ['Decision Term Included', decisionRows.length ? 1 : 0],
      ['Total Uploaded Terms', filteredTerms.length],
      ['Decision Sections', sum(decisionRows, 'decisionSections')],
      ['Decision Census Enrollment', sum(state.attritionRows, 'decisionCensus')],
      ['Decision Final/Current Enrollment', sum(state.attritionRows, 'decisionFinal')],
      ['Decision Attrition Rate', pct(safeDiv(sum(state.attritionRows, 'decisionAttritionCount'), sum(state.attritionRows, 'decisionCensus')))],
      ['Historical Avg Census Enrollment', Math.round(safeDiv(sum(state.attritionRows, 'historyCensus'), Math.max(1, historicalTerms.length)))],
      ['Historical Avg Final Enrollment', Math.round(safeDiv(sum(state.attritionRows, 'historyFinal'), Math.max(1, historicalTerms.length)))],
      ['Historical Total Attrition Count', sum(state.attritionRows, 'historicalTotalAttritionCount')],
      ['Historical Avg Attrition Rate', pct(safeDiv(sum(state.attritionRows, 'historicalTotalAttritionCount'), sum(state.attritionRows, 'historyCensus')))],
      ['All Uploaded Terms Attrition Rate', pct(safeDiv(sum(state.attritionRows, 'attritionCount'), sum(state.attritionRows, 'census')))]
    ]);
    table('attritionTable', state.attritionRows, [
      'group',
      'courseHistoricalTermsIncluded',
      'overallHistoricalTermsIncluded',
      'totalUploadedTerms',
      'decisionSections',
      'sections',
      'totalSeats',
      'census',
      'final',
      'historicalAvgCensusEnrollment',
      'historicalAvgFinalEnrollment',
      'historicalAvgCensusFillRate',
      'historicalAvgFinalFillRate',
      'historicalAvgAttritionRate',
      'historicalTotalAttritionCount',
      'decisionCensus',
      'decisionFinal',
      'decisionAttritionRate',
      'attritionCount',
      'attritionRate',
      'historicalAttritionRate',
      'censusFillRate',
      'finalFillRate',
      'emptySeatsAtCensus',
      'emptySeatsAtFinal'
    ]);
    renderAttritionLegend();
  }

  function groupKey(row, groupBy) {
    const map = {
      OVERALL: 'Overall',
      SUBJECT: row.subject,
      COURSE: `${row.subject} ${row.course}`,
      SECTION: `${row.subject} ${row.course} ${row.section}`,
      INSTRUCTOR: row.instructor || 'UNKNOWN',
      CAMPUS: row.campus || 'UNKNOWN',
      MODALITY: row.modality,
      'DAY PATTERN': row.dayPattern,
      'TIME BLOCK': row.timeBlock
    };
    return map[groupBy] || map.COURSE;
  }

  function populateInstructorAvailabilityFilters(rows = currentRows()) {
    const instructorSelect = document.getElementById('iaInstructor');
    const campusSelect = document.getElementById('iaCampus');
    const divisionSelect = document.getElementById('iaDivision');
    const disciplineSelect = document.getElementById('iaDiscipline');
    if (!instructorSelect || !campusSelect) return;
    const selectedPrior = [...instructorSelect.selectedOptions].map(option => option.value);
    const campusPrior = campusSelect.value;
    const divisionPrior = divisionSelect?.value || '';
    const disciplinePrior = disciplineSelect?.value || '';
    const divisions = [...new Set(rows.map(row => row.division).filter(Boolean))].sort();
    const disciplineRows = rows.filter(row => !divisionPrior || row.division === divisionPrior);
    const disciplines = [...new Set(disciplineRows.map(row => row.subject).filter(Boolean))].sort();
    if (divisionSelect) {
      divisionSelect.replaceChildren(new Option('All divisions', ''));
      divisions.forEach(division => divisionSelect.add(new Option(division, division)));
      if (divisions.includes(divisionPrior)) divisionSelect.value = divisionPrior;
    }
    if (disciplineSelect) {
      disciplineSelect.replaceChildren(new Option('All disciplines', ''));
      disciplines.forEach(discipline => disciplineSelect.add(new Option(discipline, discipline)));
      if (disciplines.includes(disciplinePrior)) disciplineSelect.value = disciplinePrior;
    }
    const visibleRows = rows.filter(row => {
      if (divisionSelect?.value && row.division !== divisionSelect.value) return false;
      if (disciplineSelect?.value && row.subject !== disciplineSelect.value) return false;
      return true;
    });
    const instructors = [...new Set(visibleRows.map(row => row.instructor).filter(Boolean))].sort();
    const campuses = [...new Set(rows.map(row => row.campus).filter(Boolean))].sort();
    instructorSelect.replaceChildren();
    instructors.forEach(instructor => instructorSelect.add(new Option(instructor, instructor)));
    [...instructorSelect.options].forEach(option => {
      option.selected = selectedPrior.length ? selectedPrior.includes(option.value) : true;
    });
    campusSelect.replaceChildren(new Option('All campuses', ''));
    campuses.forEach(campus => campusSelect.add(new Option(campus, campus)));
    if (campuses.includes(campusPrior)) campusSelect.value = campusPrior;
  }

  function runInstructorAvailability() {
    const rows = dedupeEnrollmentRows(currentRows()).filter(row => row.instructor);
    populateInstructorAvailabilityFilters(rows);
    const selectedInstructors = selectedInstructorAvailabilityInstructors();
    const visibleInstructors = [...(document.getElementById('iaInstructor')?.options || [])].map(option => option.value);
    const day = document.getElementById('iaDay')?.value || 'MO';
    const start = document.getElementById('iaStart')?.value || '';
    const end = document.getElementById('iaEnd')?.value || '';
    const campus = document.getElementById('iaCampus')?.value || '';
    const startMinutes = minutesFromTime(start);
    const endMinutes = minutesFromTime(end);
    if (!start || !end || startMinutes == null || endMinutes == null || endMinutes <= startMinutes) {
      metric('instructorAvailabilityMetrics', [
        ['Status', 'Needs Time'],
        ['Known Busy', 0],
        ['Potentially Available', 0]
      ]);
      document.getElementById('instructorAvailabilityTable').innerHTML = '<p class="analytics-empty">Enter a valid start and end time, then click Run.</p>';
      document.getElementById('instructorAvailabilityCalendar').innerHTML = '';
      document.getElementById('instructorAvailabilityTimes').innerHTML = '';
      renderInstructorAvailabilityLegend();
      return;
    }
    const scopedRows = rows.filter(row => visibleInstructors.includes(row.instructor) && (!selectedInstructors.length || selectedInstructors.includes(row.instructor)) && (!campus || row.campus === campus));
    const instructors = selectedInstructors.length ? selectedInstructors : visibleInstructors;
    const conflictsByInstructor = group(scopedRows.filter(row => instructorHasConflict(row, day, startMinutes, endMinutes)), row => row.instructor);
    const results = instructors.map(name => {
      const conflicts = conflictsByInstructor.get(name) || [];
      const status = conflicts.length ? 'Known Busy' : 'Potentially Available';
      return {
        instructor: name,
        status,
        day: dayLabels[day] || day,
        requestedWindow: `${start}-${end}`,
        conflictCount: conflicts.length,
        conflicts: conflicts.map(row => `${row.subject} ${row.course} ${row.section} / ${row.dayPattern} / ${row.start}-${row.end} / ${row.campus || 'Campus N/A'}`).join('; ') || 'No loaded schedule conflict found',
        campus: campus || 'All'
      };
    }).sort((a, b) => a.status.localeCompare(b.status) || a.instructor.localeCompare(b.instructor));
    const busy = results.filter(row => row.status === 'Known Busy').length;
    metric('instructorAvailabilityMetrics', [
      ['Day/Time Checked', `${dayLabels[day] || day} ${start}-${end}`],
      ['Known Busy', busy],
      ['Potentially Available', results.length - busy],
      ['Instructors Reviewed', results.length],
      ['Scoped Visible Instructors', visibleInstructors.length]
    ]);
    renderInstructorAvailabilityCalendar(instructors, scopedRows, campus);
    renderInstructorAvailableTimes(instructors, scopedRows, campus);
    table('instructorAvailabilityTable', results, [
      'instructor',
      'status',
      'day',
      'requestedWindow',
      'conflictCount',
      'conflicts',
      'campus'
    ]);
    renderInstructorAvailabilityLegend();
  }

  function selectedInstructorAvailabilityInstructors() {
    const select = document.getElementById('iaInstructor');
    return select ? [...select.selectedOptions].map(option => option.value).filter(Boolean) : [];
  }

  function instructorHasConflict(row, day, startMinutes, endMinutes) {
    if (!row.days?.includes(day)) return false;
    const meeting = instructorMeetingMinutes(row);
    if (!meeting) return false;
    const [rowStart, rowEnd] = meeting;
    return rowStart < endMinutes && rowEnd > startMinutes;
  }

  function instructorMeetingMinutes(row) {
    if (!row?.start || !row?.end) return null;
    if (row.start === '00:00' || row.end === '00:00') return null;
    const rowStart = minutesFromTime(row.start);
    const rowEnd = minutesFromTime(row.end);
    if (rowStart == null || rowEnd == null) return null;
    if (rowEnd <= rowStart) return null;
    return [rowStart, rowEnd];
  }

  function clearInstructorAvailability() {
    const instructor = document.getElementById('iaInstructor');
    const campus = document.getElementById('iaCampus');
    const division = document.getElementById('iaDivision');
    const discipline = document.getElementById('iaDiscipline');
    if (instructor) [...instructor.options].forEach(option => { option.selected = true; });
    if (campus) campus.value = '';
    if (division) division.value = '';
    if (discipline) discipline.value = '';
    const day = document.getElementById('iaDay');
    const start = document.getElementById('iaStart');
    const end = document.getElementById('iaEnd');
    if (day) day.value = 'MO';
    if (start) start.value = '09:00';
    if (end) end.value = '10:00';
    runInstructorAvailability();
  }

  function selectVisibleInstructors() {
    const instructor = document.getElementById('iaInstructor');
    if (!instructor) return;
    [...instructor.options].forEach(option => {
      option.selected = true;
    });
  }

  function renderInstructorAvailabilityCalendar(instructors, rows, campus) {
    const node = document.getElementById('instructorAvailabilityCalendar');
    if (!node) return;
    const days = ['MO', 'TU', 'WE', 'TH', 'FR'];
    const dayStart = 6 * 60;
    const dayEnd = 22 * 60;
    const slotMinutes = 30;
    if (!instructors.length) {
      node.innerHTML = '<p class="analytics-empty">No instructors are available in the loaded schedule data.</p>';
      return;
    }
    const slotCount = (dayEnd - dayStart) / slotMinutes;
    const headers = ['Time', ...days.map(day => dayLabels[day])].map((label, index) =>
      `<div class="instructor-grid-header" style="grid-column:${index + 1};grid-row:1">${escapeAttr(label)}</div>`
    ).join('');
    const timeLabels = Array.from({ length: slotCount }, (_, index) => {
      const minutes = dayStart + index * slotMinutes;
      return `<div class="instructor-grid-time" style="grid-column:1;grid-row:${index + 2}">${escapeAttr(formatMinutes(minutes))}</div>`;
    }).join('');
    const cells = days.map((day, dayIndex) => Array.from({ length: slotCount }, (_, slotIndex) =>
      `<div class="instructor-grid-cell" style="grid-column:${dayIndex + 2};grid-row:${slotIndex + 2}"></div>`
    ).join('')).join('');
    const events = [];
    rows
      .filter(row => instructors.includes(row.instructor) && (!campus || row.campus === campus))
      .forEach(row => {
        days.filter(day => row.days?.includes(day)).forEach(day => {
          const meeting = instructorMeetingMinutes(row);
          if (!meeting) return;
          const [start, end] = meeting;
          if (start == null || end == null || end <= dayStart || start >= dayEnd) return;
          events.push({
            ...row,
            day,
            startMinutes: Math.max(dayStart, start),
            endMinutes: Math.min(dayEnd, end)
          });
        });
      });
    const positioned = positionInstructorEvents(events, days);
    const blocks = positioned.map((event, index) => {
      const dayIndex = days.indexOf(event.day);
      const rowHeight = 32;
      const startOffset = event.startMinutes - dayStart;
      const startRow = Math.floor(startOffset / slotMinutes) + 2;
      const minuteOffset = startOffset % slotMinutes;
      const topOffset = Math.max(2, (minuteOffset / slotMinutes) * rowHeight + 2);
      const eventHeight = Math.max(26, ((event.endMinutes - event.startMinutes) / slotMinutes) * rowHeight - 4);
      const span = Math.max(1, Math.ceil((minuteOffset + event.endMinutes - event.startMinutes) / slotMinutes));
      const width = `calc(${100 / event.columnCount}% - 5px)`;
      const left = `calc(${event.column * 100 / event.columnCount}% + 2px)`;
      return `
        <div class="instructor-grid-event" data-instructor-event="${index}" tabindex="0" style="grid-column:${dayIndex + 2};grid-row:${startRow} / span ${span};width:${width};margin-left:${left};margin-top:${topOffset}px;height:${eventHeight}px">
          <strong>${escapeAttr(event.instructor)}</strong>
          <span>${escapeAttr(`${event.subject} ${event.course} ${event.section}`)}</span>
          <small>${escapeAttr(`${event.start}-${event.end} ${event.campus || ''}`)}</small>
        </div>`;
    }).join('');
    node.innerHTML = `
      <div class="instructor-grid-note">Selected instructors share this grid. Overlapping meetings are shown side by side in the same day/time area.</div>
      <div class="instructor-calendar-grid" style="grid-template-rows:34px repeat(${slotCount},32px)">
        ${headers}${timeLabels}${cells}${blocks}
      </div>`;
    attachInstructorGridTooltips(node, positioned);
  }

  function attachInstructorGridTooltips(node, events) {
    const tooltip = document.getElementById('class-block-tooltip');
    if (!tooltip) return;
    node.querySelectorAll('[data-instructor-event]').forEach(block => {
      const event = events[Number(block.dataset.instructorEvent)];
      if (!event) return;
      const show = (e) => {
        setInstructorTooltipLines(tooltip, instructorTooltipLines(event));
        tooltip.style.display = 'block';
        positionInstructorTooltip(tooltip, e, block);
      };
      const move = (e) => positionInstructorTooltip(tooltip, e, block);
      const hide = () => { tooltip.style.display = 'none'; };
      block.addEventListener('mouseenter', show);
      block.addEventListener('mousemove', move);
      block.addEventListener('mouseleave', hide);
      block.addEventListener('focus', show);
      block.addEventListener('blur', hide);
    });
  }

  function positionInstructorTooltip(tooltip, event, block) {
    if (event?.pageX != null && event?.pageY != null) {
      tooltip.style.left = `${event.pageX + 12}px`;
      tooltip.style.top = `${event.pageY + 12}px`;
      return;
    }
    const rect = block.getBoundingClientRect();
    tooltip.style.left = `${rect.right + window.scrollX + 8}px`;
    tooltip.style.top = `${rect.top + window.scrollY - 10}px`;
  }

  function setInstructorTooltipLines(tooltip, lines) {
    if (typeof window.setTooltipLines === 'function') {
      window.setTooltipLines(tooltip, lines);
      return;
    }
    tooltip.replaceChildren();
    lines.forEach(({ text, bold = false }) => {
      if (text === undefined || text === null || text === '') return;
      const span = document.createElement('span');
      span.textContent = text;
      if (bold) span.style.fontWeight = 'bold';
      tooltip.appendChild(span);
      tooltip.appendChild(document.createElement('br'));
    });
  }

  function instructorTooltipLines(event) {
    const course = `${event.subject || ''} ${event.course || ''}`.trim();
    const section = event.section ? `Section: ${event.section}` : '';
    const crn = event.crn ? `CRN: ${event.crn}` : '';
    const time = `Time: ${formatMinutes(event.startMinutes)} - ${formatMinutes(event.endMinutes)}`;
    const dateRange = instructorDateRange(event);
    const fill = event.cap > 0 ? `Fill: ${event.actual}/${event.cap} (${pct(event.actual / event.cap)})` : '';
    return [
      { text: course, bold: true },
      { text: event.title },
      { text: crn },
      { text: section },
      { text: event.term ? `Term: ${event.term}` : '' },
      { text: `Days: ${event.dayPattern || event.day || 'N/A'}` },
      { text: time },
      { text: dateRange ? `Date Range: ${dateRange}` : '' },
      { text: `Instructor: ${event.instructor || 'N/A'}` },
      { text: event.room ? `Room: ${event.room}` : '' },
      { text: event.campus ? `Campus: ${event.campus}` : '' },
      { text: event.modality ? `Modality: ${event.modality}` : '' },
      { text: event.cap ? `Capacity: ${event.cap}` : '' },
      { text: event.census != null ? `Census Enrollment: ${event.census}` : '' },
      { text: `Current/Final Enrollment: ${event.actual || 0}` },
      { text: event.hasWaitlistData ? `Waitlist: ${event.waitlist || 0}` : '' },
      { text: fill }
    ];
  }

  function instructorDateRange(event) {
    const raw = event.raw || {};
    const start = raw['Start_Date'] || raw['Start Date'] || raw.START_DATE || raw.start_date || '';
    const end = raw['End_Date'] || raw['End Date'] || raw.END_DATE || raw.end_date || '';
    if (!start && !end) return '';
    return `${start || 'N/A'} - ${end || 'N/A'}`;
  }

  function positionInstructorEvents(events, days) {
    const positioned = [];
    days.forEach(day => {
      const dayEvents = events
        .filter(event => event.day === day)
        .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes || a.instructor.localeCompare(b.instructor));
      const active = [];
      dayEvents.forEach(event => {
        for (let i = active.length - 1; i >= 0; i -= 1) {
          if (active[i].endMinutes <= event.startMinutes) active.splice(i, 1);
        }
        const used = new Set(active.map(item => item.column));
        let column = 0;
        while (used.has(column)) column += 1;
        event.column = column;
        active.push(event);
        const overlapping = dayEvents.filter(other => other.startMinutes < event.endMinutes && other.endMinutes > event.startMinutes);
        const columnCount = Math.max(1, ...overlapping.map(other => other.column == null ? 0 : other.column + 1), column + 1);
        overlapping.forEach(other => {
          other.columnCount = Math.max(other.columnCount || 1, columnCount);
        });
        event.columnCount = Math.max(event.columnCount || 1, columnCount);
        positioned.push(event);
      });
    });
    return positioned;
  }

  function renderInstructorAvailableTimes(instructors, rows, campus) {
    const node = document.getElementById('instructorAvailabilityTimes');
    if (!node) return;
    const days = ['MO', 'TU', 'WE', 'TH', 'FR'];
    const dayStart = 8 * 60;
    const dayEnd = 18 * 60;
    if (!instructors.length) {
      node.innerHTML = '';
      return;
    }
    const dayItems = days.map(day => {
      const busy = rows
        .filter(row => instructors.includes(row.instructor) && (!campus || row.campus === campus) && row.days?.includes(day))
        .map(row => instructorMeetingMinutes(row))
        .filter(Boolean)
        .sort((a, b) => a[0] - b[0]);
      const windows = availableWindows(busy, dayStart, dayEnd);
      const text = windows.map(([start, end]) => `${formatMinutes(start)}-${formatMinutes(end)}`).join(', ') || 'No shared open windows in range';
      return `<li><strong>${escapeAttr(dayLabels[day])}:</strong> ${escapeAttr(text)}</li>`;
    }).join('');
    node.innerHTML = `
      <h3>Shared Available Time Windows</h3>
      <p>Calculated between 8:00 AM and 6:00 PM, Monday-Friday, by subtracting the combined loaded meeting times for all selected instructors. These are times that are open for everyone selected, not confirmed faculty availability.</p>
      <div class="instructor-shared-availability">
        <h4>${escapeAttr(instructors.length)} selected instructor${instructors.length === 1 ? '' : 's'}</h4>
        <ul>${dayItems}</ul>
      </div>`;
  }

  function availableWindows(busy, dayStart, dayEnd) {
    const merged = [];
    busy.forEach(([rawStart, rawEnd]) => {
      const start = Math.max(dayStart, rawStart);
      const end = Math.min(dayEnd, rawEnd);
      if (end <= dayStart || start >= dayEnd || end <= start) return;
      const last = merged[merged.length - 1];
      if (last && start <= last[1]) last[1] = Math.max(last[1], end);
      else merged.push([start, end]);
    });
    const windows = [];
    let cursor = dayStart;
    merged.forEach(([start, end]) => {
      if (start > cursor) windows.push([cursor, start]);
      cursor = Math.max(cursor, end);
    });
    if (cursor < dayEnd) windows.push([cursor, dayEnd]);
    return windows;
  }

  function formatMinutes(minutes) {
    const hour24 = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const suffix = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 || 12;
    return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
  }

  async function runConsolidation() {
    state.consolidationRan = true;
    const allRows = await loadConsolidationRows();
    const decisionTerm = consolidationDecisionTerm();
    const filteredRows = applyFilters(allRows, 'con');
    const rows = filteredRows.filter(row => !decisionTerm || row.term === decisionTerm);
    const comparisonRows = filteredRows.filter(row => row.term && row.term !== decisionTerm);
    const minSections = Number(document.getElementById('conMinSections')?.value || 5);
    const lowFill = Number(document.getElementById('conLowFill')?.value || 50) / 100;
    const lowEnroll = lowEnrollmentThreshold();
    const options = {
      sameCampus: document.getElementById('conSameCampus')?.checked,
      sameModality: document.getElementById('conSameModality')?.checked,
      dayMatch: document.getElementById('conDayMatch')?.value || 'exact',
      timeWindowHours: document.getElementById('conTimeWindow')?.value === '' ? null : Number(document.getElementById('conTimeWindow')?.value || 2),
      vacancyBasis: document.getElementById('conVacancyBasis')?.value || 'census',
      absorbPct: Math.max(0.01, Math.min(1, Number(document.getElementById('conAbsorbPct')?.value || 60) / 100)),
      chronicThreshold: Number(document.getElementById('conChronic')?.value || 75) / 100,
      minHist: Number(document.getElementById('conMinHist')?.value || 3)
    };
    const onlineRows = rows.filter(isOnlineSection);
    const inPersonRows = rows.filter(row => !isOnlineSection(row));
    const allCourseCount = group(rows, (r) => `${r.term || currentTerm()}||${r.subject} ${r.course}`).size;
    const byCourse = group(inPersonRows, (r) => `${r.term || currentTerm()}||${r.subject} ${r.course}`);
    const history = await historicalPatterns(allRows, decisionTerm, lowFill, lowEnroll);
    const historicalDemand = historicalDemandMap(comparisonRows.filter(row => !isOnlineSection(row)), options.vacancyBasis);
    state.consolidationRows = [];
    if (rows.length) {
      state.consolidationRows.push(...onlineReductionRows(onlineRows, comparisonRows.filter(isOnlineSection), options));
      byCourse.forEach((sections, key) => {
        const course = key.split('||')[1] || key;
        if (sections.length < minSections) return;
        const estimatedSections = sections.map(section => withHistoricalEstimate(section, historicalDemand)).filter(Boolean);
        consolidationGroupRows(course, estimatedSections, history, lowFill, lowEnroll, options)
          .forEach(row => state.consolidationRows.push(row));
      });
    } else {
      state.consolidationRows.push(...historicalPlanningCandidates(comparisonRows, decisionTerm, lowFill, lowEnroll, minSections));
    }
    state.consolidationRows.sort((a, b) => b.score - a.score);
    const onlineOpportunities = state.consolidationRows.filter(row => row.type === 'Online Reduction');
    const flowOpportunities = state.consolidationRows.filter(row => row.type !== 'Online Reduction');
    const potentialSectionReductions = sum(state.consolidationRows, 'potentialSectionsRemoved') || sum(state.consolidationRows, 'recommendedReductions');
    const seatsRecovered = sum(state.consolidationRows, 'potentialSeatsRecovered') || sum(state.consolidationRows, 'freedSeats');
    metric('consolidationMetrics', [
      ['Decision Term', decisionTerm || 'N/A'],
      ['Decision-Term Rows', rows.length],
      ['Courses Reviewed', allCourseCount],
      ['Potential Consolidations', state.consolidationRows.length],
      ['Potential Section Reductions', potentialSectionReductions],
      ['Potential Seats Recovered', seatsRecovered],
      ['Estimated FTES Impact', state.consolidationRows.length ? 'Neutral if absorbed' : 'N/A'],
      ['Online Reduction Candidates', onlineOpportunities.length],
      ['In-Person Consolidation Candidates', flowOpportunities.filter(row => row.type === 'In-Person Consolidation').length],
      ['Hybrid Consolidation Candidates', flowOpportunities.filter(row => row.type === 'Hybrid Consolidation').length],
      ['Chronic Low Enrollment Threshold', lowEnroll == null ? `<= ${pct(lowFill)} census-based expected fill` : `<= ${lowEnroll} census-based expected enrollment`],
      ['Avg Score', Math.round(safeDiv(sum(state.consolidationRows, 'score'), state.consolidationRows.length))]
    ]);
    renderConsolidationTables(state.consolidationRows.map(flattenOpportunity));
    renderConsolidationLegend();
  }

  function historicalPlanningCandidates(rows, decisionTerm, lowFill, lowEnroll, minSections) {
    const comparable = rows.filter(row => isComparableHistoricalTerm(row.term, decisionTerm));
    return [...group(comparable, row => `${row.subject} ${row.course}`).entries()].map(([course, courseRows]) => {
      const byTerm = group(courseRows, row => row.term || 'UNKNOWN');
      const lowTermCount = [...byTerm.values()].filter(termRows => {
        const census = termRows.reduce((total, row) => total + censusEnrollment(row), 0);
        const cap = sum(termRows, 'cap');
        return lowEnroll == null ? safeDiv(census, cap) <= lowFill : census <= lowEnroll;
      }).length;
      const avgSections = Math.round(safeDiv(courseRows.length, byTerm.size || 1) * 10) / 10;
      const avgCensus = Math.round(safeDiv(courseRows.reduce((total, row) => total + censusEnrollment(row), 0), byTerm.size || 1));
      const avgCap = Math.round(safeDiv(sum(courseRows, 'cap'), byTerm.size || 1));
      if (avgSections < minSections && lowTermCount < 1) return null;
      return {
        type: 'Historical Planning Candidate',
        decisionTerm,
        course,
        label: course,
        score: Math.round((lowTermCount / Math.max(1, byTerm.size)) * 100),
        sectionsReviewed: avgSections,
        potentialSectionsRemoved: '',
        expectedEnrollment: avgCensus,
        availableReceivingCapacity: Math.max(0, avgCap - avgCensus),
        potentialSeatsRecovered: '',
        projectionSource: `Comparable historical ${termSeason(decisionTerm) || 'same-season'} terms (${byTerm.size})`,
        finalEnrollmentContext: 'No decision-term rows uploaded',
        recommendation: 'Review future schedule build for possible section count adjustment.',
        matchReason: 'Historical low-fill or excess-capacity pattern; no actual decision-term section exists yet.',
        historicalTerms: byTerm.size,
        chronicLowFill: lowTermCount
      };
    }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 100);
  }

  async function loadDemandRows() {
    const saved = captureFilterState('dem');
    const uploadedRows = await readCsv(document.getElementById('demandCsv'));
    const archivedRows = await readArchivedRows('demArchiveTerms');
    const uploaded = dedupeEnrollmentRows([...uploadedRows, ...archivedRows].map(normalize))
      .filter(row => !isOmittedInstructionalMethod(row));
    state.demandInput = uploaded;
    const rows = uploaded.length ? uploaded : currentRows().filter(row => !isOmittedInstructionalMethod(row));
    state.demandTerms = collectRowTerms(rows);
    updateDemandTermOptions(state.demandTerms);
    refreshAnalyticsFilters('dem', rows, saved);
    return rows;
  }

  async function runDemand() {
    state.demandRan = true;
    setDemandMessage('Loading demand forecast...');
    try {
      const allRows = await loadDemandRows();
      if (!allRows.length) {
        state.demandRows = [];
        renderEmptyDemand('No enrollment rows were loaded. Select archived terms or upload CSV files, then click Run.');
        return;
      }
      const filtered = applyFilters(allRows, 'dem');
      if (!filtered.length) {
        state.demandRows = [];
        renderEmptyDemand('Rows loaded, but none match the current filters. Clear filters or select different archived terms.');
        return;
      }
      const windowSize = Number(document.getElementById('demWindow')?.value || 5);
      const target = demandForecastTarget();
      const finalizedHistorical = filtered.filter(row => isComparableDemandTerm(row, target));
      if (!finalizedHistorical.length) {
        state.demandRows = [];
        renderEmptyDemand(`No comparable finalized historical rows are available before ${target.label}. Select archived completed ${target.scope === 'year' ? 'academic-year' : target.season} terms earlier than the forecast target.`);
        return;
      }
      const analysisRows = normalizeDemandAnalysisTerms(finalizedHistorical, target);
      const filteredTerms = collectRowTerms(analysisRows);
      const selectedTerms = filteredTerms
        .sort((a, b) => termSortValue(a) - termSortValue(b))
        .slice(Math.max(0, filteredTerms.length - windowSize));
      const rows = analysisRows.filter(row => selectedTerms.includes(row.term));
      if (!rows.length) {
        state.demandRows = [];
        renderEmptyDemand('No rows remain after applying the analysis window. Increase the analysis window or choose more terms.');
        return;
      }
      const growthModifier = Number(document.getElementById('demGrowthModifier')?.value || 0) / 100;
      const ftesCap = Number(document.getElementById('demFtesCap')?.value || 0);
      const context = demandGrowthContext(rows);
      state.demandRows = demandForecastRowsForLevels(rows, context, growthModifier);
      const expanding = state.demandRows.filter(row => /expanding|increase/i.test(row.capacityGuidance));
      const softening = state.demandRows.filter(row => /softening/i.test(row.capacityGuidance));
      const collegeRow = state.demandRows.find(row => row.forecastLevel === 'College');
      const forecastFtes = collegeRow?.expectedFtesNextTerm || 0;
      const annualFtes = demandAnnualFtesProjection(target, forecastFtes);
      const yearSeasonForecast = demandYearSeasonForecast(target, rows, annualFtes.annualFtes);
      const capComparisonFtes = annualFtes.annualFtes;
      const ftesCapDelta = ftesCap > 0 ? ftesCap - capComparisonFtes : null;
      metric('demandMetrics', [
        ['Forecast Target', target.label],
        ['Forecast Scope', target.scope === 'year' ? 'Academic year' : 'Single term'],
        ['Terms Included', selectedTerms.length],
        ['Courses Reviewed', state.demandRows.filter(row => row.forecastLevel === 'Course').length],
        ['College Growth', pct(context.collegeGrowth)],
        ['Modifier Applied', pct(growthModifier)],
        ['Historical FTES', round1(collegeRow?.avgFtes || 0)],
        ['Forecast FTES', round1(forecastFtes)],
        ['Known/Projected Companion FTES', round1(annualFtes.companionFtes)],
        ['Annual FTES Projection', round1(capComparisonFtes)],
        ...(yearSeasonForecast ? yearSeasonForecast.seasons.map(row => [`${row.termLabel} Est. FTES`, round1(row.forecastFtes)]) : []),
        ['FTES Cap Position', ftesCapDelta == null ? 'No cap entered' : (ftesCapDelta >= 0 ? `${round1(ftesCapDelta)} under cap` : `${round1(Math.abs(ftesCapDelta))} over cap`)],
        ['Expanding Demand', expanding.length],
        ['Softening Demand', softening.length],
        ['Avg Forecast Growth', pct(safeDiv(sum(state.demandRows, 'adjustedForecastGrowth'), state.demandRows.length))]
      ]);
      renderDemandInsights(state.demandRows, dayTimeDemandRows(rows), demandTrendSeries(rows), yearSeasonForecast);
      table('demandTable', state.demandRows, demandColumns());
      renderDemandLegend();
    } catch (err) {
      console.error('Demand forecast failed:', err);
      state.demandRows = [];
      renderEmptyDemand(`Demand forecast failed: ${err.message || err}`);
    }
  }

  function setDemandMessage(message) {
    const tableNode = document.getElementById('demandTable');
    if (tableNode) tableNode.innerHTML = `<p class="analytics-empty">${message}</p>`;
  }

  function renderEmptyDemand(message) {
    metric('demandMetrics', [
      ['Terms Included', 0],
      ['Courses Reviewed', 0],
      ['Historical FTES', 0],
      ['Forecast FTES', 0],
      ['Known/Projected Companion FTES', 0],
      ['Annual FTES Projection', 0],
      ['FTES Cap Position', 'No cap entered']
    ]);
    const insights = document.getElementById('demandInsights');
    if (insights) insights.innerHTML = '';
    setDemandMessage(message);
    renderDemandLegend();
  }

  function demandColumns() {
    return ['forecastLevel', 'groupName', 'course', 'courseTitle', 'terms', 'totalSectionsOffered', 'avgSectionsOffered', 'avgCensusEnrollment', 'avgFinalEnrollment', 'avgFtes', 'avgFillRate', 'avgFinalFillRate', 'avgAttritionCount', 'avgAttritionRate', 'avgWaitlistCount', 'hasWaitlistData', 'collegeGrowth', 'divisionGrowth', 'disciplineGrowth', 'courseGrowth', 'modifierGrowth', 'adjustedForecastGrowth', 'expectedEnrollmentNextTerm', 'expectedFtesNextTerm', 'expectedFillRate', 'expectedSectionsNeeded', 'suggestedSectionCount', 'forecastConfidence', 'capacityGuidance'];
  }

  function demandForecastRowsForLevels(rows, context, modifierGrowth = 0) {
    const out = [];
    const college = demandForecastRow('College', 'College', rows, context, modifierGrowth);
    if (college) out.push(college);
    group(rows, row => row.division || 'UNKNOWN').forEach((groupRows, key) => {
      const row = demandForecastRow('Division', key, groupRows, context, modifierGrowth);
      if (row) out.push(row);
    });
    group(rows, row => row.subject || 'UNKNOWN').forEach((groupRows, key) => {
      const row = demandForecastRow('Discipline', key, groupRows, context, modifierGrowth);
      if (row) out.push(row);
    });
    group(rows, row => courseKey(row)).forEach((groupRows, key) => {
      const row = demandForecastRow('Course', key, groupRows, context, modifierGrowth);
      if (row) out.push(row);
    });
    const order = { College: 0, Division: 1, Discipline: 2, Course: 3 };
    return out.sort((a, b) => (order[a.forecastLevel] - order[b.forecastLevel]) || b.adjustedForecastGrowth - a.adjustedForecastGrowth || a.groupName.localeCompare(b.groupName));
  }

  function demandForecastRow(level, groupName, rows, context, modifierGrowth = 0) {
    const byTerm = group(rows, row => row.term || 'UNKNOWN');
    const termRows = [...byTerm.entries()]
      .map(([term, termSections]) => demandTermStats(term, termSections))
      .sort((a, b) => termSortValue(a.term) - termSortValue(b.term));
    if (!termRows.length) return null;
    const subject = rows[0]?.subject || '';
    const courseNumber = rows[0]?.course || '';
    const courseTitle = level === 'Course' ? rows.find(row => row.title)?.title || '' : `${level} aggregate`;
    const course = level === 'Course' ? groupName : 'All courses';
    const avgCensusEnrollment = Math.round(average(termRows.map(row => row.census)));
    const avgFinalEnrollment = Math.round(average(termRows.map(row => row.final)));
    const avgFtes = average(termRows.map(row => row.ftes));
    const avgCapacity = average(termRows.map(row => row.capacity));
    const avgCapPerSection = Math.max(1, average(rows.map(row => row.cap).filter(Boolean)));
    const avgFillRate = average(termRows.map(row => row.fillRate));
    const avgFinalFillRate = average(termRows.map(row => row.finalFillRate));
    const avgAttritionCount = Math.round(average(termRows.map(row => row.attritionCount)));
    const avgAttritionRate = average(termRows.map(row => row.attritionRate));
    const avgWaitlistCount = Math.round(average(termRows.map(row => row.waitlist)));
    const avgSections = average(termRows.map(row => row.sections));
    const waitlistTerms = termRows.filter(row => row.waitlist > 0).length;
    const trend = demandTrend(termRows.map(row => row.census));
    const hasWaitlistData = rows.some(row => row.hasWaitlistData);
    const divisionGrowth = level === 'Division'
      ? context.division.get(groupName) ?? context.collegeGrowth
      : context.division.get(rows[0]?.division || 'UNKNOWN') ?? context.collegeGrowth;
    const disciplineGrowth = context.discipline.get(subject || 'UNKNOWN') ?? divisionGrowth;
    const courseGrowth = trend.rate;
    const adjustedForecastGrowth = blendedForecastGrowth(level, {
      college: context.collegeGrowth,
      division: divisionGrowth,
      discipline: disciplineGrowth,
      course: courseGrowth,
      modifier: modifierGrowth
    });
    const expectedEnrollmentNextTerm = Math.max(0, Math.round(avgCensusEnrollment * (1 + adjustedForecastGrowth)));
    const expectedFtesNextTerm = Math.max(0, avgFtes * (1 + adjustedForecastGrowth));
    const expectedFillRate = safeDiv(expectedEnrollmentNextTerm, avgCapacity);
    const expectedSectionsNeeded = Math.max(1, Math.ceil((expectedEnrollmentNextTerm + avgWaitlistCount) / avgCapPerSection));
    const suggestedSectionCount = Math.max(1, expectedSectionsNeeded);
    const forecastConfidence = forecastConfidenceLabel(termRows, avgFillRate);
    const capacityGuidance = demandCapacityGuidance({
      avgFillRate,
      waitlistTerms,
      avgAttritionRate,
      trend,
      avgSections,
      expectedSectionsNeeded,
      suggestedSectionCount,
      adjustedForecastGrowth,
      hasWaitlistData
    });
    return {
      forecastLevel: level,
      groupName,
      course,
      subject,
      courseNumber,
      courseTitle,
      terms: termRows.length,
      totalSectionsOffered: sum(termRows, 'sections'),
      avgSectionsOffered: round1(avgSections),
      avgCensusEnrollment,
      avgFinalEnrollment,
      avgFtes,
      avgFillRate,
      avgFinalFillRate,
      avgAttritionCount,
      avgAttritionRate,
      avgWaitlistCount,
      collegeGrowth: context.collegeGrowth,
      divisionGrowth,
      disciplineGrowth,
      courseGrowth,
      modifierGrowth,
      adjustedForecastGrowth,
      expectedEnrollmentNextTerm,
      expectedFtesNextTerm,
      expectedFillRate,
      expectedSectionsNeeded,
      suggestedSectionCount,
      forecastConfidence,
      capacityGuidance,
      hasWaitlistData: hasWaitlistData ? 'Yes' : 'No',
      enrollmentTrend: trend.label
    };
  }

  function demandTermStats(term, rows) {
    const census = rows.reduce((total, row) => total + (row.census == null ? row.actual : row.census), 0);
    const final = sum(rows, 'actual');
    const capacity = sum(rows, 'cap');
    return {
      term,
      sections: rows.length,
      census,
      final,
      ftes: sum(rows, 'ftes'),
      capacity,
      waitlist: sum(rows, 'waitlist'),
      fillRate: safeDiv(census, capacity),
      finalFillRate: safeDiv(final, capacity),
      attritionCount: Math.max(0, census - final),
      attritionRate: safeDiv(Math.max(0, census - final), census),
      filledAtCensus: rows.filter(row => row.cap > 0 && (row.census == null ? row.actual : row.census) >= row.cap).length,
      closedPriorCensus: rows.filter(row => row.closedPriorCensus || /CLOSED/.test(row.status)).length,
      under50: rows.filter(row => row.cap > 0 && safeDiv(row.census == null ? row.actual : row.census, row.cap) < 0.5).length,
      under35: rows.filter(row => row.cap > 0 && safeDiv(row.census == null ? row.actual : row.census, row.cap) < 0.35).length,
      cancelled: rows.filter(row => /CANCEL/.test(row.status)).length
    };
  }

  function demandTrend(values) {
    if (values.length < 2) return { delta: 0, rate: 0, label: 'Flat' };
    const first = values[0] || 0;
    const last = values[values.length - 1] || 0;
    const delta = (last - first) / (values.length - 1);
    const rate = safeDiv(delta, Math.max(1, first));
    return { delta, rate, label: delta > 2 ? 'Increasing' : delta < -2 ? 'Declining' : 'Flat' };
  }

  function demandGrowthContext(rows) {
    return {
      collegeGrowth: aggregateGrowth(rows),
      division: growthMap(rows, row => row.division || 'UNKNOWN'),
      discipline: growthMap(rows, row => row.subject || 'UNKNOWN')
    };
  }

  function growthMap(rows, keyer) {
    const map = new Map();
    group(rows, keyer).forEach((groupRows, key) => {
      map.set(key, aggregateGrowth(groupRows));
    });
    return map;
  }

  function aggregateGrowth(rows) {
    const series = [...group(rows, row => row.term || 'UNKNOWN').entries()]
      .map(([term, termRows]) => ({
        term,
        census: termRows.reduce((total, row) => total + (row.census == null ? row.actual : row.census), 0)
      }))
      .sort((a, b) => termSortValue(a.term) - termSortValue(b.term));
    return demandTrend(series.map(item => item.census)).rate;
  }

  function blendedForecastGrowth(level, parts) {
    let historicalBlend = parts.course;
    if (level === 'College') historicalBlend = parts.college;
    else if (level === 'Division') historicalBlend = (parts.division * 0.7) + (parts.college * 0.3);
    else if (level === 'Discipline') historicalBlend = (parts.discipline * 0.6) + (parts.division * 0.25) + (parts.college * 0.15);
    else historicalBlend = (parts.course * 0.5) + (parts.discipline * 0.2) + (parts.division * 0.15) + (parts.college * 0.15);
    return clamp(historicalBlend + parts.modifier, -0.75, 1.5);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function demandBandForScore(score) {
    if (score >= 85) return 'Very High Demand';
    if (score >= 70) return 'High Demand';
    if (score >= 50) return 'Stable Demand';
    if (score >= 35) return 'Low Demand';
    return 'Very Low Demand';
  }

  function suggestedDemandSections(expectedNeeded, avgSections, score, fillRate, waitlistTerms, under50, under35) {
    if (score >= 85 && fillRate >= 0.95 && waitlistTerms >= 2) return Math.max(avgSections + 1, expectedNeeded);
    if (score >= 70 && fillRate >= 0.9 && waitlistTerms >= 1) return Math.max(avgSections, expectedNeeded);
    if ((under35 >= 2 || under50 >= 3) && score < 50) return Math.max(1, avgSections - (under35 >= 3 ? 2 : 1));
    return Math.max(1, expectedNeeded);
  }

  function forecastConfidenceLabel(termRows, avgFillRate) {
    if (termRows.length >= 4 && fillVariance(termRows, avgFillRate) < 0.05) return 'High';
    if (termRows.length >= 3) return 'Medium';
    return 'Low';
  }

  function fillVariance(termRows, averageFill) {
    return average(termRows.map(row => Math.abs(row.fillRate - averageFill)));
  }

  function demandCapacityGuidance(row) {
    const sectionGap = row.suggestedSectionCount - Math.round(row.avgSections);
    if (row.adjustedForecastGrowth >= 0.08 || sectionGap >= 2) return 'Expanding demand - plan additional capacity.';
    if (row.adjustedForecastGrowth >= 0.03 || sectionGap >= 1) return 'Moderate growth - monitor for added capacity.';
    if (row.adjustedForecastGrowth <= -0.08 || sectionGap <= -2) return 'Softening demand - review capacity assumptions.';
    if (row.adjustedForecastGrowth <= -0.03 || sectionGap <= -1) return 'Slight softening - monitor before building schedule.';
    return 'Stable demand - maintain planning baseline.';
  }

  function dayTimeDemandRows(rows) {
    return [...group(rows, row => [row.dayPattern, row.start || 'ONLINE/TBA', row.modality, row.campus].join(' | ')).entries()]
      .map(([key, groupRows]) => {
        const census = groupRows.reduce((total, row) => total + (row.census == null ? row.actual : row.census), 0);
        const capacity = sum(groupRows, 'cap');
        const waitlist = sum(groupRows, 'waitlist');
        const fillRate = safeDiv(census, capacity);
        return {
          pattern: key,
          sections: groupRows.length,
          fillRate,
          waitlist,
          demandScore: Math.round(clamp(fillRate / 0.95 * 70 + safeDiv(waitlist, Math.max(1, groupRows.length)) * 6, 0, 100))
        };
      })
      .sort((a, b) => b.demandScore - a.demandScore);
  }

  function demandTrendSeries(rows) {
    return [...group(rows, row => row.term || 'UNKNOWN').entries()]
      .map(([term, termRows]) => {
        const census = termRows.reduce((total, row) => total + (row.census == null ? row.actual : row.census), 0);
        const final = sum(termRows, 'actual');
        const capacity = sum(termRows, 'cap');
        return {
          term,
          census,
          final,
          ftes: sum(termRows, 'ftes'),
          fillRate: safeDiv(census, capacity),
          waitlist: sum(termRows, 'waitlist'),
          forecast: Math.round(average([census, final]))
        };
      })
      .sort((a, b) => termSortValue(a.term) - termSortValue(b.term));
  }

  function demandYearSeasonForecast(target, rows, annualForecastFtes) {
    if (target.scope !== 'year') return null;
    const seasons = ['SUMMER', 'FALL', 'SPRING'];
    const totals = new Map(seasons.map(season => [season, { season, ftes: 0, census: 0 }]));
    rows.forEach(row => {
      const sourceTerm = row.sourceTerm || row.term;
      const season = termParts(sourceTerm).season;
      if (!totals.has(season)) return;
      const item = totals.get(season);
      item.ftes += row.ftes || 0;
      item.census += row.census == null ? row.actual : row.census;
    });
    const totalFtes = [...totals.values()].reduce((total, row) => total + row.ftes, 0);
    const totalCensus = [...totals.values()].reduce((total, row) => total + row.census, 0);
    const seasonsOut = seasons.map(season => {
      const item = totals.get(season);
      const share = totalFtes > 0 ? safeDiv(item.ftes, totalFtes) : safeDiv(item.census, totalCensus);
      return {
        season,
        termLabel: targetTermFromFiscalYear(season, target.year),
        historicalFtes: item.ftes,
        historicalCensus: item.census,
        share,
        forecastFtes: annualForecastFtes * share
      };
    });
    return {
      basis: totalFtes > 0 ? 'historical FTES share' : 'historical census share',
      seasons: seasonsOut
    };
  }

  function renderDemandInsights(rows, patterns, trends, yearSeasonForecast = null) {
    const wrap = document.getElementById('demandInsights');
    if (!wrap) return;
    const growth = rows.filter(row => /expanding|growth/i.test(row.capacityGuidance)).slice(0, 5);
    const softening = rows.filter(row => /softening/i.test(row.capacityGuidance)).slice(0, 5);
    const highPatterns = patterns.slice(0, 5);
    const lowPatterns = patterns.slice(-5).reverse();
    wrap.innerHTML = `
      ${trendPanel('Demand Trend Line', trends, 'census', value => value)}
      ${trendPanel('FTES Trend', trends, 'ftes', value => round1(value))}
      ${trendPanel('Fill Rate Trend', trends, 'fillRate', value => pct(value))}
      ${trendPanel('Waitlist Trend', trends, 'waitlist', value => value)}
      ${forecastPanel(trends)}
      ${insightPanel('Semester FTES Totals', trends.map(row => `${row.term}: ${round1(row.ftes)} FTES; ${row.census} census enrollment`))}
      ${yearSeasonForecast ? insightPanel('Forecast Term FTES Split', yearSeasonForecast.seasons.map(row => `${row.termLabel}: ${round1(row.forecastFtes)} FTES (${pct(row.share)} of annual forecast, based on ${yearSeasonForecast.basis})`)) : ''}
      ${insightPanel('Top Expanding Demand Forecasts', growth.map(row => `${row.forecastLevel} - ${row.groupName}: ${pct(row.adjustedForecastGrowth)} forecast growth; ${row.capacityGuidance}`))}
      ${insightPanel('Top Softening Demand Forecasts', softening.map(row => `${row.forecastLevel} - ${row.groupName}: ${pct(row.adjustedForecastGrowth)} forecast growth; ${row.capacityGuidance}`))}
      ${insightPanel('Highest Demand Day/Time Patterns', highPatterns.map(row => `${row.pattern}: ${pct(row.fillRate)} fill, ${row.waitlist} waitlist`))}
      ${insightPanel('Lowest Demand Day/Time Patterns', lowPatterns.map(row => `${row.pattern}: ${pct(row.fillRate)} fill, ${row.waitlist} waitlist`))}`;
  }

  function trendPanel(title, rows, key, formatter) {
    const values = rows.map(row => Number(row[key]) || 0);
    const points = sparklinePoints(values);
    const latest = rows.length ? formatter(rows[rows.length - 1][key]) : 'N/A';
    return `<section><h3>${title}</h3><svg class="analytics-sparkline" viewBox="0 0 220 70" preserveAspectRatio="none"><polyline points="${points}" /></svg><p class="analytics-chart-note">Latest: ${latest}</p></section>`;
  }

  function forecastPanel(rows) {
    const values = rows.map(row => Math.abs((row.forecast || 0) - (row.census || 0)));
    const avgError = Math.round(average(values));
    return `<section><h3>Forecast vs Actual Comparison</h3><p class="analytics-chart-note">Average historical forecast gap: ${avgError} students.</p><p class="analytics-chart-note">Uses final/census midpoint as a simple back-test proxy when no separate forecast file is available.</p></section>`;
  }

  function sparklinePoints(values) {
    if (!values.length) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const width = 220;
    const height = 60;
    const spread = max - min || 1;
    return values.map((value, index) => {
      const x = values.length === 1 ? width : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / spread) * height + 5;
      return `${Math.round(x)},${Math.round(y)}`;
    }).join(' ');
  }

  function insightPanel(title, items) {
    const list = items.length ? items.map(item => `<li>${item}</li>`).join('') : '<li>No matching rows.</li>';
    return `<section><h3>${title}</h3><ul>${list}</ul></section>`;
  }

  function average(values) {
    const usable = values.filter(value => Number.isFinite(value));
    return usable.length ? usable.reduce((total, value) => total + value, 0) / usable.length : 0;
  }

  function courseKey(section) {
    return `${section.subject} ${section.course}`;
  }

  async function loadConsolidationRows() {
    const saved = captureFilterState('con');
    const uploadedRows = await readCsv(document.getElementById('consolidationCsv'));
    const archivedRows = await readArchivedRows('conArchiveTerms');
    const uploaded = dedupeEnrollmentRows([...uploadedRows, ...archivedRows].map(normalize))
      .filter(row => !isOmittedInstructionalMethod(row));
    state.consolidationInput = uploaded;
    const rows = uploaded.length ? uploaded : currentRows().filter(row => !isOmittedInstructionalMethod(row));
    state.consolidationTerms = collectRowTerms(rows);
    updateConsolidationTermOptions(state.consolidationTerms);
    refreshAnalyticsFilters('con', rows, saved);
    return rows;
  }

  function lowEnrollmentThreshold() {
    const raw = document.getElementById('conLowEnroll')?.value;
    if (raw == null || String(raw).trim() === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  function minutesFromTime(time) {
    if (!time) return null;
    const match = String(time).match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  async function historicalPatterns(allRows = [], decisionTerm = '', lowFill = 0.5, lowEnroll = null) {
    const map = new Map();
    const lookback = Number(document.getElementById('conLookback')?.value || 0);
    const comparisonRows = allRows.filter(row => row.term && row.term !== decisionTerm);
    if (comparisonRows.length) {
      comparisonRows.forEach((row) => {
        const key = patternKey(row);
        const item = map.get(key) || { terms: new Set(), low: new Set() };
        item.terms.add(row.term || 'UNKNOWN');
        if (isLowEnrollmentSection(row, lowFill, lowEnroll)) item.low.add(row.term || 'UNKNOWN');
        map.set(key, item);
      });
      return finalizeHistoricalMap(map);
    }
    if (!lookback || !window.BACKEND_BASE_URL) return map;
    try {
      const terms = await fetch(`${window.BACKEND_BASE_URL}/terms`).then((r) => r.json());
      const priorTerms = (Array.isArray(terms) ? terms : []).filter((t) => t && t !== currentTerm()).slice(-lookback);
      const batches = await Promise.all(priorTerms.map((t) => fetch(`${window.BACKEND_BASE_URL}/schedule/${encodeURIComponent(t)}`).then((r) => r.ok ? r.json() : [])));
      batches.flat().map(normalize).forEach((row) => {
        const key = patternKey(row);
        const item = map.get(key) || { terms: new Set(), low: new Set() };
        item.terms.add(row.term || 'UNKNOWN');
        if (isLowEnrollmentSection(row, lowFill, lowEnroll)) item.low.add(row.term || 'UNKNOWN');
        map.set(key, item);
      });
    } catch (err) {
      console.warn('Historical consolidation lookup skipped:', err);
    }
    return finalizeHistoricalMap(map);
  }

  function finalizeHistoricalMap(map) {
    const finalized = new Map();
    map.forEach((item, key) => {
      finalized.set(key, {
        terms: item.terms?.size || 0,
        low: item.low?.size || 0
      });
    });
    return finalized;
  }

  function flattenOpportunity(row) {
    const isOnline = row.type === 'Online Reduction';
    const removed = row.removedSections || [];
    const receiving = row.receivingSections || [];
    const removedList = removed.map(describe).join('; ');
    const receivingList = receiving.map(describe).join('; ');
    const targetOpenSeats = row.target ? expectedOpenSeats(row.target) : row.targetOpenSeats;
    const recommendation = isOnline
      ? `Reduce by ${row.recommendedReductions ?? 0} online section(s); retain buffer after ${row.possibleReductions ?? 0} possible reduction(s).`
      : `Remove ${removedList || 'selected low-enrollment section(s)'}; redistribute ${row.requiredSeats ?? 0} projected students into remaining sections.`;
    const projectedRedistribution = isOnline ? '' : `${row.requiredSeats ?? 0} students`;
    const netAvailableCapacity = isOnline ? row.vacancies : row.availableReceivingCapacity;
    const sourceSummary = isOnline
      ? `Online aggregate; census-based expected enrollment ${row.sourceEnroll}; fill ${pct(row.sourceFill)}`
      : `Remove: ${removedList || 'N/A'}`;
    const targetSummary = isOnline
      ? ''
      : `Receive into: ${receivingList || 'remaining matching sections'}; available receiving capacity ${row.availableReceivingCapacity ?? 0}`;
    const onlineSummary = isOnline
      ? `${row.vacancies ?? 0} expected vacancies; median cap ${row.sectionCap ?? 0}; possible reductions ${row.possibleReductions ?? 0}`
      : '';
    return {
      type: row.type || 'In-Person Consolidation',
      term: row.term || row.decisionTerm || row.source?.term || row.target?.term || '',
      decisionTerm: row.decisionTerm || row.term || row.source?.term || row.target?.term || '',
      score: row.score,
      label: row.label,
      course: row.course,
      sectionsReviewed: row.sectionsReviewed || row.sections || row.sectionCount || '',
      potentialSectionsRemoved: row.potentialSectionsRemoved || row.recommendedReductions || '',
      expectedEnrollment: row.expectedEnrollment ?? row.sourceEnroll ?? '',
      availableReceivingCapacity: row.availableReceivingCapacity ?? row.vacancies ?? targetOpenSeats ?? '',
      projectedRedistribution,
      netAvailableCapacity,
      potentialSeatsRecovered: row.potentialSeatsRecovered ?? row.freedSeats ?? '',
      projectionSource: row.projectionSource || (row.historicalTerms ? `Historical Average (${row.historicalTerms} terms)` : 'N/A'),
      finalEnrollmentContext: row.finalEnrollmentContext || 'N/A',
      sourceSummary,
      sourceSection: row.source ? describe(row.source) : 'Online aggregate',
      sourceEnroll: row.source ? expectedEnrollment(row.source) : row.sourceEnroll,
      sourceFill: row.source ? pct(expectedFillRate(row.source)) : pct(row.sourceFill),
      targetSummary,
      targetSection: row.target ? describe(row.target) : '',
      targetEnroll: row.target ? expectedEnrollment(row.target) : '',
      targetOpenSeats,
      onlineSummary,
      vacancies: row.vacancies ?? '',
      sectionCap: row.sectionCap ?? '',
      possibleReductions: row.possibleReductions ?? '',
      recommendedReductions: row.recommendedReductions ?? '',
      recommendation,
      freedSeats: row.freedSeats,
      matchReason: row.matchReason,
      historicalTerms: row.historicalTerms,
      chronicLowFill: row.chronicLowFill,
      tbaConfidence: row.tba ? 'Capped at 70' : ''
    };
  }

  function renderConsolidationTables(rows) {
    const node = document.getElementById('consolidationTable');
    if (!node) return;
    const online = rows.filter(row => row.type === 'Online Reduction');
    const inPerson = rows.filter(row => row.type !== 'Online Reduction');
    const columns = ['type', 'score', 'label', 'course', 'sectionsReviewed', 'potentialSectionsRemoved', 'expectedEnrollment', 'availableReceivingCapacity', 'projectedRedistribution', 'netAvailableCapacity', 'potentialSeatsRecovered', 'projectionSource', 'finalEnrollmentContext', 'sourceSummary', 'targetSummary', 'recommendation', 'matchReason', 'historicalTerms', 'chronicLowFill', 'tbaConfidence'];
    node.innerHTML = [
      consolidationTableSection('Online Reduction Candidates', online, columns),
      consolidationTableSection('In-Person and Hybrid Consolidation Candidates', inPerson, columns)
    ].join('');
  }

  function consolidationTableSection(title, rows, columns) {
    const display = rows.slice(0, 500);
    if (!display.length) return `<section class="consolidation-subtable"><h3>${escapeAttr(title)}</h3><p class="analytics-empty">No rows match the selected criteria.</p></section>`;
    return `
      <section class="consolidation-subtable">
        <h3>${escapeAttr(title)}</h3>
        <table><thead><tr>${columns.map((c, index) => `<th><button type="button" class="analytics-sort" data-column="${index}" aria-label="Sort by ${label(c)}">${label(c)} <span aria-hidden="true"></span></button></th>`).join('')}</tr></thead>
        <tbody>${display.map(row => `<tr>${columns.map(c => `<td data-sort="${escapeAttr(sortValue(row[c], c))}">${format(row[c], c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
      </section>`;
  }

  function describe(row) {
    return [row.crn || row.section, row.campus, row.modality, row.dayPattern, row.start].filter(Boolean).join(' / ');
  }

  function group(rows, keyer) {
    const map = new Map();
    rows.forEach((row) => {
      const key = keyer(row);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });
    return map;
  }

  function sum(rows, key) {
    return rows.reduce((total, row) => total + num(row[key]), 0);
  }

  function safeDiv(a, b) {
    return b ? a / b : 0;
  }

  function metric(id, items) {
    document.getElementById(id).innerHTML = items.map(([label, value]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join('');
  }

  function table(id, rows, columns) {
    const display = rows.slice(0, 500);
    document.getElementById(id).innerHTML = display.length ? `
      <table><thead><tr>${columns.map((c, index) => `<th><button type="button" class="analytics-sort" data-column="${index}" aria-label="Sort by ${label(c)}">${label(c)} <span aria-hidden="true"></span></button></th>`).join('')}</tr></thead>
      <tbody>${display.map((row) => `<tr>${columns.map((c) => `<td data-sort="${escapeAttr(sortValue(row[c], c))}">${format(row[c], c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` :
      '<p class="analytics-empty">No rows match the selected criteria.</p>';
  }

  function escapeAttr(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function sortValue(value, column = '') {
    if (typeof value === 'number') return String(value);
    if (/(rate|fill|growth)$/i.test(column)) return String(num(value) / 100);
    return String(value ?? '').trim();
  }

  function sortAnalyticsTable(button) {
    const tableNode = button.closest('table');
    const tbody = tableNode?.querySelector('tbody');
    if (!tableNode || !tbody) return;
    const column = Number(button.dataset.column);
    const current = button.dataset.direction || 'none';
    const direction = current === 'asc' ? 'desc' : 'asc';
    tableNode.querySelectorAll('.analytics-sort').forEach(sortButton => {
      sortButton.dataset.direction = '';
      sortButton.querySelector('span').textContent = '';
    });
    button.dataset.direction = direction;
    button.querySelector('span').textContent = direction === 'asc' ? '^' : 'v';
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const values = rows.map(row => row.children[column]?.dataset.sort ?? '');
    const numeric = values.filter(Boolean).every(value => Number.isFinite(Number(value)));
    rows.sort((a, b) => {
      const left = a.children[column]?.dataset.sort ?? '';
      const right = b.children[column]?.dataset.sort ?? '';
      const result = numeric
        ? Number(left) - Number(right)
        : left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
      return direction === 'asc' ? result : -result;
    });
    rows.forEach(row => tbody.appendChild(row));
  }

  function renderDashboardLegend() {
    const legend = document.getElementById('dashboardLegend');
    if (!legend) return;
    renderMethodologyPanel(legend, {
      title: 'Enrollment Analytics Dashboard Methodology & Data Dictionary',
      purpose: 'Provides a compact decision-support landing view for enrollment health, registration pace, capacity pressure, consolidation summary, physical student presence, schedule structure, and course rotation health.',
      methodology: 'Prepared using TIMBER Enrollment Analytics. Dashboard calculations use the currently selected filters. Growth prompts compare waitlist pressure to existing open seats before suggesting added capacity. Reduction prompts summarize the existing Section Consolidation Opportunities output and do not introduce separate reduction logic.',
      assumptions: 'Current enrollment uses census enrollment when available and current enrollment otherwise. Expected enrollment uses same-season historical comparison terms and excludes the selected focus term. Student Presence Analytics includes in-person and hybrid rows only. Prime time is Monday through Thursday, 9:00 AM through 2:59 PM.',
      limitations: 'The dashboard is a planning summary, not an automatic add, cancel, consolidation, or staffing directive. It does not include student intent, budget constraints, contractual constraints, equity review, or leadership decisions unless those factors are represented in the uploaded data.',
      items: [
        ['Enrollment Health', 'Current enrollment, expected enrollment, variance, courses reviewed, sections reviewed, FTES, and available lifecycle milestones for the selected filters.'],
        ['Focus Term', 'Decision term selected in the dashboard toolbar. Current Rows, Current Enrollment, Courses Reviewed, Sections Reviewed, FTES, Growth Opportunities, Student Presence, and Schedule Structure are scoped to this term unless All Loaded Terms is explicitly selected.'],
        ['Current Rows', 'Filtered rows from the selected Focus Term only. If All Loaded Terms is selected, this becomes a gross-total row set and a warning is shown.'],
        ['Historical Rows', 'Filtered comparison rows from comparable historical terms. The selected Focus Term and future terms are excluded.'],
        ['Comparable Historical Terms', 'Same-season prior terms used for expected enrollment and registration pace. Spring compares to prior Spring terms, Fall to prior Fall terms, and Summer to prior Summer terms.'],
        ['Current Enrollment', 'Census enrollment for the Focus Term when available, otherwise current/actual enrollment.'],
        ['Expected Enrollment', 'Average same-season historical enrollment for the same group, excluding the Focus Term. N/A appears when comparable history is unavailable.'],
        ['Variance', 'Current Enrollment minus Expected Enrollment.'],
        ['Variance %', 'Variance divided by Expected Enrollment.'],
        ['Registration Pace Monitor', 'Current focus-term enrollment versus average expected enrollment from comparable same-season historical terms by Course, Division, Modality, Campus, Day Pattern, and Time Block. The selected focus term and future terms are excluded. Status is Ahead of Pace, On Pace, Behind Pace, or N/A.'],
        ['Growth Opportunities', 'Courses with waitlist pressure or very high fill. Growth prompts depend on enrollment, capacity, waitlist, and viable open-seat logic. If waitlist is unavailable, growth signals use fill rate/capacity only and are lower confidence.'],
        ['Viable Open Seats', 'Open seats in sections that can reasonably absorb demand based on modality, campus, online status, day compatibility, and the +/- hour window.'],
        ['Total Open Seats', 'All open seats in the course before viability checks. Non-viable open seats are not treated as fully absorbable.'],
        ['Same Modality Seats', 'Open seats in sections matching the modality of the demand section.'],
        ['Same Campus Seats', 'Open seats on the same campus as the demand section.'],
        ['Online Seats', 'Open seats in online sections, counted separately because they may not substitute for in-person demand.'],
        ['+/- Hour Seats', 'Open seats within the configured start-time window, defaulting to plus or minus 2 hours.'],
        ['Reduction Opportunities', 'Top rows from the existing consolidation report output. Open the consolidation report for the full methodology and candidate details.'],
        ['Student Presence', 'Estimated physical student load from in-person and hybrid scheduled rows with fixed days/times. Online, web, virtual, and TBA rows are excluded.'],
        ['Sections Active', 'Number of scheduled section meetings represented in a Student Presence bucket.'],
        ['Available Room Capacity', 'Scheduled capacity minus enrollment for the included bucket, floored at zero.'],
        ['Prime Time', 'Monday through Thursday, 9:00 AM through 2:59 PM.'],
        ['Off-Peak', 'Scheduled time outside the Prime Time definition.'],
        ['Schedule Structure', 'Prime/off-peak section and enrollment split plus modality mix for the selected filters.'],
        ['Rotation Cycle', 'Estimated course offering cadence from loaded historical terms, such as every term, once per academic year, every 3 terms, or irregular.'],
        ['Course Rotation Analysis', 'Course offering cadence based on loaded historical terms, including terms offered, average gap, rotation cycle, last offered, expected next offering, and rotation status.'],
        ['Missing Milestone Fields', 'Lifecycle fields not present in the selected upload: First Day, Census 1, Census 2, and Final. Missing values display as N/A.'],
        ['First Day', 'Enrollment snapshot on the first day of class when available from a future IT/Argos report.'],
        ['Census 1', 'First census enrollment milestone when available.'],
        ['Census 2', 'Second census enrollment milestone when applicable and available.'],
        ['Final', 'Final or end-of-term enrollment milestone when available.'],
        ['FTES', 'Full-Time Equivalent Students from the uploaded FTES field when present, otherwise estimated from contact-hour/unit fields where possible.'],
        ['WSCH', 'Weekly Student Contact Hours, used only when contact-hour fields are available for FTES estimation.'],
        ['Data Quality Warning', 'Visible warning shown when scope or source data could mislead interpretation, such as missing history, missing lifecycle fields, or All Loaded Terms gross mode.'],
        ['All Loaded Terms', 'Explicit gross-total mode. It includes every loaded term and should not be used as a decision-term dashboard.'],
        ['Part-Time Faculty', 'Standard user-facing terminology for part-time instructional staffing references.']
      ],
      version: 'Methodology v1.2'
    });
  }

  function renderInstructorAvailabilityLegend() {
    const legend = document.getElementById('instructorAvailabilityLegend');
    if (!legend) return;
    renderMethodologyPanel(legend, {
      title: 'Instructor Availability - Planning View Methodology & Data Dictionary',
      purpose: 'Provides a first-layer schedule-conflict check for instructors using the currently loaded schedule/class data.',
      methodology: 'The report compares each instructor scheduled in the loaded data against the selected day and time window. A conflict exists when the section meets on the selected day and its meeting time overlaps the requested window.',
      assumptions: 'Rows without fixed meeting days or fixed meeting times are not treated as conflicts for a specific day/time search. Rows with 00:00 placeholder start or end times are treated as non-fixed. This keeps Online/TBA rows and placeholder records from blocking an instructor in a physical time slot.',
      limitations: 'This is not a true faculty availability system. It does not include preference forms, office hours, reassigned time, department rules, leave, contractual limits, overload rules, travel time, or unuploaded assignments.',
      items: [
        ['Instructor', 'Instructor name from the loaded schedule/class data. Only instructors appearing in the loaded data are reviewed.'],
        ['Status', 'Known Busy when at least one loaded section overlaps the selected day/time window. Potentially Available when no loaded overlap is found.'],
        ['Day', 'Selected day used for the schedule-conflict check.'],
        ['Requested Window', 'Selected start and end time used for the overlap check.'],
        ['Conflict Count', 'Number of loaded sections for that instructor that overlap the requested day/time window.'],
        ['Conflicts', 'The overlapping course, section, meeting pattern, time, and campus records. If none are found, the row states that no loaded conflict was found.'],
        ['Campus', 'Optional campus filter. When All is selected, all loaded campuses are included.'],
        ['Overlap Formula', 'A conflict is counted when section start is before requested end AND section end is after requested start, and the section includes the selected day.'],
        ['Shared Available Time Windows', 'For each day, loaded busy intervals for all selected instructors are merged, then subtracted from the 8:00 AM-6:00 PM planning day. The resulting windows are times that are open for everyone selected, not confirmed faculty availability.']
      ],
      version: 'Methodology v1.0'
    });
  }

  function renderAttritionLegend() {
    const legend = document.getElementById('attritionLegend');
    if (!legend) return;
    const items = [
      ['Group', 'The current grouping selected in Group by, usually Discipline + Course.'],
      ['Course Historical Terms Included', 'Number of historical comparison terms where this specific row grouping appears after filters are applied. The selected decision term is excluded.'],
      ['Overall Historical Terms Included', 'Number of uploaded historical comparison terms used after filters are applied. The selected decision/future term is excluded.'],
      ['Total Uploaded Terms', 'Number of distinct uploaded terms represented in that row after filters are applied, including the decision term when present.'],
      ['Decision Sections', 'Number of sections for the selected decision term only.'],
      ['Total Seats', 'Total MAX ENROLL capacity across the row grouping and included terms.'],
      ['Census Enrollment', 'CENSUS_ENROLL across included terms. If CENSUS_ENROLL is missing for a section, ACTUAL_ENROLL is used for that section.'],
      ['Final Enrollment', 'ACTUAL_ENROLL across included terms. This remains visible for attrition/retention context and does not drive consolidation or forecast recommendations.'],
      ['Lifecycle Readiness', 'Current available calculations use Census Enrollment and Final/Current Enrollment. Future lifecycle support will use First Day, Census 1, Census 2, and Final Enrollment fields when those fields are available. Missing milestone fields display as N/A.'],
      ['Attrition Count', 'Census Enrollment minus Final Enrollment, floored at zero.'],
      ['Attrition Rate', 'Attrition Count divided by Census Enrollment.'],
      ['Historical Attrition Rate', 'Historical attrition from comparison terms only; it excludes the decision term.'],
      ['All Terms Sections', 'Section count across the decision term plus included comparison terms.'],
      ['Census Fill Rate', 'Census Enrollment divided by Total Seats. Values above 100% mean sections exceeded listed capacity.'],
      ['Final Fill Rate', 'Final Enrollment divided by Total Seats. Values above 100% mean sections exceeded listed capacity.'],
      ['Empty Seats at Census', 'Total Seats minus Census Enrollment, floored at zero.'],
      ['Empty Seats at Final', 'Total Seats minus Final Enrollment, floored at zero.']
    ];
    renderMethodologyPanel(legend, {
      title: 'Enrollment Attrition Methodology & Data Dictionary',
      purpose: 'Identifies enrollment loss between census and final/current enrollment and compares decision-term attrition against historical comparison terms.',
      methodology: 'The selected decision term is tracked separately from historical comparison terms. Historical term counts and historical attrition exclude the decision/future term. Census enrollment is the demand basis; final/current enrollment remains visible as attrition context. The report is lifecycle-ready but limited by available uploaded data until First Day, Census 1, Census 2, and Final milestone fields are delivered.',
      assumptions: 'CENSUS_ENROLL is treated as census enrollment. ACTUAL_ENROLL is treated as final enrollment when the source file is final and as current enrollment when the source file is an in-progress snapshot.',
      limitations: 'This report does not know why students left, whether a term file is final unless the uploaded source reflects that, or whether external retention interventions occurred.',
      items,
      version: 'Methodology v1.0'
    });
  }

  function renderConsolidationLegend() {
    const legend = document.getElementById('consolidationLegend');
    if (!legend) return;
    const items = [
      ['Consolidation CSV(s)', 'Optional upload for this report. If no file is uploaded, the report uses the currently loaded dashboard schedule.'],
      ['Instructional methods', 'Online, In Person, and Hybrid are derived from instructional method codes. CPL, DE, CBE, and unmapped archived code 98 are omitted from these analytics datasets.'],
      ['Decision term', 'The term being reviewed for planned consolidation opportunities. For in-person rows, the decision term supplies planned sections, meeting patterns, and capacity, not the enrollment demand used to trigger recommendations.'],
      ['Min sections', 'Minimum number of decision-term in-person or hybrid sections a course must have before consolidation groups are considered. Online reduction rows use a separate minimum of two online sections, then require enough historical vacancy to remove at least one section.'],
      ['Low enrollment', 'Optional strict enrollment threshold. If entered, an in-person source section is considered low when its census-based historical expected enrollment is at or below this number.'],
      ['Low fill %', 'Percentage threshold used only when Low enrollment is blank. An in-person source section is low-filled when census-based historical expected enrollment divided by decision-term capacity is at or below this threshold.'],
      ['Absorb %', 'Minimum share of the source section census-based historical expected enrollment that eligible receiving sections must collectively be able to absorb. The default 60% means a source expected to draw 16 students needs at least 10 expected pooled open seats among matching sections.'],
      ['Vacancy basis', 'Controls online vacancy math from historical comparison terms. The default Historical census option uses CENSUS_ENROLL when available. Historical final/current uses ACTUAL_ENROLL only when explicitly selected. The decision term supplies offered sections and capacity, not current in-progress demand.'],
      ['Lookback terms', 'Number of prior terms to check for historical low-fill patterns when backend schedule history is available.'],
      ['Chronic Low Enrollment Threshold', 'Number of historical terms where the course/pattern was actually offered that must show low enrollment before it can be labeled chronically under-enrolled. 1 = low in any offered historical term; 2 = low in at least two; 3 = low in at least three.'],
      ['Chronic %', 'Historical low-fill share required to mark the source pattern as chronic. Example: 75% means at least three out of four offered matching historical patterns were low-filled.'],
      ['Day match', 'Controls which receiving sections can be considered: exact same meeting pattern, any shared meeting day, or any day.'],
      ['Start window', 'Controls how far apart source and receiving section start times can be. The default +/- 2 hours means a 10:00 source can match starts from 8:00 through 12:00.'],
      ['Same campus', 'When checked, source and receiving sections must be on the same campus.'],
      ['Same modality', 'When checked, source and receiving sections must use the same instructional modality.'],
      ['Score', 'Consolidation groups score schedule/method consistency, available receiving capacity, chronic low-enrollment history, and confidence. TBA or missing meeting-pattern groups are capped at 70 because they cannot earn high confidence from exact schedule matching. Online reduction starts at 55 and increases with the number of reducible sections.'],
      ['Sections Reviewed', 'Number of active decision-term sections included in the grouped opportunity. This replaces pairwise source-target counts.'],
      ['Potential Sections Removed', 'Number of sections that could be reviewed for removal within the grouped opportunity without exceeding projected receiving capacity.'],
      ['Expected Enrollment', 'Census-based expected enrollment for the grouped course/pattern opportunity.'],
      ['Available Receiving Capacity', 'Expected remaining open seats in sections that would receive redistributed enrollment.'],
      ['Projected Redistribution', 'Projected number of students to absorb into remaining sections.'],
      ['Net Available Capacity', 'Available receiving capacity after projected redistribution.'],
      ['Potential Seats Recovered', 'Capacity attached to the section(s) recommended for review/removal.'],
      ['Projection Source', 'The source of expected enrollment, such as Historical Average (4 terms). Rows without a historical basis show N/A rather than implying hidden data.'],
      ['Final Enrollment Context', 'Final/current enrollment context from removed sections when present. Missing or zero context displays N/A. Final enrollment does not drive recommendations.'],
      ['Source Summary', 'For consolidation rows, the section(s) recommended for review/removal. For online rows, the course-level online aggregate.'],
      ['Target Summary', 'For consolidation rows, the remaining matching sections available to receive projected enrollment and the expected receiving capacity.'],
      ['Vacancies', 'For online reduction rows, expected open seats across decision-term online sections. This compares decision-term capacity to average historical enrollment and historical vacancy patterns.'],
      ['Section Cap', 'For online reduction rows, the median online section cap used as the standard section size.'],
      ['Possible Reductions', 'For online rows, Vacancies divided by Section Cap, rounded down.'],
      ['Recommended Reductions', 'A conservative online reduction count. It leaves one reducible section of buffer when Possible Reductions is greater than one.'],
      ['Recommendation', 'Explicit action text showing what to remove or reduce, projected redistribution, and remaining capacity. This is a planning indicator, not an automatic cancellation instruction.']
    ];
    renderMethodologyPanel(legend, {
      title: 'Consolidation Opportunities Methodology & Data Dictionary',
      purpose: 'Identifies planning candidates where low-filled sections may be reviewed for consolidation with minimal expected enrollment impact.',
      methodology: 'This report separates online reduction math from in-person/hybrid consolidation. Online rows are course-level reduction candidates. In-person and hybrid rows are grouped by course, modality, campus, and meeting pattern so reciprocal source-target pairs do not double-count a single opportunity.',
      assumptions: 'The default retention planning assumption is conservative review, not automatic cancellation. Consolidation rows require pooled receiving capacity based on the selected Absorb % threshold. Online rows use historical vacancy and section-cap math.',
      limitations: 'This report does not account for equity, program sequencing, instructor load, contractual constraints, room constraints, late enrollment behavior, or leadership decisions that may justify retaining a section.',
      items,
      version: 'Methodology v1.0'
    });
  }

  function renderDemandLegend() {
    const legend = document.getElementById('demandLegend');
    if (!legend) return;
    const items = [
      ['Terms Included', 'Metric card. Number of selected historical terms included after filters and the Analysis window are applied.'],
      ['Forecast Target', 'Metric card and controls. The future term or academic year being forecast. This does not require an uploaded section seating report. Forecast year uses the trailing FY/AY convention: FY/AY 2027 includes Summer 2026, Fall 2026, and Spring 2027, so FY/AY 2027 + Fall targets Fall 2026 / Banner term 202710. Rows from this target and later terms are excluded from historical calculations because in-progress enrollment is not a finalized baseline.'],
      ['Forecast Scope', 'Metric card and control. Single term forecasts compare only the same season before the target, such as prior Fall terms for a Fall target. Academic year forecasts aggregate Summer, Fall, and Spring rows into annual buckets before calculating growth.'],
      ['Analysis Window', 'Input. Maximum number of most-recent finalized historical terms or academic-year buckets to use after filters and forecast-target exclusion. Example: with five archived Fall terms and Analysis window = 4, the report uses the four most recent finalized Fall terms before the forecast target.'],
      ['Courses Reviewed', 'Metric card. Number of Course-level forecast rows after filters. College, Division, and Discipline summary rows are not counted here.'],
      ['College Growth', 'Metric card and table column. Growth rate for total college census enrollment across included terms. Formula: average per-term change from first included term to last included term / first included term census enrollment.'],
      ['Modifier Applied', 'Metric card. The manual Overall enrollment modifier converted to a percentage. Formula: entered value / 100.'],
      ['Historical FTES', 'Metric card. Average FTES for the College-level row across included finalized historical terms.'],
      ['Forecast FTES', 'Metric card. Expected FTES for the next term at the College level. Formula: Historical FTES x (1 + adjusted forecast growth).'],
      ['Known/Projected Companion FTES', 'Metric card and inputs. For single-term forecasts, sum of the known or projected FTES entered for the other terms in the same FY/AY. Example: when forecasting Spring 2027, enter known/projected Summer 2026 and Fall 2026 FTES so the annual cap comparison is not based on Spring alone. For academic-year forecasts, this is 0 because the forecast row already represents the full FY/AY bucket.'],
      ['Annual FTES Projection', 'Metric card. For single-term forecasts, Forecast FTES + Known/Projected Companion FTES. For academic-year forecasts, this equals Forecast FTES. This is the value used for the FTES cap comparison.'],
      ['Summer/Fall/Spring Estimated FTES', 'Metric cards shown only for Academic year forecasts. Formula: Annual FTES Projection x the selected historical season share. Season share uses historical FTES by season divided by total historical FTES across the selected academic-year buckets; if historical FTES is unavailable, census enrollment share is used as the fallback basis.'],
      ['FTES Cap', 'Input. Optional state-sanctioned FTES cap used only for comparison against the annual FTES projection; it does not change forecast growth or section estimates.'],
      ['FTES Cap Position', 'Metric card. Formula: FTES cap - Annual FTES Projection. Positive values are under cap; negative values are over cap.'],
      ['Expanding Demand', 'Metric card. Count of rows whose Capacity Guidance indicates expanding or increasing demand. Includes College, Division, Discipline, and Course rows.'],
      ['Softening Demand', 'Metric card. Count of rows whose Capacity Guidance indicates softening demand. Includes College, Division, Discipline, and Course rows.'],
      ['Average Forecast Growth', 'Metric card. Average adjusted forecast growth across all visible hierarchy rows.'],
      ['Forecast Level', 'Table column. Shows whether a row is College, Division, Discipline, or Course level.'],
      ['Forecast Group', 'Table column. The name of the level being summarized, such as College, a division name, a discipline code, or a course.'],
      ['Course', 'Table column. Course-level rows show the discipline/course. Aggregate College, Division, and Discipline rows show All courses because they summarize every matching course in that forecast group.'],
      ['Course Title', 'Table column. Course-level rows use the uploaded course-title field when present. Aggregate College, Division, and Discipline rows show the aggregate level instead of a specific title.'],
      ['Terms', 'Table column. Number of included historical terms represented in that row.'],
      ['Historical Sections Total', 'Table column. Sum of section counts across included historical terms or FY/AY buckets. Sections are deduplicated by term + CRN when CRN is available, with term + discipline + course + section fallback. This is intended to avoid double-counting multi-meeting rows for the same section.'],
      ['Average Sections Offered', 'Table column. Average historical sections per included term or FY/AY bucket. For an Academic year forecast, this is the annual average section count across the included historical years.'],
      ['Historical Avg Census Enrollment', 'Table column. Average historical census enrollment across included terms or FY/AY buckets. For an Academic year forecast, this is the annual average census enrollment. Formula: average of bucket-level sum(CENSUS_ENROLL); if CENSUS_ENROLL is missing for a section, ACTUAL_ENROLL is used for that section.'],
      ['Historical Avg Final Enrollment', 'Table column. Average historical final/current enrollment across included terms or FY/AY buckets. Formula: average of bucket-level sum(ACTUAL_ENROLL). This is context only and does not drive the forecast.'],
      ['Average FTES', 'Table column. Average historical FTES across included finalized terms. Uses uploaded FTES when present; otherwise estimates FTES from ACCOUNTING METHOD and available contact-hour fields. W/IW/unknown use census enrollment x weekly hours x 17.5 / 525. D/ID/P/E use census enrollment x TOTAL_CONTACT_HOURS / 525. If contact hours are unavailable but units are present, fallback formula is census enrollment x units / 30. If FTES, contact hours, and units are unavailable, FTES is 0.'],
      ['Historical Census Fill Rate', 'Table column. Average of term-level census fill rates. Formula per term: sum(census enrollment) / sum(MAX ENROLL).'],
      ['Historical Final Fill Rate', 'Table column. Average of term-level final fill rates. Formula per term: sum(ACTUAL_ENROLL) / sum(MAX ENROLL).'],
      ['Historical Avg Attrition Count', 'Table column. Average of term-level attrition counts. Formula per term: max(0, census enrollment - actual enrollment). This is context only and does not drive cancellation logic.'],
      ['Historical Avg Attrition Rate', 'Table column. Average of term-level attrition rates. Formula per term: max(0, census enrollment - actual enrollment) / census enrollment. This is context only and does not drive cancellation logic.'],
      ['Average Waitlist Count', 'Table column. Average historical waitlisted students across included terms when waitlist columns are present. Formula: average of term-level sum(waitlist).'],
      ['Waitlist Data Present', 'Table column. Yes when at least one source row for that forecast row includes a waitlist value. If no waitlist column exists, waitlist values remain 0 and should not be interpreted as confirmed no demand.'],
      ['Division Growth', 'Table column. Growth rate for the row division across included terms. Formula: average per-term change in division census enrollment / first included division census enrollment. Falls back to College Growth when division data is unavailable.'],
      ['Discipline Growth', 'Table column. Growth rate for the row discipline across included terms. Formula: average per-term change in discipline census enrollment / first included discipline census enrollment. Falls back to Division Growth when discipline data is unavailable.'],
      ['Course Growth', 'Table column. Course or group-specific growth rate across included terms. Formula: average per-term change in the row census enrollment / first included census enrollment. For aggregate rows, this represents that aggregate row trend.'],
      ['Modifier Growth', 'Table column. Manual enrollment-growth assumption from Overall enrollment modifier %. Formula: entered percentage / 100.'],
      ['Forecast Growth', 'Table column. Adjusted growth used for the forecast. Course rows use 50% course growth + 20% discipline growth + 15% division growth + 15% college growth + modifier. Division rows use 70% division growth + 30% college growth + modifier. Discipline rows use 60% discipline growth + 25% division growth + 15% college growth + modifier. College rows use college growth + modifier. Values are capped between -75% and +150%.'],
      ['Census-Based Expected Enrollment', 'Table column. Forecasted census enrollment for the selected forecast term or FY/AY. Formula: Historical Avg Census Enrollment x (1 + Forecast Growth), rounded to the nearest whole student.'],
      ['Forecast FTES', 'Table column. Forecasted FTES for the selected forecast term or FY/AY. Formula: Average FTES x (1 + Forecast Growth). This is the value to compare against an entered FTES cap.'],
      ['Expected Census Fill Rate', 'Table column. Forecasted utilization of offered capacity. Formula: Census-Based Expected Enrollment / average historical capacity.'],
      ['Forecast Sections Needed', 'Table column. Forecasted section need for the selected forecast term or FY/AY based on average section capacity. Formula: ceiling((Census-Based Expected Enrollment + Average Waitlist Count) / average section capacity).'],
      ['Suggested Section Count', 'Table column. Planning estimate currently equal to Forecast Sections Needed, floored at 1. This is a planning input, not an instruction to add, cancel, or consolidate sections.'],
      ['Forecast Confidence', 'Table column. High when at least four terms are included and average fill-rate variance is below 5 percentage points. Medium when at least three terms are included. Otherwise Low.'],
      ['Capacity Guidance', 'Table column. Plain-language interpretation of Forecast Growth and section need: expanding, moderate growth, stable, slight softening, or softening. It is not a direct cancellation or consolidation recommendation.'],
      ['Demand Trend Line', 'Insight chart. Term-by-term total census enrollment for the filtered dataset.'],
      ['FTES Trend', 'Insight chart. Term-by-term total FTES for the filtered dataset.'],
      ['Fill Rate Trend', 'Insight chart. Term-by-term sum(census enrollment) / sum(MAX ENROLL) for the filtered dataset.'],
      ['Waitlist Trend', 'Insight chart. Term-by-term total waitlist count when waitlist data exists.'],
      ['Forecast vs Actual Comparison', 'Insight card. Shows a simple historical proxy gap using abs((census/final midpoint) - census). This is a rough back-test placeholder because no separate prior forecast file is uploaded.'],
      ['Semester FTES Totals', 'Insight list. Shows each included finalized historical term total FTES and census enrollment after filters.'],
      ['Forecast Term FTES Split', 'Insight list shown only for Academic year forecasts. Displays the Summer, Fall, and Spring estimated FTES values that make up the Annual FTES Projection, including the historical share used for each season.'],
      ['Highest/Lowest Demand Day-Time Patterns', 'Insight lists. Groups filtered rows by day pattern, start time, modality, and campus; ranks by fill rate plus waitlist pressure. This supports placement planning, not section cancellation.'],
      ['ACCOUNTING METHOD W', 'Weekly Census. Estimated FTES formula when direct FTES is missing: census enrollment x HOURS_PER_WEEK x 17.5 / 525.'],
      ['ACCOUNTING METHOD D', 'Daily Census. Estimated FTES formula when direct FTES is missing: census enrollment x TOTAL_CONTACT_HOURS / 525.'],
      ['ACCOUNTING METHOD P', 'Positive Attendance. Estimated FTES formula when direct FTES is missing: census enrollment x TOTAL_CONTACT_HOURS / 525.'],
      ['ACCOUNTING METHOD E', 'Open Entry/Open Exit. Tied to Positive Attendance for reporting logic. Estimated FTES formula when direct FTES is missing: census enrollment x TOTAL_CONTACT_HOURS / 525.'],
      ['ACCOUNTING METHOD IW', 'Independent/Alternative Weekly Census. Estimated FTES formula when direct FTES is missing: census enrollment x HOURS_PER_WEEK x 17.5 / 525.'],
      ['ACCOUNTING METHOD ID', 'Independent/Alternative Daily Census. Estimated FTES formula when direct FTES is missing: census enrollment x TOTAL_CONTACT_HOURS / 525.'],
      ['ACCOUNTING METHOD I', 'Independent Study/Work Experience. Omitted from reporting and FTES forecast calculations.'],
      ['ACCOUNTING METHOD O', 'Not reportable for 320. Omitted from reporting and FTES forecast calculations.'],
      ['Not Included', 'This report does not use applications, registration intent, student education plans, section-level waitlist snapshots over time, room constraints, faculty availability, budget limits, or external labor-market demand. It also excludes rows omitted by instructional-method rules such as CPL, DE, CBE, and unmapped archived code 98, plus any rows removed by active filters.'],
      ['Data Limitations', 'Forecasts depend on uploaded columns. Missing FTES, contact-hour, unit, and accounting-method columns produce 0 estimated FTES. Missing waitlist columns make waitlist demand unknown, not zero. Missing division, department, or course title values appear blank or UNKNOWN. Terms that are still enrolling should not be selected as historical archives unless they are intentionally being reviewed as incomplete scenario data.']
    ];
    renderMethodologyPanel(legend, {
      title: 'Enrollment Demand Forecast Methodology & Data Dictionary',
      purpose: 'Forecasts future enrollment demand from finalized historical growth patterns at the college, division, discipline, and course levels. It supports schedule planning, enrollment growth, apportionment context, FTES cap planning, and capacity assumptions.',
      methodology: 'Forecast growth blends course, discipline, division, and college trends, then applies the optional modifier. Single-term forecasts compare like terms only. Academic-year forecasts aggregate Summer, Fall, and Spring into FY/AY buckets before calculating growth.',
      assumptions: 'Forecast growth is capped between -75% and +150%. FTES is direct-upload FTES when present; otherwise it is estimated from ACCOUNTING METHOD, census enrollment, and contact-hour fields. I and O accounting methods are omitted from reporting. E is treated as open-entry/open-exit positive attendance.',
      limitations: 'Forecasts are planning estimates, not guarantees. Positive attendance FTES is estimated from available section-seating fields unless manual/official production values are entered elsewhere. Missing waitlist, contact-hour, division, department, or title fields reduce reliability.',
      items,
      version: 'Methodology v1.1'
    });
  }

  function renderMethodologyPanel(node, config) {
    node.innerHTML = `
      <details class="methodology-panel">
        <summary>Methodology & Data Dictionary</summary>
        <div class="methodology-panel-body">
          <h3>${escapeAttr(config.title)}</h3>
          <section>
            <h4>Report Purpose</h4>
            <p>${escapeAttr(config.purpose)}</p>
          </section>
          <section>
            <h4>Methodology</h4>
            <p>${escapeAttr(config.methodology)}</p>
          </section>
          <section>
            <h4>Assumptions</h4>
            <p>${escapeAttr(config.assumptions)}</p>
          </section>
          <section>
            <h4>Limitations</h4>
            <p>${escapeAttr(config.limitations)}</p>
          </section>
          <section>
            <h4>Definitions, Calculations, and Headers</h4>
            <dl>${config.items.map(([term, definition]) => `<div><dt>${escapeAttr(term)}</dt><dd>${escapeAttr(definition)}</dd></div>`).join('')}</dl>
          </section>
          <section>
            <h4>Version Information</h4>
            <p>${escapeAttr(config.version)}. Last updated: 2026-06-18.</p>
          </section>
        </div>
      </details>`;
  }

  function label(text) {
    const labels = {
      group: 'Group',
      subject: 'Discipline',
      decisionSections: 'Decision Sections',
      totalSeats: 'Total Seats',
      emptySeatsAtCensus: 'Empty Seats at Census',
      emptySeatsAtFinal: 'Empty Seats at Final',
      courseHistoricalTermsIncluded: 'Course Historical Terms Included',
      overallHistoricalTermsIncluded: 'Overall Historical Terms Included',
      totalUploadedTerms: 'Total Uploaded Terms',
      decisionTermIncluded: 'Decision Term Included',
      historicalAttritionRate: 'Historical Attrition Rate',
      historicalAttritionCount: 'Historical Avg Attrition Count',
      historicalAvgCensusEnrollment: 'Historical Avg Census Enrollment',
      historicalAvgFinalEnrollment: 'Historical Avg Final Enrollment',
      historicalAvgCensusFillRate: 'Historical Avg Census Fill Rate',
      historicalAvgFinalFillRate: 'Historical Avg Final Fill Rate',
      historicalAvgAttritionRate: 'Historical Avg Attrition Rate',
      historicalTotalAttritionCount: 'Historical Total Attrition Count',
      decisionCensus: 'Decision Census Enrollment',
      decisionFinal: 'Decision Final/Current Enrollment',
      decisionAttritionRate: 'Decision Attrition Rate',
      sections: 'All Terms Sections',
      census: 'Census Enrollment',
      final: 'Final Enrollment',
      attritionCount: 'Attrition Count',
      attritionRate: 'All Terms Attrition Rate',
      censusFillRate: 'Census Fill Rate',
      finalFillRate: 'Final Fill Rate',
      availableAtCensus: 'Empty Seats at Census',
      availableAtEnd: 'Empty Seats at Final',
      type: 'Type',
      sections: 'Sections Reviewed',
      sectionsReviewed: 'Sections Reviewed',
      potentialSectionsRemoved: 'Potential Sections Removed',
      expectedEnrollment: 'Expected Enrollment',
      availableReceivingCapacity: 'Available Receiving Capacity',
      projectedRedistribution: 'Projected Redistribution',
      netAvailableCapacity: 'Net Available Capacity',
      potentialSeatsRecovered: 'Potential Seats Recovered',
      projectionSource: 'Projection Source',
      finalEnrollmentContext: 'Final Enrollment Context',
      sourceSummary: 'Source Summary',
      sourceEnroll: 'Source Expected Enrollment',
      targetSummary: 'Target Summary',
      targetEnroll: 'Target Expected Enrollment',
      targetOpenSeats: 'Target Open Seats',
      onlineSummary: 'Online Vacancy Math',
      sectionCap: 'Section Cap',
      possibleReductions: 'Possible Reductions',
      recommendedReductions: 'Recommended Reductions',
      recommendation: 'Recommendation',
      freedSeats: 'Freed Seats',
      matchReason: 'Match Reason',
      historicalTerms: 'Course Historical Terms Included',
      chronicLowFill: 'Chronic Low Fill',
      tbaConfidence: 'TBA Confidence Note',
      forecastLevel: 'Forecast Level',
      groupName: 'Forecast Group',
      courseTitle: 'Course Title',
      totalSectionsOffered: 'Historical Sections Total',
      avgSectionsOffered: 'Average Sections Offered',
      avgCensusEnrollment: 'Historical Avg Census Enrollment',
      avgFinalEnrollment: 'Historical Avg Final Enrollment',
      avgFtes: 'Average FTES',
      avgFillRate: 'Historical Census Fill Rate',
      avgFinalFillRate: 'Historical Final Fill Rate',
      avgAttritionCount: 'Historical Avg Attrition Count',
      avgAttritionRate: 'Historical Avg Attrition Rate',
      avgWaitlistCount: 'Average Waitlist Count',
      hasWaitlistData: 'Waitlist Data Present',
      sectionsFilledAtCensus: 'Sections Filled at Census',
      sectionsClosedPriorToCensus: 'Sections Closed Prior to Census',
      sectionsUnder50: 'Sections Under 50%',
      sectionsUnder35: 'Sections Under 35%',
      sectionsCancelled: 'Sections Cancelled',
      studentsUnableToEnroll: 'Students Unable to Enroll',
      demandScore: 'Demand Score',
      demandBand: 'Demand Band',
      collegeGrowth: 'College Growth',
      divisionGrowth: 'Division Growth',
      disciplineGrowth: 'Discipline Growth',
      courseGrowth: 'Course Growth',
      modifierGrowth: 'Modifier Growth',
      adjustedForecastGrowth: 'Forecast Growth',
      expectedEnrollmentNextTerm: 'Census-Based Expected Enrollment',
      expectedFtesNextTerm: 'Forecast FTES',
      expectedFillRate: 'Expected Census Fill Rate',
      expectedSectionsNeeded: 'Forecast Sections Needed',
      suggestedSectionCount: 'Suggested Section Count',
      forecastConfidence: 'Forecast Confidence',
      capacityGuidance: 'Capacity Guidance',
      group: 'Group',
      dimension: 'Dimension',
      name: 'Group',
      currentEnrollment: 'Current Enrollment',
      expectedEnrollment: 'Expected Enrollment',
      variance: 'Variance',
      variancePct: 'Variance %',
      openSeats: 'Total Open Seats',
      viableOpenSeats: 'Viable Open Seats',
      sameModalitySeats: 'Same Modality Seats',
      onlineSeats: 'Online Seats',
      sameCampusSeats: 'Same Campus Seats',
      timeWindowSeats: '+/- Hour Seats',
      compatibleDaySeats: 'Compatible Day Seats',
      action: 'Recommendation',
      studentsPresent: 'Students Present',
      sectionsActive: 'Sections Active',
      availableRoomCapacity: 'Available Room Capacity',
      seatsScheduled: 'Seats Scheduled',
      averageFillRate: 'Average Fill Rate',
      hour: 'Hour',
      peak: 'Peak',
      lightest: 'Lightest',
      primeSections: 'Prime Sections',
      primeEnrollment: 'Prime Enrollment',
      offPeakSections: 'Off-Peak Sections',
      offPeakEnrollment: 'Off-Peak Enrollment',
      termsOffered: 'Terms Offered',
      termsOfferedCount: 'Terms Offered Count',
      averageGap: 'Average Gap',
      rotationCycle: 'Rotation Cycle',
      lastOffered: 'Last Offered',
      expectedNextOffering: 'Expected Next Offering',
      rotationStatus: 'Rotation Status'
    };
    return labels[text] || text.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
  }

  function format(value, column = '') {
    if (typeof value === 'number' && /(rate|fill|growth|pct)$/i.test(column)) return pct(value);
    if (typeof value === 'number' && /ftes/i.test(column)) return round1(value);
    return value ?? '';
  }

  function exportRows(rows, filename) {
    let csv = Papa.unparse(rows);
    const methodology = methodologyExportText();
    if (methodology) {
      csv += `\r\n\r\n${Papa.unparse([{ Section: 'Methodology & Data Dictionary', Detail: methodology }])}`;
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function exportRowsWithoutMethodology(rows, filename) {
    const blob = new Blob([Papa.unparse(rows)], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function exportRowsExcel(rows, columns, filename) {
    const methodology = methodologyExportText();
    const methodologyTable = methodology
      ? `<br><table><thead><tr><th colspan="2">Methodology & Data Dictionary</th></tr></thead><tbody><tr><td>Report Methodology</td><td>${escapeAttr(methodology)}</td></tr></tbody></table>`
      : '';
    const html = `<table><thead><tr>${columns.map(column => `<th>${escapeAttr(label(column))}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${columns.map(column => `<td>${escapeAttr(format(row[column], column))}</td>`).join('')}</tr>`).join('')}</tbody></table>${methodologyTable}`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function methodologyExportText() {
    if (!document.getElementById('includeMethodologyExport')?.checked) return '';
    const selected = selectedEnrollmentReport();
    const legendId = selected === REPORTS.dashboard ? 'dashboardLegend' :
      selected === REPORTS.attrition ? 'attritionLegend' :
      selected === REPORTS.consolidation ? 'consolidationLegend' :
      selected === REPORTS.demand ? 'demandLegend' :
      selected === REPORTS.studentPresence ? 'studentPresenceLegend' :
      selected === REPORTS.instructorAvailability ? 'instructorAvailabilityLegend' : '';
    const text = document.getElementById(legendId)?.innerText || '';
    return [divisionFilterContextText(selected), text.trim()].filter(Boolean).join('\n\n');
  }

  function divisionFilterContextText(selectedReport) {
    const prefix = selectedReport === REPORTS.dashboard ? 'dash' :
      selectedReport === REPORTS.attrition ? 'attr' :
      selectedReport === REPORTS.consolidation ? 'con' :
      selectedReport === REPORTS.studentPresence ? 'sp' :
      selectedReport === REPORTS.demand ? 'dem' : '';
    if (!prefix || !document.getElementById(prefix + 'Division')) return '';
    return [
      'Report Context',
      `Prepared using TIMBER Enrollment Analytics`,
      `Methodology Version 1.2`,
      `Selected term: ${selectedReport === REPORTS.dashboard ? dashboardFocusTerm() || 'All Loaded Terms' : selectedReport === REPORTS.studentPresence ? studentPresenceFocusTerm() || 'N/A' : currentTerm() || 'All loaded terms'}`,
      `Division filter: ${filterUtils.divisionFilterLabel(getSelectedValues(prefix + 'Division'))}`,
      `Campus filter: ${filterUtils.divisionFilterLabel(getSelectedValues(prefix + 'Campus'))}`,
      `Modality filter: ${filterUtils.divisionFilterLabel(getSelectedValues(prefix + 'Modality'))}`,
      `Data source: ${dashboardDataSourceLabel()}`
    ].join('\n');
  }

  function selectedEnrollmentReport() {
    return document.getElementById('emReportSelect')?.value || REPORTS.dashboard;
  }

  function dashboardDataSourceLabel() {
    if (state.enrollment.length || state.demandInput.length || state.consolidationInput.length) return 'Uploaded and/or archived enrollment CSV rows';
    return 'Currently loaded schedule rows';
  }

  function isEnrollmentManagementUnlocked() {
    const expiresAt = Number(sessionStorage.getItem('cos-em-token-expires-at') || 0);
    if (!expiresAt || expiresAt <= Date.now()) {
      sessionStorage.removeItem('cos-em-token');
      sessionStorage.removeItem('cos-em-token-expires-at');
      sessionStorage.removeItem('cos-em-unlocked');
      return false;
    }
    return Boolean(sessionStorage.getItem('cos-em-token'));
  }

  function enrollmentManagementToken() {
    return isEnrollmentManagementUnlocked() ? sessionStorage.getItem('cos-em-token') : '';
  }

  async function unlockEnrollmentManagement() {
    if (window.COS_APP_CONFIG?.features?.enrollmentManagement === false) return;
    if (!window.BACKEND_BASE_URL) {
      alert('Backend is not configured, so Enrollment Management cannot be opened.');
      return;
    }
    const password = prompt('Enter Enrollment Management password:');
    if (password == null) return;
    const response = await fetch(`${window.BACKEND_BASE_URL}/api/auth/enrollment-management`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (!response.ok) {
      alert('Enrollment Management password was not accepted.');
      return;
    }
    const payload = await response.json();
    sessionStorage.setItem('cos-em-token', payload.token || '');
    sessionStorage.setItem('cos-em-token-expires-at', String(Date.parse(payload.expiresAt || '') || Date.now()));
    updateVisibility();
  }

  function updateVisibility() {
    const selected = selectedEnrollmentReport();
    const wrap = document.getElementById('analyticsReports');
    if (!wrap) return;
    const unlocked = isEnrollmentManagementUnlocked();
    wrap.style.display = 'block';
    document.getElementById('emReportControls').hidden = !unlocked;
    document.getElementById('unlockEnrollmentManagement').hidden = unlocked;
    const note = document.querySelector('.em-access-note');
    if (note) note.textContent = unlocked ? 'Decision-support reports are open for this browser session.' : 'Decision-support summaries are hidden until opened.';
    document.getElementById('dashboardReport').style.display = unlocked && selected === REPORTS.dashboard ? 'block' : 'none';
    document.getElementById('attritionReport').style.display = unlocked && selected === REPORTS.attrition ? 'block' : 'none';
    document.getElementById('consolidationReport').style.display = unlocked && selected === REPORTS.consolidation ? 'block' : 'none';
    document.getElementById('demandReport').style.display = unlocked && selected === REPORTS.demand ? 'block' : 'none';
    document.getElementById('studentPresenceReport').style.display = unlocked && selected === REPORTS.studentPresence ? 'block' : 'none';
    document.getElementById('instructorAvailabilityReport').style.display = unlocked && selected === REPORTS.instructorAvailability ? 'block' : 'none';
    const utilizationTool = document.getElementById('utilization-tool');
    if (utilizationTool) utilizationTool.style.display = unlocked && selected === REPORTS.utilization ? 'block' : 'none';
    if (!unlocked) return;
    if (selected === REPORTS.dashboard) {
      runDashboard();
    }
    if (selected === REPORTS.attrition && !state.attritionRan) {
      const rows = state.enrollment.length ? state.enrollment : currentRows().filter(row => !isOmittedInstructionalMethod(row));
      updateDecisionTermOptions(state.attritionTerms.length ? state.attritionTerms : collectTerms(rows));
      populateAnalyticsFilters('attr', rows);
      document.getElementById('attritionTable').innerHTML = '<p class="analytics-empty">Upload enrollment CSV files, then click Run.</p>';
    }
    if (selected === REPORTS.consolidation) {
      populateAnalyticsFilters('con', state.consolidationInput.length ? state.consolidationInput : currentRows());
      renderConsolidationLegend();
    }
    if (selected === REPORTS.demand && !state.demandRan) {
      const rows = state.demandInput.length ? state.demandInput : currentRows().filter(row => !isOmittedInstructionalMethod(row));
      updateDemandTermOptions(state.demandTerms.length ? state.demandTerms : collectTerms(rows));
      populateAnalyticsFilters('dem', rows);
      document.getElementById('demandTable').innerHTML = '<p class="analytics-empty">Upload or select archived historical CSV files, then click Run.</p>';
      renderDemandLegend();
    }
    if (selected === REPORTS.utilization) {
      window.COSScheduleApp?.renderUtilizationMap?.();
    }
    if (selected === REPORTS.studentPresence) {
      runStudentPresence().catch(err => alert(err.message || 'Student Presence failed.'));
    }
    if (selected === REPORTS.instructorAvailability) {
      populateInstructorAvailabilityFilters(currentRows());
      runInstructorAvailability();
    }
  }

  function injectStyle() {
    if (document.getElementById('analyticsReportStyles')) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="analyticsReportStyles">
      .analytics-reports{width:min(1480px,calc(100% - 2rem));margin:16px auto 24px;padding:14px;background:rgba(255,255,255,.74);border:1px solid #d8e1ec;border-radius:12px;box-shadow:none}
      .em-access-panel{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #e2eaf3}
      .em-unlock{min-height:32px;border:1px solid #ccd6e2;border-radius:8px;padding:0 12px;background:#f8fbff;color:#51657c;font-size:13px;font-weight:800;cursor:pointer;box-shadow:none}
      .em-unlock:hover{color:#123367;border-color:#8ba6c2;background:#fff}
      .em-access-note{color:#6b7d91;font-size:12px}
      .em-report-controls{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:18px}
      .em-report-controls label{font-weight:800;color:#51657c;font-size:13px}
      .em-report-controls .em-methodology-export{font-weight:700;color:#51657c}
      .em-report-controls .em-methodology-export input{margin-right:6px}
      .em-workbench-note{flex-basis:100%;color:#6b7d91;font-size:12px;line-height:1.35}
      .em-report-controls select{min-height:36px;border:1px solid #ccd6e2;border-radius:8px;padding:6px 10px;background:#fff;color:#123367;font-weight:700}
      .analytics-report-intro{margin-bottom:16px;color:#51657c;line-height:1.45}
      .analytics-report-intro h2{margin:0 0 6px;color:#123367;font-size:24px}
      .analytics-report-intro p{margin:0;max-width:980px}
      .analytics-methodology{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:14px;padding:14px;border:1px solid #d8e1ec;border-radius:12px;background:#f8fbff}
      .analytics-methodology>div{min-width:0}
      .analytics-methodology h3{margin:0 0 6px;color:#123367;font-size:15px}
      .analytics-methodology ul{margin:0;padding-left:18px}
      .analytics-methodology li{margin:4px 0}
      .analytics-toolbar{display:flex;flex-wrap:wrap;gap:12px;align-items:end;margin-bottom:18px}
      .analytics-toolbar label{display:flex;flex-direction:column;gap:4px;font-weight:600;color:#51657c;font-size:13px}
      .analytics-toolbar input,.analytics-toolbar select{min-height:34px;border:1px solid #ccd6e2;border-radius:6px;padding:6px 8px}
      .analytics-toolbar input[type=checkbox]{min-height:auto}
      .analytics-toolbar button{min-height:36px;border:0;border-radius:18px;padding:0 16px;background:#cdeffc;color:#002b5c;font-weight:700;cursor:pointer}
      .analytics-toolbar .choices{min-width:170px;margin-bottom:0}
      .analytics-toolbar .choices__inner{min-height:34px;border:1px solid #ccd6e2;border-radius:6px;background:#fff;padding:3px 6px}
      .analytics-toolbar .choices__list--dropdown .choices__item,.analytics-toolbar .choices__list[aria-expanded] .choices__item{font-size:12px;line-height:1.2;white-space:nowrap}
      .analytics-toolbar .choices__list--multiple .choices__item{background:#174f7d;border-color:#174f7d;border-radius:18px;font-size:12px;line-height:1.2;margin:2px 3px 2px 0;padding:7px 22px 7px 10px;white-space:nowrap;max-width:150px;overflow:hidden;text-overflow:ellipsis;position:relative}
      .analytics-toolbar .choices[data-type*="select-multiple"] .choices__button{position:absolute;right:7px;top:50%;transform:translateY(-50%);width:12px;height:12px;margin:0;padding:0;border:0;background:none!important;text-indent:0;opacity:1;font-size:0;line-height:12px;color:#fff}
      .analytics-toolbar .choices[data-type*="select-multiple"] .choices__button::before{content:'x';display:block;font-size:12px;font-weight:800;line-height:12px}
      .analytics-toolbar .choices__placeholder{font-size:12px}
      .analytics-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:14px}
      .analytics-metrics div{border:1px solid #d8e1ec;border-radius:8px;padding:12px;background:#f8fbff}
      .analytics-metrics strong{display:block;font-size:22px;color:#002b5c}
      .analytics-metrics span{font-size:12px;color:#51657c;text-transform:uppercase}
      #iaInstructor{min-width:220px;min-height:92px}
      .instructor-week-grid{margin:0 0 14px;overflow:auto;border:1px solid #d8e1ec;border-radius:10px;background:#fff}
      .instructor-grid-note{padding:10px 12px;color:#51657c;background:#f8fbff;border-bottom:1px solid #d8e1ec;font-size:13px}
      .instructor-calendar-grid{display:grid;grid-template-columns:96px repeat(5,minmax(160px,1fr));position:relative;min-width:980px}
      .instructor-grid-header{position:sticky;top:0;z-index:4;background:#eaf1f7;color:#123367;font-weight:800;text-align:center;padding:8px;border-right:1px solid #d8e1ec;border-bottom:1px solid #d8e1ec}
      .instructor-grid-time{background:#eef5f9;color:#123367;font-weight:800;text-align:center;padding:7px 6px;border-right:1px solid #d8e1ec;border-bottom:1px solid #e6edf5;font-size:12px}
      .instructor-grid-cell{border-right:1px solid #e1e8f0;border-bottom:1px solid #e6edf5;background:#fff}
      .instructor-grid-event{align-self:start;z-index:3;box-sizing:border-box;min-height:26px;border:1px solid #1f7aa8;border-left:4px solid #1f7aa8;border-radius:8px;background:linear-gradient(135deg,#e8f4fb,#cdeffc);box-shadow:0 4px 10px rgba(15,45,75,.14);padding:6px;color:#123367;overflow:hidden}
      .instructor-grid-event strong,.instructor-grid-event span,.instructor-grid-event small{display:block;line-height:1.15}
      .instructor-grid-event strong{font-size:12px}
      .instructor-grid-event span,.instructor-grid-event small{font-size:11px}
      .instructor-available-times{margin:0 0 14px;padding:12px;border:1px solid #d8e1ec;border-radius:10px;background:#f8fbff;color:#334862}
      .instructor-available-times h3{margin:0 0 6px;color:#123367;font-size:15px}
      .instructor-available-times p{margin:0 0 10px;font-size:13px;color:#51657c}
      .instructor-shared-availability{background:#fff;border:1px solid #e2eaf3;border-radius:8px;padding:10px}
      .instructor-shared-availability h4{margin:0 0 6px;color:#123367}
      .instructor-shared-availability ul{margin:0;padding-left:18px;columns:2;column-gap:28px}
      .instructor-shared-availability li{break-inside:avoid;margin:4px 0;line-height:1.3}
      .analytics-insights{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-bottom:14px}
      .analytics-insights section{border:1px solid #d8e1ec;border-radius:10px;background:#f8fbff;padding:12px}
      .analytics-insights h3{margin:0 0 8px;color:#123367;font-size:15px}
      .analytics-insights ul{margin:0;padding-left:18px;color:#334862}
      .analytics-insights li{margin:4px 0;line-height:1.3}
      .dashboard-actions{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}
      .dashboard-actions button,.dashboard-panel button{min-height:32px;border:1px solid #ccd6e2;border-radius:8px;padding:0 12px;background:#fff;color:#123367;font-weight:800;cursor:pointer}
      .dashboard-actions button:hover,.dashboard-panel button:hover{border-color:#8ba6c2;background:#f8fbff}
      .dashboard-scope-panel{margin:0 0 14px;padding:12px;border:1px solid #d8e1ec;border-radius:8px;background:#fff}
      .dashboard-scope-panel h3{margin:0 0 8px;color:#123367;font-size:15px}
      .dashboard-scope-panel dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px;margin:10px 0 0}
      .dashboard-scope-panel dl div{border:1px solid #e2eaf3;border-radius:8px;background:#f8fbff;padding:8px}
      .dashboard-scope-panel dt{font-size:11px;text-transform:uppercase;color:#51657c;font-weight:800}
      .dashboard-scope-panel dd{margin:3px 0 0;color:#123367;font-weight:800;line-height:1.25}
      .dashboard-scope-warnings{display:grid;gap:6px}
      .dashboard-scope-warnings p{margin:0;padding:8px 10px;border:1px solid #f0c36d;border-radius:8px;background:#fff7dc;color:#6d4c00;font-weight:800;line-height:1.3}
      .dashboard-scope-ok{padding:8px 10px;border:1px solid #b9ddc3;border-radius:8px;background:#eef9f1;color:#245f37;font-weight:800}
      .analytics-warning-panel{margin:10px 0;padding:10px 12px;border:1px solid #f0c36d;border-radius:8px;background:#fff7dc;color:#6d4c00}
      .analytics-warning-panel strong{display:block;margin-bottom:4px;color:#5f4100}
      .analytics-warning-panel ul{margin:0;padding-left:18px}
      .dashboard-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:12px;margin-bottom:14px}
      .dashboard-panel{min-width:0;border:1px solid #d8e1ec;border-radius:8px;background:#f8fbff;padding:12px;overflow:hidden}
      .dashboard-panel h3{margin:0 0 8px;color:#123367;font-size:15px}
      .dashboard-table-wrap{overflow-x:auto;overflow-y:auto;max-height:460px}
      .dashboard-panel table{width:100%;min-width:520px;border-collapse:collapse;background:#fff}
      .dashboard-mini-table-growth{min-width:760px}
      .dashboard-mini-table-reduction{min-width:680px}
      .dashboard-mini-table-presence{min-width:560px}
      .dashboard-panel th{background:#eaf1f7;color:#123367;text-align:left;padding:7px;font-size:12px;white-space:nowrap;word-break:normal}
      .dashboard-panel th span{white-space:nowrap}
      .dashboard-panel td{border-top:1px solid #e6edf5;padding:7px;font-size:12px;vertical-align:top;word-break:normal;overflow-wrap:normal}
      .dashboard-panel td.dashboard-cell-text{white-space:normal;overflow-wrap:break-word;min-width:120px}
      .dashboard-note{margin:0 0 8px;color:#334862;font-size:13px;line-height:1.35}
      .analytics-sparkline{display:block;width:100%;height:74px;margin:6px 0}
      .analytics-sparkline polyline{fill:none;stroke:#1f7aa8;stroke-width:4;stroke-linecap:round;stroke-linejoin:round}
      .analytics-chart-note{margin:4px 0 0;color:#51657c;font-size:12px;line-height:1.3}
      .analytics-table{overflow:auto;max-height:620px;border:1px solid #d8e1ec;border-radius:8px}
      .analytics-table table{width:100%;border-collapse:collapse;background:#fff}
      .analytics-table th{position:sticky;top:0;background:#174f7d;color:#fff;text-align:left;padding:9px;font-size:13px}
      .analytics-table th .analytics-sort{display:flex;align-items:center;gap:5px;width:100%;border:0;background:transparent;color:inherit;font:inherit;font-weight:800;text-align:left;cursor:pointer;padding:0}
      .analytics-table th .analytics-sort span{min-width:10px;font-size:10px}
      .analytics-table td{border-top:1px solid #e6edf5;padding:8px;font-size:13px}
      #consolidationTable{overflow-x:hidden}
      #consolidationTable table{table-layout:fixed}
      #consolidationTable th{padding:8px 7px;font-size:12px}
      #consolidationTable th .analytics-sort{align-items:flex-start;line-height:1.15;white-space:normal}
      #consolidationTable td{padding:7px;font-size:12px;line-height:1.25;vertical-align:top;white-space:normal;overflow-wrap:anywhere}
      .analytics-empty{padding:16px;margin:0;color:#51657c}
      .analytics-legend{margin-top:14px;padding:14px;border:1px solid #d8e1ec;border-radius:12px;background:#f8fbff;color:#51657c}
      .analytics-legend h3{margin:0 0 6px;color:#123367;font-size:16px}
      .analytics-legend h4{margin:12px 0 4px;color:#123367;font-size:14px}
      .analytics-legend p{margin:0 0 10px;max-width:980px}
      .analytics-legend dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px 16px;margin:0}
      .analytics-legend div{border-top:1px solid #e2eaf3;padding-top:8px}
      .analytics-legend dt{font-weight:800;color:#123367}
      .analytics-legend dd{margin:3px 0 0;line-height:1.35}
      .methodology-panel summary{cursor:pointer;font-weight:900;color:#123367;font-size:16px}
      .methodology-panel-body{padding-top:10px}
      .methodology-panel-body section{margin-top:8px}
    </style>`);
  }

  function wire() {
    document.getElementById('viewSelect')?.addEventListener('change', updateVisibility);
    document.getElementById('emReportSelect')?.addEventListener('change', updateVisibility);
    document.getElementById('unlockEnrollmentManagement')?.addEventListener('click', unlockEnrollmentManagement);
    document.getElementById('termSelect')?.addEventListener('change', () => {
      if (!isEnrollmentManagementUnlocked()) return;
      if (selectedEnrollmentReport() === REPORTS.dashboard) runDashboard();
      if (selectedEnrollmentReport() === REPORTS.consolidation) runConsolidation();
      if (selectedEnrollmentReport() === REPORTS.demand) runDemand();
      if (selectedEnrollmentReport() === REPORTS.studentPresence) runStudentPresence().catch(err => alert(err.message || 'Student Presence failed.'));
    });
    document.getElementById('runDashboard')?.addEventListener('click', runDashboard);
    document.getElementById('dashFocusTerm')?.addEventListener('change', runDashboard);
    document.getElementById('exportDashboardSummary')?.addEventListener('click', exportDashboardSummary);
    document.getElementById('runStudentPresence')?.addEventListener('click', () => runStudentPresence().catch(err => alert(err.message || 'Student Presence failed.')));
    document.getElementById('spFocusTerm')?.addEventListener('change', () => runStudentPresence().catch(err => alert(err.message || 'Student Presence failed.')));
    document.getElementById('spGroup')?.addEventListener('change', () => runStudentPresence().catch(err => alert(err.message || 'Student Presence failed.')));
    document.getElementById('exportStudentPresence')?.addEventListener('click', () => exportRows(state.studentPresenceRows, `student-presence-${studentPresenceFocusTerm() || 'term'}.csv`));
    document.getElementById('runAttrition')?.addEventListener('click', runAttrition);
    document.getElementById('enrollmentCsv')?.addEventListener('change', loadAttritionFiles);
    document.getElementById('attrArchiveTerms')?.addEventListener('change', loadAttritionFiles);
    document.getElementById('archiveAttritionUploads')?.addEventListener('click', () => archiveUploads('enrollmentCsv').catch(err => alert(err.message || 'Archive failed.')));
    document.getElementById('clearAttrition')?.addEventListener('click', () => resetAnalyticsControls('attr'));
    document.getElementById('runConsolidation')?.addEventListener('click', runConsolidation);
    document.getElementById('consolidationCsv')?.addEventListener('change', loadConsolidationRows);
    document.getElementById('conArchiveTerms')?.addEventListener('change', loadConsolidationRows);
    document.getElementById('archiveConsolidationUploads')?.addEventListener('click', () => archiveUploads('consolidationCsv').catch(err => alert(err.message || 'Archive failed.')));
    document.getElementById('clearConsolidation')?.addEventListener('click', () => resetAnalyticsControls('con'));
    document.getElementById('runDemand')?.addEventListener('click', runDemand);
    document.getElementById('demandCsv')?.addEventListener('change', loadDemandRows);
    document.getElementById('demArchiveTerms')?.addEventListener('change', loadDemandRows);
    document.getElementById('demForecastScope')?.addEventListener('change', updateDemandTargetControls);
    document.getElementById('archiveDemandUploads')?.addEventListener('click', () => archiveUploads('demandCsv').catch(err => alert(err.message || 'Archive failed.')));
    document.getElementById('archiveStudentPresenceUploads')?.addEventListener('click', () => archiveUploads('studentPresenceCsv').catch(err => alert(err.message || 'Archive failed.')));
    document.getElementById('clearDemand')?.addEventListener('click', () => resetAnalyticsControls('dem'));
    document.getElementById('runInstructorAvailability')?.addEventListener('click', runInstructorAvailability);
    document.getElementById('clearInstructorAvailability')?.addEventListener('click', clearInstructorAvailability);
    document.getElementById('iaDivision')?.addEventListener('change', () => populateInstructorAvailabilityFilters(dedupeEnrollmentRows(currentRows()).filter(row => row.instructor)));
    document.getElementById('iaDiscipline')?.addEventListener('change', () => populateInstructorAvailabilityFilters(dedupeEnrollmentRows(currentRows()).filter(row => row.instructor)));
    document.getElementById('iaSelectVisible')?.addEventListener('click', selectVisibleInstructors);
    document.getElementById('exportAttrition')?.addEventListener('click', () => exportRows(state.attritionRows, `enrollment-attrition-${currentTerm() || 'term'}.csv`));
    document.getElementById('exportConsolidation')?.addEventListener('click', () => exportRows(state.consolidationRows.map(flattenOpportunity), `section-consolidation-${currentTerm() || 'term'}.csv`));
    document.getElementById('exportDemand')?.addEventListener('click', () => exportRows(state.demandRows, `enrollment-demand-forecast-${demandTargetSlug()}.csv`));
    document.getElementById('exportDemandExcel')?.addEventListener('click', () => exportRowsExcel(state.demandRows, demandColumns(), `enrollment-demand-forecast-${demandTargetSlug()}.xls`));
    document.getElementById('exportRotation')?.addEventListener('click', () => exportRows(state.rotationRows, `course-rotation-analysis-${currentTerm() || 'term'}.csv`));
    document.getElementById('analyticsReports')?.addEventListener('click', (event) => {
      const targetButton = event.target.closest('[data-report-target],[data-scroll-target]');
      if (targetButton) {
        const targetReport = targetButton.dataset.reportTarget;
        const reportSelect = document.getElementById('emReportSelect');
        if (targetReport && reportSelect) {
          reportSelect.value = targetReport;
          updateVisibility();
        }
        const scrollTarget = targetButton.dataset.scrollTarget;
        if (scrollTarget) document.getElementById(scrollTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      const button = event.target.closest('.analytics-sort');
      if (button) sortAnalyticsTable(button);
    });
  }

  function init() {
    ensureOptions();
    buildUi();
    injectStyle();
    wire();
    refreshAnalyticsArchiveOptions();
    updateVisibility();
  }

  window.COSEnrollmentAnalytics = {
    normalizeRow: normalize,
    dashboardAvailableTerms,
    dashboardCurrentRows,
    dashboardHistoricalRows,
    dashboardScopeContext,
    dashboardScopeWarnings,
    summaryLifecycleAvailability
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
