(function () {
  'use strict';

  const REPORTS = {
    dashboard: 'enrollment-dashboard',
    attrition: 'enrollment-attrition',
    consolidation: 'section-consolidation',
    duration: 'course-duration-concurrent',
    demand: 'enrollment-demand-forecast',
    heatmap: 'heatmap-analytics',
    utilization: 'room-utilization',
    modality: 'modality-balance',
    roomFit: 'room-fit-analysis',
    workExperience: 'work-experience-enrollment',
    studentPresence: 'student-presence-analytics',
    instructorAvailability: 'instructor-availability',
    facultyHeatmap: 'faculty-schedule-heatmap',
    facultyModality: 'faculty-modality',
    primeTimeAnalysis: 'prime-time-analysis',
    supplyDemand: 'supply-demand-analysis',
    busyTimeDashboard: 'busy-time-dashboard',
    studentChoiceOpportunity: 'student-choice-opportunity',
    recommendationEngine: 'scheduling-recommendation-engine',
    conflictCheck: 'conflict-check',
    snapshotManager: 'enrollment-snapshot-manager',
    archiveInspection: 'archive-inspection'
  };
  const ROLE_LEVEL = {
    general: 1,
    dean: 2,
    em: 3,
    development: 4,
    admin: 5
  };
  const ROLE_LABEL = {
    general: 'General',
    dean: 'Dean / Division Chair',
    em: 'Enrollment Management',
    development: 'Development',
    admin: 'Administrator'
  };
  const REPORT_ACCESS = {
    [REPORTS.archiveInspection]: 'admin',
    [REPORTS.snapshotManager]: 'admin',
    [REPORTS.workExperience]: 'admin',
    [REPORTS.dashboard]: 'dean',
    [REPORTS.duration]: 'dean',
    [REPORTS.heatmap]: 'dean',
    [REPORTS.instructorAvailability]: 'dean',
    [REPORTS.modality]: 'dean',
    [REPORTS.conflictCheck]: 'em',
    [REPORTS.attrition]: 'em',
    [REPORTS.demand]: 'em',
    [REPORTS.roomFit]: 'em',
    [REPORTS.utilization]: 'em',
    [REPORTS.consolidation]: 'em',
    [REPORTS.studentPresence]: 'em',
    [REPORTS.facultyModality]: 'development',
    [REPORTS.primeTimeAnalysis]: 'development',
    [REPORTS.supplyDemand]: 'development',
    [REPORTS.busyTimeDashboard]: 'development',
    [REPORTS.studentChoiceOpportunity]: 'development',
    [REPORTS.recommendationEngine]: 'development',
    [REPORTS.facultyHeatmap]: 'development'
  };
  const REPORT_LABEL = {
    [REPORTS.archiveInspection]: 'Archived Schedule Inspector',
    [REPORTS.conflictCheck]: 'Conflict Check Report',
    [REPORTS.duration]: 'Course Duration / Concurrent Courses',
    [REPORTS.dashboard]: 'Enrollment Analytics Dashboard',
    [REPORTS.attrition]: 'Enrollment Attrition Trend',
    [REPORTS.demand]: 'Enrollment Demand Forecast',
    [REPORTS.snapshotManager]: 'Enrollment Snapshot Manager',
    [REPORTS.heatmap]: 'Heatmap Analytics',
    [REPORTS.instructorAvailability]: 'Instructor Availability - Planning View',
    [REPORTS.modality]: 'Modality Balance',
    [REPORTS.roomFit]: 'Room Fit Analysis',
    [REPORTS.utilization]: 'Room Utilization Map',
    [REPORTS.consolidation]: 'Section Consolidation Opportunities',
    [REPORTS.studentPresence]: 'Student Presence Analytics',
    [REPORTS.facultyModality]: 'Faculty Modality',
    [REPORTS.primeTimeAnalysis]: 'Prime Time Analysis',
    [REPORTS.supplyDemand]: 'Supply vs Demand',
    [REPORTS.busyTimeDashboard]: 'Busy Time Dashboard',
    [REPORTS.studentChoiceOpportunity]: 'Student Choice Opportunity',
    [REPORTS.recommendationEngine]: 'Scheduling Recommendation Engine',
    [REPORTS.facultyHeatmap]: 'Faculty Schedule Heatmap',
    [REPORTS.workExperience]: 'Work Experience Enrollment'
  };
  const REPORT_GROUP_ORDER = ['dean', 'em', 'admin', 'development'];
  const REPORT_ORDER = [
    REPORTS.archiveInspection,
    REPORTS.snapshotManager,
    REPORTS.workExperience,
    REPORTS.duration,
    REPORTS.dashboard,
    REPORTS.heatmap,
    REPORTS.instructorAvailability,
    REPORTS.modality,
    REPORTS.conflictCheck,
    REPORTS.attrition,
    REPORTS.demand,
    REPORTS.roomFit,
    REPORTS.utilization,
    REPORTS.consolidation,
    REPORTS.studentPresence,
    REPORTS.facultyModality,
    REPORTS.primeTimeAnalysis,
    REPORTS.supplyDemand,
    REPORTS.busyTimeDashboard,
    REPORTS.studentChoiceOpportunity,
    REPORTS.recommendationEngine,
    REPORTS.facultyHeatmap
  ];
  const SNAPSHOT_STORAGE_KEY = 'cos-enrollment-snapshots';
  const ROLE_STORAGE_KEY = 'cos-access-role';
  const ROLE_TOKEN_KEY = 'cos-role-token';
  const ROLE_EXPIRES_KEY = 'cos-role-token-expires-at';
  const LEGACY_EM_TOKEN_KEY = 'cos-em-token';
  const LEGACY_EM_EXPIRES_KEY = 'cos-em-token-expires-at';
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
    workExperienceInput: [],
    dashboardInput: [],
    dashboardRows: [],
    rotationRows: [],
    dashboardRan: false,
    studentPresenceRows: [],
    studentPresenceSourceRows: [],
    studentPresenceComparisonRows: [],
    studentPresenceGraphRows: [],
    studentPresenceReport: null,
    studentPresenceChartFilter: null,
    studentPresenceExportRows: [],
    studentPresenceRan: false,
    facultyHeatmapRows: [],
    facultyHeatmapBucketRows: [],
    facultyHeatmapRan: false,
    facultyModalityRows: [],
    facultyModalityTableRows: [],
    facultyModalityRan: false,
    primeTimeRows: [],
    primeTimeTableRows: [],
    primeTimeRan: false,
    supplyDemandRows: [],
    supplyDemandBucketRows: [],
    supplyDemandRan: false,
    busyTimeRows: [],
    busyTimeFacultyRows: [],
    busyTimeTableRows: [],
    busyTimeRan: false,
    studentChoiceRows: [],
    studentChoiceFacultyRows: [],
    studentChoiceBucketRows: [],
    studentChoiceRan: false,
    recommendationRows: [],
    recommendationFacultyRows: [],
    recommendationOutputRows: [],
    recommendationRan: false,
    conflictRows: [],
    conflictInput: [],
    conflictTerms: [],
    conflictRan: false,
    archiveInspectionRows: [],
    archiveInspectionTerm: '',
    attritionRows: [],
    attritionRan: false,
    attritionTerms: [],
    consolidationRan: false,
    consolidationTerms: [],
    demandRan: false,
    demandTerms: [],
    archivedAnalyticsTerms: [],
    enrollmentSnapshots: [],
    snapshotRows: [],
    snapshotLastUpdated: null,
    pendingAccessRole: '',
    pendingAccessReport: ''
  };
  const analyticsChoices = new Map();
  const metrics = window.COSEnrollmentMetrics;
  const filterUtils = window.COSEnrollmentFilters;
  const consolidation = window.COSConsolidationAnalytics;
  const dashboard = window.COSEnrollmentDashboard;
  const sectionModel = window.COSSectionModel;
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
  let studentPresenceChartInstance = null;
  const modalityGroups = {
    online: new Set(['ONL', '71', '72', 'O1', 'OL', 'ONN', 'ONS', 'OO', 'OS', 'OSS', 'OT', 'OTS', 'ON', 'OSL']),
    inPerson: new Set(['IP', '02', '22', '022', '02H', '02O', '02S', '02T', '02N', '04', '06', '07', '08', '09', '12', 'XX', 'YY']),
    hybrid: new Set(['HYB', 'OH', 'OHF', 'FLX', 'OHS']),
    omitted: new Set(['CPL', 'DE', 'CBE', '98'])
  };
  const TUTORING_OPEN_LAB_CONFIG = {
    label: 'Tutoring / Open Lab Sections',
    defaultExcludedCourses: ['MATH 400', 'ENGL 400', 'LA 425']
  };
  const tutoringOpenLabCourseSet = new Set(TUTORING_OPEN_LAB_CONFIG.defaultExcludedCourses.map(canon));

  const fields = {
    term: ['Term', 'TERM', 'term'],
    crn: ['CRN', 'Crn', 'crn', 'Course Reference Number', 'COURSE REFERENCE NUMBER', 'Course Ref Number', 'COURSE_REF_NUMBER', 'CRN_KEY'],
    subject: ['Subject', 'SUBJECT', 'Discipline', 'DISCIPLINE'],
    course: ['Course', 'COURSE', 'Course_Number', 'Course Number', 'Course No', 'Catalog', 'CATALOG'],
    title: ['Course Title', 'COURSE_TITLE', 'Title', 'TITLE', 'Long Title', 'Course_Name', 'Course Name'],
    division: ['Division', 'DIVISION', 'Division Name', 'DIVISION_NAME'],
    department: ['Department', 'DEPARTMENT', 'Dept', 'DEPT', 'Department Name', 'DEPARTMENT_NAME'],
    section: ['Section', 'SECTION', 'Sec', 'SEC', 'SECTION_NUMB', 'Section Number'],
    campus: ['Campus', 'CAMPUS', 'Campus Code', 'CAMPUS CODE', 'Campus_Code', 'CAMPUS_CODE'],
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
    actual: ['Actual_Enroll', 'ACTUAL_ENROLL', 'Actual Enroll', 'Enrollment', 'Enroll', 'ENROLLED', 'Current Enrollment', 'Current Enrollment / ACTUAL_ENROLL', 'Current_Enrollment'],
    census: ['Census_Enroll', 'CENSUS_ENROLL', 'Census Enroll', 'Census Enrollment', 'Census Enrollment / CENSUS_ENROLL'],
    firstDay: ['First Day Enrollment', 'First_Day_Enrollment', 'FIRST_DAY_ENROLLMENT', 'First Day'],
    census1: ['Census 1', 'Census_1', 'CENSUS_1'],
    census2: ['Census 2', 'Census_2', 'CENSUS_2', 'CENSUS_ENROLL2', 'Census Enroll 2', 'Census Enrollment 2'],
    finalEnrollment: ['Final Enrollment', 'FINAL_ENROLLMENT', 'End Enrollment', 'END_ENROLLMENT', 'Final Enrollment, if available'],
    waitlist: ['Waitlist', 'WAITLIST', 'Waitlist Count', 'WAITLIST_COUNT', 'WAIT COUNT', 'WAIT_COUNT', 'WL Count', 'WAITLISTED'],
    fill: ['Fill_Rate', 'Fill Rate', 'Percent Full', '% Full'],
    closed: ['Closed Prior to Census', 'CLOSED_PRIOR_TO_CENSUS', 'Closed Before Census', 'Closed', 'CLOSED'],
    status: ['Status', 'STATUS', 'Section Status'],
    crossList: ['CROSS_LIST', 'Cross List', 'Cross_List', 'Cross Listed', 'Cross-Listed', 'XLIST', 'X_LIST']
  };
  fields.startDate = ['Start_Date', 'START_DATE', 'Start Date', 'START DATE', 'Class Start Date', 'CLASS START DATE', 'Begin Date', 'BEGIN DATE'];
  fields.endDate = ['End_Date', 'END_DATE', 'End Date', 'END DATE', 'Class End Date', 'CLASS END DATE', 'Stop Date', 'STOP DATE'];

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

  function normalizeCampus(row) {
    const raw = canon(val(row, fields.campus));
    const aliases = {
      VISALIA: 'VIS',
      VIS: 'VIS',
      TULARE: 'TUL',
      TUL: 'TUL',
      HANFORD: 'HAN',
      HAN: 'HAN',
      ONLINE: 'ONLINE',
      ONL: 'ONLINE',
      DISTANCE: 'ONLINE',
      'DISTANCE EDUCATION': 'ONLINE'
    };
    return aliases[raw] || raw;
  }

  function courseNumber(row) {
    const direct = val(row, fields.course);
    if (direct) return canon(direct).replace(/^([A-Z]+)\s+/, '');
    const combined = val(row, ['Subject_Course', 'Subject Course', 'Course ID', 'SUBJECT/COURSE']);
    return canon((combined.match(/[A-Z]+\s*([A-Z]?\d{1,4}[A-Z]?)/) || [])[1] || combined);
  }

  function normalizedSubjectCourse(row) {
    const raw = row?.raw || row || {};
    const subjectCourse = val(raw, ['Subject_Course', 'Subject Course', 'Course ID', 'SUBJECT/COURSE']);
    const directCourse = val(raw, fields.course);
    const subject = canon(row?.subject || val(raw, fields.subject) || (subjectCourse.match(/^([A-Z]+)/i) || [])[1] || (directCourse.match(/^([A-Z]+)/i) || [])[1]);
    const course = canon(row?.course || courseNumber(raw));
    return [subject, course].filter(Boolean).join(' ');
  }

  function isTutoringOpenLabSection(row) {
    return tutoringOpenLabCourseSet.has(normalizedSubjectCourse(row));
  }

  function normalize(row) {
    const isWorkExperienceSource = canon(row.__sourceType) === 'WORK_EXPERIENCE';
    const canonical = sectionModel?.normalizeSection?.(row, { term: row.__sourceTerm || currentTerm() });
    const subjectCourse = val(row, ['Subject_Course', 'Subject Course', 'Course ID', 'SUBJECT/COURSE']);
    const subject = canonical?.subject || canon(val(row, fields.subject) || (subjectCourse.match(/^([A-Z]+)/i) || [])[1]);
    const course = canonical?.course || courseNumber(row);
    const building = canonical?.building || canon(val(row, fields.building));
    const roomOnly = canonical?.roomOnly || canon(val(row, fields.room));
    const campus = canonical?.campus || normalizeCampus(row);
    const modality = canonical?.modality || normalizeModality(val(row, fields.modality), row);
    const days = canonical?.days || normalizeDays(val(row, fields.days), row);
    const times = canonical ? { start: canonical.start, end: canonical.end } : normalizeTimes(row);
    const cap = canonical?.cap ?? num(val(row, fields.cap));
    const actual = canonical?.actual ?? num(val(row, fields.actual));
    const censusValue = val(row, fields.census);
    const census = censusValue === '' ? null : num(censusValue);
    const firstDayValue = val(row, fields.firstDay);
    const census1Value = val(row, fields.census1);
    const census2Value = val(row, fields.census2);
    const census2Raw = census2Value === '' ? null : num(census2Value);
    const invalidNegativeCensus2 = census2Raw != null && census2Raw < 0;
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
    const hasFtesEstimationInputs = units > 0 || weeklyHours > 0 || totalContactHours > 0;
    const estimatedFtesValue = estimatedFtes(enrollmentForFtes, { units, weeklyHours, dailyHours, totalContactHours, accountingMethod, allowOmitted: isWorkExperienceSource });
    const ftesUnavailable = isWorkExperienceSource && ftesValue === '' && !hasFtesEstimationInputs;
    const normalized = {
      raw: row,
      term: canon(canonical?.term || val(row, fields.term) || row.__sourceTerm || currentTerm()),
      crn: canon(canonical?.crn || val(row, fields.crn)),
      subject,
      course,
      title: canon(val(row, fields.title)),
      division: canon(val(row, fields.division)),
      department: canon(val(row, fields.department)),
      section: canon(val(row, fields.section)),
      crossList: canon(val(row, fields.crossList)),
      campus,
      modality: isWorkExperienceSource ? 'WORK EXPERIENCE' : modality,
      instructor: canon(val(row, fields.instructor)),
      days: isWorkExperienceSource ? [] : days,
      dayPattern: isWorkExperienceSource ? 'WORK EXPERIENCE' : dayPattern(days),
      start: isWorkExperienceSource ? '' : times.start,
      end: isWorkExperienceSource ? '' : times.end,
      startDate: val(row, fields.startDate),
      endDate: val(row, fields.endDate),
      timeBlock: isWorkExperienceSource ? 'WORK EXPERIENCE' : (isOnlinePlaceholderTime({ modality, start: times.start, end: times.end }) ? 'ONLINE/TBA' : timeBlock(times.start, modality)),
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
      accountingReportable: isWorkExperienceSource ? true : accountingMethodInfo(accountingMethod).reportable,
      sourceType: isWorkExperienceSource ? 'WORK EXPERIENCE' : 'SECTION SEATING',
      isWorkExperience: isWorkExperienceSource,
      ftes: ftesValue === '' ? estimatedFtesValue : num(ftesValue),
      hasFtesData: ftesValue !== '' || hasFtesEstimationInputs,
      hasDirectFtesData: ftesValue !== '',
      ftesUnavailable,
      ftesWarning: ftesUnavailable ? 'FTES unavailable: direct FTES, contact hours, and units are missing.' : '',
      actual,
      census,
      firstDay: firstDayValue === '' ? null : num(firstDayValue),
      census1: census1Value === '' ? census : num(census1Value),
      census2: invalidNegativeCensus2 ? null : census2Raw,
      invalidNegativeCensus2,
      finalEnrollment: finalEnrollmentValue === '' ? null : num(finalEnrollmentValue),
      waitlist: num(waitlistValue),
      hasWaitlistData: waitlistValue !== '',
      closedPriorCensus: isTruthy(val(row, fields.closed)),
      fillRate: cap > 0 ? enrollmentForPlanning / cap : strictNum(val(row, fields.fill)) / 100,
      status: canon(val(row, fields.status)),
      isTutoringOpenLab: tutoringOpenLabCourseSet.has([subject, course].filter(Boolean).join(' '))
    };
    normalized.canonicalSection = canonical;
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
    if (!info.reportable && !details.allowOmitted) return 0;
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
      accountingMethod: row.accountingMethod,
      allowOmitted: row.isWorkExperience
    });
    row.hasFtesData = row.hasFtesData || row.weeklyHours > 0 || row.totalContactHours > 0 || row.units > 0;
    row.ftesUnavailable = Boolean(row.isWorkExperience && !row.hasDirectFtesData && !row.hasFtesData);
    row.ftesWarning = row.ftesUnavailable ? 'FTES unavailable: direct FTES, contact hours, and units are missing.' : row.ftesWarning || '';
    return row;
  }

  function normalizeModality(text, row) {
    if (window.COSModalityNormalizer?.normalize) return window.COSModalityNormalizer.normalize(text, row?.raw || row);
    const raw = canon(text);
    const code = canon(val(row, ['INSTRUCTIONAL_METHOD_CODE', 'Instructional Method Code', 'Method Code']) || text);
    if (code === 'DE' || /DUAL\s*ENROLL/.test(raw)) return 'OMIT';
    if (modalityGroups.omitted.has(code)) return 'OMIT';
    if (modalityGroups.online.has(code)) return 'ONLINE';
    if (modalityGroups.inPerson.has(code)) return 'IN PERSON';
    if (modalityGroups.hybrid.has(code)) return 'HYBRID';
    if (/ONLINE|WEB|ASYNC/.test(raw)) return 'ONLINE';
    if (/HYBRID|PARTIAL/.test(raw)) return 'HYBRID';
    if (/IN[ -]?PERSON|FACE[ -]?TO[ -]?FACE|ON[ -]?CAMPUS/.test(raw)) return 'IN PERSON';
    return 'UNKNOWN';
  }

  function isOmittedInstructionalMethod(row) {
    if (row?.isWorkExperience) return false;
    const rawMethod = canon(val(row.raw || {}, fields.modality));
    return row.modality === 'OMIT' ||
      row.modality === 'UNKNOWN' ||
      row.accountingReportable === false ||
      modalityGroups.omitted.has(rawMethod) ||
      /DUAL\s*ENROLL/.test(rawMethod);
  }

  function isDualEnrollmentRow(row) {
    const rawMethod = canon(val(row?.raw || {}, fields.modality));
    return rawMethod === 'DE' || /DUAL\s*ENROLL/.test(rawMethod);
  }

  function isStudentPresenceOmitted(row) {
    if (isDualEnrollmentRow(row)) return false;
    return isOmittedInstructionalMethod(row);
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

  function isOnlinePlaceholderTime(row) {
    const modality = canon(row?.modality || row?.Modality || '');
    const start = canon(row?.start || row?.Start_Time || row?.Start || '');
    const end = canon(row?.end || row?.End_Time || row?.End || '');
    const block = canon(row?.timeBlock || row?.TimeBlock || row?.['Time Block'] || '');
    const isOnline = modality === 'ONLINE' || /\b(ONLINE|ONL|OL|ONN|ONS|O1|WEB|REMOTE|VIRTUAL|TBA)\b/.test(modality);
    if (!isOnline) return false;
    if (!start || !end || start === 'INVALID' || end === 'INVALID') return true;
    if (/^0?0:00(?:\s*-\s*0?0:(?:00|59))?$/.test(block)) return true;
    if (start >= '00:00' && start <= '00:59') return true;
    return start === '00:00' && (end === '00:00' || end === '00:59');
  }

  function rowInstructionModality(row) {
    const direct = row?.modality || row?.Modality || row?.instructionalMethod || row?.INSTRUCTIONAL_METHOD || row?.INSM_CODE_SSBSECT || row?.raw?.INSTRUCTIONAL_METHOD || row?.raw?.INSM_CODE_SSBSECT || '';
    return canon(normalizeModality(direct, row));
  }

  function isPhysicalInstructionModality(row) {
    const modality = rowInstructionModality(row);
    return modality === 'IN PERSON' || modality === 'HYBRID';
  }

  function isOnlineInstructionModality(row) {
    return rowInstructionModality(row) === 'ONLINE';
  }

  function hasUsablePhysicalInterval(row) {
    const start = minutesFromTime(row?.start || row?.startTime);
    const end = minutesFromTime(row?.end || row?.endTime);
    if (!Array.isArray(row?.days) || !row.days.length) return false;
    if (start == null || end == null || end <= start) return false;
    if (canon(row?.timeBlock) === 'ONLINE/TBA') return false;
    if (start === 0 && end <= 59) return false;
    if (isOnlinePlaceholderTime(row)) return false;
    return true;
  }

  function physicalIntervalRows(rows, options = {}) {
    const includeOnline = options.includeOnline === true;
    return (rows || []).filter(row => {
      if (!hasUsablePhysicalInterval(row)) return false;
      if (isPhysicalInstructionModality(row)) return true;
      return includeOnline && isOnlineInstructionModality(row);
    });
  }

  const REPORTABLE_MODALITY_LABELS = ['In-Person', 'Hybrid', 'Online'];
  const PHYSICAL_MODALITY_LABELS = ['In-Person', 'Hybrid'];

  function displayModalityLabel(value, row = null) {
    const raw = String(value || '').trim();
    if (REPORTABLE_MODALITY_LABELS.includes(raw) || raw === 'Unknown') return raw;
    const category = normalizeModality(raw, row || { raw: { INSTRUCTIONAL_METHOD_CODE: raw } });
    if (window.COSModalityNormalizer?.displayLabel) return window.COSModalityNormalizer.displayLabel(category);
    if (category === 'IN PERSON') return 'In-Person';
    if (category === 'HYBRID') return 'Hybrid';
    if (category === 'ONLINE') return 'Online';
    return 'Unknown';
  }

  function modalityDiagnosticsEnabled() {
    return document.getElementById('modalityDiagnosticsMode')?.checked === true
      || document.getElementById('emDiagnosticsMode')?.checked === true;
  }

  function modalityOptionLabels() {
    return modalityDiagnosticsEnabled() ? [...REPORTABLE_MODALITY_LABELS, 'Unknown'] : REPORTABLE_MODALITY_LABELS;
  }

  function selectedOptionValues(select) {
    if (!select) return [];
    if (select.multiple) return Array.from(select.selectedOptions || []).map(option => option.value).filter(Boolean);
    return select.value ? [select.value] : [];
  }

  function setModalitySelectValues(id, labels = PHYSICAL_MODALITY_LABELS) {
    const select = document.getElementById(id);
    if (!select) return;
    const allowed = new Set(modalityOptionLabels());
    const wanted = new Set((labels || []).filter(label => allowed.has(label)));
    Array.from(select.options || []).forEach(option => {
      option.selected = wanted.has(option.value);
    });
  }

  function setModalitySelectOptions(id, defaultLabels = PHYSICAL_MODALITY_LABELS) {
    const select = document.getElementById(id);
    if (!select) return;
    const previous = selectedOptionValues(select);
    const options = modalityOptionLabels();
    select.multiple = true;
    select.size = Math.max(3, Math.min(4, options.length));
    select.replaceChildren();
    options.forEach(label => select.appendChild(new Option(label, label)));
    const defaults = previous.filter(label => options.includes(label));
    setModalitySelectValues(id, defaults.length ? defaults : defaultLabels);
  }

  function initializeDevelopmentModalityFilters() {
    ['fhModality', 'ptModality', 'sdModality', 'busyTimeModality', 'studentChoiceModality', 'recommendationModality']
      .forEach(id => setModalitySelectOptions(id, PHYSICAL_MODALITY_LABELS));
    setModalitySelectOptions('fmModality', REPORTABLE_MODALITY_LABELS);
  }

  function selectedModalityLabels(id, defaultLabels = PHYSICAL_MODALITY_LABELS) {
    const select = document.getElementById(id);
    const options = modalityOptionLabels();
    const selected = selectedOptionValues(select).filter(label => options.includes(label));
    return new Set(selected.length ? selected : defaultLabels);
  }

  function modalityMatchesLabelList(row, labels = PHYSICAL_MODALITY_LABELS) {
    const selected = new Set(labels || []);
    const category = rowInstructionModality(row);
    const label = displayModalityLabel(category, row);
    if (category === 'UNKNOWN') return selected.has('Unknown');
    return selected.has(label);
  }

  function facultyModalityMatchesLabelList(row, labels = PHYSICAL_MODALITY_LABELS) {
    const selected = new Set(labels || []);
    const label = facultyInstructionModality(row);
    return selected.has(label);
  }

  function rowMatchesSelectedModality(row, id, defaultLabels = PHYSICAL_MODALITY_LABELS) {
    return modalityMatchesLabelList(row, [...selectedModalityLabels(id, defaultLabels)]);
  }

  function facultyMatchesSelectedModality(row, id, defaultLabels = PHYSICAL_MODALITY_LABELS) {
    return facultyModalityMatchesLabelList(row, [...selectedModalityLabels(id, defaultLabels)]);
  }

  function includeOnlineFromSelect(id) {
    return selectedModalityLabels(id, PHYSICAL_MODALITY_LABELS).has('Online');
  }

  function sectionKey(section) {
    return section.crn ? `${section.term}|${section.crn}` : [section.term, section.subject, section.course, section.section].join('|');
  }

  function snapshotKey(record) {
    return [canon(record?.term), canon(record?.crn), canon(record?.snapshotType)].join('|');
  }

  function normalizeSnapshotType(value) {
    const raw = canon(value);
    if (/FIRST/.test(raw)) return 'FIRST DAY';
    if (/CENSUS\s*1|CENSUS_?1/.test(raw)) return 'CENSUS 1';
    if (/CENSUS\s*2|CENSUS_?2/.test(raw)) return 'CENSUS 2';
    if (/FINAL|END/.test(raw)) return 'FINAL';
    return raw || 'CUSTOM';
  }

  function snapshotSourceValue(row, type) {
    const normalizedType = normalizeSnapshotType(type);
    const raw = row || {};
    const actualText = val(raw, fields.actual);
    const censusText = val(raw, fields.census);
    const census2Text = val(raw, fields.census2);
    if (normalizedType === 'CENSUS 1') {
      if (censusText !== '') return { enrollment: num(censusText), sourceFieldUsed: 'CENSUS_ENROLL' };
      if (actualText !== '') return { enrollment: num(actualText), sourceFieldUsed: 'ACTUAL_ENROLL fallback' };
    }
    if (normalizedType === 'CENSUS 2') {
      if (census2Text !== '') return { enrollment: num(census2Text), sourceFieldUsed: 'CENSUS_ENROLL2' };
      if (censusText !== '') return { enrollment: num(censusText), sourceFieldUsed: 'CENSUS_ENROLL fallback' };
      if (actualText !== '') return { enrollment: num(actualText), sourceFieldUsed: 'ACTUAL_ENROLL fallback' };
    }
    if (normalizedType === 'FIRST DAY' || normalizedType === 'FINAL' || normalizedType === 'CUSTOM') {
      if (actualText !== '') return { enrollment: num(actualText), sourceFieldUsed: 'ACTUAL_ENROLL' };
    }
    return { enrollment: 0, sourceFieldUsed: 'Unavailable' };
  }

  function buildSnapshotRecords(rows, options = {}) {
    const term = canon(options.term);
    const snapshotType = normalizeSnapshotType(options.snapshotType);
    const snapshotDate = String(options.snapshotDate || '').trim();
    const uploadedAt = options.uploadedAt || new Date().toISOString();
    const batchId = options.batchId || `${term}|${snapshotType}|${snapshotDate}|${uploadedAt}`;
    if (!term || !snapshotType || !snapshotDate) return [];
    return (rows || []).map((rawRow) => {
      const row = normalize({ ...rawRow, __sourceTerm: term });
      const source = snapshotSourceValue(rawRow, snapshotType);
      if (!row.crn || source.sourceFieldUsed === 'Unavailable') return null;
      return {
        term,
        crn: row.crn,
        snapshotType,
        snapshotDate,
        enrollment: source.enrollment,
        sourceFieldUsed: source.sourceFieldUsed,
        subject: row.subject,
        course: row.course,
        section: row.section,
        courseTitle: row.title,
        division: row.division,
        department: row.department,
        campus: row.campus,
        building: row.building,
        room: row.roomOnly || row.room,
        startDate: val(rawRow, fields.startDate),
        endDate: val(rawRow, fields.endDate),
        capacity: row.cap,
        waitlist: row.waitlist,
        uploadedAt,
        batchId,
        action: 'Pending'
      };
    }).filter(Boolean);
  }

  function upsertSnapshotRecords(existing = [], incoming = []) {
    const map = new Map();
    (existing || []).forEach(record => {
      const key = snapshotKey(record);
      if (key !== '||') map.set(key, { ...record, action: record.action || 'Existing' });
    });
    let appended = 0;
    let updated = 0;
    (incoming || []).forEach(record => {
      const key = snapshotKey(record);
      if (map.has(key)) {
        updated += 1;
        map.set(key, { ...map.get(key), ...record, action: 'Updated' });
      } else {
        appended += 1;
        map.set(key, { ...record, action: 'Appended' });
      }
    });
    return {
      appended,
      updated,
      records: [...map.values()].sort((a, b) =>
        canon(a.term).localeCompare(canon(b.term), undefined, { numeric: true }) ||
        canon(a.snapshotType).localeCompare(canon(b.snapshotType)) ||
        canon(a.crn).localeCompare(canon(b.crn), undefined, { numeric: true })
      )
    };
  }

  function mergeSnapshotsIntoRows(rows, snapshots = []) {
    const byKeyType = new Map();
    (snapshots || []).forEach(record => {
      const key = snapshotKey(record);
      if (key !== '||') byKeyType.set(key, record);
    });
    return (rows || []).map(row => {
      const base = { ...row };
      [
        ['FIRST DAY', 'firstDay', 'firstDaySource'],
        ['CENSUS 1', 'census1', 'census1Source'],
        ['CENSUS 2', 'census2', 'census2Source'],
        ['FINAL', 'finalEnrollment', 'finalEnrollmentSource']
      ].forEach(([type, valueKey, sourceKey]) => {
        const record = byKeyType.get(snapshotKey({ term: base.term, crn: base.crn, snapshotType: type }));
        if (record && Number.isFinite(Number(record.enrollment))) {
          base[valueKey] = Number(record.enrollment);
          base[sourceKey] = `Stored ${type} snapshot ${record.snapshotDate}`;
        } else if (base[valueKey] != null && base[valueKey] !== '') {
          base[sourceKey] = 'Uploaded section seating field';
        }
      });
      return base;
    });
  }

  function snapshotCoverage(rows = [], snapshots = [], term = '') {
    const termKey = canon(term);
    const focusRows = dedupeEnrollmentRows(rows).filter(row => !termKey || canon(row.term) === termKey);
    const focusCrns = new Set(focusRows.map(row => row.crn).filter(Boolean));
    const firstDay = (snapshots || []).filter(record => normalizeSnapshotType(record.snapshotType) === 'FIRST DAY' && (!term || canon(record.term) === canon(term)));
    const firstDayCrns = new Set(firstDay.map(record => canon(record.crn)).filter(Boolean));
    const covered = [...focusCrns].filter(crn => firstDayCrns.has(crn)).length;
    const dates = (snapshots || []).map(record => record.snapshotDate).filter(Boolean).sort();
    const batches = new Set((snapshots || []).map(record => record.batchId || [record.term, record.snapshotType, record.snapshotDate].join('|')).filter(Boolean));
    return {
      sectionsInFocusTerm: focusCrns.size,
      sectionsWithFirstDaySnapshot: covered,
      firstDayCoveragePct: focusCrns.size ? covered / focusCrns.size : 0,
      sectionsMissingFirstDaySnapshot: Math.max(0, focusCrns.size - covered),
      snapshotBatchesUploaded: batches.size,
      latestSnapshotDate: dates[dates.length - 1] || '',
      snapshotRecordsStored: snapshots.length
    };
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

  function visibleScheduleTerms() {
    return Array.from(document.querySelectorAll('#term-tabs .tab'))
      .map(tab => tab.textContent.trim())
      .filter(Boolean);
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

  function reportOptionsHtml() {
    return REPORT_ORDER
      .map(report => `<option value="${report}">${escapeAttr(lockedReportLabel(report))}</option>`)
      .join('');
  }

  function lockedReportLabel(report) {
    return canAccess(report) ? REPORT_LABEL[report] || report : 'Locked report ••••••••';
  }

  function reportGroupsHtml() {
    return REPORT_GROUP_ORDER.map(role => {
      const reports = REPORT_ORDER.filter(report => (REPORT_ACCESS[report] || 'general') === role);
      const buttons = reports.length
        ? reports.map(report => `
            <button type="button" class="em-report-button" data-report-target="${report}" data-required-role="${role}">
              <span>${escapeAttr(lockedReportLabel(report))}</span>
              <small>${canAccess(report) ? escapeAttr(ROLE_LABEL[role]) : 'Locked - unlock to view name'}</small>
            </button>
          `).join('')
        : '<p class="em-report-empty">No reports assigned.</p>';
      return `
        <section class="em-report-group" data-report-role="${role}">
          <h3>${escapeAttr(ROLE_LABEL[role])}</h3>
          <div class="em-report-button-list">${buttons}</div>
        </section>
      `;
    }).join('');
  }

  function buildUi() {
    if (document.getElementById('analyticsReports')) return;
    const anchor = document.getElementById('admin-tools') || document.body;
    const position = anchor === document.body ? 'beforeend' : 'beforebegin';
    const reportOptions = reportOptionsHtml();
    const reportGroups = reportGroupsHtml();
    anchor.insertAdjacentHTML(position, `
      <section id="analyticsReports" class="analytics-reports" style="display:none">
        <div id="emAccessPanel" class="em-access-panel">
          <div class="em-access-status">
            <span>Access Level</span>
            <strong id="currentAccessLevel">General</strong>
          </div>
          <button id="unlockEnrollmentManagement" type="button" class="em-unlock">Unlock Reports</button>
          <button id="lockEnrollmentReports" type="button" class="em-unlock">Lock Reports</button>
          <span class="em-access-note">Reports unlock progressively by role for this browser session.</span>
          <form id="emPasswordPanel" class="em-password-panel" hidden>
            <label><span id="emPasswordLabelText">Report Password</span>
              <span class="password-input-wrap">
                <input id="emPasswordInput" type="password" autocomplete="current-password">
                <button id="emPasswordToggle" type="button" class="password-eye" aria-label="Show password">Show</button>
              </span>
            </label>
            <p id="emRequiredAccessHint" class="analytics-note">Enter any configured role password. Higher roles unlock lower tiers.</p>
            <div class="em-password-actions">
              <button type="submit">Unlock</button>
              <button id="emPasswordCancel" type="button">Cancel</button>
            </div>
          </form>
        </div>
        <div id="emReportControls" class="em-report-controls" hidden>
          <label class="sr-only" for="emReportSelect">Selected report</label>
          <select id="emReportSelect" hidden>${reportOptions}</select>
          <div class="em-report-groups" aria-label="Reports grouped by access level">${reportGroups}</div>
          <label class="em-methodology-export"><input id="includeMethodologyExport" type="checkbox"> Include Methodology in exports</label>
          <span class="em-workbench-note">Dashboard and factual reports support dean/division review. Scenario modeling and schedule simulation are future Enrollment Management Workbench tools.</span>
        </div>
        <div id="lockedReportPanel" class="analytics-locked-panel" hidden></div>
        <div id="workExperienceUploadPanel" class="analytics-upload-panel" hidden>
          <h3>Work Experience Enrollment Upload</h3>
          <p>Upload Work Experience enrollment rows that are not present in Section Seating. These rows are included in enrollment, attrition, lifecycle, demand, and FTES calculations when the report toggle is on, and excluded from room, time, conflict, and physical presence tools.</p>
          <div class="analytics-toolbar">
            <label>Work Experience CSV(s) <input id="workExperienceCsv" type="file" accept=".csv" multiple></label>
            <span id="workExperienceUploadStatus" class="analytics-note">No Work Experience rows loaded. Work Experience uploads are session only until archive support is added.</span>
          </div>
        </div>
        <div id="dashboardReport" class="analytics-view">
          <div class="analytics-report-intro">
            <h2>Enrollment Analytics Dashboard</h2>
            <p>A compact decision-support summary for enrollment health, registration pace, growth pressure, reduction opportunities, physical student presence, schedule structure, and course rotation health. It summarizes factual report data; scenario modeling and simulation are future Enrollment Management Workbench tools.</p>
            <div class="analytics-methodology">
              <div>
                <h3>How to Use This Dashboard</h3>
                <ul>
                  <li>Select one or more archived dashboard terms, or upload dashboard CSVs, before refreshing. If no dashboard source is selected, the dashboard falls back to the active room availability grid term.</li>
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
                  <li>Access tiers: General supports file upload and maintenance passwords only; Dean / Division Chair supports division-level analytics and planning; Enrollment Management supports institution-wide planning and scheduling; Development is for experimental and in-progress reports; Administrator is reserved for system configuration, archive inspection, snapshot management, Work Experience uploads, and application management.</li>
                </ul>
              </div>
            </div>
          </div>
          <div class="analytics-toolbar dashboard-toolbar">
            <label>Dashboard CSV(s) <input id="dashboardCsv" type="file" accept=".csv" multiple></label>
            <button id="archiveDashboardUploads" type="button">Archive Uploads</button>
            <label>Archived terms <select id="dashArchiveTerms" multiple data-placeholder="No archived terms"></select></label>
            <label>Loaded decision term <select id="dashFocusTerm"></select></label>
            <label>Decision season
              <select id="dashDecisionSeason">
                <option value="SUMMER">Summer</option>
                <option value="FALL">Fall</option>
                <option value="SPRING">Spring</option>
              </select>
            </label>
            <label>Decision year <input id="dashDecisionYear" type="number" min="2022" max="2035" step="1"></label>
            ${filters('dash', { includeGroup: false, includeCancelled: false, includeDivision: true })}
            <label><input id="dashIncludeWorkExperience" type="checkbox" checked> include Work Experience</label>
            <button id="runDashboard" type="button">Refresh Dashboard</button>
            <button id="exportDashboardSummary" type="button">Export Dashboard Summary CSV</button>
            <button id="exportRotation" type="button">Export Course Rotation CSV</button>
          </div>
          <div class="dashboard-actions">
            <button type="button" data-report-target="${REPORTS.demand}">Demand Forecast</button>
            <button type="button" data-report-target="${REPORTS.attrition}">Enrollment Attrition Trend</button>
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
        <div id="snapshotManagerReport" class="analytics-view">
          <div class="analytics-report-intro">
            <h2>Enrollment Snapshot Manager</h2>
            <p>Stores partial lifecycle enrollment snapshots by term, CRN, snapshot type, and snapshot date. First Day snapshots are uploaded from Section Seating files pulled on the actual section start date.</p>
            <div class="analytics-methodology">
              <div>
                <h3>How to Use This Manager</h3>
                <ul>
                  <li>Select the term, snapshot type, and snapshot date, then upload the Section Seating export for that date.</li>
                  <li>Snapshot uploads may contain only the sections that begin on the selected snapshot date. Missing CRNs will not delete or overwrite previously saved snapshot records.</li>
                  <li>First Day and Final snapshots use ACTUAL_ENROLL. Census 1 uses CENSUS_ENROLL when present. Census 2 uses CENSUS_ENROLL2 when present.</li>
                  <li>If the uploaded file has no term field, the selected term is used. If the file has a conflicting term, the selected term remains authoritative for storage.</li>
                </ul>
              </div>
              <div>
                <h3>Lifecycle Integration</h3>
                <ul>
                  <li>Enrollment Lifecycle Diagnostics merges stored snapshots by Term + CRN.</li>
                  <li>Stored snapshot values are preferred over source-file milestone fields when the snapshot type matches the lifecycle milestone.</li>
                  <li>The unique storage key is Term + CRN + Snapshot Type, so a later upload updates that milestone for the CRN instead of duplicating it.</li>
                </ul>
              </div>
            </div>
          </div>
          <div class="analytics-toolbar">
            <label>Snapshot Season
              <select id="snapSeason">
                <option value="SUMMER">Summer</option>
                <option value="FALL">Fall</option>
                <option value="SPRING">Spring</option>
              </select>
            </label>
            <label>Snapshot Year <input id="snapYear" type="number" min="2022" max="2035" step="1" required></label>
            <label>Snapshot Type
              <select id="snapType">
                <option>First Day</option>
                <option>Census 1</option>
                <option>Census 2</option>
                <option>Final</option>
                <option>Custom</option>
              </select>
            </label>
            <span class="analytics-note snapshot-note">First Day is the primary manual snapshot. Census 1, Census 2, and Final are already present in Banner source exports and generally do not need manual snapshot capture; keep those options for correction or manual override only.</span>
            <label>Snapshot Date <input id="snapDate" type="date" required></label>
            <label>Snapshot CSV <input id="snapshotCsv" type="file" accept=".csv"></label>
            <button id="saveSnapshotBatch" type="button">Archive/Save Snapshot</button>
            <button id="viewStoredSnapshots" type="button">View Stored Snapshots</button>
            <button id="exportStoredSnapshots" type="button">Export Stored Snapshots</button>
            <button id="clearSnapshotBatch" type="button">Clear Selected Snapshot Batch</button>
          </div>
          <div id="snapshotWarnings" class="analytics-warning-list"></div>
          <div id="snapshotMetrics" class="analytics-metrics"></div>
          <div id="snapshotTable" class="analytics-table"></div>
          <div id="snapshotLegend" class="analytics-legend"></div>
        </div>
        <div id="conflictCheckReport" class="analytics-view">
          <div class="analytics-report-intro">
            <h2>Conflict Check Report</h2>
            <p>Identifies overlapping fixed class meetings by room, instructor, exact room/time, exact instructor/time, or same course/day/time pattern.</p>
            <div class="analytics-methodology">
              <div>
                <h3>How to Use This Report</h3>
                <ul>
                  <li>Upload or select archived Section Seating files, choose the term, then select one or more conflict modes.</li>
                  <li>Use filters to narrow the review by division, discipline, course, campus, room, modality, instructor, day, or start hour.</li>
                  <li>Online/TBA rows are excluded unless they contain fixed meeting days and times.</li>
                  <li>Cross-listed rows are omitted by default when either side of a conflict pair has a CROSS_LIST value. Uncheck the omit option to inspect them.</li>
                </ul>
              </div>
              <div>
                <h3>Methodology</h3>
                <ul>
                  <li>Only fixed meeting days and valid start/end times are compared.</li>
                  <li>Duplicate meeting rows for the same Term + CRN + day + start + end are counted once.</li>
                  <li>Conflicts are based on partial time overlap, not only identical start/end times. Exact time modes require same day, same start, and same end.</li>
                  <li>Same room and same instructor matches are combined into one row by default to reduce duplicate review items.</li>
                </ul>
              </div>
            </div>
          </div>
          <div class="analytics-toolbar">
            <label>Conflict CSV(s) <input id="conflictCsv" type="file" accept=".csv" multiple></label>
            <button id="archiveConflictUploads" type="button">Archive Uploads</button>
            <label>Archived terms <select id="conflictArchiveTerms" multiple data-placeholder="No archived terms"></select></label>
            <label>Term <select id="conflictTerm"></select></label>
            <label>Conflict modes
              <select id="conflictModes" multiple data-placeholder="Select conflict modes">
                <option value="roomOverlap" selected>Same room overlap</option>
                <option value="instructorOverlap" selected>Same instructor overlap</option>
                <option value="roomExact">Same room + same time</option>
                <option value="instructorExact">Same instructor + same time</option>
                <option value="coursePattern">Same course/day/time pattern</option>
              </select>
            </label>
            <label><input id="conflictOmitCrossListed" type="checkbox" checked> Omit Cross-Listed Sections</label>
            <label><input id="conflictSeparateTypes" type="checkbox"> Show separate conflict types</label>
            ${filters('conflict', { includeGroup: false, includeCancelled: false, includeDivision: true, includeRoom: true })}
            <button id="runConflictCheck" type="button">Run</button>
            <button id="clearConflictCheck" type="button">Clear</button>
            <button id="exportConflictCheck" type="button">Export CSV</button>
            <button id="inspectConflictArchive" type="button">Inspect Parsed Schedule</button>
            <button id="exportConflictArchiveInspection" type="button">Export Parsed Schedule</button>
          </div>
          <div id="conflictMetrics" class="analytics-metrics"></div>
          <div id="conflictTable" class="analytics-table"></div>
          <div id="conflictArchiveInspection" class="analytics-table"></div>
          <div id="conflictLegend" class="analytics-legend"></div>
        </div>
        <div id="archiveInspectionReport" class="analytics-view">
          <div class="analytics-report-intro">
            <h2>Archived Schedule Inspector</h2>
            <p>Inspect one archived Section Seating upload exactly as the app parses it. Use this before running analytics when a term appears missing, duplicated, or misclassified.</p>
            <div class="analytics-methodology">
              <div>
                <h3>How to Use This Tool</h3>
                <ul>
                  <li>Select one archived term, then click Inspect Archived Schedule.</li>
                  <li>Review parsed row count, distinct CRNs, detected term values, campus/modality/day/time distributions, and sample rows.</li>
                  <li>Export the parsed inspection CSV when you need to verify what the backend archive returned.</li>
                </ul>
              </div>
              <div>
                <h3>Methodology</h3>
                <ul>
                  <li>The inspection reads only the selected archived term from the analytics archive endpoint.</li>
                  <li>Rows are normalized with the same parser used by the analytics reports.</li>
                  <li>Distinct CRNs count unique CRN values after parsing; rows without CRNs remain visible in samples but are not counted as distinct CRNs.</li>
                </ul>
              </div>
            </div>
          </div>
          <div class="analytics-toolbar">
            <label>Archived term <select id="archiveInspectionTerm"></select></label>
            <label>Optional CSV <input id="archiveInspectionCsv" type="file" accept=".csv"></label>
            <button id="inspectArchivedSchedule" type="button">Inspect Archived Schedule</button>
            <button id="exportArchiveInspection" type="button">Export Parsed Archive CSV</button>
          </div>
          <div id="archiveInspectionMetrics" class="analytics-metrics"></div>
          <div id="archiveInspectionSummary" class="dashboard-grid"></div>
          <div id="archiveInspectionSamples" class="analytics-table"></div>
        </div>
        <div id="roomFitReport" class="analytics-view">
          <div class="analytics-report-intro">
            <h2>Room Fit Analysis</h2>
            <p>Flags section-to-room capacity mismatches so oversized room assignments, room-cap risks, and enrollment-over-cap issues can be reviewed separately from utilization scoring.</p>
            <div class="analytics-methodology">
              <div>
                <h3>How to Use This Report</h3>
                <ul>
                  <li>Upload a Section Seating CSV or select archived terms, then choose the term and filters to review.</li>
                  <li>Click a flag card to filter the table to that flag. Export CSV respects the active filters.</li>
                  <li>Work Experience, online, TBA, and no-room rows are excluded because they do not represent physical room assignments.</li>
                  <li>Tutoring/Open Lab sections are excluded by default because their scheduling and enrollment behavior is not comparable to standard scheduled instruction.</li>
                </ul>
              </div>
              <div>
                <h3>Methodology</h3>
                <ul>
                  <li>Underutilized Room flags when section capacity or enrollment uses less than 70% of room capacity.</li>
                  <li>Over Capacity Risk flags when section capacity exceeds room capacity.</li>
                  <li>Enrollment Exceeds Room Capacity flags when census/current enrollment exceeds room capacity.</li>
                  <li>Fit Ratio = max(section capacity, census/current enrollment) / room capacity.</li>
                </ul>
              </div>
            </div>
          </div>
          <div class="analytics-toolbar">
            <label>Room Fit CSV(s) <input id="roomFitCsv" type="file" accept=".csv" multiple></label>
            <label>Archived terms <select id="roomFitArchiveTerms" multiple data-placeholder="No archived terms"></select></label>
            <label>Term <select id="roomFitTerm"></select></label>
            <label>Campus <select id="roomFitCampus"></select></label>
            <label>Building <select id="roomFitBuilding"></select></label>
            <label>Room <select id="roomFitRoom"></select></label>
            <label>Division <select id="roomFitDivision"></select></label>
            <label>Discipline <select id="roomFitSubject"></select></label>
            <label>Course <select id="roomFitCourse"></select></label>
            <label>Flag <select id="roomFitFlag"><option value="">All</option><option>Underutilized Room</option><option>Over Capacity Risk</option><option>Enrollment Exceeds Room Capacity</option></select></label>
            <label><input id="roomFitExcludeTutoringOpenLab" type="checkbox" checked> Exclude Tutoring/Open Lab Sections</label>
            <button id="runRoomFit" type="button">Run</button>
            <button id="clearRoomFit" type="button">Clear</button>
            <button id="exportRoomFitReport" type="button">Export CSV</button>
          </div>
          <div id="roomFitReportMetrics" class="analytics-metrics"></div>
          <div id="roomFitReportTable" class="analytics-table"></div>
        </div>
        <div id="studentPresenceReport" class="analytics-view">
          <div class="analytics-report-intro">
            <h2>Student Presence Analytics</h2>
            <p>Estimates physical student presence from loaded scheduled sections and enrollment. By default it includes only in-person and hybrid sections on physical COS/TCC/HAC campus codes, excludes Dual Enrollment, and omits online/TBA/no fixed-time rows.</p>
            <div class="analytics-methodology">
              <div>
                <h3>How to Use This Report</h3>
                <ul>
                  <li>Select a focus term and optional comparison terms, then filter by division, department, discipline, course, campus, building, room, modality, day, or time block.</li>
                  <li>Use grouping to switch between campus, building, room, day, hour, and day/hour combinations.</li>
                  <li>Use this as a physical presence estimate for scheduling and facilities planning, not a full campus traffic count.</li>
                </ul>
              </div>
              <div>
                <h3>Methodology</h3>
                <ul>
                  <li>Students present uses census enrollment when available and current enrollment otherwise, counted once per CRN within each applicable half-hour bucket.</li>
                  <li>Only in-person and hybrid sections with fixed day/time patterns are included by default; use the expansion controls to include other modalities or Dual Enrollment for review.</li>
                  <li>Distinct CRNs and meeting rows are shown separately so cross-listed or multi-meeting data does not inflate active section counts.</li>
                  <li>This report does not count unscheduled student presence, online attendance, tutoring, library use, athletics, events, or services traffic.</li>
                </ul>
              </div>
            </div>
          </div>
          <div class="analytics-toolbar">
            <label>Presence CSV(s) <input id="studentPresenceCsv" type="file" accept=".csv" multiple></label>
            <button id="archiveStudentPresenceUploads" type="button">Archive Uploads</button>
            <label>Archived terms <select id="spArchiveTerms" multiple data-placeholder="No archived terms"></select></label>
            <label>Focus Term <select id="spFocusTerm"></select></label>
            <label>Compare Terms <select id="spCompareTerms" multiple data-placeholder="No comparison terms"></select></label>
            ${filters('sp', { includeGroup: false, includeCancelled: false, includeDivision: true, includeRoom: true, includeCampus: false })}
            <label>Campus Scope
              <select id="spCampusScope">
                <option value="ALL" selected>All COS/HAC/TCC</option>
                <option value="COS">COS only</option>
                <option value="HAC">HAC only</option>
                <option value="TCC">TCC only</option>
              </select>
            </label>
            <label><input id="spIncludeDualEnrollment" type="checkbox"> include Dual Enrollment</label>
            <label><input id="spIncludeOtherModalities" type="checkbox"> include other modalities</label>
            <label>Group by
              <select id="spGroup">
                <option value="all">All campuses</option>
                <option value="campus">Campus</option>
                <option value="building">Building</option>
                <option value="room">Room</option>
                <option value="day">Day</option>
                <option value="hour">Half-hour time block</option>
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
          <div id="studentPresenceCurve" class="analytics-insights"></div>
          <div id="studentPresenceChartFilterNote" class="analysis-filter-note" hidden></div>
          <div id="studentPresenceTable" class="analytics-table"></div>
          <div id="studentPresenceLegend" class="analytics-legend"></div>
        </div>
        <div id="instructorAvailabilityReport" class="analytics-view">
          <div class="analytics-report-intro">
            <h2>Instructor Availability - Planning View</h2>
            <p>This first-layer planning view uses the loaded schedule/class data to identify when instructors are already scheduled. It does not prove contractual or personal availability; it only separates known schedule conflicts from open windows where no loaded teaching assignment is found.</p>
            <p class="analytics-direction"><strong><u>Instructor Availability depends on the term selected for the Room Availability Grid at the top of the page.</u></strong></p>
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
            <label>Discipline <select id="iaSubject"></select></label>
            <label>Instructor <select id="iaInstructor" multiple size="4"></select></label>
            <button id="iaSelectVisible" type="button">Select All Visible Instructors</button>
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
        <div id="facultyHeatmapReport" class="analytics-view">
          <div class="analytics-report-intro">
            <h2>Faculty Schedule Heatmap</h2>
            <p>Uses Faculty Schedule CSV uploads to show when faculty instructional activity is concentrated by half-hour interval. This report is isolated in Development while the faculty parser and model are validated.</p>
            <div class="analytics-methodology">
              <div>
                <h3>How to Use This Report</h3>
                <ul>
                  <li>Upload one or more Faculty Schedule CSV files, then click Load Faculty Schedule.</li>
                  <li>Use the metric toggle to switch the heatmap between sections, unique faculty count, enrollment, seats, and LHE.</li>
                  <li>Use faculty type, meeting type, term, campus, division, department, discipline, course, and modality filters to isolate the schedule population.</li>
                </ul>
              </div>
              <div>
                <h3>Methodology</h3>
                <ul>
                  <li>Rows are parsed by the Faculty Schedule parser and deduplicated by CRN + days + start + end + meeting type + instructor.</li>
                  <li>A meeting contributes to every half-hour interval it overlaps on each scheduled day.</li>
                  <li>Sections counts instructional meeting rows once per day/time bucket. Faculty Count counts distinct faculty in each bucket. Enrollment uses ActualEnroll, Seats uses MaxEnroll, and LHE uses the uploaded LHE value.</li>
                  <li>Faculty Type maps FCNT_CODE values: FT and TE are Full-Time, JP is Part-Time, unknown codes are Unknown, and omitted faculty types are excluded from this report.</li>
                  <li>Meeting Type maps SCHD_CODE_SSRMEET values: 2 is Lecture, 4 is Lab, XX is Activity, and all other codes are Other.</li>
                </ul>
              </div>
            </div>
          </div>
          <div class="analytics-toolbar">
            <label>Faculty Schedule CSV(s) <input id="facultyScheduleCsv" type="file" accept=".csv" multiple></label>
            <button id="loadFacultyScheduleHeatmap" type="button">Load Faculty Schedule</button>
            <span id="facultyScheduleHeatmapStatus" class="analytics-note">No faculty schedule rows loaded.</span>
            <label>Metric
              <select id="fhMetric">
                <option value="sections">Sections</option>
                <option value="facultyCount">Faculty Count</option>
                <option value="enrollment">Enrollment</option>
                <option value="seats">Seats</option>
                <option value="lhe">LHE</option>
              </select>
            </label>
            <label>Faculty Type
              <select id="fhFacultyType">
                <option value="">All</option>
                <option value="FULL_TIME">Full-Time</option>
                <option value="PART_TIME">Part-Time</option>
                <option value="UNKNOWN">Unknown</option>
              </select>
            </label>
            <label>Meeting Type
              <select id="fhMeetingType">
                <option value="">All</option>
                <option value="Lecture">Lecture</option>
                <option value="Lab">Lab</option>
                <option value="Activity">Activity</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <label>Term <select id="fhTerm"></select></label>
            <label>Campus <select id="fhCampus"></select></label>
            <label>Division <select id="fhDivision"></select></label>
            <label>Department <select id="fhDepartment"></select></label>
            <label>Discipline <select id="fhSubject"></select></label>
            <label>Course <select id="fhCourse"></select></label>
            <label>Modality <select id="fhModality" multiple size="3"></select></label>
            <button type="button" data-modality-quick="fhModality" data-modality-values="In-Person|Hybrid">Physical Only</button>
            <button type="button" data-modality-quick="fhModality" data-modality-values="In-Person|Hybrid|Online">All Modalities</button>
            <button id="clearFacultyHeatmap" type="button">Clear</button>
          </div>
          <div id="facultyHeatmapMetrics" class="analytics-metrics"></div>
          <div id="facultyHeatmapContainer" class="analytics-insights"></div>
          <div id="facultyHeatmapTable" class="analytics-table"></div>
          <div id="facultyHeatmapLegend" class="analytics-legend"></div>
        </div>
        <div id="facultyModalityReport" class="analytics-view">
          <div class="analytics-report-intro">
            <h2>Faculty Modality</h2>
            <p>Uses Faculty Schedule CSV uploads to summarize teaching modality by faculty type. This report uses INSM_CODE_SSBSECT as the modality source and is isolated in Development while the faculty analytics model is validated.</p>
            <div class="analytics-methodology">
              <div>
                <h3>How to Use This Report</h3>
                <ul>
                  <li>Upload one or more Faculty Schedule CSV files, then click Load Faculty Modality.</li>
                  <li>Review Full-Time, Part-Time, and Unknown faculty type rows split into In-Person, Hybrid, and Online modality buckets.</li>
                  <li>Use campus, division, department, course, and term filters to narrow the population before exporting.</li>
                </ul>
              </div>
              <div>
                <h3>Methodology</h3>
                <ul>
                  <li>Rows are parsed by the Faculty Schedule parser and deduplicated by CRN + days + start + end + meeting type + instructor.</li>
                  <li>Modality is determined from INSM_CODE_SSBSECT using the shared TIMBER instructional method mapping. Unknown or omitted codes are excluded from standard analytics and should be reviewed through diagnostics.</li>
                  <li>Sections counts deduped instructional meeting rows. Faculty Count counts distinct faculty in each faculty type and modality bucket. Enrollment uses ActualEnroll, Seats uses MaxEnroll, and LHE uses uploaded LHE.</li>
                  <li>AE and X faculty type rows are omitted. JP is Part-Time, FT/TE are Full-Time, and unrecognized FCNT_CODE values are Unknown.</li>
                </ul>
              </div>
            </div>
          </div>
          <div class="analytics-toolbar">
            <label>Faculty Schedule CSV(s) <input id="facultyModalityCsv" type="file" accept=".csv" multiple></label>
            <button id="loadFacultyModality" type="button">Load Faculty Modality</button>
            <span id="facultyModalityStatus" class="analytics-note">No faculty schedule rows loaded.</span>
            <label>Term <select id="fmTerm"></select></label>
            <label>Campus <select id="fmCampus"></select></label>
            <label>Division <select id="fmDivision"></select></label>
            <label>Department <select id="fmDepartment"></select></label>
            <label>Course <select id="fmCourse"></select></label>
            <label>Modality <select id="fmModality" multiple size="3"></select></label>
            <button type="button" data-modality-quick="fmModality" data-modality-values="In-Person|Hybrid">Physical Only</button>
            <button type="button" data-modality-quick="fmModality" data-modality-values="In-Person|Hybrid|Online">All Modalities</button>
            <button id="clearFacultyModality" type="button">Clear</button>
            <button id="exportFacultyModality" type="button">Export CSV</button>
          </div>
          <div id="facultyModalityMetrics" class="analytics-metrics"></div>
          <div id="facultyModalityChart" class="analytics-insights"></div>
          <div id="facultyModalityTable" class="analytics-table"></div>
          <div id="facultyModalityLegend" class="analytics-legend"></div>
        </div>
        <div id="primeTimeAnalysisReport" class="analytics-view">
          <div class="analytics-report-intro">
            <h2>Prime Time Analysis</h2>
            <p>Uses Faculty Schedule CSV uploads to measure how much faculty teaching, enrollment, and LHE occur during the selected prime-time window. The default prime-time window is Monday through Thursday, 9:00 AM-3:00 PM.</p>
            <p class="analytics-note"><strong>Prime Time Analysis defaults to physical instruction because it is intended to evaluate campus time-of-day concentration. Online sections can be included manually.</strong></p>
            <div class="analytics-methodology">
              <div>
                <h3>How to Use This Report</h3>
                <ul>
                  <li>Upload one or more Faculty Schedule CSV files, then click Load Prime Time Analysis.</li>
                  <li>Use the prime-time day and time controls to test a different local definition.</li>
                  <li>Review the gauges and table to compare Full-Time, Part-Time, meeting type, enrollment, and LHE concentration inside prime time.</li>
                </ul>
              </div>
              <div>
                <h3>Methodology</h3>
                <ul>
                  <li>Rows are parsed by the Faculty Schedule parser and deduplicated by CRN + days + start + end + meeting type + instructor.</li>
                  <li>A meeting is counted in prime time when any scheduled day overlaps the selected prime-time days and any part of the meeting overlaps the selected time window.</li>
                  <li>The default modality scope is In-Person and Hybrid only. Use the modality multi-select or All Modalities button to include Online sections manually.</li>
                  <li>Enrollment uses ActualEnroll, seats uses MaxEnroll, and LHE uses uploaded LHE. Omitted faculty type rows are excluded.</li>
                  <li>Percentages are prime-time value divided by total value for the filtered population.</li>
                </ul>
              </div>
            </div>
          </div>
          <div class="analytics-toolbar">
            <label>Faculty Schedule CSV(s) <input id="primeTimeCsv" type="file" accept=".csv" multiple></label>
            <button id="loadPrimeTimeAnalysis" type="button">Load Prime Time Analysis</button>
            <span id="primeTimeStatus" class="analytics-note">No faculty schedule rows loaded.</span>
            <label>Prime start <input id="ptStart" type="time" value="09:00" step="300"></label>
            <label>Prime end <input id="ptEnd" type="time" value="15:00" step="300"></label>
            <label class="prime-time-days">Prime days
              <span>
                <label><input class="ptDay" type="checkbox" value="MO" checked> M</label>
                <label><input class="ptDay" type="checkbox" value="TU" checked> T</label>
                <label><input class="ptDay" type="checkbox" value="WE" checked> W</label>
                <label><input class="ptDay" type="checkbox" value="TH" checked> R</label>
                <label><input class="ptDay" type="checkbox" value="FR"> F</label>
                <label><input class="ptDay" type="checkbox" value="SA"> S</label>
                <label><input class="ptDay" type="checkbox" value="SU"> U</label>
              </span>
            </label>
            <label>Term <select id="ptTerm"></select></label>
            <label>Campus <select id="ptCampus"></select></label>
            <label>Division <select id="ptDivision"></select></label>
            <label>Department <select id="ptDepartment"></select></label>
            <label>Course <select id="ptCourse"></select></label>
            <label>Modality <select id="ptModality" multiple size="3"></select></label>
            <button type="button" data-modality-quick="ptModality" data-modality-values="In-Person|Hybrid">Physical Only</button>
            <button type="button" data-modality-quick="ptModality" data-modality-values="In-Person|Hybrid|Online">All Modalities</button>
            <button id="clearPrimeTimeAnalysis" type="button">Clear</button>
            <button id="exportPrimeTimeAnalysis" type="button">Export CSV</button>
          </div>
          <div id="primeTimeGauges" class="prime-time-gauges"></div>
          <div id="primeTimeMetrics" class="analytics-metrics"></div>
          <div id="primeTimeTable" class="analytics-table"></div>
          <div id="primeTimeLegend" class="analytics-legend"></div>
        </div>
        <div id="supplyDemandReport" class="analytics-view">
          <div class="analytics-report-intro">
            <h2>Supply vs Demand</h2>
            <p>Compares scheduled instructional supply against realized student demand by half-hour interval. This report is for pattern diagnosis: enrollment alone cannot prove student preference because available section supply strongly shapes observed demand.</p>
            <div class="analytics-methodology">
              <div>
                <h3>How to Use This Report</h3>
                <ul>
                  <li>Upload Section Seating CSV files or select archived terms, then click Run.</li>
                  <li>Use the metric toggle to inspect sections, seats, enrollment, student presence, fill rate, waitlist, or empty seats by day/time.</li>
                  <li>Use campus, division, department, course, CAL-GETC, modality, and term filters to narrow the population.</li>
                </ul>
              </div>
              <div>
                <h3>Methodology</h3>
                <ul>
                  <li>Only rows with fixed meeting days and start/end times contribute to the half-hour grid. Online/TBA/no-time rows are not placed into physical time buckets.</li>
                  <li>Each section contributes to every half-hour interval it overlaps on every scheduled day. Duplicate rows for the same CRN/day/start/end are counted once per bucket.</li>
                  <li>Student Presence uses census enrollment when available and current enrollment otherwise. Fill Rate = enrollment / seats offered. Empty Seats = seats offered - enrollment.</li>
                  <li>Interpretation labels compare supply and demand indicators. They are planning prompts, not proof of student preference or automatic scheduling decisions.</li>
                </ul>
              </div>
            </div>
          </div>
          <div class="analytics-toolbar">
            <label>Supply/Demand CSV(s) <input id="supplyDemandCsv" type="file" accept=".csv" multiple></label>
            <button id="archiveSupplyDemandUploads" type="button">Archive Uploads</button>
            <label>Archived terms <select id="sdArchiveTerms" multiple data-placeholder="No archived terms"></select></label>
            <span id="supplyDemandStatus" class="analytics-note">No supply/demand rows loaded.</span>
            <label>View
              <select id="sdView">
                <option value="all">All views</option>
                <option value="heatmap">Heatmap</option>
                <option value="line">Line Graph</option>
                <option value="table">Summary Table</option>
              </select>
            </label>
            <label>Metric
              <select id="sdMetric">
                <option value="sections">Sections</option>
                <option value="seats">Seats Offered</option>
                <option value="enrollment">Enrollment</option>
                <option value="studentPresence">Student Presence</option>
                <option value="fillRate">Fill Rate</option>
                <option value="waitlist">Waitlist</option>
                <option value="emptySeats">Empty Seats</option>
              </select>
            </label>
            <label>Term <select id="sdTerm"></select></label>
            <label>Campus <select id="sdCampus"></select></label>
            <label>Division <select id="sdDivision"></select></label>
            <label>Department <select id="sdDepartment"></select></label>
            <label>Course <select id="sdCourse"></select></label>
            <label>CAL-GETC <select id="sdCalGetc"></select></label>
            <label>Modality <select id="sdModality" multiple size="3"></select></label>
            <button type="button" data-modality-quick="sdModality" data-modality-values="In-Person|Hybrid">Physical Only</button>
            <button type="button" data-modality-quick="sdModality" data-modality-values="In-Person|Hybrid|Online">All Modalities</button>
            <button id="runSupplyDemand" type="button">Run</button>
            <button id="clearSupplyDemand" type="button">Clear</button>
            <button id="exportSupplyDemand" type="button">Export CSV</button>
          </div>
          <div id="supplyDemandMetrics" class="analytics-metrics"></div>
          <div id="supplyDemandHeatmap" class="analytics-insights"></div>
          <div id="supplyDemandLineGraph" class="analytics-insights"></div>
          <div id="supplyDemandTable" class="analytics-table"></div>
          <div id="supplyDemandLegend" class="analytics-legend"></div>
        </div>
        <div id="busyTimeDashboardReport" class="analytics-view">
          <div class="analytics-report-intro">
            <h2>Busy Time Dashboard</h2>
            <p>Summarizes busy-time patterns by combining student presence, course duration, faculty heatmap, supply vs demand, prime time, and room utilization signals. This dashboard summarizes data only and does not make scheduling recommendations.</p>
            <div class="analytics-methodology">
              <div>
                <h3>Inputs</h3>
                <ul>
                  <li>Use Section Seating CSV files or archived terms for student, section, seat, demand, and room utilization signals.</li>
                  <li>Use an optional Faculty Schedule CSV to add full-time and part-time faculty concentration signals.</li>
                  <li>Existing loaded Faculty Heatmap rows are reused when no Faculty CSV is selected here.</li>
                </ul>
              </div>
              <div>
                <h3>Methodology</h3>
                <ul>
                  <li>Half-hour buckets count each CRN/day/start/end once, then add enrollment, seats, and room usage to every interval the class overlaps.</li>
                  <li>Prime time defaults to Monday-Thursday, 9:00 AM-3:00 PM.</li>
                  <li>Observations describe alignment or contrast among supply, demand, faculty concentration, student concentration, and room utilization. They are not scheduling recommendations.</li>
                </ul>
              </div>
            </div>
          </div>
          <div class="analytics-toolbar">
            <label>Schedule CSV(s) <input id="busyTimeCsv" type="file" accept=".csv" multiple></label>
            <button id="archiveBusyTimeUploads" type="button">Archive Uploads</button>
            <label>Archived terms <select id="busyTimeArchiveTerms" multiple data-placeholder="No archived terms"></select></label>
            <label>Faculty CSV <input id="busyTimeFacultyCsv" type="file" accept=".csv" multiple></label>
            <span id="busyTimeStatus" class="analytics-note">No Busy Time rows loaded.</span>
            <label>Term <select id="busyTimeTerm"></select></label>
            <label>Campus <select id="busyTimeCampus"></select></label>
            <label>Division <select id="busyTimeDivision"></select></label>
            <label>Department <select id="busyTimeDepartment"></select></label>
            <label>Course <select id="busyTimeCourse"></select></label>
            <label>Modality <select id="busyTimeModality" multiple size="3"></select></label>
            <button type="button" data-modality-quick="busyTimeModality" data-modality-values="In-Person|Hybrid">Physical Only</button>
            <button type="button" data-modality-quick="busyTimeModality" data-modality-values="In-Person|Hybrid|Online">All Modalities</button>
            <button id="runBusyTimeDashboard" type="button">Run</button>
            <button id="clearBusyTimeDashboard" type="button">Clear</button>
            <button id="exportBusyTimeDashboard" type="button">Export CSV</button>
          </div>
          <div id="busyTimeMetrics" class="analytics-metrics"></div>
          <div id="busyTimeCharts" class="analytics-insights"></div>
          <div id="busyTimeObservations" class="analytics-legend"></div>
          <div id="busyTimeTable" class="analytics-table"></div>
          <div id="busyTimeLegend" class="analytics-legend"></div>
        </div>
        <div id="studentChoiceOpportunityReport" class="analytics-view">
          <div class="analytics-report-intro">
            <h2>Student Choice Opportunity</h2>
            <p>Measures how much schedule choice students have by day and time, not just how many students enrolled.</p>
            <div class="analytics-methodology">
              <div>
                <h3>How to Read This Report</h3>
                <ul>
                  <li>Use the heatmap to find day/time blocks with broad or narrow course choice.</li>
                  <li>Use the line graph to compare choice and demand patterns across days.</li>
                  <li>Use the table to audit course breadth, seats, enrollment, fill, empty seats, and waitlist by half-hour block.</li>
                </ul>
              </div>
              <div>
                <h3>Methodology</h3>
                <ul>
                  <li>This report measures student schedule opportunity. Enrollment alone does not show whether students had meaningful choices.</li>
                  <li>A time block may fill well because students prefer that time, or because very few alternatives exist.</li>
                  <li>This report compares course variety, seat availability, and enrollment pressure across the day.</li>
                </ul>
              </div>
            </div>
          </div>
          <div class="analytics-toolbar">
            <label>Choice CSV(s) <input id="studentChoiceCsv" type="file" accept=".csv" multiple></label>
            <button id="archiveStudentChoiceUploads" type="button">Archive Uploads</button>
            <label>Archived terms <select id="studentChoiceArchiveTerms" multiple data-placeholder="No archived terms"></select></label>
            <label>Faculty CSV <input id="studentChoiceFacultyCsv" type="file" accept=".csv" multiple></label>
            <span id="studentChoiceStatus" class="analytics-note">No student choice rows loaded.</span>
            <label>View
              <select id="studentChoiceView">
                <option value="all">All views</option>
                <option value="heatmap">Heatmap</option>
                <option value="line">Line Graph</option>
                <option value="table">Summary Table</option>
              </select>
            </label>
            <label>Metric
              <select id="studentChoiceMetric">
                <option value="uniqueCourses">Unique courses</option>
                <option value="uniqueCalGetcCourses">Unique CAL-GETC courses</option>
                <option value="seats">Seats offered</option>
                <option value="enrollment">Enrollment present</option>
                <option value="fillRate">Fill rate</option>
                <option value="emptySeats">Empty seats</option>
              </select>
            </label>
            <label>Term/source <select id="studentChoiceTerm"></select></label>
            <label>Campus <select id="studentChoiceCampus"></select></label>
            <label>Division <select id="studentChoiceDivision"></select></label>
            <label>Department <select id="studentChoiceDepartment"></select></label>
            <label>Discipline <select id="studentChoiceDiscipline"></select></label>
            <label>Course <select id="studentChoiceCourse"></select></label>
            <label>CAL-GETC <select id="studentChoiceCalGetc"></select></label>
            <label>Modality <select id="studentChoiceModality" multiple size="3"></select></label>
            <button type="button" data-modality-quick="studentChoiceModality" data-modality-values="In-Person|Hybrid">Physical Only</button>
            <button type="button" data-modality-quick="studentChoiceModality" data-modality-values="In-Person|Hybrid|Online">All Modalities</button>
            <label>Faculty type <select id="studentChoiceFacultyType"></select></label>
            <label class="analytics-check"><input id="studentChoiceExcludeTutoring" type="checkbox" checked> Exclude Tutoring/Open Lab</label>
            <button id="runStudentChoiceOpportunity" type="button">Run</button>
            <button id="clearStudentChoiceOpportunity" type="button">Clear</button>
            <button id="exportStudentChoiceOpportunity" type="button">Export CSV</button>
          </div>
          <div id="studentChoiceMetrics" class="analytics-metrics"></div>
          <div id="studentChoiceHeatmap" class="analytics-insights"></div>
          <div id="studentChoiceLineGraph" class="analytics-insights"></div>
          <div id="studentChoiceTable" class="analytics-table"></div>
          <div id="studentChoiceLegend" class="analytics-legend"></div>
        </div>
        <div id="recommendationEngineReport" class="analytics-view">
          <div class="analytics-report-intro">
            <h2>Scheduling Recommendation Engine</h2>
            <p>Produces advisory-only, evidence-informed scheduling observations from supply, demand, choice, faculty, modality, prime-time, room, fill-rate, waitlist, and consolidation-style indicators. It does not automatically change schedules and does not claim to prove student preference.</p>
            <div class="analytics-methodology">
              <div>
                <h3>Evidence Used</h3>
                <ul>
                  <li>Observed enrollment, fill rate, waitlist, student presence, section supply, seat supply, course choice, modality mix, faculty assignment pattern, room usage, and consolidation-style low-fill indicators.</li>
                  <li>Recommendations distinguish available supply from observed enrollment and student choice opportunity.</li>
                  <li>When evidence is not strong enough, the engine labels the item as Insufficient evidence instead of forcing a recommendation.</li>
                </ul>
              </div>
              <div>
                <h3>Advisory Use Only</h3>
                <ul>
                  <li>Recommendations are evidence-informed, not deterministic.</li>
                  <li>They are prompts for review and should be checked against program, equity, staffing, room, and student-service constraints.</li>
                  <li>No schedules are changed automatically.</li>
                </ul>
              </div>
            </div>
          </div>
          <div class="analytics-toolbar">
            <label>Recommendation CSV(s) <input id="recommendationCsv" type="file" accept=".csv" multiple></label>
            <button id="archiveRecommendationUploads" type="button">Archive Uploads</button>
            <label>Archived terms <select id="recommendationArchiveTerms" multiple data-placeholder="No archived terms"></select></label>
            <label>Faculty CSV <input id="recommendationFacultyCsv" type="file" accept=".csv" multiple></label>
            <span id="recommendationStatus" class="analytics-note">No recommendation rows loaded.</span>
            <label>Category <select id="recommendationCategory"></select></label>
            <label>Confidence <select id="recommendationConfidence"></select></label>
            <label>Term/source <select id="recommendationTerm"></select></label>
            <label>Campus <select id="recommendationCampus"></select></label>
            <label>Division <select id="recommendationDivision"></select></label>
            <label>Department <select id="recommendationDepartment"></select></label>
            <label>Discipline <select id="recommendationDiscipline"></select></label>
            <label>Course <select id="recommendationCourse"></select></label>
            <label>Time block <select id="recommendationTimeBlock"></select></label>
            <label>Modality <select id="recommendationModality" multiple size="3"></select></label>
            <button type="button" data-modality-quick="recommendationModality" data-modality-values="In-Person|Hybrid">Physical Only</button>
            <button type="button" data-modality-quick="recommendationModality" data-modality-values="In-Person|Hybrid|Online">All Modalities</button>
            <label>Faculty type <select id="recommendationFacultyType"></select></label>
            <label class="analytics-check"><input id="recommendationExcludeTutoring" type="checkbox" checked> Exclude Tutoring/Open Lab</label>
            <button id="runRecommendationEngine" type="button">Run</button>
            <button id="clearRecommendationEngine" type="button">Clear</button>
            <button id="exportRecommendationCsv" type="button">Export CSV</button>
            <button id="exportRecommendationPdf" type="button">Export PDF</button>
          </div>
          <div id="recommendationMetrics" class="analytics-metrics"></div>
          <div id="recommendationCards" class="analytics-insights"></div>
          <div id="recommendationPriorityList" class="analytics-legend"></div>
          <div id="recommendationTable" class="analytics-table"></div>
          <div id="recommendationLegend" class="analytics-legend"></div>
        </div>
        <div id="attritionReport" class="analytics-view">
          <div class="analytics-report-intro">
            <h2>Enrollment Attrition Trend</h2>
            <p>Upload historical enrollment snapshot CSV files to review Census 1, Census 2, and End/Final movement over time. This report is a historical trend baseline for planning; current or future planning terms are excluded from the trend rather than treated as the analysis target.</p>
            <div class="analytics-methodology">
              <div>
                <h3>How to Use This Report</h3>
                <ul>
                  <li>This report requires the <strong>Seating (All Columns)</strong> version of the Section Seating report housed in Argos.</li>
                  <li>For archived uploads, name files with the Banner term code, such as <strong>202710.csv</strong>, so the app can assign the correct term automatically.</li>
                  <li>Upload completed historical enrollment CSV files, such as Fall to Fall, Spring to Spring, or Summer to Summer.</li>
                  <li>Use comparison terms from 2022 forward only. Earlier terms should be avoided because COVID-era disruption can distort normal enrollment and attrition patterns.</li>
                  <li>Use the planning term controls only to exclude an active, future, or otherwise non-final term from the historical trend. No current/decision term is required for this report.</li>
                  <li>Dual Enrollment instructional method rows are omitted from this report so the analysis focuses on general enrollment behavior.</li>
                  <li>Tutoring/Open Lab sections are excluded by default because they behave differently from standard scheduled sections and can contain non-comparable Census 2 values. Clear the checkbox only when intentionally auditing those rows.</li>
                  <li>First Day comes from stored First Day snapshots when available. If First Day snapshots are missing, start-based lifecycle calculations show N/A instead of zero.</li>
                </ul>
              </div>
              <div>
                <h3>Methodology</h3>
                <ul>
                  <li>Sections are deduplicated by CRN within term, with subject/course/section used as fallback, so multi-meeting rows are not double counted.</li>
                  <li>Overall Attrition = Census 1 to End/Final attrition. Census 1 and Census 2 are Banner-captured milestone values from CENSUS_ENROLL and CENSUS_ENROLL2. End/Final uses final enrollment or ACTUAL_ENROLL/current enrollment after the end of the term.</li>
                  <li>Negative Census 2 values are not valid enrollment counts and are treated as missing/invalid rather than included as real enrollment.</li>
                  <li>Census Fill Rate = CENSUS_ENROLL / MAX ENROLL. Final Fill Rate = ACTUAL_ENROLL / MAX ENROLL.</li>
                  <li>Total milestone enrollment is shown independently for Census 1, Census 2, and End/Final. Those totals can use different CRN populations when the source data differs by milestone.</li>
                  <li>Lifecycle intervals shown are Start to End, Start to Census 1, Start to Census 2, Census 1 to Census 2, Census 1 to End, Census 2 to End, and Overall Attrition. Each interval uses matched CRNs that have both required milestone values.</li>
                  <li>Attrition is signed: (start enrollment - end enrollment) / start enrollment. Enrollment gains display as negative attrition rather than being clamped to zero.</li>
                  <li>If milestone populations differ, the report shows a data-quality warning but still calculates each attrition interval from its matched CRN population.</li>
                  <li>Historical Attrition uses selected completed terms only. The excluded planning term never contributes to the trend rates.</li>
                  <li>Min sections controls the minimum section count a grouped row must have before it appears in the report.</li>
                </ul>
              </div>
            </div>
          </div>
          <div class="analytics-toolbar">
            <label>Enrollment CSV(s) <input id="enrollmentCsv" type="file" accept=".csv" multiple></label>
            <button id="archiveAttritionUploads" type="button">Archive Uploads</button>
            <label>Archived terms <select id="attrArchiveTerms" multiple data-placeholder="No archived terms"></select></label>
            <label>Planning term to exclude
              <select id="attrDecisionSeason">
                <option value="SUMMER">Summer</option>
                <option value="FALL">Fall</option>
                <option value="SPRING">Spring</option>
              </select>
            </label>
            <label>Exclude year <input id="attrDecisionYear" type="number" min="2022" max="2035" step="1"></label>
            ${filters('attr', { includeGroup: true, includeCancelled: false, includeDivision: true })}
            <label><input id="attrIncludeWorkExperience" type="checkbox" checked> include Work Experience</label>
            <button id="runAttrition" type="button">Run</button>
            <button id="clearAttrition" type="button">Clear</button>
            <button id="exportAttrition" type="button">Export CSV</button>
          </div>
          <div id="attritionMetrics" class="analytics-metrics"></div>
          <div id="attritionDiagnosticRates" class="analytics-table"></div>
          <div id="attritionDataQualityNotes" class="analytics-legend"></div>
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
            <label>Decision season
              <select id="conDecisionSeason">
                <option value="SUMMER">Summer</option>
                <option value="FALL">Fall</option>
                <option value="SPRING">Spring</option>
              </select>
            </label>
            <label>Decision year <input id="conDecisionYear" type="number" min="2022" max="2035" step="1"></label>
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
          <div id="consolidationScopePanel" class="dashboard-scope-panel"></div>
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
            <label><input id="demIncludeWorkExperience" type="checkbox" checked> include Work Experience</label>
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
      utilizationTool.querySelector('.room-fit-section')?.remove();
      utilizationTool.classList.add('analytics-view');
      utilizationTool.style.display = 'none';
      document.getElementById('analyticsReports').appendChild(utilizationTool);
    }
    [
      ['heatmap-tool', 'analytics-view'],
      ['modality-tool', 'analytics-view'],
      ['linechart-tool', 'analytics-view']
    ].forEach(([id, className]) => {
      const tool = document.getElementById(id);
      if (!tool) return;
      tool.classList.add(className);
      tool.style.display = 'none';
      document.getElementById('analyticsReports').appendChild(tool);
    });
    placeAdminToolsAtBottom();
  }

  function placeAdminToolsAtBottom() {
    const adminTools = document.getElementById('admin-tools');
    if (!adminTools || !document.body.contains(adminTools)) return;
    const tooltip = document.getElementById('class-block-tooltip');
    if (tooltip && tooltip.parentElement === document.body) document.body.insertBefore(adminTools, tooltip);
    else document.body.appendChild(adminTools);
  }

  function filters(prefix, options = {}) {
    const includeGroup = typeof options === 'boolean' ? options : Boolean(options.includeGroup);
    const includeCancelled = typeof options === 'boolean' ? true : options.includeCancelled !== false;
    const includeOrg = typeof options === 'object' && Boolean(options.includeOrg);
    const includeDivision = includeOrg || (typeof options === 'object' && Boolean(options.includeDivision));
    const includeRoom = typeof options === 'object' && Boolean(options.includeRoom);
    const includeCampus = typeof options !== 'object' || options.includeCampus !== false;
    return `
      ${includeDivision ? `<label>Division <select id="${prefix}Division" multiple data-placeholder="All divisions"></select></label>` : ''}
      ${includeOrg ? `<label>Department <select id="${prefix}Department" multiple data-placeholder="All departments"></select></label>` : ''}
      <label>Discipline <select id="${prefix}Subject" multiple data-placeholder="All disciplines"></select></label>
      <label>Course <select id="${prefix}Course" multiple data-placeholder="All courses"></select></label>
      ${includeCampus ? `<label>Campus <select id="${prefix}Campus" multiple data-placeholder="All campuses"></select></label>` : ''}
      ${includeRoom ? `<label>Building <select id="${prefix}Building" multiple data-placeholder="All buildings"></select></label>` : ''}
      ${includeRoom ? `<label>Room <select id="${prefix}Room" multiple data-placeholder="All rooms"></select></label>` : ''}
      <label>Modality <select id="${prefix}Modality" multiple data-placeholder="All modalities"></select></label>
      <label>Instructor <select id="${prefix}Instructor" multiple data-placeholder="All instructors"></select></label>
      <label>Day <select id="${prefix}Day" multiple data-placeholder="All days"></select></label>
      <label>Start hour <select id="${prefix}Time" multiple data-placeholder="All start hours"></select></label>
      ${includeGroup ? '<label>Group by <select id="attrGroup"><option>COURSE</option><option value="SUBJECT">DISCIPLINE</option><option>SECTION</option><option>INSTRUCTOR</option><option>CAMPUS</option><option>MODALITY</option><option>DAY PATTERN</option><option>TIME BLOCK</option><option>OVERALL</option></select></label><label>Min sections <input id="attrMinSections" type="number" min="1" value="1" title="Minimum section count required for a grouped row to appear."></label>' : ''}
      <label><input id="${prefix}ExcludeTutoringOpenLab" type="checkbox" checked> Exclude Tutoring/Open Lab Sections</label>
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

  const defaultCampusCodes = ['COS', 'TCC', 'HAC', 'ONT', 'ONH', 'ONC'];
  const physicalCampusCodes = ['COS', 'TCC', 'HAC'];

  function defaultCampusesForPrefix(prefix, options) {
    if (!String(prefix || '').endsWith('Campus')) return [];
    const reportPrefix = String(prefix || '').replace(/Campus$/, '');
    const defaults = reportPrefix === 'sp' ? physicalCampusCodes : defaultCampusCodes;
    return defaults.filter(code => (options || []).some(option => canon(option.value) === code));
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
    const defaultCampuses = selected.size ? [] : defaultCampusesForPrefix(id, options);
    const choice = analyticsChoices.get(id);
    if (choice) {
      choice.destroy();
      analyticsChoices.delete(id);
    }
    select.replaceChildren();
    options.forEach(option => {
      const optionKey = canon(option.value);
      const defaultSelected = defaultCampuses.includes(optionKey) && select.dataset.defaultCampusApplied !== 'true';
      const node = new Option(option.label, option.value, false, selected.has(optionKey) || defaultSelected);
      select.appendChild(node);
    });
    if (defaultCampuses.length) select.dataset.defaultCampusApplied = 'true';
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
    const excludeTutoringOpenLab = document.getElementById(prefix + 'ExcludeTutoringOpenLab');
    if (excludeTutoringOpenLab) excludeTutoringOpenLab.checked = true;
    if (prefix === 'attr') {
      const workExperience = document.getElementById('attrIncludeWorkExperience');
      if (workExperience) workExperience.checked = true;
      const group = document.getElementById('attrGroup');
      if (group) group.value = 'COURSE';
      const minSections = document.getElementById('attrMinSections');
      if (minSections) minSections.value = '1';
      if ((state.enrollment.length || currentRows().length) && state.attritionRan) runAttrition().catch(handleAttritionError);
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
      const workExperience = document.getElementById('demIncludeWorkExperience');
      if (workExperience) workExperience.checked = true;
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
      rerunDashboard();
    }
    if (prefix === 'conflict') {
      const omitCrossListed = document.getElementById('conflictOmitCrossListed');
      if (omitCrossListed) omitCrossListed.checked = true;
      const separateTypes = document.getElementById('conflictSeparateTypes');
      if (separateTypes) separateTypes.checked = false;
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
    const excludeTutoringOpenLab = document.getElementById(prefix + 'ExcludeTutoringOpenLab')?.checked !== false;
    return rows.filter((r) => {
      if (excludeTutoringOpenLab && isTutoringOpenLabSection(r)) return false;
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

  function standardExclusionDiagnostics(rows, prefix) {
    const excludeTutoringOpenLab = document.getElementById(prefix + 'ExcludeTutoringOpenLab')?.checked !== false;
    const tutoringRows = rows.filter(isTutoringOpenLabSection);
    const invalidCensus2Rows = rows.filter(row => row.invalidNegativeCensus2);
    return {
      tutoringOpenLabRowsExcluded: excludeTutoringOpenLab ? tutoringRows.length : 0,
      tutoringOpenLabRowsDetected: tutoringRows.length,
      invalidNegativeCensus2Rows: invalidCensus2Rows.length,
      invalidNegativeCensus2Crns: new Set(invalidCensus2Rows.map(sectionKey)).size,
      hasInvalidNegativeCensus2: invalidCensus2Rows.length > 0
    };
  }

  async function readCsv(input, options = {}) {
    const files = Array.from(input?.files || []);
    if (!files.length) return [];
    const batches = await Promise.all(files.map(file => new Promise((resolve, reject) => {
      const sourceTerm = termFromFilename(file.name);
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (r) => resolve((r.data || []).map(row => ({ ...row, __sourceTerm: sourceTerm, __sourceType: options.sourceType || '' }))),
        error: reject
      });
    })));
    return batches.flat();
  }

  function readTextFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error(`Unable to read ${file?.name || 'file'}.`));
      reader.readAsText(file);
    });
  }

  async function readFacultyScheduleFiles(input) {
    const files = Array.from(input?.files || []);
    if (!files.length) return [];
    if (!window.COSFacultyParser?.parseFacultyScheduleCsv) {
      throw new Error('Faculty Schedule parser is not loaded.');
    }
    const batches = await Promise.all(files.map(async file => {
      const text = await readTextFile(file);
      const sourceTerm = termFromFilename(file.name) || 'Unspecified';
      const parsed = window.COSFacultyParser.parseFacultyScheduleCsv(text, { term: sourceTerm });
      return parsed.meetings || [];
    }));
    return batches.flat();
  }

  function facultyTerm(row) {
    return String(row?.sourceTerm || row?.term || 'Unspecified').trim() || 'Unspecified';
  }

  function facultyCourseValue(row) {
    return row?.courseCode || [row?.subject, row?.course].filter(Boolean).join(' ');
  }

  function facultyModalityValue(row) {
    return row?.insmCode || row?.modality || '';
  }

  function reportableFacultyRows(rows) {
    if (window.COSFacultyModel?.reportableFacultyRows) return window.COSFacultyModel.reportableFacultyRows(rows);
    return (rows || []).filter(row => row && row.facultyType !== 'OMIT');
  }

  function setFacultyFilterOptions(id, values, allLabel = 'All') {
    const select = document.getElementById(id);
    if (!select) return;
    const previous = select.value;
    const unique = [...new Set((values || []).map(value => String(value || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    select.replaceChildren(new Option(allLabel, ''));
    unique.forEach(value => select.appendChild(new Option(value, value)));
    if (unique.includes(previous)) select.value = previous;
  }

  function facultyFilterSourceRows() {
    const rows = reportableFacultyRows(state.facultyHeatmapRows);
    const scoped = rows.filter(row => {
      const term = document.getElementById('fhTerm')?.value || '';
      const facultyType = document.getElementById('fhFacultyType')?.value || '';
      const meetingType = document.getElementById('fhMeetingType')?.value || '';
      const campus = document.getElementById('fhCampus')?.value || '';
      const division = document.getElementById('fhDivision')?.value || '';
      const department = document.getElementById('fhDepartment')?.value || '';
      const subject = document.getElementById('fhSubject')?.value || '';
      const course = document.getElementById('fhCourse')?.value || '';
      if (!facultyHasUsablePhysicalInterval(row)) return false;
      if (!facultyMatchesSelectedModality(row, 'fhModality', PHYSICAL_MODALITY_LABELS)) return false;
      if (term && facultyTerm(row) !== term) return false;
      if (facultyType && row.facultyType !== facultyType) return false;
      if (meetingType && row.meetingType !== meetingType) return false;
      if (campus && row.campus !== campus) return false;
      if (division && row.divisionId !== division) return false;
      if (department && row.departmentId !== department) return false;
      if (subject && row.subject !== subject) return false;
      if (course && facultyCourseValue(row) !== course) return false;
      return true;
    });
    return scoped;
  }

  function updateFacultyHeatmapFilterOptions() {
    const rows = reportableFacultyRows(state.facultyHeatmapRows);
    setFacultyFilterOptions('fhTerm', rows.map(facultyTerm), 'All terms');
    setFacultyFilterOptions('fhCampus', rows.map(row => row.campus), 'All campuses');
    setFacultyFilterOptions('fhDivision', rows.map(row => row.divisionId), 'All divisions');
    const division = document.getElementById('fhDivision')?.value || '';
    const departmentSource = division ? rows.filter(row => row.divisionId === division) : rows;
    setFacultyFilterOptions('fhDepartment', departmentSource.map(row => row.departmentId), 'All departments');
    const department = document.getElementById('fhDepartment')?.value || '';
    const subjectSource = department ? departmentSource.filter(row => row.departmentId === department) : departmentSource;
    setFacultyFilterOptions('fhSubject', subjectSource.map(row => row.subject), 'All disciplines');
    const subject = document.getElementById('fhSubject')?.value || '';
    const courseSource = subject ? subjectSource.filter(row => row.subject === subject) : subjectSource;
    setFacultyFilterOptions('fhCourse', courseSource.map(facultyCourseValue), 'All courses');
    setModalitySelectOptions('fhModality', PHYSICAL_MODALITY_LABELS);
  }

  function facultyIntervalRows(rows, options = {}) {
    const includeOnline = options.includeOnline === true;
    return reportableFacultyRows(rows).filter(row => {
      if (!facultyHasUsablePhysicalInterval(row)) return false;
      if (facultyIsPhysicalModality(row)) return true;
      return includeOnline && facultyInstructionModality(row) === 'Online';
    });
  }

  function facultyHeatmapSlots(rows, options = {}) {
    let min = 6 * 60;
    let max = 22 * 60;
    facultyIntervalRows(rows, options).forEach(row => {
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

  function facultyHeatmapMetricValue(row, metricName) {
    if (metricName === 'enrollment') return row.actualEnroll || 0;
    if (metricName === 'seats') return row.maxEnroll || 0;
    if (metricName === 'lhe') return row.lhe || 0;
    return 1;
  }

  function buildFacultyHeatmapBuckets(rows, metricName, options = {}) {
    const dayKeys = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const dayNames = { SU: 'Sunday', MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday', FR: 'Friday', SA: 'Saturday' };
    const slots = facultyHeatmapSlots(rows, options);
    const cellMap = new Map();
    dayKeys.forEach(day => {
      slots.forEach(minutes => {
        const key = `${day}|${minutes}`;
        cellMap.set(key, {
          key,
          day,
          dayName: dayNames[day],
          minutes,
          time: formatPresenceHourLabel(minutes / 60),
          sections: 0,
          facultyCount: 0,
          enrollment: 0,
          seats: 0,
          lhe: 0,
          faculty: new Set(),
          meetings: new Set()
        });
      });
    });
    facultyIntervalRows(rows, options).forEach(row => {
      const start = minutesFromTime(row.startTime || row.start);
      const end = minutesFromTime(row.endTime || row.end);
      if (start == null || end == null || end <= start) return;
      const rowDays = Array.isArray(row.days) ? row.days : [];
      const facultyKey = row.facultyId || row.facultyName || row.instructor || 'Unknown';
      rowDays.forEach(day => {
        slots.forEach(minutes => {
          if (end <= minutes || start >= minutes + 30) return;
          const cell = cellMap.get(`${day}|${minutes}`);
          if (!cell) return;
          const meetingKey = row.deduplicationKey || [row.crn, row.dayPattern, row.startTime, row.endTime, row.meetingType, facultyKey].join('|');
          if (cell.meetings.has(meetingKey)) return;
          cell.meetings.add(meetingKey);
          cell.sections += 1;
          cell.enrollment += facultyHeatmapMetricValue(row, 'enrollment');
          cell.seats += facultyHeatmapMetricValue(row, 'seats');
          cell.lhe += facultyHeatmapMetricValue(row, 'lhe');
          cell.faculty.add(facultyKey);
          cell.facultyCount = cell.faculty.size;
        });
      });
    });
    const rowsOut = [...cellMap.values()].map(cell => ({
      ...cell,
      metricValue: metricName === 'facultyCount' ? cell.facultyCount : cell[metricName] || 0
    }));
    return { dayKeys, dayNames, slots, rows: rowsOut };
  }

  function peakFacultyHeatmapCell(bucketRows, metricName, predicate = () => true) {
    return (bucketRows || [])
      .filter(row => predicate(row) && (metricName === 'facultyCount' ? row.facultyCount : row[metricName] || 0) > 0)
      .sort((a, b) => ((metricName === 'facultyCount' ? b.facultyCount : b[metricName] || 0) - (metricName === 'facultyCount' ? a.facultyCount : a[metricName] || 0)))[0] || null;
  }

  function facultyHeatmapPeakByType(rows, facultyType) {
    const built = buildFacultyHeatmapBuckets(reportableFacultyRows(rows).filter(row => row.facultyType === facultyType), 'sections', { includeOnline: includeOnlineFromSelect('fhModality') });
    return peakFacultyHeatmapCell(built.rows, 'sections');
  }

  function renderFacultyScheduleHeatmap() {
    const status = document.getElementById('facultyScheduleHeatmapStatus');
    const sourceRows = state.facultyHeatmapRows || [];
    const rows = facultyFilterSourceRows();
    const metricName = document.getElementById('fhMetric')?.value || 'sections';
    if (!sourceRows.length) {
      if (status) status.textContent = 'No faculty schedule rows loaded.';
      metric('facultyHeatmapMetrics', [
        ['Peak teaching time', 'N/A'],
        ['Peak FT teaching', 'N/A'],
        ['Peak PT teaching', 'N/A'],
        ['Peak enrollment', 'N/A'],
        ['Peak LHE', 'N/A'],
        ['Most active day', 'N/A'],
        ['Least active day', 'N/A']
      ]);
      document.getElementById('facultyHeatmapContainer').innerHTML = '<p class="analytics-empty">Upload a Faculty Schedule CSV and click Load Faculty Schedule.</p>';
      document.getElementById('facultyHeatmapTable').innerHTML = '<p class="analytics-empty">No faculty schedule data loaded.</p>';
      document.getElementById('facultyHeatmapLegend').innerHTML = '';
      return;
    }
    if (status) {
      const terms = [...new Set(sourceRows.map(facultyTerm))].sort().join(', ');
      status.textContent = `Loaded ${sourceRows.length} deduped meeting row(s). Terms: ${terms || 'Unspecified'}.`;
    }
    const built = buildFacultyHeatmapBuckets(rows, metricName, { includeOnline: includeOnlineFromSelect('fhModality') });
    state.facultyHeatmapBucketRows = built.rows;
    const maxValue = Math.max(0, ...built.rows.map(row => row.metricValue || 0));
    const cellByKey = new Map(built.rows.map(row => [row.key, row]));
    const headers = built.slots.map(minutes => `<th>${escapeAttr(formatPresenceHourLabel(minutes / 60))}</th>`).join('');
    const body = built.dayKeys.map(day => {
      const cells = built.slots.map(minutes => {
        const cell = cellByKey.get(`${day}|${minutes}`);
        const value = cell?.metricValue || 0;
        const heat = maxValue ? value / maxValue : 0;
        const level = value <= 0 ? 'empty' : heat >= 0.67 ? 'high' : heat >= 0.34 ? 'medium' : 'low';
        const display = metricName === 'lhe' && value ? value.toFixed(1) : Math.round(value);
        return `<td class="heatmap-cell heatmap-${level}" style="--heat:${heat.toFixed(3)}" title="${escapeAttr(`${built.dayNames[day]} ${formatPresenceHourLabel(minutes / 60)}: ${display}`)}">${value ? display : ''}</td>`;
      }).join('');
      return `<tr><th>${built.dayNames[day]}</th>${cells}</tr>`;
    }).join('');
    document.getElementById('facultyHeatmapContainer').innerHTML = `
      <div class="heatmap-wrap">
        <table class="heatmap">
          <thead><tr><th>Day / Time</th>${headers}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
    const peakTeaching = peakFacultyHeatmapCell(built.rows, 'sections');
    const peakEnrollment = peakFacultyHeatmapCell(built.rows, 'enrollment');
    const peakLhe = peakFacultyHeatmapCell(built.rows, 'lhe');
    const peakFt = facultyHeatmapPeakByType(rows, 'FULL_TIME');
    const peakPt = facultyHeatmapPeakByType(rows, 'PART_TIME');
    const dayTotals = built.dayKeys.map(day => ({
      day: built.dayNames[day],
      sections: built.rows.filter(row => row.day === day).reduce((total, row) => total + row.sections, 0)
    }));
    const mostActiveDay = dayTotals.slice().sort((a, b) => b.sections - a.sections)[0];
    const leastActiveDay = dayTotals.slice().sort((a, b) => a.sections - b.sections)[0];
    const cellLabel = (cell, metric = 'sections') => cell ? `${cell.dayName} ${cell.time} (${metric === 'lhe' ? (cell[metric] || 0).toFixed(1) : Math.round(cell[metric] || 0)})` : 'N/A';
    metric('facultyHeatmapMetrics', [
      ['Peak teaching time', cellLabel(peakTeaching, 'sections')],
      ['Peak FT teaching', cellLabel(peakFt, 'sections')],
      ['Peak PT teaching', cellLabel(peakPt, 'sections')],
      ['Peak enrollment', cellLabel(peakEnrollment, 'enrollment')],
      ['Peak LHE', cellLabel(peakLhe, 'lhe')],
      ['Most active day', mostActiveDay ? `${mostActiveDay.day} (${mostActiveDay.sections})` : 'N/A'],
      ['Least active day', leastActiveDay ? `${leastActiveDay.day} (${leastActiveDay.sections})` : 'N/A']
    ]);
    const nonEmpty = built.rows
      .filter(row => row.sections || row.facultyCount || row.enrollment || row.seats || row.lhe)
      .map(row => ({
        day: row.dayName,
        time: row.time,
        sections: row.sections,
        facultyCount: row.facultyCount,
        enrollment: row.enrollment,
        seats: row.seats,
        lhe: Number(row.lhe.toFixed(2))
      }));
    table('facultyHeatmapTable', nonEmpty, ['day', 'time', 'sections', 'facultyCount', 'enrollment', 'seats', 'lhe']);
    document.getElementById('facultyHeatmapLegend').innerHTML = `
      <strong>Faculty Schedule Heatmap Methodology</strong>
      <p>Rows are normalized by the Faculty Schedule parser and deduplicated by CRN, day pattern, start/end time, meeting type, and instructor. Each meeting contributes to every overlapping half-hour bucket on every scheduled day. Omitted faculty types are excluded from this Development report.</p>
    `;
    state.facultyHeatmapRan = true;
  }

  async function loadFacultyScheduleHeatmap() {
    const rows = await readFacultyScheduleFiles(document.getElementById('facultyScheduleCsv'));
    state.facultyHeatmapRows = rows;
    updateFacultyHeatmapFilterOptions();
    renderFacultyScheduleHeatmap();
  }

  function clearFacultyScheduleHeatmap() {
    ['fhMetric', 'fhFacultyType', 'fhMeetingType', 'fhTerm', 'fhCampus', 'fhDivision', 'fhDepartment', 'fhSubject', 'fhCourse'].forEach(id => {
      const node = document.getElementById(id);
      if (node) node.value = '';
    });
    setModalitySelectValues('fhModality', PHYSICAL_MODALITY_LABELS);
    const metricSelect = document.getElementById('fhMetric');
    if (metricSelect) metricSelect.value = 'sections';
    renderFacultyScheduleHeatmap();
  }

  function facultyInstructionModality(row) {
    const normalized = normalizeModality(row?.insmCode || '', { raw: { INSTRUCTIONAL_METHOD_CODE: row?.insmCode || '' } });
    return window.COSModalityNormalizer?.displayLabel
      ? window.COSModalityNormalizer.displayLabel(normalized)
      : ({ 'IN PERSON': 'In-Person', HYBRID: 'Hybrid', ONLINE: 'Online' }[normalized] || 'Unknown');
  }

  function facultyIsPhysicalModality(row) {
    const modality = facultyInstructionModality(row);
    return modality === 'In-Person' || modality === 'Hybrid';
  }

  function facultyHasUsablePhysicalInterval(row) {
    const start = minutesFromTime(row?.startTime || row?.start);
    const end = minutesFromTime(row?.endTime || row?.end);
    if (!Array.isArray(row?.days) || !row.days.length) return false;
    if (start == null || end == null || end <= start) return false;
    if (start === 0 && end <= 59) return false;
    return true;
  }

  function facultyModalityFilterRows() {
    const term = document.getElementById('fmTerm')?.value || '';
    const campus = document.getElementById('fmCampus')?.value || '';
    const division = document.getElementById('fmDivision')?.value || '';
    const department = document.getElementById('fmDepartment')?.value || '';
    const course = document.getElementById('fmCourse')?.value || '';
    return reportableFacultyRows(state.facultyModalityRows)
      .filter(row => {
        if (!facultyMatchesSelectedModality(row, 'fmModality', REPORTABLE_MODALITY_LABELS)) return false;
        if (term && facultyTerm(row) !== term) return false;
        if (campus && row.campus !== campus) return false;
        if (division && row.divisionId !== division) return false;
        if (department && row.departmentId !== department) return false;
        if (course && facultyCourseValue(row) !== course) return false;
        return true;
      });
  }

  function updateFacultyModalityFilterOptions() {
    const rows = reportableFacultyRows(state.facultyModalityRows);
    setFacultyFilterOptions('fmTerm', rows.map(facultyTerm), 'All terms');
    setFacultyFilterOptions('fmCampus', rows.map(row => row.campus), 'All campuses');
    setFacultyFilterOptions('fmDivision', rows.map(row => row.divisionId), 'All divisions');
    const division = document.getElementById('fmDivision')?.value || '';
    const departmentSource = division ? rows.filter(row => row.divisionId === division) : rows;
    setFacultyFilterOptions('fmDepartment', departmentSource.map(row => row.departmentId), 'All departments');
    const department = document.getElementById('fmDepartment')?.value || '';
    const courseSource = department ? departmentSource.filter(row => row.departmentId === department) : departmentSource;
    setFacultyFilterOptions('fmCourse', courseSource.map(facultyCourseValue), 'All courses');
    setModalitySelectOptions('fmModality', REPORTABLE_MODALITY_LABELS);
  }

  function buildFacultyModalityRows(rows) {
    const facultyTypes = [
      ['FULL_TIME', 'Full-Time'],
      ['PART_TIME', 'Part-Time'],
      ['UNKNOWN', 'Unknown']
    ];
    const modalities = ['In-Person', 'Hybrid', 'Online'];
    const buckets = new Map();
    facultyTypes.forEach(([, label]) => {
      modalities.forEach(modality => {
        buckets.set(`${label}|${modality}`, {
          facultyType: label,
          modality,
          sections: 0,
          facultyCount: 0,
          enrollment: 0,
          seats: 0,
          lhe: 0,
          faculty: new Set(),
          sourceCodes: new Set()
        });
      });
    });
    reportableFacultyRows(rows).forEach(row => {
      const facultyType = facultyTypes.find(([code]) => code === row.facultyType)?.[1];
      if (!facultyType) return;
      const modality = facultyInstructionModality(row);
      if (!['In-Person', 'Hybrid', 'Online'].includes(modality)) return;
      const bucket = buckets.get(`${facultyType}|${modality}`);
      if (!bucket) return;
      bucket.sections += 1;
      bucket.enrollment += row.actualEnroll || 0;
      bucket.seats += row.maxEnroll || 0;
      bucket.lhe += row.lhe || 0;
      bucket.faculty.add(row.facultyId || row.facultyName || row.instructor || 'Unknown');
      bucket.facultyCount = bucket.faculty.size;
      if (row.insmCode) bucket.sourceCodes.add(row.insmCode);
    });
    const totalSections = [...buckets.values()].reduce((total, row) => total + row.sections, 0);
    return [...buckets.values()].map(row => ({
      facultyType: row.facultyType,
      modality: row.modality,
      sections: row.sections,
      facultyCount: row.facultyCount,
      enrollment: row.enrollment,
      seats: row.seats,
      lhe: Number(row.lhe.toFixed(2)),
      sectionShare: totalSections ? `${((row.sections / totalSections) * 100).toFixed(1)}%` : '0%',
      sourceCodes: [...row.sourceCodes].sort().join(', ') || 'N/A'
    }));
  }

  function renderFacultyModalityChart(rows) {
    const node = document.getElementById('facultyModalityChart');
    if (!node) return;
    const maxSections = Math.max(1, ...rows.map(row => row.sections || 0));
    const facultyTypes = ['Full-Time', 'Part-Time', 'Unknown'];
    node.innerHTML = facultyTypes.map(type => {
      const typeRows = rows.filter(row => row.facultyType === type);
      const bars = typeRows.map(row => {
        const width = Math.max(2, ((row.sections || 0) / maxSections) * 100);
        return `
          <div class="faculty-modality-bar-row">
            <span>${escapeAttr(row.modality)}</span>
            <div class="faculty-modality-bar-track">
              <div class="faculty-modality-bar faculty-modality-${row.modality.toLowerCase().replace(/\s+/g, '-')}" style="width:${width.toFixed(1)}%"></div>
            </div>
            <strong>${row.sections}</strong>
          </div>`;
      }).join('');
      return `<section class="faculty-modality-card"><h3>${escapeAttr(type)}</h3>${bars}</section>`;
    }).join('');
  }

  function renderFacultyModality() {
    const status = document.getElementById('facultyModalityStatus');
    const sourceRows = state.facultyModalityRows || [];
    if (!sourceRows.length) {
      if (status) status.textContent = 'No faculty schedule rows loaded.';
      metric('facultyModalityMetrics', [
        ['Total sections', 0],
        ['Full-Time sections', 0],
        ['Part-Time sections', 0],
        ['Unknown sections', 0],
        ['In-Person sections', 0],
        ['Hybrid sections', 0],
        ['Online sections', 0],
        ['Unknown/Omitted rows excluded', reportableFacultyRows(sourceRows).filter(row => !['In-Person', 'Hybrid', 'Online'].includes(facultyInstructionModality(row))).length]
      ]);
      document.getElementById('facultyModalityChart').innerHTML = '<p class="analytics-empty">Upload a Faculty Schedule CSV and click Load Faculty Modality.</p>';
      document.getElementById('facultyModalityTable').innerHTML = '<p class="analytics-empty">No faculty modality data loaded.</p>';
      document.getElementById('facultyModalityLegend').innerHTML = '';
      return;
    }
    if (status) {
      const terms = [...new Set(sourceRows.map(facultyTerm))].sort().join(', ');
      status.textContent = `Loaded ${sourceRows.length} deduped meeting row(s). Terms: ${terms || 'Unspecified'}.`;
    }
    const rows = facultyModalityFilterRows();
    const tableRows = buildFacultyModalityRows(rows);
    state.facultyModalityTableRows = tableRows;
    const byType = type => tableRows.filter(row => row.facultyType === type).reduce((total, row) => total + row.sections, 0);
    const byModality = modality => tableRows.filter(row => row.modality === modality).reduce((total, row) => total + row.sections, 0);
    metric('facultyModalityMetrics', [
      ['Total sections', tableRows.reduce((total, row) => total + row.sections, 0)],
      ['Full-Time sections', byType('Full-Time')],
      ['Part-Time sections', byType('Part-Time')],
      ['Unknown sections', byType('Unknown')],
      ['In-Person sections', byModality('In-Person')],
      ['Hybrid sections', byModality('Hybrid')],
      ['Online sections', byModality('Online')],
      ['Unknown/Omitted rows excluded', sourceRows.filter(row => !['In-Person', 'Hybrid', 'Online'].includes(facultyInstructionModality(row))).length]
    ]);
    renderFacultyModalityChart(tableRows);
    table('facultyModalityTable', tableRows, ['facultyType', 'modality', 'sections', 'facultyCount', 'enrollment', 'seats', 'lhe', 'sectionShare', 'sourceCodes']);
    document.getElementById('facultyModalityLegend').innerHTML = `
      <strong>Faculty Modality Methodology</strong>
      <p>Modality is mapped from INSM_CODE_SSBSECT with the shared TIMBER modality normalizer. User-facing modality results display only In-Person, Hybrid, and Online. Unknown or omitted codes are excluded from standard analytics and should be reviewed in diagnostics/validation outputs.</p>
    `;
    state.facultyModalityRan = true;
  }

  async function loadFacultyModality() {
    const rows = await readFacultyScheduleFiles(document.getElementById('facultyModalityCsv'));
    state.facultyModalityRows = rows;
    updateFacultyModalityFilterOptions();
    renderFacultyModality();
  }

  function clearFacultyModality() {
    ['fmTerm', 'fmCampus', 'fmDivision', 'fmDepartment', 'fmCourse'].forEach(id => {
      const node = document.getElementById(id);
      if (node) node.value = '';
    });
    setModalitySelectValues('fmModality', REPORTABLE_MODALITY_LABELS);
    renderFacultyModality();
  }

  function primeTimeDefinition() {
    const start = minutesFromTime(document.getElementById('ptStart')?.value || '09:00') ?? 9 * 60;
    const end = minutesFromTime(document.getElementById('ptEnd')?.value || '15:00') ?? 15 * 60;
    const days = new Set(Array.from(document.querySelectorAll('.ptDay:checked')).map(node => node.value));
    return { start, end, days };
  }

  function rowOverlapsPrimeTime(row, definition = primeTimeDefinition()) {
    const start = minutesFromTime(row.startTime || row.start);
    const end = minutesFromTime(row.endTime || row.end);
    if (start == null || end == null || end <= start || definition.end <= definition.start) return false;
    const rowDays = Array.isArray(row.days) ? row.days : [];
    if (!rowDays.some(day => definition.days.has(day))) return false;
    return start < definition.end && end > definition.start;
  }

  function primeTimeFilterRows() {
    const term = document.getElementById('ptTerm')?.value || '';
    const campus = document.getElementById('ptCampus')?.value || '';
    const division = document.getElementById('ptDivision')?.value || '';
    const department = document.getElementById('ptDepartment')?.value || '';
    const course = document.getElementById('ptCourse')?.value || '';
    return reportableFacultyRows(state.primeTimeRows)
      .filter(row => facultyHasUsablePhysicalInterval(row))
      .filter(row => {
        if (!facultyMatchesSelectedModality(row, 'ptModality', PHYSICAL_MODALITY_LABELS)) return false;
        if (term && facultyTerm(row) !== term) return false;
        if (campus && row.campus !== campus) return false;
        if (division && row.divisionId !== division) return false;
        if (department && row.departmentId !== department) return false;
        if (course && facultyCourseValue(row) !== course) return false;
        return true;
      });
  }

  function updatePrimeTimeFilterOptions() {
    const rows = reportableFacultyRows(state.primeTimeRows);
    setFacultyFilterOptions('ptTerm', rows.map(facultyTerm), 'All terms');
    setFacultyFilterOptions('ptCampus', rows.map(row => row.campus), 'All campuses');
    setFacultyFilterOptions('ptDivision', rows.map(row => row.divisionId), 'All divisions');
    const division = document.getElementById('ptDivision')?.value || '';
    const departmentSource = division ? rows.filter(row => row.divisionId === division) : rows;
    setFacultyFilterOptions('ptDepartment', departmentSource.map(row => row.departmentId), 'All departments');
    const department = document.getElementById('ptDepartment')?.value || '';
    const courseSource = department ? departmentSource.filter(row => row.departmentId === department) : departmentSource;
    setFacultyFilterOptions('ptCourse', courseSource.map(facultyCourseValue), 'All courses');
    setModalitySelectOptions('ptModality', PHYSICAL_MODALITY_LABELS);
  }

  function primeTimeStat(label, rows, predicate, valueKey = 'sections') {
    const scoped = rows.filter(predicate);
    const prime = scoped.filter(row => row.isPrimeTime);
    const total = valueKey === 'sections' ? scoped.length : scoped.reduce((sumValue, row) => sumValue + (row[valueKey] || 0), 0);
    const primeValue = valueKey === 'sections' ? prime.length : prime.reduce((sumValue, row) => sumValue + (row[valueKey] || 0), 0);
    const pct = safeDiv(primeValue, total);
    return {
      category: label,
      primeValue: round1(primeValue),
      totalValue: round1(total),
      percentPrime: `${(pct * 100).toFixed(1)}%`,
      percentNumber: pct
    };
  }

  function primeTimeAnalysisRows(rows, modalityLabels = PHYSICAL_MODALITY_LABELS) {
    const definition = primeTimeDefinition();
    const analyzed = reportableFacultyRows(rows)
      .filter(row => facultyHasUsablePhysicalInterval(row))
      .filter(row => facultyModalityMatchesLabelList(row, modalityLabels))
      .map(row => ({
      ...row,
      isPrimeTime: rowOverlapsPrimeTime(row, definition),
      enrollment: row.actualEnroll || 0,
      seats: row.maxEnroll || 0
    }));
    return [
      primeTimeStat('Full-Time Sections', analyzed, row => row.facultyType === 'FULL_TIME'),
      primeTimeStat('Part-Time Sections', analyzed, row => row.facultyType === 'PART_TIME'),
      primeTimeStat('Lecture Sections', analyzed, row => row.meetingType === 'Lecture'),
      primeTimeStat('Lab Sections', analyzed, row => row.meetingType === 'Lab'),
      primeTimeStat('Activity Sections', analyzed, row => row.meetingType === 'Activity'),
      primeTimeStat('Student Enrollment', analyzed, () => true, 'enrollment'),
      primeTimeStat('LHE', analyzed, () => true, 'lhe')
    ];
  }

  function renderPrimeTimeGauges(rows) {
    const node = document.getElementById('primeTimeGauges');
    if (!node) return;
    node.innerHTML = rows.map(row => {
      const pct = Math.max(0, Math.min(1, row.percentNumber || 0));
      return `
        <section class="prime-time-gauge-card">
          <div class="prime-time-gauge" style="--pct:${pct}">
            <span>${escapeAttr(row.percentPrime)}</span>
          </div>
          <strong>${escapeAttr(row.category)}</strong>
          <small>${escapeAttr(row.primeValue)} of ${escapeAttr(row.totalValue)} in prime time</small>
        </section>`;
    }).join('');
  }

  function renderPrimeTimeAnalysis() {
    const status = document.getElementById('primeTimeStatus');
    const sourceRows = state.primeTimeRows || [];
    if (!sourceRows.length) {
      if (status) status.textContent = 'No faculty schedule rows loaded.';
      document.getElementById('primeTimeGauges').innerHTML = '<p class="analytics-empty">Upload a Faculty Schedule CSV and click Load Prime Time Analysis.</p>';
      metric('primeTimeMetrics', [
        ['FT prime-time sections', '0%'],
        ['PT prime-time sections', '0%'],
        ['Lecture prime time', '0%'],
        ['Lab prime time', '0%'],
        ['Activity prime time', '0%'],
        ['Enrollment prime time', '0%'],
        ['LHE prime time', '0%']
      ]);
      document.getElementById('primeTimeTable').innerHTML = '<p class="analytics-empty">No prime-time data loaded.</p>';
      document.getElementById('primeTimeLegend').innerHTML = '';
      return;
    }
    if (status) {
      const terms = [...new Set(sourceRows.map(facultyTerm))].sort().join(', ');
      status.textContent = `Loaded ${sourceRows.length} deduped meeting row(s). Terms: ${terms || 'Unspecified'}.`;
    }
    const rows = primeTimeFilterRows();
    const tableRows = primeTimeAnalysisRows(rows, [...selectedModalityLabels('ptModality', PHYSICAL_MODALITY_LABELS)]);
    state.primeTimeTableRows = tableRows;
    renderPrimeTimeGauges(tableRows);
    const pick = label => tableRows.find(row => row.category === label)?.percentPrime || '0%';
    metric('primeTimeMetrics', [
      ['FT prime-time sections', pick('Full-Time Sections')],
      ['PT prime-time sections', pick('Part-Time Sections')],
      ['Lecture prime time', pick('Lecture Sections')],
      ['Lab prime time', pick('Lab Sections')],
      ['Activity prime time', pick('Activity Sections')],
      ['Enrollment prime time', pick('Student Enrollment')],
      ['LHE prime time', pick('LHE')]
    ]);
    table('primeTimeTable', tableRows, ['category', 'primeValue', 'totalValue', 'percentPrime']);
    const definition = primeTimeDefinition();
    const dayNames = [...definition.days].map(day => dayLabels[day] || day).join(', ') || 'No days selected';
    document.getElementById('primeTimeLegend').innerHTML = `
      <strong>Prime Time Analysis Methodology</strong>
      <p>Prime time currently uses ${escapeAttr(dayNames)}, ${escapeAttr(formatPresenceHourLabel(definition.start / 60))}-${escapeAttr(formatPresenceHourLabel(definition.end / 60))}. A meeting counts as prime time when any scheduled day and any part of the meeting overlaps the selected window. Percent Prime = prime-time value / total value for the filtered reportable faculty schedule rows.</p>
    `;
    state.primeTimeRan = true;
  }

  async function loadPrimeTimeAnalysis() {
    const rows = await readFacultyScheduleFiles(document.getElementById('primeTimeCsv'));
    state.primeTimeRows = rows;
    updatePrimeTimeFilterOptions();
    renderPrimeTimeAnalysis();
  }

  function clearPrimeTimeAnalysis() {
    ['ptTerm', 'ptCampus', 'ptDivision', 'ptDepartment', 'ptCourse'].forEach(id => {
      const node = document.getElementById(id);
      if (node) node.value = '';
    });
    setModalitySelectValues('ptModality', PHYSICAL_MODALITY_LABELS);
    const start = document.getElementById('ptStart');
    const end = document.getElementById('ptEnd');
    if (start) start.value = '09:00';
    if (end) end.value = '15:00';
    document.querySelectorAll('.ptDay').forEach(node => {
      node.checked = ['MO', 'TU', 'WE', 'TH'].includes(node.value);
    });
    renderPrimeTimeAnalysis();
  }

  function calGetcCourseCode(row) {
    return canon([row?.subject, row?.course].filter(Boolean).join(' '));
  }

  function normalizedCalGetcRows() {
    const source = Array.isArray(window.CAL_GETC_MAPPING) ? window.CAL_GETC_MAPPING : [];
    return source.map(item => ({
      code: canon(item.code || item.Code || item.course || item.Course || item['Course Code']),
      areas: String(item.areas || item.Areas || item.area || item.Area || item['CAL-GETC Area'] || '')
        .split(/[,;|]/).map(value => canon(value)).filter(Boolean),
      divisions: String(item.divisions || item.Divisions || item.division || item.Division || item['CAL-GETC Division'] || '')
        .split(/[,;|]/).map(value => canon(value)).filter(Boolean)
    })).filter(item => item.code);
  }

  function setSupplyDemandCalGetcOptions() {
    const select = document.getElementById('sdCalGetc');
    if (!select) return;
    const previous = select.value;
    const rows = normalizedCalGetcRows();
    const options = [{ value: '', label: 'All CAL-GETC' }];
    const areas = new Set();
    const divisions = new Set();
    rows.forEach(row => {
      row.areas.forEach(area => areas.add(area));
      row.divisions.forEach(division => divisions.add(division));
    });
    [...areas].sort().forEach(area => options.push({ value: `AREA:${area}`, label: `Area: ${area}` }));
    [...divisions].sort().forEach(division => options.push({ value: `DIVISION:${division}`, label: `Division: ${division}` }));
    rows.map(row => row.code).sort().forEach(code => options.push({ value: `COURSE:${code}`, label: code }));
    select.replaceChildren();
    options.forEach(option => select.appendChild(new Option(option.label, option.value, false, option.value === previous)));
    if (options.some(option => option.value === previous)) select.value = previous;
  }

  function supplyDemandMatchesCalGetc(row) {
    const selected = document.getElementById('sdCalGetc')?.value || '';
    if (!selected) return true;
    const courseCode = calGetcCourseCode(row);
    const mappings = normalizedCalGetcRows().filter(item => item.code === courseCode);
    if (selected.startsWith('COURSE:')) return courseCode === selected.slice(7);
    if (selected.startsWith('AREA:')) return mappings.some(item => item.areas.includes(selected.slice(5)));
    if (selected.startsWith('DIVISION:')) return mappings.some(item => item.divisions.includes(selected.slice(9)));
    return true;
  }

  function updateSupplyDemandFilterOptions() {
    const rows = (state.supplyDemandRows || []).filter(row => !row.isWorkExperience);
    setFacultyFilterOptions('sdTerm', rows.map(row => row.term), 'All terms');
    setFacultyFilterOptions('sdCampus', rows.map(row => row.campus), 'All campuses');
    setFacultyFilterOptions('sdDivision', rows.map(row => row.division), 'All divisions');
    const division = document.getElementById('sdDivision')?.value || '';
    const departmentSource = division ? rows.filter(row => row.division === division) : rows;
    setFacultyFilterOptions('sdDepartment', departmentSource.map(row => row.department), 'All departments');
    const department = document.getElementById('sdDepartment')?.value || '';
    const courseSource = department ? departmentSource.filter(row => row.department === department) : departmentSource;
    setFacultyFilterOptions('sdCourse', courseSource.map(calGetcCourseCode), 'All courses');
    setModalitySelectOptions('sdModality', PHYSICAL_MODALITY_LABELS);
    setSupplyDemandCalGetcOptions();
  }

  function supplyDemandFilteredRows() {
    const term = document.getElementById('sdTerm')?.value || '';
    const campus = document.getElementById('sdCampus')?.value || '';
    const division = document.getElementById('sdDivision')?.value || '';
    const department = document.getElementById('sdDepartment')?.value || '';
    const course = document.getElementById('sdCourse')?.value || '';
    return (state.supplyDemandRows || [])
      .filter(row => !row.isWorkExperience && !isOmittedInstructionalMethod(row))
      .filter(row => {
        if (term && row.term !== term) return false;
        if (campus && row.campus !== campus) return false;
        if (division && row.division !== division) return false;
        if (department && row.department !== department) return false;
        if (course && calGetcCourseCode(row) !== course) return false;
        if (!rowMatchesSelectedModality(row, 'sdModality', PHYSICAL_MODALITY_LABELS)) return false;
        if (!supplyDemandMatchesCalGetc(row)) return false;
        return true;
      });
  }

  function supplyDemandEnrollment(row) {
    return row.census == null ? row.actual || 0 : row.census || 0;
  }

  function supplyDemandSlots(rows) {
    let min = 6 * 60;
    let max = 22 * 60;
    (rows || []).forEach(row => {
      const start = minutesFromTime(row.start);
      const end = minutesFromTime(row.end);
      if (start != null && end != null && end > start) {
        min = Math.min(min, Math.floor(start / 30) * 30);
        max = Math.max(max, Math.ceil(end / 30) * 30);
      }
    });
    const slots = [];
    for (let minutes = min; minutes < max; minutes += 30) slots.push(minutes);
    return slots;
  }

  function supplyDemandInterpretation(row) {
    if ((row.sections || 0) <= 0 && (row.enrollment || 0) <= 0 && (row.waitlist || 0) <= 0) return 'Low Activity';
    if ((row.fillRateNumber || 0) >= 0.9 || (row.waitlist || 0) > 0) return row.sections <= 1 && row.waitlist > 0 ? 'Hidden Demand' : 'High Demand';
    if ((row.sections || 0) >= 3 && (row.fillRateNumber || 0) < 0.55 && (row.emptySeats || 0) > 0) return 'Oversupplied';
    if ((row.fillRateNumber || 0) >= 0.65 && (row.fillRateNumber || 0) < 0.9) return 'Balanced';
    return 'Low Activity';
  }

  function buildSupplyDemandBuckets(rows, metricName, options = {}) {
    const dayKeys = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const dayNames = { SU: 'Sunday', MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday', FR: 'Friday', SA: 'Saturday' };
    const fixedRows = physicalIntervalRows(rows, options);
    const slots = supplyDemandSlots(fixedRows);
    const map = new Map();
    dayKeys.forEach(day => {
      slots.forEach(minutes => {
        const key = `${day}|${minutes}`;
        map.set(key, {
          key,
          day,
          dayName: dayNames[day],
          minutes,
          time: formatPresenceHourLabel(minutes / 60),
          sections: 0,
          seats: 0,
          enrollment: 0,
          studentPresence: 0,
          waitlist: 0,
          emptySeats: 0,
          fillRate: '0%',
          fillRateNumber: 0,
          seen: new Set()
        });
      });
    });
    fixedRows.forEach(row => {
      const start = minutesFromTime(row.start);
      const end = minutesFromTime(row.end);
      if (start == null || end == null || end <= start) return;
      row.days.forEach(day => {
        slots.forEach(minutes => {
          if (end <= minutes || start >= minutes + 30) return;
          const cell = map.get(`${day}|${minutes}`);
          if (!cell) return;
          const key = [row.term, sectionKey(row), day, row.start, row.end].join('|');
          if (cell.seen.has(key)) return;
          cell.seen.add(key);
          const enrollment = supplyDemandEnrollment(row);
          cell.sections += 1;
          cell.seats += row.cap || 0;
          cell.enrollment += enrollment;
          cell.studentPresence += enrollment;
          cell.waitlist += row.waitlist || 0;
        });
      });
    });
    const bucketRows = [...map.values()].map(row => {
      const fillRateNumber = safeDiv(row.enrollment, row.seats);
      const emptySeats = Math.max(0, row.seats - row.enrollment);
      const out = {
        day: row.dayName,
        time: row.time,
        sections: row.sections,
        seats: row.seats,
        enrollment: row.enrollment,
        studentPresence: row.studentPresence,
        fillRate: `${(fillRateNumber * 100).toFixed(1)}%`,
        fillRateNumber,
        waitlist: row.waitlist,
        emptySeats,
        interpretation: ''
      };
      out.interpretation = supplyDemandInterpretation(out);
      out.metricValue = metricName === 'fillRate' ? fillRateNumber * 100 : out[metricName] || 0;
      return out;
    });
    return { dayKeys, dayNames, slots, rows: bucketRows };
  }

  function renderSupplyDemandHeatmap(built, metricName) {
    const node = document.getElementById('supplyDemandHeatmap');
    const view = document.getElementById('sdView')?.value || 'all';
    if (!node) return;
    node.style.display = view === 'all' || view === 'heatmap' ? '' : 'none';
    const maxValue = Math.max(0, ...built.rows.map(row => row.metricValue || 0));
    const headers = built.slots.map(minutes => `<th>${escapeAttr(formatPresenceHourLabel(minutes / 60))}</th>`).join('');
    const body = built.dayKeys.map(day => {
      const cells = built.slots.map(minutes => {
        const row = built.rows.find(item => item.day === built.dayNames[day] && item.time === formatPresenceHourLabel(minutes / 60));
        const value = row?.metricValue || 0;
        const heat = maxValue ? value / maxValue : 0;
        const level = value <= 0 ? 'empty' : heat >= 0.67 ? 'high' : heat >= 0.34 ? 'medium' : 'low';
        const display = metricName === 'fillRate' && value ? `${value.toFixed(0)}%` : Math.round(value);
        return `<td class="heatmap-cell heatmap-${level}" style="--heat:${heat.toFixed(3)}" title="${escapeAttr(`${built.dayNames[day]} ${formatPresenceHourLabel(minutes / 60)} ${display}`)}">${value ? display : ''}</td>`;
      }).join('');
      return `<tr><th>${built.dayNames[day]}</th>${cells}</tr>`;
    }).join('');
    node.innerHTML = `<section class="presence-curve"><h3>Supply vs Demand Heatmap</h3><div class="heatmap-wrap"><table class="heatmap"><thead><tr><th>Day / Time</th>${headers}</tr></thead><tbody>${body}</tbody></table></div></section>`;
  }

  function renderSupplyDemandLineGraph(built, metricName) {
    const node = document.getElementById('supplyDemandLineGraph');
    const view = document.getElementById('sdView')?.value || 'all';
    if (!node) return;
    node.style.display = view === 'all' || view === 'line' ? '' : 'none';
    const maxValue = Math.max(1, ...built.rows.map(row => row.metricValue || 0));
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const width = 920;
    const height = 320;
    const left = 48;
    const right = 16;
    const top = 20;
    const bottom = 44;
    const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2'];
    const usableWidth = width - left - right;
    const usableHeight = height - top - bottom;
    const xFor = index => left + (built.slots.length <= 1 ? 0 : index / (built.slots.length - 1) * usableWidth);
    const yFor = value => top + usableHeight - (value / maxValue * usableHeight);
    const lines = dayNames.map((day, dayIndex) => {
      const points = built.slots.map((minutes, index) => {
        const time = formatPresenceHourLabel(minutes / 60);
        const item = built.rows.find(row => row.day === day && row.time === time);
        return `${xFor(index).toFixed(1)},${yFor(item?.metricValue || 0).toFixed(1)}`;
      }).join(' ');
      return `<polyline fill="none" stroke="${colors[dayIndex]}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="${points}"></polyline>`;
    }).join('');
    const xTicks = built.slots.filter((_, index) => index % 2 === 0).map((minutes, index) => {
      const slotIndex = built.slots.indexOf(minutes);
      return `<text x="${xFor(slotIndex).toFixed(1)}" y="${height - 16}" text-anchor="middle">${escapeAttr(formatPresenceHourLabel(minutes / 60).replace(':00 ', ''))}</text>`;
    }).join('');
    const legend = dayNames.map((day, index) => `<span><i style="background:${colors[index]}"></i>${escapeAttr(day)}</span>`).join('');
    node.innerHTML = `
      <section class="presence-curve supply-demand-line">
        <h3>Supply vs Demand Line Graph</h3>
        <p>One line per day using the selected metric across half-hour intervals.</p>
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Supply vs Demand ${escapeAttr(metricName)} line graph">
          <line x1="${left}" y1="${top}" x2="${left}" y2="${height - bottom}" stroke="#cbd5e1"></line>
          <line x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}" stroke="#cbd5e1"></line>
          <text x="8" y="${top + 10}" text-anchor="start">${escapeAttr(metricName === 'fillRate' ? '100%' : String(Math.round(maxValue)))}</text>
          <text x="8" y="${height - bottom}" text-anchor="start">0</text>
          ${xTicks}
          ${lines}
        </svg>
        <div class="supply-demand-line-legend">${legend}</div>
      </section>`;
  }

  function renderSupplyDemandMetrics(rows, built) {
    const totalSections = rows.length;
    const totalSeats = sum(rows, 'cap');
    const totalEnrollment = rows.reduce((total, row) => total + supplyDemandEnrollment(row), 0);
    const totalWaitlist = sum(rows, 'waitlist');
    const highDemand = built.rows.filter(row => row.interpretation === 'High Demand').length;
    const hiddenDemand = built.rows.filter(row => row.interpretation === 'Hidden Demand').length;
    const oversupplied = built.rows.filter(row => row.interpretation === 'Oversupplied').length;
    metric('supplyDemandMetrics', [
      ['Sections', totalSections],
      ['Seats Offered', totalSeats],
      ['Enrollment', totalEnrollment],
      ['Fill Rate', `${(safeDiv(totalEnrollment, totalSeats) * 100).toFixed(1)}%`],
      ['Waitlist', totalWaitlist],
      ['High Demand Buckets', highDemand],
      ['Hidden Demand Buckets', hiddenDemand],
      ['Oversupplied Buckets', oversupplied]
    ]);
  }

  async function loadSupplyDemandRows() {
    const uploadedRows = await readCsv(document.getElementById('supplyDemandCsv'), { sourceType: 'SUPPLY_DEMAND_UPLOAD' });
    const archivedRows = await readArchivedRows('sdArchiveTerms', { reportLabel: 'Supply vs Demand' });
    state.supplyDemandRows = dedupeEnrollmentRows([...uploadedRows, ...archivedRows].map(normalize));
    updateSupplyDemandFilterOptions();
    return state.supplyDemandRows;
  }

  async function runSupplyDemand() {
    const rows = await loadSupplyDemandRows();
    const filtered = supplyDemandFilteredRows();
    const metricName = document.getElementById('sdMetric')?.value || 'sections';
    const intervalOptions = { includeOnline: includeOnlineFromSelect('sdModality') };
    const built = buildSupplyDemandBuckets(filtered, metricName, intervalOptions);
    state.supplyDemandBucketRows = built.rows;
    renderSupplyDemandMetrics(physicalIntervalRows(filtered, intervalOptions), built);
    renderSupplyDemandHeatmap(built, metricName);
    renderSupplyDemandLineGraph(built, metricName);
    const view = document.getElementById('sdView')?.value || 'all';
    const tableNode = document.getElementById('supplyDemandTable');
    if (tableNode) tableNode.style.display = view === 'all' || view === 'table' ? '' : 'none';
    table('supplyDemandTable', built.rows.filter(row => row.sections || row.seats || row.enrollment || row.waitlist), ['day', 'time', 'sections', 'seats', 'enrollment', 'studentPresence', 'fillRate', 'waitlist', 'emptySeats', 'interpretation']);
    document.getElementById('supplyDemandLegend').innerHTML = `
      <strong>Supply vs Demand Methodology</strong>
      <p>Supply is scheduled sections and seats offered. Realized demand is census enrollment when available, otherwise current enrollment, plus waitlist when present. Enrollment alone cannot demonstrate student preference because students can only enroll in sections that were offered at available times, campuses, and modalities. Hidden Demand identifies limited supply with waitlist pressure; Oversupplied identifies multiple low-filled buckets with empty seats.</p>
    `;
    const status = document.getElementById('supplyDemandStatus');
    if (status) status.textContent = `Loaded ${rows.length} row(s); ${filtered.length} row(s) match filters; ${physicalIntervalRows(filtered, intervalOptions).length} fixed physical/time-selected row(s).`;
    state.supplyDemandRan = true;
  }

  function clearSupplyDemand() {
    ['sdTerm', 'sdCampus', 'sdDivision', 'sdDepartment', 'sdCourse', 'sdCalGetc'].forEach(id => {
      const node = document.getElementById(id);
      if (node) node.value = '';
    });
    setModalitySelectValues('sdModality', PHYSICAL_MODALITY_LABELS);
    const metricSelect = document.getElementById('sdMetric');
    const viewSelect = document.getElementById('sdView');
    if (metricSelect) metricSelect.value = 'sections';
    if (viewSelect) viewSelect.value = 'all';
    if (state.supplyDemandRows.length) runSupplyDemand().catch(err => console.warn(err));
  }

  function updateBusyTimeFilterOptions() {
    const rows = state.busyTimeRows || [];
    setFacultyFilterOptions('busyTimeTerm', rows.map(row => row.term), 'All terms');
    setFacultyFilterOptions('busyTimeCampus', rows.map(row => row.campus), 'All campuses');
    setFacultyFilterOptions('busyTimeDivision', rows.map(row => row.division), 'All divisions');
    const division = document.getElementById('busyTimeDivision')?.value || '';
    const departmentSource = division ? rows.filter(row => row.division === division) : rows;
    setFacultyFilterOptions('busyTimeDepartment', departmentSource.map(row => row.department), 'All departments');
    const department = document.getElementById('busyTimeDepartment')?.value || '';
    const courseSource = department ? departmentSource.filter(row => row.department === department) : departmentSource;
    setFacultyFilterOptions('busyTimeCourse', courseSource.map(calGetcCourseCode), 'All courses');
    setModalitySelectOptions('busyTimeModality', PHYSICAL_MODALITY_LABELS);
  }

  function busyTimeFilteredRows() {
    const term = document.getElementById('busyTimeTerm')?.value || '';
    const campus = document.getElementById('busyTimeCampus')?.value || '';
    const division = document.getElementById('busyTimeDivision')?.value || '';
    const department = document.getElementById('busyTimeDepartment')?.value || '';
    const course = document.getElementById('busyTimeCourse')?.value || '';
    return (state.busyTimeRows || [])
      .filter(row => !row.isWorkExperience && !isOmittedInstructionalMethod(row))
      .filter(row => {
        if (term && row.term !== term) return false;
        if (campus && row.campus !== campus) return false;
        if (division && row.division !== division) return false;
        if (department && row.department !== department) return false;
        if (course && calGetcCourseCode(row) !== course) return false;
        if (!rowMatchesSelectedModality(row, 'busyTimeModality', PHYSICAL_MODALITY_LABELS)) return false;
        return true;
      });
  }

  function busyTimeFacultyRowsForScope() {
    const term = document.getElementById('busyTimeTerm')?.value || '';
    const campus = document.getElementById('busyTimeCampus')?.value || '';
    const division = document.getElementById('busyTimeDivision')?.value || '';
    const department = document.getElementById('busyTimeDepartment')?.value || '';
    const course = document.getElementById('busyTimeCourse')?.value || '';
    return reportableFacultyRows(state.busyTimeFacultyRows?.length ? state.busyTimeFacultyRows : state.facultyHeatmapRows || [])
      .filter(row => {
        if (!facultyMatchesSelectedModality(row, 'busyTimeModality', PHYSICAL_MODALITY_LABELS)) return false;
        if (term && facultyTerm(row) !== term) return false;
        if (campus && row.campus !== campus) return false;
        if (division && row.divisionId !== division) return false;
        if (department && row.departmentId !== department) return false;
        if (course && facultyCourseValue(row) !== course) return false;
        return true;
      });
  }

  function busyTimeEnrollment(row) {
    return row.census == null ? row.actual || 0 : row.census || 0;
  }

  function busyTimeFixedRows(rows, options = {}) {
    return physicalIntervalRows(rows, options);
  }

  function buildBusyTimeBuckets(rows, options = {}) {
    const dayKeys = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const dayNames = { SU: 'Sunday', MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday', FR: 'Friday', SA: 'Saturday' };
    const fixedRows = busyTimeFixedRows(rows, options);
    const slots = supplyDemandSlots(fixedRows);
    const map = new Map();
    dayKeys.forEach(day => {
      slots.forEach(minutes => map.set(`${day}|${minutes}`, {
        key: `${day}|${minutes}`,
        day,
        dayName: dayNames[day],
        minutes,
        time: formatPresenceHourLabel(minutes / 60),
        sections: 0,
        seats: 0,
        enrollment: 0,
        studentPresence: 0,
        waitlist: 0,
        emptySeats: 0,
        roomMinutes: 0,
        seen: new Set()
      }));
    });
    fixedRows.forEach(row => {
      const start = minutesFromTime(row.start);
      const end = minutesFromTime(row.end);
      row.days.forEach(day => {
        slots.forEach(minutes => {
          if (end <= minutes || start >= minutes + 30) return;
          const cell = map.get(`${day}|${minutes}`);
          if (!cell) return;
          const key = [row.term, sectionKey(row), day, row.start, row.end].join('|');
          if (cell.seen.has(key)) return;
          cell.seen.add(key);
          const enrollment = busyTimeEnrollment(row);
          const seats = row.cap || 0;
          cell.sections += 1;
          cell.seats += seats;
          cell.enrollment += enrollment;
          cell.studentPresence += enrollment;
          cell.waitlist += row.waitlist || 0;
          cell.emptySeats += Math.max(0, seats - enrollment);
          cell.roomMinutes += Math.min(end, minutes + 30) - Math.max(start, minutes);
        });
      });
    });
    return [...map.values()].map(row => ({
      ...row,
      fillRateNumber: safeDiv(row.enrollment, row.seats),
      fillRate: `${(safeDiv(row.enrollment, row.seats) * 100).toFixed(1)}%`
    }));
  }

  function buildBusyTimeFacultyBuckets(rows, slots) {
    if (window.COSFacultyModel?.buildBusyTimeFacultyBuckets) {
      return window.COSFacultyModel.buildBusyTimeFacultyBuckets(rows, slots);
    }
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
          if (end <= minutes || start >= minutes + 30) return;
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

  function busyTimePrimeRows(bucketRows) {
    return (bucketRows || []).filter(row => ['MO', 'TU', 'WE', 'TH'].includes(row.day) && row.minutes >= 9 * 60 && row.minutes < 15 * 60);
  }

  function busyTimePeak(rows, field) {
    return (rows || []).slice().sort((a, b) => (b[field] || 0) - (a[field] || 0))[0] || null;
  }

  function busyTimeCellLabel(cell, field = 'studentPresence') {
    if (!cell || !(cell[field] || 0)) return 'N/A';
    return `${cell.dayName || cell.day} ${cell.time || formatPresenceHourLabel(cell.minutes / 60)} (${Math.round(cell[field] || 0)})`;
  }

  function busyTimeConcentration(rows, field) {
    const total = (rows || []).reduce((sumTotal, row) => sumTotal + (row[field] || 0), 0);
    if (!total) return 0;
    const peak = Math.max(0, ...(rows || []).map(row => row[field] || 0));
    return peak / total;
  }

  function busyTimeDurationRows(rows, options = {}) {
    const buckets = new Map();
    busyTimeFixedRows(rows, options).forEach(row => {
      const start = minutesFromTime(row.start);
      const end = minutesFromTime(row.end);
      const minutes = end - start;
      const label = minutes < 60 ? '< 1 hr' : minutes < 90 ? '1-1.5 hrs' : minutes < 150 ? '1.5-2.5 hrs' : minutes < 210 ? '2.5-3.5 hrs' : '3.5+ hrs';
      const key = [sectionKey(row), row.start, row.end, row.dayPattern].join('|');
      if (!buckets.has(label)) buckets.set(label, { duration: label, courses: 0, enrollment: 0, seen: new Set() });
      const bucket = buckets.get(label);
      if (bucket.seen.has(key)) return;
      bucket.seen.add(key);
      bucket.courses += 1;
      bucket.enrollment += busyTimeEnrollment(row);
    });
    return [...buckets.values()].map(row => ({ duration: row.duration, courses: row.courses, enrollment: row.enrollment }));
  }

  function busyTimeRoomUtilization(rows, options = {}) {
    const rooms = new Map();
    busyTimeFixedRows(rows, options).forEach(row => {
      const room = [row.campus, row.building, row.roomOnly || row.room].filter(Boolean).join(' / ') || 'Unassigned';
      if (!rooms.has(room)) rooms.set(room, { room, minutes: 0, meetings: new Set() });
      const bucket = rooms.get(room);
      const start = minutesFromTime(row.start);
      const end = minutesFromTime(row.end);
      (row.days || []).forEach(day => {
        const key = [sectionKey(row), day, row.start, row.end].join('|');
        if (bucket.meetings.has(key)) return;
        bucket.meetings.add(key);
        bucket.minutes += end - start;
      });
    });
    const availableMinutes = Math.max(1, rooms.size * 5 * 16 * 60);
    const scheduledMinutes = [...rooms.values()].reduce((total, row) => total + row.minutes, 0);
    return { rooms: rooms.size, scheduledHours: scheduledMinutes / 60, utilization: scheduledMinutes / availableMinutes };
  }

  function busyTimeObservationRows(metrics) {
    const rows = [];
    if (metrics.supplyPeak && metrics.studentPeak && metrics.supplyPeak.key === metrics.studentPeak.key) {
      rows.push('High enrollment appears to coincide with high section supply.');
    }
    if (metrics.eveningFillRate >= 0.8 && metrics.eveningSections < metrics.daySections * 0.35) {
      rows.push('Evening sections have limited supply but consistently high fill.');
    }
    if (metrics.facultyFtPeak && metrics.facultyFtPeak.minutes >= 9 * 60 && metrics.facultyFtPeak.minutes <= 14 * 60) {
      rows.push('Full-time faculty are concentrated between 9 AM and 2 PM.');
    }
    if (metrics.afterFourPresenceShare >= 0.15) {
      rows.push('Student demand remains strong after 4 PM.');
    }
    if (!rows.length) rows.push('No dominant busy-time pattern stands out in the current filtered data.');
    return rows;
  }

  function renderBusyTimeCharts(bucketRows, durationRows, facultyBuckets) {
    const node = document.getElementById('busyTimeCharts');
    if (!node) return;
    const topStudentRows = bucketRows.filter(row => row.studentPresence).slice().sort((a, b) => b.studentPresence - a.studentPresence).slice(0, 8);
    const maxPresence = Math.max(1, ...topStudentRows.map(row => row.studentPresence || 0));
    const presenceBars = topStudentRows.map(row => `
      <div class="busy-time-bar-row"><span>${escapeAttr(`${row.dayName} ${row.time}`)}</span><div><i style="width:${((row.studentPresence || 0) / maxPresence * 100).toFixed(1)}%"></i></div><strong>${Math.round(row.studentPresence || 0)}</strong></div>`).join('');
    const maxDuration = Math.max(1, ...durationRows.map(row => row.courses || 0));
    const durationBars = durationRows.map(row => `
      <div class="busy-time-bar-row"><span>${escapeAttr(row.duration)}</span><div><i style="width:${((row.courses || 0) / maxDuration * 100).toFixed(1)}%"></i></div><strong>${row.courses}</strong></div>`).join('');
    const facultyPeakRows = facultyBuckets.filter(row => row.total).slice().sort((a, b) => b.total - a.total).slice(0, 8);
    const maxFaculty = Math.max(1, ...facultyPeakRows.map(row => row.total || 0));
    const facultyBars = facultyPeakRows.map(row => `
      <div class="busy-time-bar-row"><span>${escapeAttr(`${row.day} ${formatPresenceHourLabel(row.minutes / 60)}`)}</span><div><i style="width:${((row.total || 0) / maxFaculty * 100).toFixed(1)}%"></i></div><strong>${row.total}</strong></div>`).join('');
    node.innerHTML = `
      <section><h3>Student Presence Peaks</h3>${presenceBars || '<p class="analytics-empty">No student presence buckets.</p>'}</section>
      <section><h3>Course Duration Mix</h3>${durationBars || '<p class="analytics-empty">No fixed-duration courses.</p>'}</section>
      <section><h3>Faculty Concentration Peaks</h3>${facultyBars || '<p class="analytics-empty">No faculty rows loaded.</p>'}</section>
    `;
  }

  function renderBusyTimeDashboard() {
    const sourceRows = state.busyTimeRows || [];
    const rows = busyTimeFilteredRows();
    const facultyRows = busyTimeFacultyRowsForScope();
    const intervalOptions = { includeOnline: includeOnlineFromSelect('busyTimeModality') };
    const bucketRows = buildBusyTimeBuckets(rows, intervalOptions);
    const slots = supplyDemandSlots(busyTimeFixedRows(rows, intervalOptions));
    const facultyBuckets = buildBusyTimeFacultyBuckets(facultyRows, slots);
    const primeRows = busyTimePrimeRows(bucketRows);
    const primePresence = primeRows.reduce((total, row) => total + row.studentPresence, 0);
    const allPresence = bucketRows.reduce((total, row) => total + row.studentPresence, 0);
    const seats = bucketRows.reduce((total, row) => total + row.seats, 0);
    const enrollment = bucketRows.reduce((total, row) => total + row.enrollment, 0);
    const waitlist = bucketRows.reduce((total, row) => total + row.waitlist, 0);
    const eveningRows = bucketRows.filter(row => row.minutes >= 16 * 60);
    const dayRows = bucketRows.filter(row => row.minutes >= 8 * 60 && row.minutes < 16 * 60);
    const eveningSeats = eveningRows.reduce((total, row) => total + row.seats, 0);
    const eveningEnrollment = eveningRows.reduce((total, row) => total + row.enrollment, 0);
    const roomUse = busyTimeRoomUtilization(rows, intervalOptions);
    const metrics = {
      studentPeak: busyTimePeak(bucketRows, 'studentPresence'),
      supplyPeak: busyTimePeak(bucketRows, 'sections'),
      facultyFtPeak: busyTimePeak(facultyBuckets, 'fullTime'),
      eveningFillRate: safeDiv(eveningEnrollment, eveningSeats),
      eveningSections: eveningRows.reduce((total, row) => total + row.sections, 0),
      daySections: dayRows.reduce((total, row) => total + row.sections, 0),
      afterFourPresenceShare: safeDiv(eveningRows.reduce((total, row) => total + row.studentPresence, 0), allPresence)
    };
    const primeScore = safeDiv(primePresence, allPresence);
    const facultyConcentration = busyTimeConcentration(facultyBuckets, 'total');
    const studentConcentration = busyTimeConcentration(bucketRows, 'studentPresence');
    const demandPressure = safeDiv(enrollment + waitlist, seats);
    metric('busyTimeMetrics', [
      ['Prime Time Score', `${(primeScore * 100).toFixed(1)}%`],
      ['Faculty Concentration', `${(facultyConcentration * 100).toFixed(1)}%`],
      ['Student Concentration', `${(studentConcentration * 100).toFixed(1)}%`],
      ['Seat Supply', seats],
      ['Demand Pressure', `${(demandPressure * 100).toFixed(1)}%`],
      ['Room Utilization', `${(roomUse.utilization * 100).toFixed(1)}%`],
      ['Peak Student Time', busyTimeCellLabel(metrics.studentPeak, 'studentPresence')],
      ['Peak Section Supply', busyTimeCellLabel(metrics.supplyPeak, 'sections')]
    ]);
    const durationRows = busyTimeDurationRows(rows, intervalOptions);
    renderBusyTimeCharts(bucketRows, durationRows, facultyBuckets);
    document.getElementById('busyTimeObservations').innerHTML = `
      <strong>Observations</strong>
      <ul>${busyTimeObservationRows(metrics).map(item => `<li>${escapeAttr(item)}</li>`).join('')}</ul>
      <p>These are descriptive summaries only. They do not recommend adding, moving, or canceling sections.</p>
    `;
    state.busyTimeTableRows = bucketRows
      .filter(row => row.sections || row.studentPresence || row.seats || row.waitlist)
      .map(row => ({
        day: row.dayName,
        time: row.time,
        sections: row.sections,
        seats: row.seats,
        enrollment: row.enrollment,
        studentPresence: row.studentPresence,
        fillRate: row.fillRate,
        waitlist: row.waitlist,
        emptySeats: row.emptySeats
      }));
    table('busyTimeTable', state.busyTimeTableRows, ['day', 'time', 'sections', 'seats', 'enrollment', 'studentPresence', 'fillRate', 'waitlist', 'emptySeats']);
    document.getElementById('busyTimeLegend').innerHTML = `
      <strong>Busy Time Dashboard Methodology</strong>
      <p>Student Presence and Supply vs Demand use half-hour buckets from fixed meeting rows. Course Duration groups fixed meetings by length. Faculty Concentration uses Faculty Schedule rows by half-hour bucket. Prime Time Score is the share of student presence occurring Monday-Thursday from 9:00 AM-3:00 PM. Demand Pressure = (enrollment + waitlist) / seats. Room Utilization is scheduled room time divided by a standard weekday instructional-room availability window.</p>
    `;
    const status = document.getElementById('busyTimeStatus');
    if (status) status.textContent = `Loaded ${sourceRows.length} schedule row(s); ${rows.length} row(s) match filters; ${facultyRows.length || 0} faculty row(s).`;
    state.busyTimeRan = true;
  }

  async function loadBusyTimeDashboardRows() {
    const uploadedRows = await readCsv(document.getElementById('busyTimeCsv'), { sourceType: 'BUSY_TIME_UPLOAD' });
    const archivedRows = await readArchivedRows('busyTimeArchiveTerms', { reportLabel: 'Busy Time Dashboard' });
    state.busyTimeRows = dedupeEnrollmentRows([...uploadedRows, ...archivedRows].map(normalize));
    const facultyInput = document.getElementById('busyTimeFacultyCsv');
    state.busyTimeFacultyRows = facultyInput?.files?.length ? await readFacultyScheduleFiles(facultyInput) : [];
    updateBusyTimeFilterOptions();
  }

  async function runBusyTimeDashboard() {
    await loadBusyTimeDashboardRows();
    renderBusyTimeDashboard();
  }

  function clearBusyTimeDashboard() {
    ['busyTimeTerm', 'busyTimeCampus', 'busyTimeDivision', 'busyTimeDepartment', 'busyTimeCourse'].forEach(id => {
      const node = document.getElementById(id);
      if (node) node.value = '';
    });
    setModalitySelectValues('busyTimeModality', PHYSICAL_MODALITY_LABELS);
    if (state.busyTimeRows.length) renderBusyTimeDashboard();
  }

  function studentChoiceCalGetcCodes() {
    return new Set(normalizedCalGetcRows().map(row => row.code));
  }

  function studentChoiceMatchesCalGetc(row) {
    const selected = document.getElementById('studentChoiceCalGetc')?.value || '';
    if (!selected) return true;
    const courseCode = calGetcCourseCode(row);
    const mappings = normalizedCalGetcRows().filter(item => item.code === courseCode);
    if (selected.startsWith('COURSE:')) return courseCode === selected.slice(7);
    if (selected.startsWith('AREA:')) return mappings.some(item => item.areas.includes(selected.slice(5)));
    if (selected.startsWith('DIVISION:')) return mappings.some(item => item.divisions.includes(selected.slice(9)));
    return true;
  }

  function setStudentChoiceCalGetcOptions() {
    const select = document.getElementById('studentChoiceCalGetc');
    if (!select) return;
    const previous = select.value;
    const rows = normalizedCalGetcRows();
    const options = [{ value: '', label: 'All CAL-GETC' }];
    const areas = new Set();
    const divisions = new Set();
    rows.forEach(row => {
      row.areas.forEach(area => areas.add(area));
      row.divisions.forEach(division => divisions.add(division));
    });
    [...areas].sort().forEach(area => options.push({ value: `AREA:${area}`, label: `Area: ${area}` }));
    [...divisions].sort().forEach(division => options.push({ value: `DIVISION:${division}`, label: `Division: ${division}` }));
    rows.map(row => row.code).sort().forEach(code => options.push({ value: `COURSE:${code}`, label: code }));
    select.replaceChildren();
    options.forEach(option => select.appendChild(new Option(option.label, option.value, false, option.value === previous)));
    if (options.some(option => option.value === previous)) select.value = previous;
  }

  function updateStudentChoiceFilterOptions() {
    const rows = state.studentChoiceRows || [];
    setFacultyFilterOptions('studentChoiceTerm', rows.map(row => row.term), 'All terms');
    setFacultyFilterOptions('studentChoiceCampus', rows.map(row => row.campus), 'All campuses');
    setFacultyFilterOptions('studentChoiceDivision', rows.map(row => row.division), 'All divisions');
    const division = document.getElementById('studentChoiceDivision')?.value || '';
    const departmentSource = division ? rows.filter(row => row.division === division) : rows;
    setFacultyFilterOptions('studentChoiceDepartment', departmentSource.map(row => row.department), 'All departments');
    const department = document.getElementById('studentChoiceDepartment')?.value || '';
    const disciplineSource = department ? departmentSource.filter(row => row.department === department) : departmentSource;
    setFacultyFilterOptions('studentChoiceDiscipline', disciplineSource.map(row => row.subject), 'All disciplines');
    const discipline = document.getElementById('studentChoiceDiscipline')?.value || '';
    const courseSource = discipline ? disciplineSource.filter(row => row.subject === discipline) : disciplineSource;
    setFacultyFilterOptions('studentChoiceCourse', courseSource.map(calGetcCourseCode), 'All courses');
    setModalitySelectOptions('studentChoiceModality', PHYSICAL_MODALITY_LABELS);
    const facultyRows = reportableFacultyRows(state.studentChoiceFacultyRows?.length ? state.studentChoiceFacultyRows : state.facultyHeatmapRows || []);
    setFacultyFilterOptions('studentChoiceFacultyType', facultyRows.map(row => row.facultyType).filter(Boolean), 'All faculty types');
    setStudentChoiceCalGetcOptions();
  }

  function studentChoiceFacultyCrns() {
    const selected = document.getElementById('studentChoiceFacultyType')?.value || '';
    const facultyRows = reportableFacultyRows(state.studentChoiceFacultyRows?.length ? state.studentChoiceFacultyRows : state.facultyHeatmapRows || []);
    if (!selected || !facultyRows.length) return null;
    if (window.COSFacultyModel?.facultyCrnsByType) return window.COSFacultyModel.facultyCrnsByType(facultyRows, selected);
    return new Set(facultyRows.filter(row => row.facultyType === selected).map(row => canon(row.crn)).filter(Boolean));
  }

  function studentChoiceFilteredRows() {
    const term = document.getElementById('studentChoiceTerm')?.value || '';
    const campus = document.getElementById('studentChoiceCampus')?.value || '';
    const division = document.getElementById('studentChoiceDivision')?.value || '';
    const department = document.getElementById('studentChoiceDepartment')?.value || '';
    const discipline = document.getElementById('studentChoiceDiscipline')?.value || '';
    const course = document.getElementById('studentChoiceCourse')?.value || '';
    const facultyCrns = studentChoiceFacultyCrns();
    const excludeTutoring = document.getElementById('studentChoiceExcludeTutoring')?.checked !== false;
    return (state.studentChoiceRows || [])
      .filter(row => !row.isWorkExperience && !isOmittedInstructionalMethod(row))
      .filter(row => !(excludeTutoring && isTutoringOpenLabSection(row)))
      .filter(row => {
        if (term && row.term !== term) return false;
        if (campus && row.campus !== campus) return false;
        if (division && row.division !== division) return false;
        if (department && row.department !== department) return false;
        if (discipline && row.subject !== discipline) return false;
        if (course && calGetcCourseCode(row) !== course) return false;
        if (!rowMatchesSelectedModality(row, 'studentChoiceModality', PHYSICAL_MODALITY_LABELS)) return false;
        if (facultyCrns && !facultyCrns.has(canon(row.crn))) return false;
        if (!studentChoiceMatchesCalGetc(row)) return false;
        return true;
      });
  }

  function studentChoiceMetricValue(row, metricName) {
    if (metricName === 'uniqueCourses') return row.uniqueCourses;
    if (metricName === 'uniqueCalGetcCourses') return row.uniqueCalGetcCourses;
    if (metricName === 'fillRate') return row.fillRateNumber * 100;
    return row[metricName] || 0;
  }

  function studentChoiceInterpretation(row) {
    const highChoice = (row.uniqueCourses || 0) >= 5 || (row.seats || 0) >= 150;
    const highDemand = (row.fillRateNumber || 0) >= 0.85 || (row.waitlist || 0) > 0;
    const weakDemand = (row.fillRateNumber || 0) < 0.55 && (row.emptySeats || 0) > 0;
    if (highChoice && highDemand) return 'High choice / high demand';
    if (highChoice && weakDemand) return 'High choice / weaker demand';
    if (!highChoice && highDemand) return 'Low choice / high demand';
    if (!highChoice && (row.sections || 0) <= 1 && (row.enrollment || 0) <= 0) return 'Low choice / limited evidence';
    return 'Low choice / low demand';
  }

  function buildStudentChoiceBuckets(rows, metricName = 'uniqueCourses', options = {}) {
    const dayKeys = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const dayNames = { SU: 'Sunday', MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday', FR: 'Friday', SA: 'Saturday' };
    const fixedRows = busyTimeFixedRows(rows, options);
    const slots = supplyDemandSlots(fixedRows);
    const calGetcCodes = studentChoiceCalGetcCodes();
    const map = new Map();
    dayKeys.forEach(day => slots.forEach(minutes => map.set(`${day}|${minutes}`, {
      key: `${day}|${minutes}`,
      day,
      dayName: dayNames[day],
      minutes,
      time: formatPresenceHourLabel(minutes / 60),
      courses: new Set(),
      subjects: new Set(),
      calGetcCourses: new Set(),
      modalities: new Set(),
      campuses: new Set(),
      crns: new Set(),
      seats: 0,
      enrollment: 0,
      studentPresence: 0,
      waitlist: 0,
      seen: new Set()
    })));
    fixedRows.forEach(row => {
      const start = minutesFromTime(row.start);
      const end = minutesFromTime(row.end);
      if (start == null || end == null || end <= start) return;
      const courseCode = calGetcCourseCode(row);
      row.days.forEach(day => {
        slots.forEach(minutes => {
          if (end <= minutes || start >= minutes + 30) return;
          const cell = map.get(`${day}|${minutes}`);
          if (!cell) return;
          const key = [row.term, sectionKey(row), day, row.start, row.end].join('|');
          if (cell.seen.has(key)) return;
          cell.seen.add(key);
          cell.courses.add(courseCode);
          cell.subjects.add(canon(row.subject));
          if (calGetcCodes.has(courseCode)) cell.calGetcCourses.add(courseCode);
          if (row.modality) cell.modalities.add(row.modality);
          if (row.campus) cell.campuses.add(row.campus);
          cell.crns.add(sectionKey(row));
          const enrollment = busyTimeEnrollment(row);
          const seats = row.cap || 0;
          cell.seats += seats;
          cell.enrollment += enrollment;
          cell.studentPresence += enrollment;
          cell.waitlist += row.waitlist || 0;
        });
      });
    });
    return [...map.values()].map(cell => {
      const fillRateNumber = safeDiv(cell.enrollment, cell.seats);
      const row = {
        key: cell.key,
        day: cell.dayName,
        dayCode: cell.day,
        timeBlock: cell.time,
        minutes: cell.minutes,
        uniqueCourses: cell.courses.size,
        uniqueSubjects: cell.subjects.size,
        uniqueCalGetcCourses: cell.calGetcCourses.size,
        sections: cell.crns.size,
        seats: cell.seats,
        enrollment: cell.enrollment,
        studentPresence: cell.studentPresence,
        fillRate: `${(fillRateNumber * 100).toFixed(1)}%`,
        fillRateNumber,
        emptySeats: Math.max(0, cell.seats - cell.enrollment),
        waitlist: cell.waitlist,
        courseChoiceCount: cell.courses.size,
        geChoiceCount: cell.calGetcCourses.size,
        subjectBreadthCount: cell.subjects.size,
        seatChoiceCount: cell.seats,
        modalityChoiceCount: cell.modalities.size,
        campusChoiceCount: cell.campuses.size,
        metricValue: 0,
        interpretation: ''
      };
      row.metricValue = studentChoiceMetricValue(row, metricName);
      row.interpretation = studentChoiceInterpretation(row);
      return row;
    });
  }

  function renderStudentChoiceHeatmap(rows, metricName) {
    const node = document.getElementById('studentChoiceHeatmap');
    const view = document.getElementById('studentChoiceView')?.value || 'all';
    if (!node) return;
    node.style.display = view === 'all' || view === 'heatmap' ? '' : 'none';
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const slots = [...new Set(rows.map(row => row.minutes))].sort((a, b) => a - b);
    const maxValue = Math.max(0, ...rows.map(row => row.metricValue || 0));
    const headers = slots.map(minutes => `<th>${escapeAttr(formatPresenceHourLabel(minutes / 60))}</th>`).join('');
    const body = dayNames.map(day => {
      const cells = slots.map(minutes => {
        const row = rows.find(item => item.day === day && item.minutes === minutes);
        const value = row?.metricValue || 0;
        const heat = maxValue ? value / maxValue : 0;
        const level = value <= 0 ? 'empty' : heat >= 0.67 ? 'high' : heat >= 0.34 ? 'medium' : 'low';
        const display = metricName === 'fillRate' && value ? `${value.toFixed(0)}%` : Math.round(value);
        return `<td class="heatmap-cell heatmap-${level}" style="--heat:${heat.toFixed(3)}" title="${escapeAttr(`${day} ${formatPresenceHourLabel(minutes / 60)} ${display}`)}">${value ? display : ''}</td>`;
      }).join('');
      return `<tr><th>${day}</th>${cells}</tr>`;
    }).join('');
    node.innerHTML = `<section class="presence-curve"><h3>Student Choice Heatmap</h3><div class="heatmap-wrap"><table class="heatmap"><thead><tr><th>Day / Time</th>${headers}</tr></thead><tbody>${body}</tbody></table></div></section>`;
  }

  function renderStudentChoiceLineGraph(rows, metricName) {
    const node = document.getElementById('studentChoiceLineGraph');
    const view = document.getElementById('studentChoiceView')?.value || 'all';
    if (!node) return;
    node.style.display = view === 'all' || view === 'line' ? '' : 'none';
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const slots = [...new Set(rows.map(row => row.minutes))].sort((a, b) => a - b);
    const maxValue = Math.max(1, ...rows.map(row => row.metricValue || 0));
    const width = 920;
    const height = 320;
    const left = 48;
    const right = 16;
    const top = 20;
    const bottom = 44;
    const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2'];
    const usableWidth = width - left - right;
    const usableHeight = height - top - bottom;
    const xFor = index => left + (slots.length <= 1 ? 0 : index / (slots.length - 1) * usableWidth);
    const yFor = value => top + usableHeight - (value / maxValue * usableHeight);
    const lines = dayNames.map((day, dayIndex) => {
      const points = slots.map((minutes, index) => {
        const item = rows.find(row => row.day === day && row.minutes === minutes);
        return `${xFor(index).toFixed(1)},${yFor(item?.metricValue || 0).toFixed(1)}`;
      }).join(' ');
      return `<polyline fill="none" stroke="${colors[dayIndex]}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="${points}"></polyline>`;
    }).join('');
    const xTicks = slots.filter((_, index) => index % 2 === 0).map(minutes => {
      const slotIndex = slots.indexOf(minutes);
      return `<text x="${xFor(slotIndex).toFixed(1)}" y="${height - 16}" text-anchor="middle">${escapeAttr(formatPresenceHourLabel(minutes / 60).replace(':00 ', ''))}</text>`;
    }).join('');
    const legend = dayNames.map((day, index) => `<span><i style="background:${colors[index]}"></i>${escapeAttr(day)}</span>`).join('');
    node.innerHTML = `
      <section class="presence-curve supply-demand-line">
        <h3>Student Choice Line Graph</h3>
        <p>One line per day using the selected student choice metric.</p>
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Student Choice ${escapeAttr(metricName)} line graph">
          <line x1="${left}" y1="${top}" x2="${left}" y2="${height - bottom}" stroke="#cbd5e1"></line>
          <line x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}" stroke="#cbd5e1"></line>
          <text x="8" y="${top + 10}" text-anchor="start">${escapeAttr(metricName === 'fillRate' ? '100%' : String(Math.round(maxValue)))}</text>
          <text x="8" y="${height - bottom}" text-anchor="start">0</text>
          ${xTicks}
          ${lines}
        </svg>
        <div class="supply-demand-line-legend">${legend}</div>
      </section>`;
  }

  function renderStudentChoiceOpportunity() {
    const rows = studentChoiceFilteredRows();
    const metricName = document.getElementById('studentChoiceMetric')?.value || 'uniqueCourses';
    const buckets = buildStudentChoiceBuckets(rows, metricName, { includeOnline: includeOnlineFromSelect('studentChoiceModality') });
    state.studentChoiceBucketRows = buckets;
    const nonEmpty = buckets.filter(row => row.sections || row.seats || row.enrollment || row.waitlist);
    const highChoice = nonEmpty.filter(row => row.interpretation.startsWith('High choice')).length;
    const lowChoiceHighDemand = nonEmpty.filter(row => row.interpretation === 'Low choice / high demand').length;
    const totalSeats = nonEmpty.reduce((total, row) => total + row.seats, 0);
    const totalEnrollment = nonEmpty.reduce((total, row) => total + row.enrollment, 0);
    metric('studentChoiceMetrics', [
      ['Course Choice Count', Math.max(0, ...nonEmpty.map(row => row.courseChoiceCount || 0))],
      ['GE Choice Count', Math.max(0, ...nonEmpty.map(row => row.geChoiceCount || 0))],
      ['Subject Breadth Count', Math.max(0, ...nonEmpty.map(row => row.subjectBreadthCount || 0))],
      ['Seat Choice Count', totalSeats],
      ['Modality Choice Count', Math.max(0, ...nonEmpty.map(row => row.modalityChoiceCount || 0))],
      ['Campus Choice Count', Math.max(0, ...nonEmpty.map(row => row.campusChoiceCount || 0))],
      ['High Choice Blocks', highChoice],
      ['Low Choice / High Demand', lowChoiceHighDemand]
    ]);
    renderStudentChoiceHeatmap(buckets, metricName);
    renderStudentChoiceLineGraph(buckets, metricName);
    const view = document.getElementById('studentChoiceView')?.value || 'all';
    const tableNode = document.getElementById('studentChoiceTable');
    if (tableNode) tableNode.style.display = view === 'all' || view === 'table' ? '' : 'none';
    const tableRows = nonEmpty.map(row => ({
      day: row.day,
      timeBlock: row.timeBlock,
      uniqueCourses: row.uniqueCourses,
      uniqueSubjects: row.uniqueSubjects,
      uniqueCalGetcCourses: row.uniqueCalGetcCourses,
      sections: row.sections,
      seats: row.seats,
      enrollment: row.enrollment,
      fillRate: row.fillRate,
      emptySeats: row.emptySeats,
      waitlist: row.waitlist,
      interpretation: row.interpretation
    }));
    table('studentChoiceTable', tableRows, ['day', 'timeBlock', 'uniqueCourses', 'uniqueSubjects', 'uniqueCalGetcCourses', 'sections', 'seats', 'enrollment', 'fillRate', 'emptySeats', 'waitlist', 'interpretation']);
    document.getElementById('studentChoiceLegend').innerHTML = `
      <strong>Student Choice Opportunity Methodology</strong>
      <p>This report measures student schedule opportunity. Enrollment alone does not show whether students had meaningful choices. A time block may fill well because students prefer that time, or because very few alternatives exist. This report compares course variety, seat availability, and enrollment pressure across the day.</p>
      <p>Fixed meeting rows are placed into every half-hour interval they overlap. Duplicate rows for the same CRN, day, start, and end are counted once per bucket. Online/TBA rows are excluded from physical time buckets. Tutoring/Open Lab sections are excluded by default when the checkbox is selected.</p>
    `;
    const status = document.getElementById('studentChoiceStatus');
    if (status) status.textContent = `Loaded ${state.studentChoiceRows.length} row(s); ${rows.length} row(s) match filters; ${nonEmpty.length} active time block(s).`;
    state.studentChoiceRan = true;
  }

  async function loadStudentChoiceRows() {
    const uploadedRows = await readCsv(document.getElementById('studentChoiceCsv'), { sourceType: 'STUDENT_CHOICE_UPLOAD' });
    const archivedRows = await readArchivedRows('studentChoiceArchiveTerms', { reportLabel: 'Student Choice Opportunity' });
    state.studentChoiceRows = dedupeEnrollmentRows([...uploadedRows, ...archivedRows].map(normalize));
    const facultyInput = document.getElementById('studentChoiceFacultyCsv');
    state.studentChoiceFacultyRows = facultyInput?.files?.length ? await readFacultyScheduleFiles(facultyInput) : [];
    updateStudentChoiceFilterOptions();
  }

  async function runStudentChoiceOpportunity() {
    await loadStudentChoiceRows();
    renderStudentChoiceOpportunity();
  }

  function clearStudentChoiceOpportunity() {
    ['studentChoiceView', 'studentChoiceMetric', 'studentChoiceTerm', 'studentChoiceCampus', 'studentChoiceDivision', 'studentChoiceDepartment', 'studentChoiceDiscipline', 'studentChoiceCourse', 'studentChoiceCalGetc', 'studentChoiceFacultyType'].forEach(id => {
      const node = document.getElementById(id);
      if (node) node.value = '';
    });
    setModalitySelectValues('studentChoiceModality', PHYSICAL_MODALITY_LABELS);
    const metricSelect = document.getElementById('studentChoiceMetric');
    const viewSelect = document.getElementById('studentChoiceView');
    const exclude = document.getElementById('studentChoiceExcludeTutoring');
    if (metricSelect) metricSelect.value = 'uniqueCourses';
    if (viewSelect) viewSelect.value = 'all';
    if (exclude) exclude.checked = true;
    if (state.studentChoiceRows.length) renderStudentChoiceOpportunity();
  }

  const recommendationCategories = [
    'Hidden Demand',
    'Oversupply',
    'Choice Gap',
    'Faculty Concentration',
    'Room Opportunity',
    'Modality Imbalance',
    'Consolidation Candidate',
    'Expansion Candidate',
    'Insufficient evidence'
  ];

  function updateRecommendationFilterOptions() {
    const rows = state.recommendationRows || [];
    setFacultyFilterOptions('recommendationCategory', recommendationCategories, 'All categories');
    setFacultyFilterOptions('recommendationConfidence', ['High', 'Medium', 'Low'], 'All confidence');
    setFacultyFilterOptions('recommendationTerm', rows.map(row => row.term), 'All terms');
    setFacultyFilterOptions('recommendationCampus', rows.map(row => row.campus), 'All campuses');
    setFacultyFilterOptions('recommendationDivision', rows.map(row => row.division), 'All divisions');
    const division = document.getElementById('recommendationDivision')?.value || '';
    const departmentSource = division ? rows.filter(row => row.division === division) : rows;
    setFacultyFilterOptions('recommendationDepartment', departmentSource.map(row => row.department), 'All departments');
    const department = document.getElementById('recommendationDepartment')?.value || '';
    const disciplineSource = department ? departmentSource.filter(row => row.department === department) : departmentSource;
    setFacultyFilterOptions('recommendationDiscipline', disciplineSource.map(row => row.subject), 'All disciplines');
    const discipline = document.getElementById('recommendationDiscipline')?.value || '';
    const courseSource = discipline ? disciplineSource.filter(row => row.subject === discipline) : disciplineSource;
    setFacultyFilterOptions('recommendationCourse', courseSource.map(calGetcCourseCode), 'All courses');
    setModalitySelectOptions('recommendationModality', PHYSICAL_MODALITY_LABELS);
    setFacultyFilterOptions('recommendationTimeBlock', buildBusyTimeBuckets(rows).filter(row => row.sections).map(row => `${row.dayName} ${row.time}`), 'All time blocks');
    const facultyRows = reportableFacultyRows(state.recommendationFacultyRows?.length ? state.recommendationFacultyRows : state.facultyHeatmapRows || []);
    setFacultyFilterOptions('recommendationFacultyType', facultyRows.map(row => row.facultyType).filter(Boolean), 'All faculty types');
  }

  function recommendationFilteredSourceRows() {
    const term = document.getElementById('recommendationTerm')?.value || '';
    const campus = document.getElementById('recommendationCampus')?.value || '';
    const division = document.getElementById('recommendationDivision')?.value || '';
    const department = document.getElementById('recommendationDepartment')?.value || '';
    const discipline = document.getElementById('recommendationDiscipline')?.value || '';
    const course = document.getElementById('recommendationCourse')?.value || '';
    const facultyType = document.getElementById('recommendationFacultyType')?.value || '';
    const excludeTutoring = document.getElementById('recommendationExcludeTutoring')?.checked !== false;
    const facultyRows = reportableFacultyRows(state.recommendationFacultyRows?.length ? state.recommendationFacultyRows : state.facultyHeatmapRows || []);
    const facultyCrns = facultyType
      ? (window.COSFacultyModel?.facultyCrnsByType ? window.COSFacultyModel.facultyCrnsByType(facultyRows, facultyType) : new Set(facultyRows.filter(row => row.facultyType === facultyType).map(row => canon(row.crn)).filter(Boolean)))
      : null;
    return (state.recommendationRows || [])
      .filter(row => !row.isWorkExperience && !isOmittedInstructionalMethod(row))
      .filter(row => !(excludeTutoring && isTutoringOpenLabSection(row)))
      .filter(row => {
        if (term && row.term !== term) return false;
        if (campus && row.campus !== campus) return false;
        if (division && row.division !== division) return false;
        if (department && row.department !== department) return false;
        if (discipline && row.subject !== discipline) return false;
        if (course && calGetcCourseCode(row) !== course) return false;
        if (!rowMatchesSelectedModality(row, 'recommendationModality', PHYSICAL_MODALITY_LABELS)) return false;
        if (facultyCrns && !facultyCrns.has(canon(row.crn))) return false;
        return true;
      });
  }

  function recommendationConfidence(score, evidenceCount = 1) {
    if (score >= 4 && evidenceCount >= 3) return 'High';
    if (score >= 2 && evidenceCount >= 2) return 'Medium';
    return 'Low';
  }

  function recommendationRecord(data) {
    return {
      recommendationTitle: data.title,
      category: data.category,
      confidenceLevel: data.confidence || data.confidenceLevel || 'Low',
      affectedTermSource: data.term || data.affectedTermSource || 'Multiple/filtered',
      campus: data.campus || 'All',
      divisionDepartmentDiscipline: [data.division, data.department, data.discipline].filter(Boolean).join(' / ') || 'All',
      courseOrCourseGroup: data.course || 'All',
      dayTimeBlock: data.timeBlock || 'N/A',
      evidenceSummary: data.evidence,
      metricsUsed: data.metrics,
      whyThisMatters: data.why,
      suggestedAction: data.action,
      cautionsLimitations: data.caution,
      modality: data.modality || '',
      facultyType: data.facultyType || ''
    };
  }

  function recommendationBucketContext(row) {
    return {
      term: document.getElementById('recommendationTerm')?.value || 'Multiple/filtered',
      campus: document.getElementById('recommendationCampus')?.value || 'All',
      division: document.getElementById('recommendationDivision')?.value || '',
      department: document.getElementById('recommendationDepartment')?.value || '',
      discipline: document.getElementById('recommendationDiscipline')?.value || '',
      course: document.getElementById('recommendationCourse')?.value || '',
      timeBlock: row ? `${row.day} ${row.timeBlock || row.time}` : ''
    };
  }

  function buildSchedulingRecommendations(rows, options = {}) {
    const recommendations = [];
    const recommendationRows = busyTimeFixedRows(rows, options);
    const choiceBuckets = buildStudentChoiceBuckets(recommendationRows, 'uniqueCourses', options).filter(row => row.sections || row.seats || row.enrollment || row.waitlist);
    const supplyBuckets = buildSupplyDemandBuckets(recommendationRows, 'sections', options).rows.filter(row => row.sections || row.seats || row.enrollment || row.waitlist);
    const highDemand = choiceBuckets.filter(row => row.fillRateNumber >= 0.9 || row.waitlist > 0).sort((a, b) => (b.waitlist + b.fillRateNumber) - (a.waitlist + a.fillRateNumber));
    const oversupply = choiceBuckets.filter(row => row.sections >= 3 && row.fillRateNumber < 0.55 && row.emptySeats >= 40).sort((a, b) => b.emptySeats - a.emptySeats);
    const choiceGap = choiceBuckets.filter(row => row.uniqueCourses <= 2 && (row.fillRateNumber >= 0.8 || row.waitlist > 0)).sort((a, b) => b.fillRateNumber - a.fillRateNumber);
    const addBucketRec = (row, category, title, action, extra = {}) => {
      const ctx = recommendationBucketContext(row);
      recommendations.push(recommendationRecord({
        ...ctx,
        ...extra,
        title,
        category,
        confidence: recommendationConfidence((row.fillRateNumber >= 0.9 ? 2 : 0) + (row.waitlist > 0 ? 2 : 0) + (row.uniqueCourses <= 2 ? 1 : 0) + (row.emptySeats >= 40 ? 1 : 0), 4),
        evidence: `${row.day} ${row.timeBlock}: ${row.sections} active sections, ${row.uniqueCourses} unique courses, ${row.seats} seats, ${row.enrollment} enrollment, ${row.fillRate}, ${row.emptySeats} empty seats, ${row.waitlist} waitlist.`,
        metrics: 'observed enrollment; available supply; student choice opportunity; fill rate; waitlist; student presence',
        why: 'This distinguishes observed enrollment from the amount of supply and choice students had at that time.',
        action,
        caution: 'Evidence-informed only. Does not prove student preference and should be reviewed against program, equity, staffing, room, and service constraints.'
      }));
    };
    highDemand.slice(0, 3).forEach(row => addBucketRec(row, 'Hidden Demand', `Possible hidden demand around ${row.timeBlock}`, 'Review whether similar time blocks need more options before reducing supply elsewhere.'));
    oversupply.slice(0, 3).forEach(row => addBucketRec(row, 'Oversupply', `Possible oversupply around ${row.timeBlock}`, 'Review low-fill supply and empty seats before expanding comparable offerings.', { confidence: recommendationConfidence(3, 3) }));
    choiceGap.slice(0, 3).forEach(row => addBucketRec(row, 'Choice Gap', `Limited student choice around ${row.timeBlock}`, 'Review whether students have enough meaningful alternatives in this time block.'));
    choiceGap.filter(row => row.waitlist > 0 || row.fillRateNumber >= 0.9).slice(0, 2).forEach(row => addBucketRec(row, 'Expansion Candidate', `Possible expansion candidate around ${row.timeBlock}`, 'Consider testing additional capacity in this pattern before reducing nearby supply.'));
    const roomUse = busyTimeRoomUtilization(recommendationRows, options);
    if (highDemand.length && roomUse.rooms && roomUse.utilization < 0.55) {
      const row = highDemand[0];
      addBucketRec(row, 'Room Opportunity', `Room opportunity near ${row.timeBlock}`, 'Review room availability during high-demand or low-choice periods.', {
        confidence: recommendationConfidence(3, 3),
        metrics: `room availability; student presence; fill rate; waitlist; room utilization ${(roomUse.utilization * 100).toFixed(1)}%`
      });
    }
    const facultyRows = reportableFacultyRows(state.recommendationFacultyRows?.length ? state.recommendationFacultyRows : state.facultyHeatmapRows || []);
    const facultyBuckets = buildBusyTimeFacultyBuckets(facultyRows, supplyDemandSlots(recommendationRows));
    const primeFaculty = facultyBuckets.filter(row => ['MO', 'TU', 'WE', 'TH'].includes(row.day) && row.minutes >= 9 * 60 && row.minutes < 15 * 60 && row.total >= 3);
    const concentrated = primeFaculty.find(row => safeDiv(Math.max(row.fullTime, row.partTime), row.total) >= 0.75);
    if (concentrated) {
      const facultyType = concentrated.fullTime >= concentrated.partTime ? 'FULL_TIME' : 'PART_TIME';
      recommendations.push(recommendationRecord({
        title: `Faculty concentration in prime time`,
        category: 'Faculty Concentration',
        confidenceLevel: recommendationConfidence(3, 3),
        affectedTermSource: document.getElementById('recommendationTerm')?.value || 'Multiple/filtered',
        dayTimeBlock: `${concentrated.day} ${formatPresenceHourLabel(concentrated.minutes / 60)}`,
        facultyType,
        evidenceSummary: `${concentrated.total} faculty meeting rows in this prime-time bucket; ${Math.max(concentrated.fullTime, concentrated.partTime)} are ${facultyType}.`,
        metricsUsed: 'faculty assignment pattern; prime-time analysis; student demand distribution',
        whyThisMatters: 'Faculty assignment concentration can differ from student demand concentration and should be visible before interpreting schedule balance.',
        suggestedAction: 'Review faculty assignment distribution against student demand patterns.',
        cautionsLimitations: 'Faculty schedule data must be loaded or previously available. Advisory only.'
      }));
    }
    const byDiscipline = new Map();
    recommendationRows.forEach(row => {
      const key = row.subject || 'Unknown';
      if (!byDiscipline.has(key)) byDiscipline.set(key, { discipline: key, total: 0, modalities: new Map(), enrollment: 0, waitlist: 0 });
      const bucket = byDiscipline.get(key);
      bucket.total += 1;
      bucket.enrollment += busyTimeEnrollment(row);
      bucket.waitlist += row.waitlist || 0;
      bucket.modalities.set(row.modality || 'Unknown', (bucket.modalities.get(row.modality || 'Unknown') || 0) + 1);
    });
    [...byDiscipline.values()].filter(row => row.total >= 5).forEach(row => {
      const [modality, count] = [...row.modalities.entries()].sort((a, b) => b[1] - a[1])[0] || ['', 0];
      if (safeDiv(count, row.total) >= 0.8 && row.modalities.size > 1) {
        recommendations.push(recommendationRecord({
          title: `Possible modality imbalance in ${row.discipline}`,
          category: 'Modality Imbalance',
          confidenceLevel: recommendationConfidence(3, 3),
          affectedTermSource: document.getElementById('recommendationTerm')?.value || 'Multiple/filtered',
          division: '',
          discipline: row.discipline,
          course: row.discipline,
          modality,
          evidenceSummary: `${count} of ${row.total} sections are ${modality}; enrollment ${row.enrollment}; waitlist ${row.waitlist}.`,
          metricsUsed: 'faculty modality mix; observed enrollment; available supply; waitlist',
          whyThisMatters: 'A dominant modality can limit student choice even when enrollment looks healthy.',
          suggestedAction: 'Review modality mix against demand indicators in other modalities.',
          cautionsLimitations: 'Does not prove preference for another modality; it flags imbalance for review.'
        }));
      }
    });
    const byCourse = new Map();
    rows.forEach(row => {
      const key = calGetcCourseCode(row);
      if (!key) return;
      if (!byCourse.has(key)) byCourse.set(key, { course: key, sections: 0, seats: 0, enrollment: 0, waitlist: 0 });
      const bucket = byCourse.get(key);
      bucket.sections += 1;
      bucket.seats += row.cap || 0;
      bucket.enrollment += busyTimeEnrollment(row);
      bucket.waitlist += row.waitlist || 0;
    });
    [...byCourse.values()].forEach(row => {
      const fill = safeDiv(row.enrollment, row.seats);
      if (row.sections >= 3 && fill < 0.5 && row.seats - row.enrollment >= 30) {
        recommendations.push(recommendationRecord({
          title: `Possible consolidation candidate in ${row.course}`,
          category: 'Consolidation Candidate',
          confidenceLevel: recommendationConfidence(3, 3),
          affectedTermSource: document.getElementById('recommendationTerm')?.value || 'Multiple/filtered',
          course: row.course,
          evidenceSummary: `${row.sections} sections, ${row.seats} seats, ${row.enrollment} enrollment, ${(fill * 100).toFixed(1)}% fill, ${row.seats - row.enrollment} empty seats.`,
          metricsUsed: 'historical/current fill rates; empty seats; section consolidation logic; student choice opportunity',
          whyThisMatters: 'Low-fill repeated sections may be review candidates if student choice is not materially reduced.',
          suggestedAction: 'Review manually for consolidation feasibility and student choice impact.',
          cautionsLimitations: 'Do not consolidate automatically. Check time, campus, modality, equity, and receiving capacity.'
        }));
      }
    });
    if (!recommendations.length && recommendationRows.length) {
      recommendations.push(recommendationRecord({
        title: 'Insufficient evidence for advisory recommendation',
        category: 'Insufficient evidence',
        confidenceLevel: 'Low',
        affectedTermSource: document.getElementById('recommendationTerm')?.value || 'Multiple/filtered',
        evidenceSummary: `${recommendationRows.length} fixed physical/time-selected rows were loaded, but no category met the minimum evidence thresholds.`,
        metricsUsed: 'observed enrollment; available supply; student choice opportunity; faculty assignment pattern; room availability',
        whyThisMatters: 'The engine should not force a recommendation when evidence is weak or incomplete.',
        suggestedAction: 'Load more relevant terms or narrow filters if a specific pattern is being investigated.',
        cautionsLimitations: 'Insufficient evidence is not evidence of no issue.'
      }));
    }
    if (!recommendations.length) {
      recommendations.push(recommendationRecord({
        title: 'Insufficient evidence',
        category: 'Insufficient evidence',
        confidenceLevel: 'Low',
        affectedTermSource: 'No selected source',
        evidenceSummary: 'No usable schedule rows were loaded for the selected scope.',
        metricsUsed: 'No metrics available',
        whyThisMatters: 'Recommendations require schedule, enrollment, supply, and choice evidence.',
        suggestedAction: 'Upload a schedule CSV or select archived terms.',
        cautionsLimitations: 'No conclusion can be drawn without data.'
      }));
    }
    return recommendations;
  }

  function recommendationFilterOutput(rows) {
    const category = document.getElementById('recommendationCategory')?.value || '';
    const confidence = document.getElementById('recommendationConfidence')?.value || '';
    const timeBlock = document.getElementById('recommendationTimeBlock')?.value || '';
    return (rows || []).filter(row => {
      if (category && row.category !== category) return false;
      if (confidence && row.confidenceLevel !== confidence) return false;
      if (timeBlock && row.dayTimeBlock !== timeBlock) return false;
      return true;
    });
  }

  function renderRecommendationEngine() {
    const sourceRows = recommendationFilteredSourceRows();
    const allRecommendations = buildSchedulingRecommendations(sourceRows, { includeOnline: includeOnlineFromSelect('recommendationModality') });
    const filteredRecommendations = recommendationFilterOutput(allRecommendations);
    state.recommendationOutputRows = filteredRecommendations;
    const byCategory = category => filteredRecommendations.filter(row => row.category === category).length;
    metric('recommendationMetrics', [
      ['Recommendations', filteredRecommendations.length],
      ['High Confidence', filteredRecommendations.filter(row => row.confidenceLevel === 'High').length],
      ['Hidden Demand', byCategory('Hidden Demand')],
      ['Oversupply', byCategory('Oversupply')],
      ['Choice Gap', byCategory('Choice Gap')],
      ['Expansion Candidate', byCategory('Expansion Candidate')],
      ['Consolidation Candidate', byCategory('Consolidation Candidate')],
      ['Insufficient Evidence', byCategory('Insufficient evidence')]
    ]);
    document.getElementById('recommendationCards').innerHTML = filteredRecommendations.slice(0, 6).map(row => `
      <section>
        <h3>${escapeAttr(row.recommendationTitle)}</h3>
        <ul>
          <li><strong>Category:</strong> ${escapeAttr(row.category)}</li>
          <li><strong>Confidence:</strong> ${escapeAttr(row.confidenceLevel)}</li>
          <li><strong>Time:</strong> ${escapeAttr(row.dayTimeBlock)}</li>
          <li><strong>Evidence:</strong> ${escapeAttr(row.evidenceSummary)}</li>
          <li><strong>Action:</strong> ${escapeAttr(row.suggestedAction)}</li>
        </ul>
      </section>
    `).join('') || '<section><p class="analytics-empty">No recommendation cards match the selected filters.</p></section>';
    const priority = { High: 0, Medium: 1, Low: 2 };
    const priorityRows = filteredRecommendations.slice().sort((a, b) => (priority[a.confidenceLevel] ?? 9) - (priority[b.confidenceLevel] ?? 9));
    document.getElementById('recommendationPriorityList').innerHTML = `
      <strong>Filterable Priority List</strong>
      <ol>${priorityRows.slice(0, 12).map(row => `<li>${escapeAttr(row.confidenceLevel)} - ${escapeAttr(row.category)} - ${escapeAttr(row.recommendationTitle)}</li>`).join('')}</ol>
    `;
    table('recommendationTable', filteredRecommendations, ['recommendationTitle', 'category', 'confidenceLevel', 'affectedTermSource', 'campus', 'divisionDepartmentDiscipline', 'courseOrCourseGroup', 'dayTimeBlock', 'evidenceSummary', 'metricsUsed', 'whyThisMatters', 'suggestedAction', 'cautionsLimitations']);
    document.getElementById('recommendationLegend').innerHTML = `
      <strong>Recommendation Engine Methodology</strong>
      <p>Recommendations are evidence-informed, not deterministic. The engine distinguishes observed enrollment, available supply, student choice opportunity, faculty assignment pattern, room availability, historical/current fill rates, waitlists when available, and consolidation-style low-fill indicators. It does not prove student preference and does not change schedules automatically.</p>
    `;
    const status = document.getElementById('recommendationStatus');
    if (status) status.textContent = `Loaded ${state.recommendationRows.length} row(s); ${sourceRows.length} row(s) match source filters; ${filteredRecommendations.length} recommendation row(s).`;
    state.recommendationRan = true;
  }

  async function loadRecommendationRows() {
    const uploadedRows = await readCsv(document.getElementById('recommendationCsv'), { sourceType: 'RECOMMENDATION_UPLOAD' });
    const archivedRows = await readArchivedRows('recommendationArchiveTerms', { reportLabel: 'Scheduling Recommendation Engine' });
    state.recommendationRows = dedupeEnrollmentRows([...uploadedRows, ...archivedRows].map(normalize));
    const facultyInput = document.getElementById('recommendationFacultyCsv');
    state.recommendationFacultyRows = facultyInput?.files?.length ? await readFacultyScheduleFiles(facultyInput) : [];
    updateRecommendationFilterOptions();
  }

  async function runRecommendationEngine() {
    await loadRecommendationRows();
    renderRecommendationEngine();
  }

  function clearRecommendationEngine() {
    ['recommendationCategory', 'recommendationConfidence', 'recommendationTerm', 'recommendationCampus', 'recommendationDivision', 'recommendationDepartment', 'recommendationDiscipline', 'recommendationCourse', 'recommendationTimeBlock', 'recommendationFacultyType'].forEach(id => {
      const node = document.getElementById(id);
      if (node) node.value = '';
    });
    setModalitySelectValues('recommendationModality', PHYSICAL_MODALITY_LABELS);
    const exclude = document.getElementById('recommendationExcludeTutoring');
    if (exclude) exclude.checked = true;
    if (state.recommendationRows.length) renderRecommendationEngine();
  }

  async function exportRecommendationPdf() {
    if (!window.html2canvas || !window.jspdf?.jsPDF) {
      alert('PDF export is not available in this browser session. Use Export CSV for the recommendation data.');
      return;
    }
    const report = document.getElementById('recommendationEngineReport');
    const canvas = await window.html2canvas(report, { scale: 1.5 });
    const pdf = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
    const imgData = canvas.toDataURL('image/png');
    const pageWidth = pdf.internal.pageSize.getWidth() - 40;
    const pageHeight = pdf.internal.pageSize.getHeight() - 40;
    pdf.addImage(imgData, 'PNG', 20, 20, pageWidth, Math.min(pageHeight, canvas.height * pageWidth / canvas.width));
    pdf.save('scheduling-recommendations.pdf');
  }

  async function loadWorkExperienceRows() {
    const raw = await readCsv(document.getElementById('workExperienceCsv'), { sourceType: 'WORK_EXPERIENCE' });
    state.workExperienceInput = dedupeEnrollmentRows(raw.map(normalize));
    renderWorkExperienceUploadStatus();
    return state.workExperienceInput;
  }

  function workExperienceRows() {
    return state.workExperienceInput || [];
  }

  function includeWorkExperience(prefix) {
    return document.getElementById(prefix + 'IncludeWorkExperience')?.checked !== false;
  }

  function rowsWithWorkExperience(rows, prefix) {
    const base = rows || [];
    if (!includeWorkExperience(prefix)) return base.filter(row => !row.isWorkExperience);
    return dedupeEnrollmentRows([...base, ...workExperienceRows()]);
  }

  function renderWorkExperienceUploadStatus() {
    const node = document.getElementById('workExperienceUploadStatus');
    if (!node) return;
    const rows = workExperienceRows();
    const terms = collectRowTerms(rows);
    const missingFtes = rows.filter(row => row.ftesUnavailable).length;
    node.textContent = rows.length
      ? `${rows.length} Work Experience row(s) loaded for this session${terms.length ? `; terms: ${terms.join(', ')}` : ''}${missingFtes ? `; ${missingFtes} missing FTES inputs` : ''}.`
      : 'No Work Experience rows loaded. Work Experience uploads are session only until archive support is added.';
  }

  function workExperienceSummary(rows) {
    const included = (rows || []).filter(row => row.isWorkExperience);
    return {
      rows: included.length,
      missingFtes: included.filter(row => row.ftesUnavailable).length
    };
  }

  async function readArchivedRows(selectId, options = {}) {
    const terms = getSelectedValues(selectId);
    if (!terms.length || !window.BACKEND_BASE_URL) return [];
    const reportLabel = options.reportLabel || 'analytics archive';
    const batches = await Promise.all(terms.map(term => fetchArchivedTermRows(term, reportLabel)));
    return batches.flat();
  }

  async function fetchArchivedTermRows(term, reportLabel = 'analytics archive') {
    if (!term) return [];
    if (!window.BACKEND_BASE_URL) throw new Error(`Cannot load archived term ${term} for ${reportLabel}: backend URL is not configured.`);
    try {
      const response = await fetch(`${window.BACKEND_BASE_URL}/api/analytics-archive/${encodeURIComponent(term)}`);
      let payload = {};
      try {
        payload = await response.json();
      } catch (parseErr) {
        payload = {};
      }
      if (!response.ok) {
        const detail = payload.error || payload.message || `${response.status} ${response.statusText}`.trim();
        throw new Error(`Could not load archived term ${term} for ${reportLabel}: ${detail}`);
      }
      if (!Array.isArray(payload.data)) {
        const detail = payload.error || payload.message || 'archive response did not include a data array';
        throw new Error(`Could not load archived term ${term} for ${reportLabel}: ${detail}`);
      }
      return payload.data.map(row => ({ ...row, __sourceTerm: payload.term || term }));
    } catch (err) {
      if (/Could not load archived term|Cannot load archived term/.test(err?.message || '')) throw err;
      throw new Error(`Could not load archived term ${term} for ${reportLabel}: ${err?.message || err}`);
    }
  }

  async function refreshAnalyticsArchiveOptions() {
    if (!window.BACKEND_BASE_URL) return;
    try {
      const payload = await fetch(`${window.BACKEND_BASE_URL}/api/analytics-archive`).then(response => response.ok ? response.json() : { data: [] });
      state.archivedAnalyticsTerms = (payload.data || []).map(item => item.term).filter(Boolean);
      const options = state.archivedAnalyticsTerms.map(term => ({ value: term, label: term }));
      setSelectOptions('attrArchiveTerms', options);
      setSelectOptions('conArchiveTerms', options);
      setSelectOptions('dashArchiveTerms', options);
      setSelectOptions('demArchiveTerms', options);
      setSelectOptions('spArchiveTerms', options);
      setSelectOptions('conflictArchiveTerms', options);
      setSelectOptions('roomFitArchiveTerms', options);
      setSelectOptions('sdArchiveTerms', options);
      setSelectOptions('busyTimeArchiveTerms', options);
      setSelectOptions('studentChoiceArchiveTerms', options);
      setSelectOptions('recommendationArchiveTerms', options);
      setArchiveInspectionTermOptions();
    } catch (err) {
      console.warn('Analytics archive list skipped:', err);
    }
  }

  function setArchiveInspectionTermOptions() {
    const select = document.getElementById('archiveInspectionTerm');
    if (!select) return;
    const prior = select.value;
    const terms = [...(state.archivedAnalyticsTerms || [])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    select.replaceChildren();
    terms.forEach(term => select.appendChild(new Option(term, term, false, term === prior)));
    if (terms.includes(prior)) select.value = prior;
    else if (terms.length) select.value = terms[terms.length - 1];
  }

  function loadSnapshotsFromLocal() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SNAPSHOT_STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveSnapshotsToLocal(records) {
    try {
      localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(records || []));
    } catch (err) {
      console.warn('Enrollment snapshot local save skipped:', err);
    }
  }

  async function loadEnrollmentSnapshots() {
    if (window.BACKEND_BASE_URL) {
      try {
        const payload = await fetch(`${window.BACKEND_BASE_URL}/api/enrollment-snapshots`).then(response => response.ok ? response.json() : { data: [] });
        state.enrollmentSnapshots = Array.isArray(payload.data) ? payload.data : [];
        state.snapshotLastUpdated = payload.lastUpdated || null;
        saveSnapshotsToLocal(state.enrollmentSnapshots);
        return state.enrollmentSnapshots;
      } catch (err) {
        console.warn('Backend enrollment snapshot load skipped:', err);
      }
    }
    state.enrollmentSnapshots = loadSnapshotsFromLocal();
    return state.enrollmentSnapshots;
  }

  async function persistEnrollmentSnapshots(incoming) {
    const merged = upsertSnapshotRecords(state.enrollmentSnapshots || [], incoming || []);
    if (window.BACKEND_BASE_URL && enrollmentManagementToken()) {
      const response = await fetch(`${window.BACKEND_BASE_URL}/api/enrollment-snapshots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${enrollmentManagementToken()}`
        },
        body: JSON.stringify({ records: incoming })
      });
      if (!response.ok) throw new Error(await response.text() || 'Snapshot archive failed.');
      const payload = await response.json();
      state.enrollmentSnapshots = payload.data || merged.records;
      state.snapshotLastUpdated = payload.lastUpdated || new Date().toISOString();
    } else {
      state.enrollmentSnapshots = merged.records;
      state.snapshotLastUpdated = new Date().toISOString();
    }
    saveSnapshotsToLocal(state.enrollmentSnapshots);
    return { ...merged, records: state.enrollmentSnapshots };
  }

  async function clearSelectedSnapshotBatch() {
    const term = snapshotTerm();
    const snapshotType = normalizeSnapshotType(document.getElementById('snapType')?.value || '');
    const snapshotDate = document.getElementById('snapDate')?.value || '';
    if (!term || !snapshotType || !snapshotDate) {
      alert('Term, snapshot type, and snapshot date are required to clear a snapshot batch.');
      return;
    }
    if (!confirm(`Clear stored ${snapshotType} snapshots for ${term} on ${snapshotDate}? Other dates and missing CRNs will be kept.`)) return;
    if (window.BACKEND_BASE_URL && enrollmentManagementToken()) {
      const response = await fetch(`${window.BACKEND_BASE_URL}/api/enrollment-snapshots`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${enrollmentManagementToken()}`
        },
        body: JSON.stringify({ term, snapshotType, snapshotDate })
      });
      if (!response.ok) throw new Error(await response.text() || 'Snapshot clear failed.');
      const payload = await response.json();
      state.enrollmentSnapshots = payload.data || [];
    } else {
      state.enrollmentSnapshots = (state.enrollmentSnapshots || []).filter(record =>
        canon(record.term) !== term || normalizeSnapshotType(record.snapshotType) !== snapshotType || String(record.snapshotDate || '') !== snapshotDate
      );
    }
    saveSnapshotsToLocal(state.enrollmentSnapshots);
    renderSnapshotManager();
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

  function snapshotTerm() {
    const season = canon(document.getElementById('snapSeason')?.value || 'FALL');
    const year = Number(document.getElementById('snapYear')?.value || termParts(attritionDecisionTerm()).year || termParts(currentTerm()).year || new Date().getFullYear());
    return `${season || 'FALL'} ${year}`;
  }

  function setSnapshotTermControls(term) {
    const parts = termParts(term);
    const season = document.getElementById('snapSeason');
    const year = document.getElementById('snapYear');
    if (season && parts.season) season.value = parts.season;
    if (year && parts.year) year.value = String(parts.year);
  }

  function updateConsolidationTermOptions(terms) {
    const select = document.getElementById('conDecisionTerm');
    if (!select) return '';
    const seasonSelect = document.getElementById('conDecisionSeason');
    const yearInput = document.getElementById('conDecisionYear');
    const prior = select.value;
    select.replaceChildren();
    select.add(new Option('Use season/year below', '__MANUAL__'));
    terms.forEach(term => select.add(new Option(term, term)));
    if (terms.includes(prior)) select.value = prior;
    else if (terms.length) select.value = terms[terms.length - 1];
    else select.value = '__MANUAL__';
    const selectedParts = termParts(select.value === '__MANUAL__' ? '' : select.value);
    const fallbackParts = termParts(prior);
    const basis = selectedParts.year ? selectedParts : fallbackParts.year ? fallbackParts : termParts(currentTerm());
    if (seasonSelect && basis.season) seasonSelect.value = basis.season;
    if (yearInput && basis.year && !yearInput.value) yearInput.value = String(basis.year);
    return select.value;
  }

  function consolidationDecisionTerm() {
    const selected = canon(document.getElementById('conDecisionTerm')?.value || '');
    if (selected && selected !== '__MANUAL__') return selected;
    const season = canon(document.getElementById('conDecisionSeason')?.value || 'FALL');
    const year = Number(document.getElementById('conDecisionYear')?.value || termParts(currentTerm()).year || new Date().getFullYear());
    return `${season || 'FALL'} ${year}`;
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
    const latestParts = (terms || [])
      .map(termParts)
      .filter(parts => parts.year && ['FALL', 'SPRING', 'SUMMER'].includes(parts.season))
      .sort((a, b) => termSortValue(`${a.season} ${a.year}`) - termSortValue(`${b.season} ${b.year}`))
      .pop();
    const activeParts = termParts(currentTerm());
    const basis = latestParts || (activeParts.year ? activeParts : { season: 'FALL', year: new Date().getFullYear() });
    const proposedFiscalYear = academicYearTrailingYear(`${basis.season} ${basis.year}`) || (basis.year + 1);
    if (yearInput.value && seasonSelect.value && yearInput.dataset.autoDefault !== 'true') return;
    seasonSelect.value = basis.season || 'FALL';
    yearInput.value = String(proposedFiscalYear);
    yearInput.dataset.autoDefault = 'true';
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
    const rows = (state.dashboardInput || []).filter(Boolean);
    const base = rows.length ? dedupeEnrollmentRows(rows) : currentRows().filter(row => !isOmittedInstructionalMethod(row));
    return rowsWithWorkExperience(base, 'dash');
  }

  async function loadDashboardRows() {
    const uploadedRows = await readCsv(document.getElementById('dashboardCsv'), { sourceType: 'DASHBOARD_UPLOAD' });
    const archivedRows = await readArchivedRows('dashArchiveTerms', { reportLabel: 'Enrollment Analytics Dashboard' });
    state.dashboardInput = dedupeEnrollmentRows([...uploadedRows, ...archivedRows].map(normalize));
    return state.dashboardInput;
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
    const seasonSelect = document.getElementById('dashDecisionSeason');
    const yearInput = document.getElementById('dashDecisionYear');
    const active = canon(currentTerm());
    const defaultTerm = terms.includes(prior) || prior === '__ALL__' || prior === '__MANUAL__' ? prior :
      terms.includes(active) ? active :
      terms.length ? terms[terms.length - 1] : '__MANUAL__';
    select.replaceChildren();
    select.appendChild(new Option('Use season/year below', '__MANUAL__', false, defaultTerm === '__MANUAL__'));
    select.appendChild(new Option('All Loaded Terms', '__ALL__', false, defaultTerm === '__ALL__'));
    terms.forEach(term => select.appendChild(new Option(term, term, false, term === defaultTerm)));
    select.value = defaultTerm;
    const selectedParts = termParts(defaultTerm === '__MANUAL__' || defaultTerm === '__ALL__' ? '' : defaultTerm);
    const priorParts = termParts(prior);
    const basis = selectedParts.year ? selectedParts : priorParts.year ? priorParts : termParts(active);
    if (seasonSelect && basis.season) seasonSelect.value = basis.season;
    if (yearInput && basis.year && !yearInput.value) yearInput.value = String(basis.year);
    return defaultTerm;
  }

  function updatePresenceFocusTermOptions(rows) {
    const select = document.getElementById('spFocusTerm');
    const terms = dashboardAvailableTerms(rows);
    if (!select) return '';
    const prior = select.value;
    const active = canon(currentTerm());
    const defaultTerm = terms.includes(prior) ? prior :
      terms.includes(active) ? active :
      terms.length ? terms[terms.length - 1] : '';
    select.replaceChildren();
    terms.forEach(term => select.appendChild(new Option(term, term, false, term === defaultTerm)));
    select.value = defaultTerm;
    updatePresenceCompareTermOptions(terms, defaultTerm);
    return defaultTerm;
  }

  function updatePresenceCompareTermOptions(terms, focusTerm) {
    const select = document.getElementById('spCompareTerms');
    if (!select) return;
    const prior = getSelectedValues('spCompareTerms');
    const options = (terms || []).filter(term => term !== focusTerm).map(term => ({ value: term, label: term }));
    setSelectOptions('spCompareTerms', options);
    const preserved = prior.filter(term => term !== focusTerm && terms.includes(term));
    Array.from(select.options || []).forEach(option => {
      option.selected = preserved.includes(option.value);
    });
    const choice = analyticsChoices.get('spCompareTerms');
    if (choice) {
      choice.removeActiveItems();
      preserved.forEach(value => choice.setChoiceByValue(value));
    }
  }

  function dashboardFocusTerm() {
    const value = document.getElementById('dashFocusTerm')?.value || '';
    if (value === '__ALL__') return '';
    if (value && value !== '__MANUAL__') return canon(value);
    const season = canon(document.getElementById('dashDecisionSeason')?.value || 'FALL');
    const year = Number(document.getElementById('dashDecisionYear')?.value || termParts(currentTerm()).year || new Date().getFullYear());
    return `${season || 'FALL'} ${year}`;
  }

  function studentPresenceFocusTerm() {
    return canon(document.getElementById('spFocusTerm')?.value || '');
  }

  function dashboardCurrentRows(sourceRows, focusTerm) {
    if (!focusTerm) return sourceRows;
    return sourceRows.filter(row => row.term === focusTerm);
  }

  function dashboardHistoricalRows(rows, focusTerm) {
    const pool = (rows || []).filter(row => row && !isOmittedInstructionalMethod(row));
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

  async function runDashboard() {
    state.dashboardRan = true;
    const saved = captureFilterState('dash');
    await loadDashboardRows();
    const sourceRows = dashboardSourceRows().filter(row => !isOmittedInstructionalMethod(row));
    updateDashboardFocusTermOptions(sourceRows);
    refreshAnalyticsFilters('dash', sourceRows, saved);
    const diagnostics = standardExclusionDiagnostics(sourceRows, 'dash');
    const selectedFocusTerm = dashboardFocusTerm();
    const currentRows = applyFilters(dashboardCurrentRows(sourceRows, selectedFocusTerm), 'dash');
    const historicalRows = applyFilters(dashboardHistoricalRows(sourceRows, selectedFocusTerm), 'dash');
    const reductionRows = dashboardReductionRows(selectedFocusTerm);
    const summary = dashboard.dashboardSummary(currentRows, historicalRows, reductionRows);
    summary.diagnostics = diagnostics;
    state.dashboardRows = currentRows;
    state.dashboardSummary = summary;
    state.rotationRows = summary.rotation || [];
    renderDashboard(summary, dashboardScopeContext(currentRows, historicalRows, selectedFocusTerm));
  }

  function handleDashboardError(err) {
    console.warn('Dashboard failed:', err);
    alert(err.message || 'Dashboard failed.');
  }

  function rerunDashboard() {
    runDashboard().catch(handleDashboardError);
  }

  function exportDashboardSummary() {
    if (!state.dashboardSummary) {
      alert('Refresh the dashboard before exporting.');
      return;
    }
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
    const sourceTerms = collectRowTerms(dashboardSourceRows());
    const uploadedFiles = Array.from(document.getElementById('dashboardCsv')?.files || []).map(file => file.name);
    const selectedArchivedTerms = getSelectedValues('dashArchiveTerms');
    return {
      focusTerm,
      focusLabel: focusTerm || 'All Loaded Terms',
      selectedArchivedTerms,
      uploadedFiles,
      sourceTerms,
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
    const selectedArchivedTerms = context.selectedArchivedTerms.length ? context.selectedArchivedTerms.join(', ') : 'None selected';
    const uploadedFiles = context.uploadedFiles.length ? context.uploadedFiles.join(', ') : 'None selected';
    const sourceTerms = context.sourceTerms.length ? context.sourceTerms.join(', ') : 'Active room-grid term fallback';
    const historicalTerms = context.historicalTerms.length ? context.historicalTerms.join(', ') : 'None';
    const warnings = context.warnings.length
      ? `<div class="dashboard-scope-warnings">${context.warnings.map(warning => `<p>${escapeAttr(warning)}</p>`).join('')}</div>`
      : '<div class="dashboard-scope-ok"><strong>No scope warnings detected.</strong> The current selection is internally consistent and no obvious data-scope issue was detected.</div>';
    node.innerHTML = `
      <h3>Dashboard Scope &amp; Data Quality</h3>
      ${warnings}
      <dl>
        <div><dt>Focus Term</dt><dd>${escapeAttr(context.focusLabel)}</dd></div>
        <div><dt>Selected Archived Terms</dt><dd>${escapeAttr(selectedArchivedTerms)}</dd></div>
        <div><dt>Uploaded Dashboard Files</dt><dd>${escapeAttr(uploadedFiles)}</dd></div>
        <div><dt>Dashboard Source Terms</dt><dd>${escapeAttr(sourceTerms)}</dd></div>
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
    const workExperience = workExperienceSummary(state.dashboardRows || []);
    const diagnostics = summary.diagnostics || {};
    metric('dashboardMetrics', [
      ['Current Enrollment', health.currentEnrollment ?? 0],
      ['Expected Enrollment', health.expectedEnrollment == null ? 'N/A' : health.expectedEnrollment],
      ['Variance', health.variance == null ? 'N/A' : health.variance],
      ['Courses Reviewed', health.coursesReviewed ?? 0],
      ['Sections Reviewed', health.sectionsReviewed ?? 0],
      ['FTES', round1(health.ftes || 0)],
      ['Work Experience Rows Included', workExperience.rows],
      ['Work Experience FTES Warnings', workExperience.missingFtes],
      ['Tutoring/Open Lab Rows Excluded', diagnostics.tutoringOpenLabRowsExcluded || 0],
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

  async function saveSnapshotBatch() {
    const term = snapshotTerm();
    const snapshotType = normalizeSnapshotType(document.getElementById('snapType')?.value || '');
    const snapshotDate = document.getElementById('snapDate')?.value || '';
    const fileRows = await readCsv(document.getElementById('snapshotCsv'));
    if (!term || !snapshotType || !snapshotDate) {
      alert('Term, snapshot type, and snapshot date are required.');
      return;
    }
    if (!fileRows.length) {
      alert('Choose a snapshot CSV before saving.');
      return;
    }
    const warnings = snapshotUploadWarnings(fileRows, term);
    const records = buildSnapshotRecords(fileRows, { term, snapshotType, snapshotDate });
    if (!records.length) {
      alert('No snapshot records could be created. Confirm the file includes CRN and the required enrollment source field.');
      return;
    }
    const result = await persistEnrollmentSnapshots(records);
    state.snapshotRows = records;
    renderSnapshotManager(warnings, result);
    alert(`Saved ${records.length} snapshot row(s). Appended ${result.appended}; updated ${result.updated}.`);
  }

  function snapshotUploadWarnings(rows, selectedTerm) {
    const fileTerms = [...new Set((rows || []).map(row => canon(val(row, fields.term) || row.__sourceTerm)).filter(Boolean))];
    const warnings = [];
    if (!fileTerms.length) warnings.push(`No term field found in the file. Stored snapshots will use selected term ${selectedTerm}.`);
    const conflicts = fileTerms.filter(term => term !== selectedTerm);
    if (conflicts.length) warnings.push(`Uploaded file term ${conflicts.join(', ')} differs from selected term ${selectedTerm}. Selected term will be used for storage.`);
    return warnings;
  }

  async function renderSnapshotManager(warnings = [], saveResult = null) {
    await loadEnrollmentSnapshots();
    const rows = dashboardSourceRows();
    const snapYearInput = document.getElementById('snapYear');
    if (snapYearInput && !snapYearInput.value) setSnapshotTermControls(attritionDecisionTerm() || currentTerm());
    const term = snapshotTerm();
    const coverage = snapshotCoverage(rows, state.enrollmentSnapshots, term);
    metric('snapshotMetrics', [
      ['Sections in Focus Term', coverage.sectionsInFocusTerm],
      ['Sections with First Day Snapshot', coverage.sectionsWithFirstDaySnapshot],
      ['First Day Coverage', pct(coverage.firstDayCoveragePct)],
      ['Missing First Day Snapshot', coverage.sectionsMissingFirstDaySnapshot],
      ['Snapshot Batches Uploaded', coverage.snapshotBatchesUploaded],
      ['Latest Snapshot Date', coverage.latestSnapshotDate || 'N/A'],
      ['Snapshot Records Stored', coverage.snapshotRecordsStored],
      ['Last Save', saveResult ? `+${saveResult.appended} / updated ${saveResult.updated}` : (state.snapshotLastUpdated || 'N/A')]
    ]);
    const warningNode = document.getElementById('snapshotWarnings');
    if (warningNode) {
      warningNode.innerHTML = warnings.length ? warnings.map(warning => `<p>${escapeAttr(warning)}</p>`).join('') : '';
    }
    table('snapshotTable', state.enrollmentSnapshots || [], [
      'term',
      'snapshotType',
      'snapshotDate',
      'crn',
      'course',
      'section',
      'startDate',
      'enrollment',
      'sourceFieldUsed',
      'uploadedAt',
      'action'
    ]);
    renderSnapshotLegend();
  }

  function renderSnapshotLegend() {
    const legend = document.getElementById('snapshotLegend');
    if (!legend) return;
    renderMethodologyPanel(legend, {
      title: 'Enrollment Snapshot Manager Methodology & Data Dictionary',
      purpose: 'Captures lifecycle enrollment points that are not available as standing fields in the source system, especially First Day enrollment.',
      methodology: 'Records are stored by Term + CRN + Snapshot Type. New CRNs append. Existing Term + CRN + Snapshot Type records update with the latest snapshot date/enrollment. Missing CRNs in later partial uploads are not deleted.',
      assumptions: 'First Day and Final use ACTUAL_ENROLL. Census 1 uses CENSUS_ENROLL when present, with ACTUAL_ENROLL fallback only when needed and visibly labeled. Census 2 uses CENSUS_ENROLL2 when present, then documented fallbacks.',
      limitations: 'Snapshot coverage depends on the user uploading every partial start-date batch for the term. Coverage below 100% means First Day lifecycle measures are incomplete.',
      items: [
        ['Enrollment Snapshot', 'A point-in-time captured enrollment value for a section.'],
        ['Snapshot Type', 'Lifecycle milestone being captured: First Day, Census 1, Census 2, Final, or Custom.'],
        ['Snapshot Date', 'The actual date represented by the uploaded partial export.'],
        ['Snapshot Coverage', 'Sections with a stored First Day snapshot divided by sections in the selected focus term.'],
        ['Source Field Used', 'The upload column used to populate the snapshot enrollment value.']
      ],
      version: 'Methodology v1.0'
    });
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

  async function runStudentPresence() {
    state.studentPresenceRan = true;
    const saved = captureFilterState('sp');
    const uploadedRows = await readCsv(document.getElementById('studentPresenceCsv'));
    const archivedRows = await readArchivedRows('spArchiveTerms');
    const independentRows = dedupeEnrollmentRows([...uploadedRows, ...archivedRows].map(normalize))
      .filter(row => !isStudentPresenceOmitted(row));
    const sourceRows = (independentRows.length ? independentRows : dashboardSourceRows())
      .filter(row => !row.isWorkExperience)
      .filter(row => !isStudentPresenceOmitted(row));
    state.studentPresenceSourceRows = sourceRows;
    const focusTerm = updatePresenceFocusTermOptions(sourceRows);
    refreshAnalyticsFilters('sp', sourceRows, saved);
    const diagnostics = standardExclusionDiagnostics(sourceRows, 'sp');
    const filteredRows = applyFilters(sourceRows, 'sp');
    const options = studentPresenceOptions();
    const scopedRows = studentPresenceScopedRows(dashboardCurrentRows(filteredRows, focusTerm), options);
    const report = dashboard.studentPresenceReport(scopedRows, document.getElementById('spGroup')?.value || 'campusDayHour', options);
    report.metrics = report.metrics || {};
    report.metrics.tutoringOpenLabRowsExcluded = diagnostics.tutoringOpenLabRowsExcluded;
    state.studentPresenceChartFilter = null;
    state.studentPresenceReport = report;
    state.studentPresenceGraphRows = scopedRows;
    state.studentPresenceComparisonRows = buildStudentPresenceComparisonRows(filteredRows, options);
    state.studentPresenceRows = report.rows;
    renderStudentPresenceReport(report);
  }

  function studentPresenceOptions() {
    return {
      includeDualEnrollment: document.getElementById('spIncludeDualEnrollment')?.checked === true,
      includeOtherModalities: document.getElementById('spIncludeOtherModalities')?.checked === true,
      physicalCampuses: studentPresenceCampusScope()
    };
  }

  function studentPresenceCampusScope() {
    const scope = canon(document.getElementById('spCampusScope')?.value || 'ALL');
    const allowed = ['COS', 'HAC', 'TCC'];
    if (allowed.includes(scope)) return [scope];
    return allowed;
  }

  function studentPresenceScopedRows(rows, options = studentPresenceOptions()) {
    const campuses = new Set((options.physicalCampuses || studentPresenceCampusScope()).map(canon));
    return (rows || [])
      .filter(studentPresenceHasUsableFixedTime)
      .filter(row => campuses.has(canon(row.campus)));
  }

  function buildStudentPresenceComparisonRows(rows, options) {
    const terms = [...new Set([studentPresenceFocusTerm(), ...getSelectedValues('spCompareTerms')].filter(Boolean))];
    return terms.map(term => {
      const termRows = studentPresenceScopedRows(dashboardCurrentRows(rows, term), options);
      const report = dashboard.studentPresenceReport(termRows, 'hour', options);
      return {
        term,
        sourceRows: termRows,
        rows: report.rows || [],
        metrics: report.metrics || {}
      };
    });
  }

  async function loadConflictRows() {
    const saved = captureFilterState('conflict');
    const uploadedRows = await readCsv(document.getElementById('conflictCsv'));
    const archivedRows = await readArchivedRows('conflictArchiveTerms');
    const sourceRows = [...uploadedRows, ...archivedRows].length
      ? [...uploadedRows, ...archivedRows].map(normalize)
      : currentRows();
    state.conflictInput = sourceRows.filter(row => !isOmittedInstructionalMethod(row));
    state.conflictTerms = collectRowTerms(state.conflictInput);
    updateConflictTermOptions(state.conflictTerms);
    refreshAnalyticsFilters('conflict', state.conflictInput, saved);
    return state.conflictInput;
  }

  function updateConflictTermOptions(terms) {
    const select = document.getElementById('conflictTerm');
    if (!select) return '';
    const prior = select.value;
    const sorted = [...(terms || [])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const active = canon(currentTerm());
    const selected = sorted.includes(prior) ? prior : sorted.includes(active) ? active : sorted[sorted.length - 1] || '';
    select.replaceChildren();
    sorted.forEach(term => select.appendChild(new Option(term, term, false, term === selected)));
    select.value = selected;
    return selected;
  }

  async function runConflictCheck() {
    state.conflictRan = true;
    const allRows = await loadConflictRows();
    const selectedTerm = canon(document.getElementById('conflictTerm')?.value || updateConflictTermOptions(state.conflictTerms));
    state.conflictDiagnostics = standardExclusionDiagnostics(allRows.filter(row => !selectedTerm || canon(row.term) === selectedTerm), 'conflict');
    const scopedRows = applyFilters(allRows.filter(row => !selectedTerm || canon(row.term) === selectedTerm), 'conflict');
    const modes = getSelectedValues('conflictModes');
    state.conflictRows = conflictRows(scopedRows, modes.length ? modes : ['ROOMOVERLAP', 'INSTRUCTOROVERLAP'], {
      omitCrossListed: document.getElementById('conflictOmitCrossListed')?.checked !== false,
      separateConflictTypes: document.getElementById('conflictSeparateTypes')?.checked === true
    });
    renderConflictCheck();
  }

  function conflictRows(rows, modes, options = {}) {
    const selectedModes = new Set((modes || []).map(canon));
    const omitCrossListed = options.omitCrossListed !== false;
    const separateConflictTypes = options.separateConflictTypes === true;
    const meetings = fixedMeetingRecords(rows);
    const conflicts = [];
    const seen = new Set();
    for (let i = 0; i < meetings.length; i += 1) {
      for (let j = i + 1; j < meetings.length; j += 1) {
        const a = meetings[i];
        const b = meetings[j];
        if (a.term !== b.term || a.day !== b.day || a.sectionKey === b.sectionKey) continue;
        if (omitCrossListed && hasCrossList(a, b)) continue;
        if (!dateRangesOverlap(a, b)) continue;
        const overlapStart = Math.max(a.startMinutes, b.startMinutes);
        const overlapEnd = Math.min(a.endMinutes, b.endMinutes);
        const overlap = overlapEnd - overlapStart;
        if (overlap <= 0) continue;
        const exactTime = a.startMinutes === b.startMinutes && a.endMinutes === b.endMinutes;
        const roomOverlap = sameRoom(a, b);
        const instructorOverlap = sameInstructor(a, b);
        if (!separateConflictTypes && selectedModes.has('ROOMOVERLAP') && selectedModes.has('INSTRUCTOROVERLAP') && roomOverlap && instructorOverlap) {
          const key = ['ROOMINSTRUCTOROVERLAP', a.sectionKey, b.sectionKey, a.day, a.startMinutes, b.startMinutes].join('|');
          if (!seen.has(key)) {
            seen.add(key);
            conflicts.push(conflictRecord('Same Room + Same Instructor', a, b, overlapStart, overlapEnd, overlap));
          }
          continue;
        }
        const checks = [
          ['ROOMOVERLAP', 'Same room overlap', roomOverlap],
          ['INSTRUCTOROVERLAP', 'Same instructor overlap', instructorOverlap],
          ['ROOMEXACT', 'Same room + same time', sameRoom(a, b) && exactTime],
          ['INSTRUCTOREXACT', 'Same instructor + same time', sameInstructor(a, b) && exactTime],
          ['COURSEPATTERN', 'Same course/day/time pattern', sameCourse(a, b) && exactTime]
        ];
        checks.forEach(([mode, label, matches]) => {
          if (!matches || !selectedModes.has(mode)) return;
          const key = [mode, a.sectionKey, b.sectionKey, a.day, a.startMinutes, b.startMinutes].join('|');
          if (seen.has(key)) return;
          seen.add(key);
          conflicts.push(conflictRecord(label, a, b, overlapStart, overlapEnd, overlap));
        });
      }
    }
    return conflicts.sort((a, b) =>
      a.term.localeCompare(b.term, undefined, { numeric: true }) ||
      dayOrder.indexOf(canonDay(a.day)) - dayOrder.indexOf(canonDay(b.day)) ||
      String(a.timeOverlap).localeCompare(String(b.timeOverlap)) ||
      a.conflictType.localeCompare(b.conflictType)
    );
  }

  function fixedMeetingRecords(rows) {
    const map = new Map();
    (rows || []).forEach(row => {
      const startMinutes = minutesFromTime(row.start);
      const endMinutes = minutesFromTime(row.end);
      const fixedDays = (row.days || []).map(canonDay).filter(day => dayOrder.includes(day));
      if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes || !fixedDays.length) return;
      fixedDays.forEach(day => {
        const sectionId = sectionKey(row);
        const dateRange = normalizedDateRange(row);
        const meetingKey = [sectionId, day, startMinutes, endMinutes, dateRange].join('|');
        if (map.has(meetingKey)) return;
        map.set(meetingKey, {
          row,
          sectionKey: sectionId,
          term: canon(row.term),
          day,
          meetingDays: row.dayPattern || dayPattern(row.days || []),
          startMinutes,
          endMinutes,
          crn: row.crn || '',
          course: `${row.subject || ''} ${row.course || ''}`.trim(),
          instructor: row.instructor || '',
          room: row.room || [row.building, row.roomOnly].filter(Boolean).join(' '),
          roomKey: canon(row.room || [row.building, row.roomOnly].filter(Boolean).join(' ')),
          courseKey: canon(`${row.subject || ''} ${row.course || ''}`.trim()),
          crossList: canon(row.crossList),
          startDate: row.startDate || '',
          endDate: row.endDate || '',
          dateRange: sectionDateRange(row),
          dateRangeLabel: dateRange
        });
      });
    });
    return [...map.values()];
  }

  function parseSectionDate(value) {
    const text = String(value || '').trim();
    if (!text) return null;
    const serial = Number(text);
    if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
      const excelEpoch = Date.UTC(1899, 11, 30);
      return new Date(excelEpoch + serial * 24 * 60 * 60 * 1000);
    }
    const parsed = Date.parse(text);
    if (Number.isFinite(parsed)) return new Date(parsed);
    const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (!match) return null;
    const month = Number(match[1]) - 1;
    const day = Number(match[2]);
    const rawYear = Number(match[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const date = new Date(year, month, day);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  function sectionDateRange(row) {
    const start = parseSectionDate(row?.startDate);
    const end = parseSectionDate(row?.endDate);
    if (!start && !end) return null;
    return {
      start: start || end,
      end: end || start
    };
  }

  function dateRangesOverlap(a, b) {
    const left = a?.dateRange || sectionDateRange(a);
    const right = b?.dateRange || sectionDateRange(b);
    if (!left || !right) return true;
    return left.start <= right.end && right.start <= left.end;
  }

  function formatSectionDate(value) {
    const date = parseSectionDate(value);
    if (!date) return String(value || '');
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  }

  function normalizedDateRange(row) {
    const start = formatSectionDate(row?.startDate);
    const end = formatSectionDate(row?.endDate);
    if (start && end) return `${start}-${end}`;
    return start || end || '';
  }

  function canonDay(value) {
    return canon(value);
  }

  function sameRoom(a, b) {
    return Boolean(a.roomKey && b.roomKey && a.roomKey === b.roomKey);
  }

  function sameInstructor(a, b) {
    const left = canon(a.instructor);
    const right = canon(b.instructor);
    return Boolean(left && right && left !== 'STAFF' && right !== 'STAFF' && left === right);
  }

  function sameCourse(a, b) {
    return Boolean(a.courseKey && b.courseKey && a.courseKey === b.courseKey);
  }

  function hasCrossList(a, b) {
    return Boolean(a.crossList || b.crossList);
  }

  function conflictRecord(conflictType, a, b, overlapStart, overlapEnd, overlapMinutesValue) {
    return {
      conflictType,
      term: a.term,
      day: a.day,
      meetingDays1: a.meetingDays,
      timeOverlap: `${formatMinutes(overlapStart)}-${formatMinutes(overlapEnd)}`,
      crn1: a.crn,
      course1: a.course,
      instructor1: a.instructor,
      room1: a.room,
      startDate1: formatSectionDate(a.startDate),
      endDate1: formatSectionDate(a.endDate),
      dateRange1: a.dateRangeLabel || normalizedDateRange(a),
      crossList1: a.crossList,
      meetingDays2: b.meetingDays,
      crn2: b.crn,
      course2: b.course,
      instructor2: b.instructor,
      room2: b.room,
      startDate2: formatSectionDate(b.startDate),
      endDate2: formatSectionDate(b.endDate),
      dateRange2: b.dateRangeLabel || normalizedDateRange(b),
      crossList2: b.crossList,
      overlapMinutes: overlapMinutesValue
    };
  }

  function renderConflictCheck() {
    const rows = state.conflictRows || [];
    const diagnostics = state.conflictDiagnostics || {};
    const typeCounts = new Map();
    const dayCounts = new Map();
    rows.forEach(row => typeCounts.set(row.conflictType, (typeCounts.get(row.conflictType) || 0) + 1));
    rows.forEach(row => dayCounts.set(row.day, (dayCounts.get(row.day) || 0) + 1));
    metric('conflictMetrics', [
      ['Term', document.getElementById('conflictTerm')?.value || 'N/A'],
      ['Conflicts Found', rows.length],
      ['Conflict Types', [...typeCounts.entries()].map(([type, count]) => `${type}: ${count}`).join('; ') || 'None'],
      ['Conflict Days', [...dayCounts.entries()].sort((a, b) => dayOrder.indexOf(canonDay(a[0])) - dayOrder.indexOf(canonDay(b[0]))).map(([day, count]) => `${dayLabels[day] || day}: ${count}`).join('; ') || 'None'],
      ['Tutoring/Open Lab Rows Excluded', diagnostics.tutoringOpenLabRowsExcluded || 0],
      ['Cross-Listed Pairs', document.getElementById('conflictOmitCrossListed')?.checked !== false ? 'Omitted when either row has CROSS_LIST' : 'Included'],
      ['Duplicate Type Rows', document.getElementById('conflictSeparateTypes')?.checked === true ? 'Separate' : 'Combined']
    ]);
    table('conflictTable', rows, [
      'conflictType',
      'term',
      'day',
      'timeOverlap',
      'meetingDays1',
      'crn1',
      'course1',
      'instructor1',
      'room1',
      'startDate1',
      'endDate1',
      'dateRange1',
      'crossList1',
      'meetingDays2',
      'crn2',
      'course2',
      'instructor2',
      'room2',
      'startDate2',
      'endDate2',
      'dateRange2',
      'crossList2',
      'overlapMinutes'
    ]);
    renderConflictLegend();
  }

  function conflictInspectionRows() {
    const selectedTerm = canon(document.getElementById('conflictTerm')?.value || '');
    return (state.conflictInput || [])
      .filter(row => !selectedTerm || canon(row.term) === selectedTerm)
      .map(row => ({
        sourceTerm: row.raw?.__sourceTerm || row.__sourceTerm || row.term,
        term: row.term,
        crn: row.crn,
        subject: row.subject,
        course: row.course,
        section: row.section,
        title: row.title,
        division: row.division,
        campus: row.campus,
        modality: row.modality,
        instructor: row.instructor,
        days: row.dayPattern,
        start: row.start,
        end: row.end,
        building: row.building,
        room: row.roomOnly || row.room,
        crossList: row.crossList,
        sourceType: row.sourceType
      }));
  }

  function renderConflictArchiveInspection() {
    table('conflictArchiveInspection', conflictInspectionRows(), [
      'sourceTerm',
      'term',
      'crn',
      'subject',
      'course',
      'section',
      'title',
      'division',
      'campus',
      'modality',
      'instructor',
      'days',
      'start',
      'end',
      'building',
      'room',
      'crossList',
      'sourceType'
    ]);
  }

  async function inspectArchivedSchedule() {
    const term = canon(document.getElementById('archiveInspectionTerm')?.value || '');
    const hasCsv = Boolean(document.getElementById('archiveInspectionCsv')?.files?.length);
    if (!term && !hasCsv) {
      renderArchiveInspectionError('Select an archived term to inspect.');
      return [];
    }
    const rawRows = hasCsv
      ? await readCsv(document.getElementById('archiveInspectionCsv'), { sourceType: 'ARCHIVE_INSPECTION_UPLOAD' })
      : await fetchArchivedTermRows(term, 'Archive Inspection');
    state.archiveInspectionTerm = hasCsv ? (collectRowTerms(rawRows.map(normalize))[0] || term || 'UPLOADED CSV') : term;
    state.archiveInspectionRows = rawRows.map(normalize);
    renderArchiveInspection(rawRows, state.archiveInspectionRows, state.archiveInspectionTerm);
    return state.archiveInspectionRows;
  }

  function archiveInspectionRows() {
    return (state.archiveInspectionRows || []).map(row => ({
      sourceTerm: row.raw?.__sourceTerm || row.__sourceTerm || state.archiveInspectionTerm || row.term,
      term: row.term,
      crn: row.crn,
      subject: row.subject,
      course: row.course,
      section: row.section,
      title: row.title,
      division: row.division,
      department: row.department,
      campus: row.campus,
      modality: row.modality,
      instructionalMethod: row.instructionalMethod,
      instructor: row.instructor,
      days: row.dayPattern,
      start: row.start,
      end: row.end,
      timeBlock: row.timeBlock,
      building: row.building,
      room: row.roomOnly || row.room,
      capacity: row.cap,
      censusEnrollment: row.census,
      finalEnrollment: row.actual,
      crossList: row.crossList,
      tutoringOpenLab: isTutoringOpenLabSection(row) ? 'Yes' : 'No',
      invalidNegativeCensus2: row.invalidNegativeCensus2 ? 'Yes' : 'No',
      sourceType: row.sourceType
    }));
  }

  function renderArchiveInspection(rawRows, rows, selectedTerm) {
    const termsDetected = collectRowTerms(rows);
    const distinctCrns = new Set(rows.map(row => canon(row.crn)).filter(Boolean));
    const physicalRows = rows.filter(row => row.modality !== 'ONLINE' && row.modality !== 'TBA' && row.timeBlock !== 'ONLINE/TBA' && row.days?.length);
    const physicalCrns = new Set(physicalRows.map(row => canon(row.crn)).filter(Boolean));
    const onlineCrns = new Set(rows.filter(row => row.modality === 'ONLINE' || row.timeBlock === 'ONLINE/TBA').map(row => canon(row.crn)).filter(Boolean));
    const tbaRows = rows.filter(row => row.timeBlock === 'ONLINE/TBA' || !row.start || !row.end || row.dayPattern === 'TBA');
    const crossListedRows = rows.filter(row => row.crossList).length;
    const dualEnrollmentRows = rows.filter(row => row.modality === 'DUAL ENROLLMENT' || row.instructionalMethod === 'DE').length;
    const workExperienceRows = rows.filter(row => row.isWorkExperience || row.modality === 'WORK EXPERIENCE').length;
    const tutoringOpenLabRows = rows.filter(isTutoringOpenLabSection).length;
    const invalidNegativeCensus2Rows = rows.filter(row => row.invalidNegativeCensus2).length;
    metric('archiveInspectionMetrics', [
      ['Selected Archive Term', selectedTerm || 'N/A'],
      ['Raw Row Count', rawRows.length],
      ['Normalized Row Count', rows.length],
      ['Distinct CRN Count', distinctCrns.size],
      ['Distinct Physical CRNs', physicalCrns.size],
      ['Online CRNs', onlineCrns.size],
      ['TBA/No Fixed Time Rows', tbaRows.length],
      ['Cross-Listed Rows', crossListedRows],
      ['Dual Enrollment Rows', dualEnrollmentRows],
      ['Work Experience Rows', workExperienceRows],
      ['Tutoring/Open Lab Rows', tutoringOpenLabRows],
      ['Rows with Invalid Negative Census 2', invalidNegativeCensus2Rows],
      ['Term Value Detected', termsDetected.length ? termsDetected.join(', ') : 'N/A']
    ]);
    document.getElementById('archiveInspectionSummary').innerHTML = [
      archiveDistributionPanel('Campus Distribution', rows, row => row.campus || 'Blank'),
      archiveDistributionPanel('Modality Distribution', rows, row => row.modality || 'Blank'),
      archiveDistributionPanel('Instructional Method Code Distribution', rows, row => row.instructionalMethod || 'Blank'),
      archiveDistributionPanel('Day/Time Distribution', rows, row => `${row.dayPattern || 'Blank/TBA'} ${row.timeBlock || 'Blank/TBA'}`.trim())
    ].join('');
    table('archiveInspectionSamples', archiveInspectionRows().slice(0, 100), [
      'term',
      'crn',
      'subject',
      'course',
      'section',
      'campus',
      'building',
      'room',
      'days',
      'start',
      'end',
      'timeBlock',
      'modality',
      'instructionalMethod',
      'crossList',
      'tutoringOpenLab',
      'invalidNegativeCensus2',
      'censusEnrollment',
      'capacity'
    ]);
  }

  function renderArchiveInspectionError(message) {
    metric('archiveInspectionMetrics', [
      ['Parsed Rows', 0],
      ['Distinct CRNs', 0],
      ['Term Value Detected', 'N/A']
    ]);
    document.getElementById('archiveInspectionSummary').innerHTML = `<p class="analytics-empty">${escapeAttr(message)}</p>`;
    document.getElementById('archiveInspectionSamples').innerHTML = `<p class="analytics-empty">${escapeAttr(message)}</p>`;
  }

  function archiveDistributionPanel(title, rows, keyer) {
    const counts = distributionRows(rows, keyer).slice(0, 15);
    const body = counts.length
      ? `<table class="dashboard-mini-table"><thead><tr><th>Value</th><th>Rows</th><th>Share</th></tr></thead><tbody>${counts.map(row => `<tr><td>${escapeAttr(row.value)}</td><td>${row.count}</td><td>${pct(row.share)}</td></tr>`).join('')}</tbody></table>`
      : '<p class="analytics-empty">No values found.</p>';
    return `<section class="dashboard-panel"><h3>${escapeAttr(title)}</h3>${body}</section>`;
  }

  function distributionRows(rows, keyer) {
    const counts = new Map();
    rows.forEach(row => {
      const key = canon(keyer(row) || 'Blank');
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return [...counts.entries()]
      .map(([value, count]) => ({ value, count, share: safeDiv(count, rows.length) }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, undefined, { numeric: true }));
  }

  function renderConflictLegend() {
    const legend = document.getElementById('conflictLegend');
    if (!legend) return;
    renderMethodologyPanel(legend, {
      title: 'Conflict Check Methodology & Data Dictionary',
      purpose: 'Identifies loaded class meetings that overlap by room, instructor, exact room/time, exact instructor/time, or same course/day/time pattern.',
      methodology: 'The report creates one meeting record per Term + CRN + day + start + end, removes duplicate meeting rows, then compares every fixed meeting pair in the selected term. A conflict is flagged when the two meetings share the selected basis, their time intervals overlap, and their section date ranges overlap. When same room and same instructor both match, the pair is shown once as Same Room + Same Instructor unless Show separate conflict types is selected.',
      assumptions: 'Rows without fixed meeting days and valid start/end times are excluded. Fully online or TBA rows only appear if they include fixed meeting days and times. Same room uses the normalized building/room text. Same instructor uses the uploaded instructor field. Start Date and End Date are used to suppress false conflicts between non-overlapping parts of term; if either row has no usable date range, the report keeps the possible conflict because the dates cannot rule it out. CROSS_LIST identifies cross-listed rows; rows with nonblank CROSS_LIST values are omitted by default.',
      limitations: 'This report identifies schedule conflicts for review. It does not decide whether intentional cross-listing, arranged meetings, room-sharing, instructor load rules, or special events make an overlap acceptable.',
      items: [
        ['Conflict Type', 'The selected conflict basis that matched: same room overlap, same instructor overlap, exact room/time, exact instructor/time, or same course/day/time pattern.'],
        ['Time Overlap', 'The intersecting portion of the two class meeting intervals. Partial overlaps are included.'],
        ['Date Range 1 / Date Range 2', 'Parsed section date ranges. Pairs with non-overlapping date ranges are not shown as conflicts.'],
        ['CRN 1 / CRN 2', 'The two distinct CRNs involved. A CRN is never compared against itself.'],
        ['Cross List 1 / Cross List 2', 'Parsed CROSS_LIST values for each section. If Omit Cross-Listed Sections is on, conflict pairs where either row has a nonblank value do not appear in conflict results.'],
        ['Overlap Minutes', 'Number of minutes shared by both meetings on the same day. Formula: min(end times) - max(start times).'],
        ['Deduplication', 'Duplicate meeting rows for the same Term + CRN + day + start + end are counted once. Distinct meeting patterns for the same CRN remain available for comparison against other sections.'],
        ['Parsed Schedule Inspection', 'A review/export table showing the normalized rows loaded from selected archived terms and/or current uploads so archived terms such as Spring 2027 can be verified before interpreting conflicts.']
      ],
      version: 'Methodology v1.0'
    });
  }

  function renderStudentPresenceReport(report) {
    const metrics = report.metrics || {};
    state.studentPresenceReport = report;
    metric('studentPresenceMetrics', [
      ['Focus Term', studentPresenceFocusTerm() || 'N/A'],
      ['Students Present', metrics.totalStudents || 0],
      ['Sections Active', metrics.totalSections || 0],
      ['Distinct CRNs Included', metrics.distinctCrns || 0],
      ['Meeting Rows Included', metrics.meetingRowsIncluded || 0],
      ['Tutoring/Open Lab Rows Excluded', metrics.tutoringOpenLabRowsExcluded || 0],
      ['Seats Scheduled', metrics.totalSeats || 0],
      ['Available Capacity', metrics.totalOpen || 0],
      ['Average Fill Rate', pct(metrics.averageFillRate || 0)],
      ['Peak Hour', presenceMetricLabel(metrics.peakHour)],
      ['Lightest Hour', presenceMetricLabel(metrics.lightestHour)],
      ['Peak Campus', presenceMetricLabel(metrics.peakCampus)],
      ['Peak Building', presenceMetricLabel(metrics.peakBuilding)],
      ['Peak Room', presenceMetricLabel(metrics.peakRoom)]
    ]);
    renderPresenceHeatmap(report.rows || []);
    renderStudentPresenceCurve(state.studentPresenceGraphRows || []);
    renderStudentPresenceChartFilterNote();
    if (state.studentPresenceChartFilter) {
      const rows = studentPresenceFilteredSectionRows();
      state.studentPresenceExportRows = rows;
      table('studentPresenceTable', rows, [
        'term',
        'crn',
        'course',
        'section',
        'campus',
        'building',
        'room',
        'day',
        'start',
        'end',
        'enrollment',
        'capacity',
        'instructor'
      ]);
    } else {
      const rows = report.rows || [];
      state.studentPresenceExportRows = rows;
      table('studentPresenceTable', rows, [
        'group',
        'campus',
        'building',
        'room',
        'day',
        'hour',
        'studentsPresent',
        'sectionsActive',
        'distinctCrns',
        'meetingRowsIncluded',
        'availableRoomCapacity',
        'seatsScheduled',
        'averageFillRate'
      ]);
    }
    renderStudentPresenceLegend();
  }

  function studentPresenceFilteredSectionRows() {
    const filter = state.studentPresenceChartFilter;
    if (!filter) return [];
    const start = filter.startMinutes;
    const end = filter.endMinutes;
    const rows = studentPresenceRowsForChartTerm(filter.term)
      .map(row => window.COSSectionModel?.normalizeSection?.(row) || row)
      .filter(row => {
        const rowStart = minutesFromTime(row.start);
        const rowEnd = minutesFromTime(row.end);
        return row.days?.includes(filter.dayCode) && rowStart != null && rowEnd != null && rowStart < end && rowEnd > start;
      });
    const seen = new Set();
    return rows.reduce((items, row) => {
      const key = [row.term, row.crn || row.courseCode, filter.dayCode, row.start, row.end].join('|');
      if (seen.has(key)) return items;
      seen.add(key);
      items.push({
        term: row.term || filter.term || '',
        crn: row.crn || '',
        course: row.courseCode || [row.subject, row.course].filter(Boolean).join(' '),
        section: row.section || '',
        campus: row.campus || '',
        building: row.building || '',
        room: row.roomOnly || row.room || '',
        day: filter.dayCode,
        start: row.start || '',
        end: row.end || '',
        enrollment: window.COSSectionModel?.enrollmentForSection?.(row) ?? row.census ?? row.actual ?? 0,
        capacity: row.cap || 0,
        instructor: row.instructor || ''
      });
      return items;
    }, []);
  }

  function studentPresenceRowsForChartTerm(term) {
    const match = (state.studentPresenceComparisonRows || []).find(item => item.term === term);
    if (match?.sourceRows) return match.sourceRows;
    return state.studentPresenceGraphRows || [];
  }

  function exportStudentPresenceRows() {
    const rows = state.studentPresenceExportRows?.length ? state.studentPresenceExportRows : state.studentPresenceRows;
    const suffix = state.studentPresenceChartFilter
      ? `${state.studentPresenceChartFilter.term || studentPresenceFocusTerm() || 'term'}-${state.studentPresenceChartFilter.dayCode}-${state.studentPresenceChartFilter.hourKey}`
      : studentPresenceFocusTerm() || 'term';
    exportRows(rows || [], `student-presence-${suffix}.csv`);
  }

  function renderStudentPresenceChartFilterNote() {
    const node = document.getElementById('studentPresenceChartFilterNote');
    if (!node) return;
    const filter = state.studentPresenceChartFilter;
    if (!filter) {
      node.hidden = true;
      node.innerHTML = '';
      return;
    }
    node.hidden = false;
    node.innerHTML = `
      <span>Table filtered to ${escapeAttr(filter.term || studentPresenceFocusTerm() || 'selected term')} ${escapeAttr(filter.dayName)} from ${escapeAttr(filter.hourLabel)} to ${escapeAttr(filter.endLabel)}.</span>
      <button id="clearStudentPresenceChartFilter" type="button">Clear graph filter</button>`;
    document.getElementById('clearStudentPresenceChartFilter')?.addEventListener('click', () => {
      state.studentPresenceChartFilter = null;
      renderStudentPresenceReport(state.studentPresenceReport || { rows: state.studentPresenceRows || [], metrics: {} });
    });
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
          <li>Distinct CRNs: ${row.distinctCrns || row.sectionsActive || 0}</li>
          <li>Meeting rows: ${row.meetingRowsIncluded || row.sectionsActive || 0}</li>
          <li>Open capacity: ${row.availableRoomCapacity}</li>
        </ul>
      </section>`).join('');
    node.innerHTML = cells || '<p class="analytics-empty">No fixed in-person or hybrid presence rows match the selected filters.</p>';
  }

  function formatPresenceHourLabel(hour) {
    const totalMinutes = Math.round(hour * 60);
    const h24 = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const ap = h24 < 12 ? 'AM' : 'PM';
    const h12 = h24 % 12 || 12;
    return `${h12}:${String(minutes).padStart(2, '0')} ${ap}`;
  }

  function presenceHourKey(hour) {
    const totalMinutes = Math.round(hour * 60);
    const h24 = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(h24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  function presenceHourMinutes(hour) {
    return Math.round(hour * 60);
  }

  function presenceChartHours(rows) {
    let min = 24;
    let max = 0;
    (rows || []).forEach(row => {
      const start = minutesFromTime(row.start);
      const end = minutesFromTime(row.end);
      if (start == null || end == null || end <= start) return;
      min = Math.min(min, Math.floor((start / 60) * 2) / 2);
      max = Math.max(max, Math.ceil((end / 60) * 2) / 2);
    });
    if (min >= max) {
      min = 6;
      max = 22;
    }
    if (min > 6) min = 6;
    if (max < 22) max = 22;
    const hours = [];
    for (let hour = min; hour < max; hour += 0.5) hours.push(Number(hour.toFixed(1)));
    return hours;
  }

  function nicePresenceTickStep(maxValue) {
    if (maxValue <= 5) return 1;
    const candidates = [2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
    return candidates.find(step => Math.ceil(maxValue / step) <= 8) || 5000;
  }

  function studentPresencePhysicalGraphRows(rows) {
    return (rows || [])
      .map(row => window.COSSectionModel?.normalizeSection?.(row) || row)
      .filter(row => row.isPhysical && !row.isOnline && row.timeBlock !== 'ONLINE/TBA')
      .filter(studentPresenceHasUsableFixedTime);
  }

  function studentPresenceHasUsableFixedTime(row) {
    const section = window.COSSectionModel?.normalizeSection?.(row) || row;
    const start = minutesFromTime(section.start);
    const end = minutesFromTime(section.end);
    if (start == null || end == null || end <= start) return false;
    // Midnight and pre-6 AM values in Section Seating are usually Online/TBA/no-fixed-time placeholders.
    return start >= 6 * 60;
  }

  function renderStudentPresenceCurve(rows) {
    const node = document.getElementById('studentPresenceCurve');
    if (!node) return;
    if (studentPresenceChartInstance) {
      studentPresenceChartInstance.destroy();
      studentPresenceChartInstance = null;
    }
    const sourceRows = studentPresencePhysicalGraphRows(rows);
    if (!sourceRows.length || !window.Chart || !window.COSSectionModel?.buildHalfHourPresenceSeries) {
      node.innerHTML = '<p class="analytics-empty">No student presence curve is available for the selected term scope.</p>';
      return;
    }
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const chartSources = studentPresenceChartSources(sourceRows);
    const chartRows = chartSources.flatMap(source => source.rows);
    const hours = presenceChartHours(chartRows.length ? chartRows : sourceRows);
    const colorList = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2'];
    const multipleTerms = chartSources.length > 1;
    const datasets = chartSources.flatMap((source, sourceIndex) => {
      const counts = window.COSSectionModel.buildHalfHourPresenceSeries(source.rows, hours, {
        metric: 'presence',
        daysOfWeek,
        excludeOnlineTba: true
      });
      return daysOfWeek.map((day, index) => ({
        label: multipleTerms ? `${source.term || 'Selected Term'} ${day}` : day,
        data: hours.map(hour => counts[`${day}-${hour}`] || 0),
        fill: false,
        borderColor: colorList[index % colorList.length],
        backgroundColor: colorList[index % colorList.length],
        borderDash: sourceIndex ? [6, 4] : [],
        tension: 0.3,
        pointRadius: 2,
        borderWidth: sourceIndex ? 1.75 : 2.5,
        presenceTerm: source.term,
        presenceDay: day
      }));
    });
    const maxY = Math.max(0, ...datasets.flatMap(dataset => dataset.data));
    const stepSize = nicePresenceTickStep(maxY);
    const yMax = Math.max(stepSize, Math.ceil(maxY / stepSize) * stepSize);
    const tickCount = Math.min(9, Math.ceil(yMax / stepSize) + 1);
    node.innerHTML = `
      <section class="presence-curve">
        <h3>Student Presence Graph</h3>
        <p>Student Presence estimates how many enrolled students are scheduled to be physically present during each half-hour interval. Each section contributes its census enrollment, or current enrollment when census is unavailable, to every interval where the class is active. Duplicate rows for the same CRN/day/time block are counted once.</p>
        <div class="presence-chart-container" style="width:100%; max-width:1600px; height:600px; margin:auto;">
          <canvas id="studentPresenceLineChart" style="width:100%; height:100%;"></canvas>
        </div>
      </section>`;
    const canvas = document.getElementById('studentPresenceLineChart');
    if (!canvas) return;
    studentPresenceChartInstance = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: hours.map(formatPresenceHourLabel),
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event, elements, chart) => {
          const points = chart.getElementsAtEventForMode(event, 'nearest', { intersect: false }, true);
          if (!points.length) return;
          const point = points[0];
          const dataset = chart.data.datasets[point.datasetIndex] || {};
          const dayName = dataset.presenceDay || dataset.label || '';
          const dayCodes = { Sunday: 'SU', Monday: 'MO', Tuesday: 'TU', Wednesday: 'WE', Thursday: 'TH', Friday: 'FR', Saturday: 'SA' };
          const hour = hours[point.index];
          state.studentPresenceChartFilter = {
            term: dataset.presenceTerm || studentPresenceFocusTerm() || '',
            dayName,
            dayCode: dayCodes[dayName] || dayName,
            hourKey: presenceHourKey(hour),
            hourLabel: formatPresenceHourLabel(hour),
            endLabel: formatPresenceHourLabel(hour + 0.5),
            startMinutes: presenceHourMinutes(hour),
            endMinutes: presenceHourMinutes(hour + 0.5)
          };
          renderStudentPresenceReport(state.studentPresenceReport || { rows: state.studentPresenceRows || [], metrics: {} });
        },
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            enabled: true,
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}`
            }
          }
        },
        layout: { padding: 0 },
        scales: {
          x: { title: { display: true, text: 'Time of Day' }, ticks: { font: { size: 10 } } },
          y: {
            min: 0,
            max: yMax,
            title: { display: true, text: 'Estimated Students Present' },
            beginAtZero: true,
            ticks: {
              stepSize,
              maxTicksLimit: tickCount,
              padding: 2,
              font: { size: 10 }
            }
          }
        }
      }
    });
  }

  function studentPresenceChartSources(primaryRows) {
    const focusTerm = studentPresenceFocusTerm() || '';
    const sources = [];
    const seen = new Set();
    const addSource = (term, rows) => {
      const key = term || 'selected';
      if (seen.has(key)) return;
      const physicalRows = studentPresencePhysicalGraphRows(rows || []);
      if (!physicalRows.length) return;
      seen.add(key);
      sources.push({ term, rows: physicalRows });
    };
    addSource(focusTerm, primaryRows);
    (state.studentPresenceComparisonRows || []).forEach(item => addSource(item.term, item.sourceRows || []));
    return sources.length ? sources : [{ term: focusTerm, rows: primaryRows }];
  }

  function renderStudentPresenceLegend() {
    const legend = document.getElementById('studentPresenceLegend');
    if (!legend) return;
    renderMethodologyPanel(legend, {
      title: 'Student Presence Analytics Methodology & Data Dictionary',
      purpose: 'Estimates physical student presence from loaded scheduled sections and enrollment for the selected focus term.',
      methodology: 'Rows are included by default only when they are in-person or hybrid, have fixed meeting days and times, use physical COS/TCC/HAC campus codes or their local aliases, and do not use online, web, virtual, or TBA campus values. Dual Enrollment is excluded by default and can be included with the report toggle. Students present uses census enrollment when available and current enrollment otherwise. Each CRN is counted once within each half-hour day/time bucket even if the source file has multiple rows for the same section, non-recurring dates, or paired rooms.',
      assumptions: 'Available room capacity is scheduled seats minus enrollment for the included meeting buckets. A multi-day or long-duration section contributes to each applicable half-hour bucket, but overall active sections count distinct CRNs across the selected scope. Comparison curves use the same filters and inclusion toggles for each selected term.',
      limitations: 'This report does not count unscheduled student presence, online attendance, tutoring, library use, athletics, events, or services traffic.',
      items: [
        ['Students Present', 'Sum of census/current enrollment once per CRN in the selected physical presence bucket.'],
        ['Sections Active', 'Distinct CRNs represented in the bucket, not raw meeting rows.'],
        ['Distinct CRNs Included', 'Overall count of unique CRNs included after filters and physical-presence exclusions.'],
        ['Meeting Rows Included', 'Raw included meeting rows after filters. This can be higher than distinct CRNs when a section has multiple meeting rows.'],
        ['Half-Hour Physical Presence Curve', 'Compares selected terms across half-hour intervals. A section contributes to every half-hour interval overlapped by its meeting time, and duplicate rows for the same CRN/interval are counted once.'],
        ['Include Dual Enrollment', 'Optional control. Default OFF. When enabled, Dual Enrollment rows with physical campus/day/time data may be included.'],
        ['Include Other Modalities', 'Optional control. Default OFF. When enabled, fixed-time non-online rows outside In-Person/Hybrid can be reviewed. Hide Online can then be used to remove online rows from that expanded scope.'],
        ['Campus Scope', 'Limits Student Presence Analytics to COS, HAC, and TCC only. All includes those three campus codes; selecting COS, HAC, or TCC narrows the report to that campus. Other campus codes are omitted from this report.'],
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
      allSections: 0,
      allFirstDay: 0,
      allCensus: 0,
      allCensus2: 0,
      allFinal: 0,
      census: 0,
      census2: 0,
      final: 0,
      capacity: 0,
      terms: new Set(),
      allCrns: new Set(),
      allFirstDayCount: 0,
      allCensus1Count: 0,
      allCensus2Count: 0,
      allFinalCount: 0,
      decisionSections: 0,
      decisionCrns: new Set(),
      decisionFirstDay: 0,
      decisionCensus: 0,
      decisionCensus2: 0,
      decisionFinal: 0,
      decisionCapacity: 0,
      decisionFirstDayCount: 0,
      decisionCensus1Count: 0,
      decisionCensus2Count: 0,
      decisionFinalCount: 0,
      historySections: 0,
      historyCrns: new Set(),
      historyFirstDay: 0,
      historyCensus: 0,
      historyCensus2: 0,
      historyFinal: 0,
      historyCapacity: 0,
      historyFirstDayCount: 0,
      historyCensus1Count: 0,
      historyCensus2Count: 0,
      historyFinalCount: 0,
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
      existing.isWorkExperience = existing.isWorkExperience || row.isWorkExperience;
      existing.sourceType = existing.isWorkExperience ? 'WORK EXPERIENCE' : existing.sourceType || row.sourceType;
      existing.accountingReportable = existing.isWorkExperience ? true : accountingMethodInfo(existing.accountingMethod).reportable;
      existing.invalidNegativeCensus2 = existing.invalidNegativeCensus2 || row.invalidNegativeCensus2;
      existing.isTutoringOpenLab = existing.isTutoringOpenLab || row.isTutoringOpenLab || isTutoringOpenLabSection(row);
      existing.hasDirectFtesData = existing.hasDirectFtesData || row.hasDirectFtesData;
      existing.hasFtesData = existing.hasFtesData || row.hasFtesData;
      existing.ftesUnavailable = existing.ftesUnavailable && row.ftesUnavailable;
      existing.ftesWarning = existing.ftesUnavailable ? existing.ftesWarning || row.ftesWarning : '';
    });
    return [...map.values()].map(recalculateEstimatedFtes);
  }

  function finiteOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function rowFirstDay(row) {
    return finiteOrNull(row?.firstDay);
  }

  function rowCensus1(row) {
    return finiteOrNull(row?.census1 ?? row?.census);
  }

  function rowCensus2(row) {
    return finiteOrNull(row?.census2);
  }

  function rowEndEnrollment(row) {
    return finiteOrNull(row?.finalEnrollment ?? finalEnrollment(row));
  }

  function milestonePopulationDiagnostics(rows = []) {
    const deduped = dedupeEnrollmentRows(rows);
    const allCrns = new Set(deduped.map(row => sectionKey(row)).filter(Boolean));
    const milestones = [
      ['firstDay', rowFirstDay],
      ['census1', rowCensus1],
      ['census2', rowCensus2],
      ['final', rowEndEnrollment]
    ];
    const result = {};
    milestones.forEach(([key, getter]) => {
      const crns = new Set();
      let total = 0;
      deduped.forEach(row => {
        const value = getter(row);
        if (value == null) return;
        crns.add(sectionKey(row));
        total += value;
      });
      result[key] = { crns, count: crns.size, total };
    });
    const comparablePairs = [
      ['firstDay', 'census1'],
      ['firstDay', 'census2'],
      ['firstDay', 'final'],
      ['census1', 'census2'],
      ['census1', 'final'],
      ['census2', 'final']
    ];
    result.mismatch = comparablePairs.some(([left, right]) =>
      result[left].count > 0 &&
      result[right].count > 0 &&
      !sameCrnPopulation(result[left].crns, result[right].crns)
    );
    result.distinctCrns = allCrns.size;
    return result;
  }

  function addAttritionLifecycle(item, prefix, row) {
    const firstDay = rowFirstDay(row);
    const census1 = rowCensus1(row);
    const census2 = rowCensus2(row);
    const end = rowEndEnrollment(row);
    const crnKey = sectionKey(row);
    const rowsKey = `${prefix}LifecycleRows`;
    if (!item[rowsKey]) item[rowsKey] = [];
    item[rowsKey].push({
      crn: crnKey,
      firstDay,
      census1,
      census2,
      end,
      invalidCensus2: row?.invalidNegativeCensus2 === true
    });
    const milestoneSet = (name) => {
      const key = `${prefix}${name}Crns`;
      if (!item[key]) item[key] = new Set();
      return item[key];
    };
    if (firstDay != null) {
      item[`${prefix}FirstDay`] += firstDay;
      item[`${prefix}FirstDayCount`] += 1;
      milestoneSet('FirstDay').add(crnKey);
    }
    if (census1 != null) {
      item[`${prefix}Census`] += census1;
      item[`${prefix}Census1Count`] += 1;
      milestoneSet('Census1').add(crnKey);
    }
    if (census2 != null) {
      item[`${prefix}Census2`] += census2;
      item[`${prefix}Census2Count`] += 1;
      milestoneSet('Census2').add(crnKey);
    }
    if (end != null) {
      item[`${prefix}Final`] += end;
      item[`${prefix}FinalCount`] += 1;
      milestoneSet('Final').add(crnKey);
    }
  }

  function attritionCount(start, end, available = true) {
    if (!available || start == null || end == null) return null;
    return start - end;
  }

  function attritionRate(start, end, available = true) {
    const count = attritionCount(start, end, available);
    if (count == null || !start) return null;
    return count / start;
  }

  const POPULATION_MISMATCH_LABEL = 'N/A - Different section populations';

  function sameCrnPopulation(left = new Set(), right = new Set()) {
    if (left.size !== right.size) return false;
    for (const value of left) {
      if (!right.has(value)) return false;
    }
    return true;
  }

  function lifecycleRowsByCrn(rows = []) {
    const map = new Map();
    rows.forEach(row => {
      const crn = row?.crn;
      if (!crn) return;
      const existing = map.get(crn) || { crn, firstDay: null, census1: null, census2: null, end: null, invalidCensus2: false };
      ['firstDay', 'census1', 'census2', 'end'].forEach(key => {
        if (existing[key] == null && row[key] != null) existing[key] = row[key];
      });
      existing.invalidCensus2 = existing.invalidCensus2 || row.invalidCensus2 === true;
      map.set(crn, existing);
    });
    return map;
  }

  function matchedLifecycleInterval(rows, startKey, endKey) {
    const byCrn = lifecycleRowsByCrn(rows);
    let startTotal = 0;
    let endTotal = 0;
    let matchedCrns = 0;
    let missingStartCrns = 0;
    let missingEndCrns = 0;
    byCrn.forEach(row => {
      const start = row[startKey];
      const end = row[endKey];
      if (start == null) missingStartCrns += 1;
      if (end == null) missingEndCrns += 1;
      if (start == null || end == null) return;
      matchedCrns += 1;
      startTotal += start;
      endTotal += end;
    });
    const available = matchedCrns > 0 && startTotal > 0;
    return {
      count: available ? attritionCount(startTotal, endTotal, true) : null,
      rate: available ? attritionRate(startTotal, endTotal, true) : null,
      matchedCrns,
      missingStartCrns,
      missingEndCrns,
      startTotal,
      endTotal
    };
  }

  function lifecycleMetrics(prefix, item, sectionCount) {
    const lifecycleRows = item[`${prefix}LifecycleRows`] || [];
    const byCrn = lifecycleRowsByCrn(lifecycleRows);
    const firstDay = item[`${prefix}FirstDay`];
    const census1 = item[`${prefix}Census`];
    const census2 = item[`${prefix}Census2`];
    const end = item[`${prefix}Final`];
    const firstDayCrns = item[`${prefix}FirstDayCrns`] || new Set();
    const census1Crns = item[`${prefix}Census1Crns`] || new Set();
    const census2Crns = item[`${prefix}Census2Crns`] || new Set();
    const finalCrns = item[`${prefix}FinalCrns`] || new Set();
    const startToEnd = matchedLifecycleInterval(lifecycleRows, 'firstDay', 'end');
    const startToCensus1 = matchedLifecycleInterval(lifecycleRows, 'firstDay', 'census1');
    const startToCensus2 = matchedLifecycleInterval(lifecycleRows, 'firstDay', 'census2');
    const census1ToCensus2 = matchedLifecycleInterval(lifecycleRows, 'census1', 'census2');
    const census1ToEnd = matchedLifecycleInterval(lifecycleRows, 'census1', 'end');
    const census2ToEnd = matchedLifecycleInterval(lifecycleRows, 'census2', 'end');
    const comparablePairs = [
      [firstDayCrns, census1Crns],
      [firstDayCrns, census2Crns],
      [firstDayCrns, finalCrns],
      [census1Crns, census2Crns],
      [census1Crns, finalCrns],
      [census2Crns, finalCrns]
    ];
    const mismatch = comparablePairs.some(([left, right]) => left.size > 0 && right.size > 0 && !sameCrnPopulation(left, right));
    const invalidCensus2Count = [...byCrn.values()].filter(row => row.invalidCensus2).length;
    const missingCensus2Count = [...byCrn.values()].filter(row => row.census2 == null).length;
    const missingFinalCount = [...byCrn.values()].filter(row => row.end == null).length;
    return {
      [`${prefix}StartToEndAttritionCount`]: startToEnd.count,
      [`${prefix}StartToEndAttritionRate`]: startToEnd.rate,
      [`${prefix}StartToEndMatchedCrns`]: startToEnd.matchedCrns,
      [`${prefix}StartToEndMissingStartCrns`]: startToEnd.missingStartCrns,
      [`${prefix}StartToEndMissingEndCrns`]: startToEnd.missingEndCrns,
      [`${prefix}StartToEndStartTotal`]: startToEnd.startTotal,
      [`${prefix}StartToEndEndTotal`]: startToEnd.endTotal,
      [`${prefix}StartToCensus1AttritionCount`]: startToCensus1.count,
      [`${prefix}StartToCensus1AttritionRate`]: startToCensus1.rate,
      [`${prefix}StartToCensus1MatchedCrns`]: startToCensus1.matchedCrns,
      [`${prefix}StartToCensus1MissingStartCrns`]: startToCensus1.missingStartCrns,
      [`${prefix}StartToCensus1MissingEndCrns`]: startToCensus1.missingEndCrns,
      [`${prefix}StartToCensus1StartTotal`]: startToCensus1.startTotal,
      [`${prefix}StartToCensus1EndTotal`]: startToCensus1.endTotal,
      [`${prefix}StartToCensus2AttritionCount`]: startToCensus2.count,
      [`${prefix}StartToCensus2AttritionRate`]: startToCensus2.rate,
      [`${prefix}StartToCensus2MatchedCrns`]: startToCensus2.matchedCrns,
      [`${prefix}StartToCensus2MissingStartCrns`]: startToCensus2.missingStartCrns,
      [`${prefix}StartToCensus2MissingEndCrns`]: startToCensus2.missingEndCrns,
      [`${prefix}StartToCensus2StartTotal`]: startToCensus2.startTotal,
      [`${prefix}StartToCensus2EndTotal`]: startToCensus2.endTotal,
      [`${prefix}Census1ToCensus2AttritionCount`]: census1ToCensus2.count,
      [`${prefix}Census1ToCensus2AttritionRate`]: census1ToCensus2.rate,
      [`${prefix}Census1ToCensus2MatchedCrns`]: census1ToCensus2.matchedCrns,
      [`${prefix}Census1ToCensus2MissingStartCrns`]: census1ToCensus2.missingStartCrns,
      [`${prefix}Census1ToCensus2MissingEndCrns`]: census1ToCensus2.missingEndCrns,
      [`${prefix}Census1ToCensus2StartTotal`]: census1ToCensus2.startTotal,
      [`${prefix}Census1ToCensus2EndTotal`]: census1ToCensus2.endTotal,
      [`${prefix}Census1ToEndAttritionCount`]: census1ToEnd.count,
      [`${prefix}Census1ToEndAttritionRate`]: census1ToEnd.rate,
      [`${prefix}Census1ToEndMatchedCrns`]: census1ToEnd.matchedCrns,
      [`${prefix}Census1ToEndMissingStartCrns`]: census1ToEnd.missingStartCrns,
      [`${prefix}Census1ToEndMissingEndCrns`]: census1ToEnd.missingEndCrns,
      [`${prefix}Census1ToEndStartTotal`]: census1ToEnd.startTotal,
      [`${prefix}Census1ToEndEndTotal`]: census1ToEnd.endTotal,
      [`${prefix}Census2ToEndAttritionCount`]: census2ToEnd.count,
      [`${prefix}Census2ToEndAttritionRate`]: census2ToEnd.rate,
      [`${prefix}Census2ToEndMatchedCrns`]: census2ToEnd.matchedCrns,
      [`${prefix}Census2ToEndMissingStartCrns`]: census2ToEnd.missingStartCrns,
      [`${prefix}Census2ToEndMissingEndCrns`]: census2ToEnd.missingEndCrns,
      [`${prefix}Census2ToEndStartTotal`]: census2ToEnd.startTotal,
      [`${prefix}Census2ToEndEndTotal`]: census2ToEnd.endTotal,
      [`${prefix}OverallAttritionCount`]: census1ToEnd.count,
      [`${prefix}OverallAttritionRate`]: census1ToEnd.rate,
      [`${prefix}MilestonePopulationMismatch`]: mismatch,
      [`${prefix}InvalidCensus2Count`]: invalidCensus2Count,
      [`${prefix}MissingCensus2Count`]: missingCensus2Count,
      [`${prefix}MissingFinalCount`]: missingFinalCount,
      [`${prefix}MilestoneCrnCounts`]: {
        firstDay: firstDayCrns.size,
        census1: census1Crns.size,
        census2: census2Crns.size,
        final: finalCrns.size
      }
    };
  }

  function summarizeAttritionRows(rows, prefix) {
    const sections = sum(rows, `${prefix}Sections`);
    const census1 = sum(rows, `${prefix}Census`);
    const census2 = sum(rows, `${prefix}Census2`);
    const final = sum(rows, `${prefix}Final`);
    const mismatch = rows.some(row => row[`${prefix}MilestonePopulationMismatch`]);
    const intervalSummary = (interval) => {
      const startTotal = sum(rows, `${prefix}${interval}StartTotal`);
      const endTotal = sum(rows, `${prefix}${interval}EndTotal`);
      const matchedCrns = sum(rows, `${prefix}${interval}MatchedCrns`);
      const missingStartCrns = sum(rows, `${prefix}${interval}MissingStartCrns`);
      const missingEndCrns = sum(rows, `${prefix}${interval}MissingEndCrns`);
      return {
        count: attritionCount(startTotal, endTotal, matchedCrns > 0 && startTotal > 0),
        rate: attritionRate(startTotal, endTotal, matchedCrns > 0 && startTotal > 0),
        matchedCrns,
        missingStartCrns,
        missingEndCrns,
        startTotal,
        endTotal
      };
    };
    const startToEnd = intervalSummary('StartToEnd');
    const startToCensus1 = intervalSummary('StartToCensus1');
    const startToCensus2 = intervalSummary('StartToCensus2');
    const census1ToCensus2 = intervalSummary('Census1ToCensus2');
    const census1ToEnd = intervalSummary('Census1ToEnd');
    const census2ToEnd = intervalSummary('Census2ToEnd');
    return {
      sections,
      census1,
      census2,
      final,
      overallCount: census1ToEnd.count,
      overallRate: census1ToEnd.rate,
      startToEndRate: startToEnd.rate,
      startToEndMatchedCrns: startToEnd.matchedCrns,
      startToEndStartTotal: startToEnd.startTotal,
      startToEndEndTotal: startToEnd.endTotal,
      startToEndMissingStartCrns: startToEnd.missingStartCrns,
      startToEndMissingEndCrns: startToEnd.missingEndCrns,
      startToCensus1Rate: startToCensus1.rate,
      startToCensus1MatchedCrns: startToCensus1.matchedCrns,
      startToCensus1StartTotal: startToCensus1.startTotal,
      startToCensus1EndTotal: startToCensus1.endTotal,
      startToCensus1MissingStartCrns: startToCensus1.missingStartCrns,
      startToCensus1MissingEndCrns: startToCensus1.missingEndCrns,
      startToCensus2Rate: startToCensus2.rate,
      startToCensus2MatchedCrns: startToCensus2.matchedCrns,
      startToCensus2StartTotal: startToCensus2.startTotal,
      startToCensus2EndTotal: startToCensus2.endTotal,
      startToCensus2MissingStartCrns: startToCensus2.missingStartCrns,
      startToCensus2MissingEndCrns: startToCensus2.missingEndCrns,
      census1ToEndRate: census1ToEnd.rate,
      census1ToEndMatchedCrns: census1ToEnd.matchedCrns,
      census1ToEndStartTotal: census1ToEnd.startTotal,
      census1ToEndEndTotal: census1ToEnd.endTotal,
      census1ToEndMissingStartCrns: census1ToEnd.missingStartCrns,
      census1ToEndMissingEndCrns: census1ToEnd.missingEndCrns,
      census2ToEndRate: census2ToEnd.rate,
      census2ToEndMatchedCrns: census2ToEnd.matchedCrns,
      census2ToEndStartTotal: census2ToEnd.startTotal,
      census2ToEndEndTotal: census2ToEnd.endTotal,
      census2ToEndMissingStartCrns: census2ToEnd.missingStartCrns,
      census2ToEndMissingEndCrns: census2ToEnd.missingEndCrns,
      census1ToCensus2Rate: census1ToCensus2.rate,
      census1ToCensus2MatchedCrns: census1ToCensus2.matchedCrns,
      census1ToCensus2StartTotal: census1ToCensus2.startTotal,
      census1ToCensus2EndTotal: census1ToCensus2.endTotal,
      census1ToCensus2MissingStartCrns: census1ToCensus2.missingStartCrns,
      census1ToCensus2MissingEndCrns: census1ToCensus2.missingEndCrns,
      invalidCensus2Count: sum(rows, `${prefix}InvalidCensus2Count`),
      missingCensus2Count: sum(rows, `${prefix}MissingCensus2Count`),
      missingFinalCount: sum(rows, `${prefix}MissingFinalCount`),
      mismatch
    };
  }

  function lifecycleMetricLabel(value) {
    if (value === POPULATION_MISMATCH_LABEL) return POPULATION_MISMATCH_LABEL;
    return value == null ? 'N/A' : pct(value);
  }

  async function loadAttritionFiles() {
    const uploaded = await readCsv(document.getElementById('enrollmentCsv'));
    const archived = await readArchivedRows('attrArchiveTerms');
    await loadEnrollmentSnapshots();
    await loadWorkExperienceRows();
    state.enrollment = mergeSnapshotsIntoRows(dedupeEnrollmentRows([...uploaded, ...archived].map(normalize)), state.enrollmentSnapshots)
      .filter(row => !isOmittedInstructionalMethod(row));
    const fallbackRows = mergeSnapshotsIntoRows(currentRows(), state.enrollmentSnapshots).filter(row => !isOmittedInstructionalMethod(row));
    const allEnrollment = rowsWithWorkExperience(state.enrollment.length ? state.enrollment : fallbackRows, 'attr');
    state.attritionTerms = collectTerms(allEnrollment);
    updateDecisionTermOptions(state.attritionTerms);
    populateAnalyticsFilters('attr', allEnrollment);
    return allEnrollment;
  }

  function setAttritionStatus(message, clearMetrics = false) {
    const tableNode = document.getElementById('attritionTable');
    if (tableNode) tableNode.innerHTML = `<p class="analytics-empty">${escapeAttr(message)}</p>`;
    if (clearMetrics) {
      metric('attritionMetrics', []);
      const diagnostic = document.getElementById('attritionDiagnosticRates');
      if (diagnostic) diagnostic.innerHTML = '';
      const notes = document.getElementById('attritionDataQualityNotes');
      if (notes) notes.innerHTML = '';
    }
  }

  function handleAttritionError(err) {
    console.error('Attrition report failed:', err);
    setAttritionStatus(`Attrition report failed: ${err?.message || 'Unknown error'}`, true);
    alert(err?.message || 'Attrition report failed.');
  }

  async function runAttrition() {
    state.attritionRan = true;
    setAttritionStatus('Running enrollment attrition/lifecycle report...', true);
    const allEnrollment = await loadAttritionFiles();
    const excludedPlanningTerm = attritionDecisionTerm() || updateDecisionTermOptions(state.attritionTerms);
    const excludedPlanningTermKey = canon(excludedPlanningTerm);
    const diagnostics = standardExclusionDiagnostics(allEnrollment, 'attr');
    const enrollment = applyFilters(allEnrollment, 'attr')
      .filter(row => !excludedPlanningTermKey || canon(row.term) !== excludedPlanningTermKey);
    if (!enrollment.length) {
      state.attritionRows = [];
      metric('attritionMetrics', [
        ['Planning Term Excluded', excludedPlanningTerm || 'N/A'],
        ['Historical Terms Included', 0],
        ['Historical Sections', 0],
        ['Historical Overall Attrition', 'N/A'],
        ['Tutoring/Open Lab Rows Excluded', diagnostics.tutoringOpenLabRowsExcluded],
        ['Rows with Invalid Negative Census 2', diagnostics.invalidNegativeCensus2Rows],
        ['Distinct CRNs with Invalid Negative Census 2', diagnostics.invalidNegativeCensus2Crns],
        ['Data Quality Warning', diagnostics.hasInvalidNegativeCensus2 ? 'Negative Census 2 values were detected and treated as invalid.' : 'None']
      ]);
      setAttritionStatus('No historical enrollment rows match the selected uploads, archived terms, excluded planning term, and filters.');
      renderAttritionDiagnosticRates({});
      renderAttritionDataQualityNotes(['No enrollment rows match the selected filters.']);
      renderAttritionLegend();
      return;
    }
    const grouped = new Map();
    const groupBy = document.getElementById('attrGroup')?.value || 'COURSE';
    enrollment.forEach((row) => {
      const key = groupKey(row, groupBy);
      const item = grouped.get(key) || emptyAttritionRecord(key);
      const isDecisionTerm = false;
      const crnKey = sectionKey(row);
      const censusEnroll = rowCensus1(row) ?? censusEnrollment(row);
      const census2Enroll = rowCensus2(row);
      const finalEnroll = rowEndEnrollment(row) ?? finalEnrollment(row);
      item.allCrns.add(crnKey);
      item.sections = item.allCrns.size;
      item.allSections = item.allCrns.size;
      item.census += censusEnroll;
      if (census2Enroll != null) item.census2 += census2Enroll;
      item.final += finalEnroll;
      item.capacity += row.cap;
      item.terms.add(row.term || 'UNKNOWN');
      addAttritionLifecycle(item, 'all', row);
      if (isDecisionTerm) {
        item.decisionCrns.add(crnKey);
        item.decisionSections = item.decisionCrns.size;
        item.decisionCapacity += row.cap;
        addAttritionLifecycle(item, 'decision', row);
      } else {
        item.historyCrns.add(crnKey);
        item.historySections = item.historyCrns.size;
        item.historyCapacity += row.cap;
        addAttritionLifecycle(item, 'history', row);
        item.historyTerms.add(row.term || 'UNKNOWN');
      }
      grouped.set(key, item);
    });
    const min = Number(document.getElementById('attrMinSections')?.value || 1);
    state.attritionRows = [...grouped.values()].filter((r) => r.sections >= min).map((r) => {
      const historyLifecycle = lifecycleMetrics('history', r, r.historySections);
      const decisionLifecycle = lifecycleMetrics('decision', r, r.decisionSections);
      const allLifecycle = lifecycleMetrics('all', r, r.sections);
      return {
        ...r,
        terms: r.terms.size,
        historyTerms: r.historyTerms.size,
        totalSeats: r.capacity,
        courseHistoricalTermsIncluded: r.historyTerms.size,
        overallHistoricalTermsIncluded: collectRowTerms(enrollment).length,
        decisionTermIncluded: r.decisionSections > 0 ? 1 : 0,
        totalUploadedTerms: r.terms.size,
        decisionTerm: excludedPlanningTerm,
        excludedPlanningTerm,
        dataQualityNotes: '',
        firstDayToCensus1Attrition: historyLifecycle.historyStartToCensus1AttritionRate,
        firstDayToCensus2Attrition: historyLifecycle.historyStartToCensus2AttritionRate,
        firstDayToEndFinalAttrition: historyLifecycle.historyStartToEndAttritionRate,
        census1ToCensus2Attrition: historyLifecycle.historyCensus1ToCensus2AttritionRate,
        census1ToEndFinalAttrition: historyLifecycle.historyCensus1ToEndAttritionRate,
        census2ToEndFinalAttrition: historyLifecycle.historyCensus2ToEndAttritionRate,
        firstDayToCensus1MatchedCrns: historyLifecycle.historyStartToCensus1MatchedCrns,
        firstDayToCensus2MatchedCrns: historyLifecycle.historyStartToCensus2MatchedCrns,
        firstDayToEndFinalMatchedCrns: historyLifecycle.historyStartToEndMatchedCrns,
        census1ToCensus2DiagnosticMatchedCrns: historyLifecycle.historyCensus1ToCensus2MatchedCrns,
        census1ToEndFinalMatchedCrns: historyLifecycle.historyCensus1ToEndMatchedCrns,
        census2ToEndFinalMatchedCrns: historyLifecycle.historyCensus2ToEndMatchedCrns,
        decisionAttritionCount: decisionLifecycle.decisionOverallAttritionCount,
        decisionAttritionRate: decisionLifecycle.decisionOverallAttritionRate,
        historicalAttritionCount: historyLifecycle.historyOverallAttritionCount,
        historicalAttritionRate: historyLifecycle.historyOverallAttritionRate,
        attritionCount: allLifecycle.allOverallAttritionCount,
        attritionRate: allLifecycle.allOverallAttritionRate,
        census1ToCensus2MatchedCrns: allLifecycle.allCensus1ToCensus2MatchedCrns,
        census2ToEndMatchedCrns: allLifecycle.allCensus2ToEndMatchedCrns,
        census1ToEndMatchedCrns: allLifecycle.allCensus1ToEndMatchedCrns,
        census1ToCensus2AttritionRate: allLifecycle.allCensus1ToCensus2AttritionRate,
        census2ToEndAttritionRate: allLifecycle.allCensus2ToEndAttritionRate,
        census1ToEndAttritionRate: allLifecycle.allCensus1ToEndAttritionRate,
        invalidCensus2Count: allLifecycle.allInvalidCensus2Count,
        missingCensus2Count: allLifecycle.allMissingCensus2Count,
        missingFinalCount: allLifecycle.allMissingFinalCount,
        censusFillRate: r.capacity > 0 ? r.census / r.capacity : 0,
        finalFillRate: r.capacity > 0 ? r.final / r.capacity : 0,
        emptySeatsAtCensus: Math.max(0, r.capacity - r.census),
        emptySeatsAtFinal: Math.max(0, r.capacity - r.final),
        availableAtCensus: Math.max(0, r.capacity - r.census),
        availableAtEnd: Math.max(0, r.capacity - r.final),
        ...historyLifecycle,
        ...decisionLifecycle,
        ...allLifecycle
      };
    }).sort((a, b) => num(b.attritionCount) - num(a.attritionCount) || num(b.historicalAttritionCount) - num(a.historicalAttritionCount));
    const decisionRows = state.attritionRows.filter(row => row.decisionSections > 0);
    const historicalMilestones = milestonePopulationDiagnostics(enrollment);
    const filteredTerms = collectRowTerms(enrollment);
    const historicalTerms = collectRowTerms(enrollment);
    const coverage = snapshotCoverage(enrollment, state.enrollmentSnapshots, '');
    const historicalSummary = summarizeAttritionRows(state.attritionRows, 'history');
    const allSummary = summarizeAttritionRows(state.attritionRows, 'all');
    const workExperience = workExperienceSummary(enrollment);
    const dataQualityWarnings = [];
    if (historicalMilestones.mismatch) {
      dataQualityWarnings.push('Milestone populations differ. Attrition rates are calculated using matched CRNs for each comparison.');
    }
    if (diagnostics.hasInvalidNegativeCensus2) {
      dataQualityWarnings.push('Negative Census 2 values were detected and treated as invalid.');
    }
    if (diagnostics.tutoringOpenLabRowsExcluded > 0) {
      dataQualityWarnings.push('Tutoring/Open Lab sections were excluded.');
    }
    if (coverage.firstDayCoveragePct === 0 && historicalSummary.sections > 0) {
      dataQualityWarnings.push('First Day snapshots are unavailable for the selected historical terms.');
    }
    state.attritionRows = state.attritionRows.map(row => ({
      ...row,
      dataQualityNotes: dataQualityWarnings.join(' ') || 'None'
    }));
    metric('attritionMetrics', [
      ['Planning Term Excluded', excludedPlanningTerm || 'N/A'],
      ['Historical Terms Included', historicalTerms.length],
      ['Historical Sections', historicalSummary.sections],
      ['Historical Overall Attrition', lifecycleMetricLabel(historicalSummary.overallRate)],
      ['Historical Census 1 to Census 2 Attrition', lifecycleMetricLabel(historicalSummary.census1ToCensus2Rate)],
      ['Historical Census 2 to End Attrition', lifecycleMetricLabel(historicalSummary.census2ToEndRate)],
      ['Historical Census 1 to End Attrition', lifecycleMetricLabel(historicalSummary.census1ToEndRate)],
      ['Historical Census 1 Total', historicalMilestones.census1.total],
      ['Historical Census 2 Total', historicalMilestones.census2.total],
      ['Historical End/Final Total', historicalMilestones.final.total],
      ['Historical CRNs with Census 1', historicalMilestones.census1.count],
      ['Historical CRNs with Census 2', historicalMilestones.census2.count],
      ['Historical CRNs with End/Final', historicalMilestones.final.count],
      ['First Day Snapshot Coverage', pct(coverage.firstDayCoveragePct)],
      ['Missing First Day Snapshots', coverage.sectionsMissingFirstDaySnapshot],
      ['Tutoring/Open Lab Rows Excluded', diagnostics.tutoringOpenLabRowsExcluded],
      ['Rows with Invalid Negative Census 2', diagnostics.invalidNegativeCensus2Rows],
      ['Distinct CRNs with Invalid Negative Census 2', diagnostics.invalidNegativeCensus2Crns],
      ['Work Experience Rows Included', workExperience.rows],
      ['Work Experience FTES Warnings', workExperience.missingFtes]
    ]);
    renderAttritionDiagnosticRates({
      historical: historicalSummary,
      all: allSummary,
      includeAll: false
    });
    renderAttritionDataQualityNotes(dataQualityWarnings);
    table('attritionTable', state.attritionRows, [
      'group',
      'excludedPlanningTerm',
      'courseHistoricalTermsIncluded',
      'overallHistoricalTermsIncluded',
      'totalUploadedTerms',
      'historySections',
      'totalSeats',
      'historyCensus',
      'historyCensus2',
      'historyFinal',
      'historicalAttritionRate',
      'historyStartToEndAttritionRate',
      'historyStartToCensus1AttritionRate',
      'historyStartToCensus2AttritionRate',
      'historyCensus1ToCensus2AttritionRate',
      'historyCensus1ToEndAttritionRate',
      'historyCensus2ToEndAttritionRate',
      'historyOverallAttritionRate',
      'census1ToCensus2MatchedCrns',
      'census2ToEndMatchedCrns',
      'census1ToEndMatchedCrns',
      'census1ToCensus2AttritionRate',
      'census2ToEndAttritionRate',
      'census1ToEndAttritionRate',
      'invalidCensus2Count',
      'missingCensus2Count',
      'missingFinalCount',
      'firstDayToCensus1Attrition',
      'firstDayToCensus2Attrition',
      'firstDayToEndFinalAttrition',
      'census1ToCensus2Attrition',
      'census1ToEndFinalAttrition',
      'census2ToEndFinalAttrition',
      'firstDayToCensus1MatchedCrns',
      'firstDayToCensus2MatchedCrns',
      'firstDayToEndFinalMatchedCrns',
      'census1ToCensus2DiagnosticMatchedCrns',
      'census1ToEndFinalMatchedCrns',
      'census2ToEndFinalMatchedCrns',
      'dataQualityNotes',
      'censusFillRate',
      'finalFillRate',
      'emptySeatsAtCensus',
      'emptySeatsAtFinal'
    ]);
    renderAttritionLegend();
  }

  function renderAttritionDiagnosticRates(summaries = {}) {
    const intervals = [
      ['startToCensus1', 'First Day', 'Census 1', 'First Day to Census 1'],
      ['startToCensus2', 'First Day', 'Census 2', 'First Day to Census 2'],
      ['startToEnd', 'First Day', 'End/Final', 'First Day to End/Final'],
      ['census1ToCensus2', 'Census 1', 'Census 2', 'Census 1 to Census 2'],
      ['census1ToEnd', 'Census 1', 'End/Final', 'Census 1 to End/Final'],
      ['census2ToEnd', 'Census 2', 'End/Final', 'Census 2 to End/Final']
    ];
    const scopes = [
      ['Decision Term', summaries.decision],
      ['Historical Terms', summaries.historical],
      ...(summaries.includeAll ? [['All Uploaded Terms', summaries.all]] : [])
    ].filter(([, summary]) => summary);
    const rows = [];
    scopes.forEach(([scope, summary]) => {
      intervals.forEach(([key, startMilestone, endMilestone, calculation]) => {
        const matchedCrns = summary[`${key}MatchedCrns`] || 0;
        const rate = summary[`${key}Rate`];
        rows.push({
          scope,
          calculation,
          startMilestone,
          endMilestone,
          startEnrollment: summary[`${key}StartTotal`] || 0,
          endEnrollment: summary[`${key}EndTotal`] || 0,
          matchedCrns,
          missingStartCrns: summary[`${key}MissingStartCrns`] || 0,
          missingEndCrns: summary[`${key}MissingEndCrns`] || 0,
          attritionRate: lifecycleMetricLabel(rate),
          note: matchedCrns
            ? (rate < 0 ? 'Enrollment Growth' : 'Matched CRNs')
            : (startMilestone === 'First Day' ? 'N/A - First Day snapshots unavailable or incomplete' : 'N/A - no matched CRNs')
        });
      });
    });
    const node = document.getElementById('attritionDiagnosticRates');
    if (!node) return;
    node.innerHTML = `
      <h3>Diagnostic Attrition Rates</h3>
      <p class="analytics-note">Rates use matched CRNs for each interval and are diagnostic. Formula: (start enrollment - end enrollment) / start enrollment. Negative values indicate enrollment growth.</p>
      ${rows.length ? `
        <table><thead><tr>${['scope', 'calculation', 'startMilestone', 'endMilestone', 'startEnrollment', 'endEnrollment', 'matchedCrns', 'missingStartCrns', 'missingEndCrns', 'attritionRate', 'note'].map((c, index) => `<th><button type="button" class="analytics-sort" data-column="${index}" aria-label="Sort by ${label(c)}">${label(c)} <span aria-hidden="true"></span></button></th>`).join('')}</tr></thead>
        <tbody>${rows.map(row => `<tr>${['scope', 'calculation', 'startMilestone', 'endMilestone', 'startEnrollment', 'endEnrollment', 'matchedCrns', 'missingStartCrns', 'missingEndCrns', 'attritionRate', 'note'].map(c => `<td data-sort="${escapeAttr(sortValue(row[c], c))}">${format(row[c], c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
      ` : '<p class="analytics-empty">No diagnostic rates are available for the selected data.</p>'}`;
  }

  function renderAttritionDataQualityNotes(warnings = []) {
    const node = document.getElementById('attritionDataQualityNotes');
    if (!node) return;
    const standard = 'Lifecycle milestone populations may differ because Banner captures Census 1 and Census 2 as milestone values, while End/Final uses ACTUAL_ENROLL/current enrollment after term completion. Rates are diagnostic and should be reviewed with the milestone coverage counts.';
    const notes = [...new Set([standard, ...(warnings.length ? warnings : ['No additional data-quality warnings detected.'])])];
    node.innerHTML = `
      <h3>Data Quality Notes</h3>
      <ul>${notes.map(note => `<li>${escapeAttr(note)}</li>`).join('')}</ul>`;
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
    const divisionSelect = document.getElementById('iaDivision');
    const subjectSelect = document.getElementById('iaSubject');
    const campusSelect = document.getElementById('iaCampus');
    if (!instructorSelect || !campusSelect) return;
    const selectedPrior = [...instructorSelect.selectedOptions].map(option => option.value);
    const divisionPrior = divisionSelect?.value || '';
    const subjectPrior = subjectSelect?.value || '';
    const campusPrior = campusSelect.value;
    const divisions = [...new Set(rows.map(row => row.division).filter(Boolean))].sort();
    const subjectsForDivision = rows.filter(row => !divisionPrior || row.division === divisionPrior);
    const subjects = [...new Set(subjectsForDivision.map(row => row.subject).filter(Boolean))].sort();
    if (divisionSelect) {
      divisionSelect.replaceChildren(new Option('All divisions', ''));
      divisions.forEach(division => divisionSelect.add(new Option(division, division)));
      if (divisions.includes(divisionPrior)) divisionSelect.value = divisionPrior;
    }
    if (subjectSelect) {
      subjectSelect.replaceChildren(new Option('All disciplines', ''));
      subjects.forEach(subject => subjectSelect.add(new Option(subject, subject)));
      if (subjects.includes(subjectPrior)) subjectSelect.value = subjectPrior;
    }
    const scoped = rows.filter(row =>
      (!divisionSelect?.value || row.division === divisionSelect.value) &&
      (!subjectSelect?.value || row.subject === subjectSelect.value)
    );
    const instructors = [...new Set(scoped.map(row => row.instructor).filter(Boolean))].sort();
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

  function instructorScheduleRows(rows) {
    const map = new Map();
    (rows || []).filter(row => row.instructor).forEach(row => {
      const meeting = instructorMeetingMinutes(row);
      if (!meeting || !row.days?.length) return;
      const baseKey = row.crossList
        ? ['XL', row.term, row.crossList, row.instructor, row.dayPattern, row.start, row.end, row.building, row.roomOnly || row.room].join('|')
        : ['ROW', row.term, row.crn || row.subject, row.section, row.instructor, row.dayPattern, row.start, row.end, row.building, row.roomOnly || row.room].join('|');
      if (!map.has(baseKey)) map.set(baseKey, row);
    });
    return [...map.values()];
  }

  function runInstructorAvailability() {
    const rows = instructorScheduleRows(currentRows());
    populateInstructorAvailabilityFilters(rows);
    const selectedInstructors = selectedInstructorAvailabilityInstructors();
    const division = document.getElementById('iaDivision')?.value || '';
    const subject = document.getElementById('iaSubject')?.value || '';
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
    const scopedRows = rows.filter(row =>
      (!division || row.division === division) &&
      (!subject || row.subject === subject) &&
      (!selectedInstructors.length || selectedInstructors.includes(row.instructor)) &&
      (!campus || row.campus === campus)
    );
    const instructors = selectedInstructors.length ? selectedInstructors : [...new Set(scopedRows.map(row => row.instructor).filter(Boolean))].sort();
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
      ['Instructors Reviewed', results.length]
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
    const division = document.getElementById('iaDivision');
    const subject = document.getElementById('iaSubject');
    const campus = document.getElementById('iaCampus');
    if (instructor) [...instructor.options].forEach(option => { option.selected = true; });
    if (division) division.value = '';
    if (subject) subject.value = '';
    if (campus) campus.value = '';
    const day = document.getElementById('iaDay');
    const start = document.getElementById('iaStart');
    const end = document.getElementById('iaEnd');
    if (day) day.value = 'MO';
    if (start) start.value = '09:00';
    if (end) end.value = '10:00';
    runInstructorAvailability();
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
    const diagnostics = standardExclusionDiagnostics(allRows, 'con');
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
    const allCourseCount = rows.length
      ? group(rows, (r) => `${r.term || currentTerm()}||${r.subject} ${r.course}`).size
      : group(comparisonRows, (r) => `${r.subject} ${r.course}`).size;
    const byCourse = group(inPersonRows, (r) => `${r.term || currentTerm()}||${r.subject} ${r.course}`);
    const history = await historicalPatterns(allRows, decisionTerm, lowFill, lowEnroll);
    const historicalDemand = historicalDemandMap(comparisonRows.filter(row => !isOnlineSection(row)), options.vacancyBasis);
    state.consolidationRows = rows.length
      ? onlineReductionRows(onlineRows, comparisonRows.filter(isOnlineSection), options)
      : historicalPlanningCandidates(comparisonRows, decisionTerm, lowFill, lowEnroll, minSections, options);
    if (rows.length) {
      byCourse.forEach((sections, key) => {
        const course = key.split('||')[1] || key;
        if (sections.length < minSections) return;
        const estimatedSections = sections.map(section => withHistoricalEstimate(section, historicalDemand)).filter(Boolean);
        consolidationGroupRows(course, estimatedSections, history, lowFill, lowEnroll, options)
          .forEach(row => state.consolidationRows.push(row));
      });
    }
    const scopeContext = {
      decisionTerm,
      selectedArchivedTerms: state.consolidationScope?.selectedArchivedTerms || getSelectedValues('conArchiveTerms'),
      uploadedTerms: state.consolidationScope?.uploadedTerms || [],
      historicalTerms: collectRowTerms(comparisonRows),
      currentRowsCount: rows.length,
      historicalRowsCount: comparisonRows.length,
      totalRows: allRows.length
    };
    state.consolidationRows = annotateConsolidationRows(state.consolidationRows, scopeContext, options);
    state.consolidationRows.sort((a, b) => b.score - a.score);
    const onlineOpportunities = state.consolidationRows.filter(row => row.type === 'Online Reduction');
    const flowOpportunities = state.consolidationRows.filter(row => row.type !== 'Online Reduction');
    const potentialSectionReductions = sum(state.consolidationRows, 'potentialSectionsRemoved') || sum(state.consolidationRows, 'recommendedReductions');
    const seatsRecovered = sum(state.consolidationRows, 'potentialSeatsRecovered') || sum(state.consolidationRows, 'freedSeats');
    metric('consolidationMetrics', [
      ['Decision Term', decisionTerm || 'N/A'],
      ['Courses Reviewed', allCourseCount],
      ['Potential Consolidations', state.consolidationRows.length],
      ['Potential Section Reductions', potentialSectionReductions],
      ['Potential Seats Recovered', seatsRecovered],
      ['Estimated FTES Impact', state.consolidationRows.length ? 'Neutral if absorbed' : 'N/A'],
      ['Online Reduction Candidates', onlineOpportunities.length],
      ['In-Person Consolidation Candidates', flowOpportunities.filter(row => row.type === 'In-Person Consolidation').length],
      ['Hybrid Consolidation Candidates', flowOpportunities.filter(row => row.type === 'Hybrid Consolidation').length],
      ['Historical Planning Candidates', state.consolidationRows.filter(row => row.type === 'Historical Planning Candidate').length],
      ['Tutoring/Open Lab Rows Excluded', diagnostics.tutoringOpenLabRowsExcluded],
      ['Chronic Low Enrollment Threshold', lowEnroll == null ? `<= ${pct(lowFill)} census-based expected fill` : `<= ${lowEnroll} census-based expected enrollment`],
      ['Avg Score', Math.round(safeDiv(sum(state.consolidationRows, 'score'), state.consolidationRows.length))]
    ]);
    renderConsolidationScopePanel(scopeContext);
    renderConsolidationTables(state.consolidationRows.map(flattenOpportunity));
    renderConsolidationLegend();
  }

  function annotateConsolidationRows(rows, scopeContext, options = {}) {
    const selectedDecisionTerm = scopeContext.decisionTerm || '';
    const selectedArchivedTerms = (scopeContext.selectedArchivedTerms || []).join('; ');
    const uploadedTermsUsed = (scopeContext.uploadedTerms || []).join('; ');
    const historicalComparisonTermsUsed = (scopeContext.historicalTerms || []).join('; ');
    const minHist = Number(options.minHist || 3);
    return (rows || []).map(row => {
      const historicalTermsIncluded = Number(row.historicalTerms || row.historicalTermsIncluded || 0);
      const warnings = [];
      const isOnline = row.type === 'Online Reduction';
      const requiredSeats = Number(row.requiredSeats || 0);
      const receivingCapacity = Number(row.availableReceivingCapacity || row.targetOpenSeats || 0);
      if (historicalTermsIncluded > 0 && historicalTermsIncluded < minHist) {
        warnings.push(`Limited history: ${historicalTermsIncluded} historical term${historicalTermsIncluded === 1 ? '' : 's'} included.`);
      }
      if (!isOnline && requiredSeats > receivingCapacity) {
        warnings.push('Insufficient receiving capacity.');
      }
      if (isOnline && Number(row.sourceFill || 0) > 1 && Number(row.vacancies || 0) > 0) {
        warnings.push('Expected enrollment exceeds current online capacity; verify vacancy basis before reducing sections.');
      }
      const confidenceLevel = warnings.some(warning => /^Limited history/i.test(warning))
        ? 'Limited History'
        : row.confidenceLevel || (row.score >= 75 ? 'High' : row.score >= 55 ? 'Medium' : 'Low');
      const cleanLabel = confidenceLevel === 'Limited History'
        ? 'Limited History Review'
        : warnings.some(warning => /Insufficient receiving capacity/i.test(warning))
          ? 'Manual Capacity Review'
          : row.label;
      const calculationBasis = isOnline
        ? `Online reduction uses selected decision-term online capacity minus historical average ${options.vacancyBasis === 'actual' ? 'final/current' : 'census'} enrollment; historical vacancies are audit context only.`
        : `In-person/hybrid consolidation uses historical expected enrollment, ${Math.round((options.absorbPct || 0.6) * 100)}% redistribution threshold, gross receiving open seats, and net seats after redistribution.`;
      return {
        ...row,
        term: row.term || row.decisionTerm || selectedDecisionTerm,
        decisionTerm: row.decisionTerm || selectedDecisionTerm,
        selectedDecisionTerm,
        selectedArchivedTerms,
        uploadedTermsUsed,
        historicalComparisonTermsUsed,
        historicalTermsIncluded,
        confidenceLevel,
        label: cleanLabel,
        dataQualityWarnings: warnings.join(' | '),
        calculationBasis
      };
    });
  }

  function renderConsolidationScopePanel(context) {
    const node = document.getElementById('consolidationScopePanel');
    if (!node) return;
    const selectedArchived = context.selectedArchivedTerms.length ? context.selectedArchivedTerms.join(', ') : 'None selected';
    const uploadedTerms = context.uploadedTerms.length ? context.uploadedTerms.join(', ') : 'None uploaded';
    const historicalTerms = context.historicalTerms.length ? context.historicalTerms.join(', ') : 'None';
    const warning = context.totalRows
      ? ''
      : '<div class="dashboard-scope-warnings"><p>No Consolidation CSVs or archived terms are selected. This report will not silently use other archived terms or the current room grid.</p></div>';
    node.innerHTML = `
      <h3>Consolidation Scope</h3>
      ${warning}
      <dl>
        <div><dt>Decision Term</dt><dd>${escapeAttr(context.decisionTerm || 'N/A')}</dd></div>
        <div><dt>Selected Archived Terms</dt><dd>${escapeAttr(selectedArchived)}</dd></div>
        <div><dt>Uploaded Terms</dt><dd>${escapeAttr(uploadedTerms)}</dd></div>
        <div><dt>Historical Comparison Terms Used</dt><dd>${escapeAttr(historicalTerms)}</dd></div>
        <div><dt>Current Rows Count</dt><dd>${context.currentRowsCount}</dd></div>
        <div><dt>Historical Rows Count</dt><dd>${context.historicalRowsCount}</dd></div>
      </dl>`;
  }

  async function loadDemandRows() {
    const saved = captureFilterState('dem');
    const uploadedRows = await readCsv(document.getElementById('demandCsv'));
    const archivedRows = await readArchivedRows('demArchiveTerms', { reportLabel: 'Demand Forecast' });
    await loadWorkExperienceRows();
    const uploaded = dedupeEnrollmentRows([...uploadedRows, ...archivedRows].map(normalize))
      .filter(row => !isOmittedInstructionalMethod(row));
    state.demandInput = uploaded;
    const rows = rowsWithWorkExperience(uploaded, 'dem');
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
      const diagnostics = standardExclusionDiagnostics(allRows, 'dem');
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
      const workExperience = workExperienceSummary(rows);
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
        ['Work Experience Rows Included', workExperience.rows],
        ['Work Experience FTES Warnings', workExperience.missingFtes],
        ['Tutoring/Open Lab Rows Excluded', diagnostics.tutoringOpenLabRowsExcluded],
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
    if (tableNode) tableNode.innerHTML = `<p class="analytics-empty">${escapeAttr(message)}</p>`;
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
      attritionCount: census - final,
      attritionRate: safeDiv(census - final, census),
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

  function curriculumCourseKey(subject, course) {
    return canon(`${subject || ''} ${course || ''}`).replace(/\s+/g, ' ').trim();
  }

  function curriculumCrosswalkMap() {
    const rows = Array.isArray(window.CURRICULUM_CROSSWALK) ? window.CURRICULUM_CROSSWALK : [];
    const map = new Map();
    rows.forEach(item => {
      const source = curriculumCourseKey(
        item.sourceSubject || item.SourceSubject || String(item.sourceCourse || item.SourceCourse || item['Source Course'] || item.oldCourse || item['Old Course'] || '').split(/\s+/)[0],
        item.sourceCatalog || item.SourceCatalog || String(item.sourceCourse || item.SourceCourse || item['Source Course'] || item.oldCourse || item['Old Course'] || '').split(/\s+/).slice(1).join(' ')
      );
      const target = curriculumCourseKey(
        item.synonymSubject || item.SynonymSubject || item.newSubject || item.NewSubject || String(item.synonymCourse || item.SynonymCourse || item['Synonym Course'] || item.newCourse || item['New Course'] || item.commonCourse || item['Common Course'] || '').split(/\s+/)[0],
        item.synonymCatalog || item.SynonymCatalog || item.newCatalog || item.NewCatalog || String(item.synonymCourse || item.SynonymCourse || item['Synonym Course'] || item.newCourse || item['New Course'] || item.commonCourse || item['Common Course'] || '').split(/\s+/).slice(1).join(' ')
      );
      if (source && target && source !== target) map.set(source, target);
    });
    return map;
  }

  function applyCurriculumCrosswalkToRows(rows) {
    const map = curriculumCrosswalkMap();
    if (!map.size) return rows || [];
    return (rows || []).map(row => {
      const current = curriculumCourseKey(row.subject, row.course);
      const mapped = map.get(current);
      if (!mapped) return row;
      const [subject, ...courseParts] = mapped.split(' ');
      return {
        ...row,
        originalSubject: row.originalSubject || row.subject,
        originalCourse: row.originalCourse || row.course,
        originalCourseKey: row.originalCourseKey || current,
        subject,
        course: courseParts.join(' '),
        crosswalkMappedCourse: mapped
      };
    });
  }

  async function loadConsolidationRows() {
    const saved = captureFilterState('con');
    const uploadedRows = await readCsv(document.getElementById('consolidationCsv'));
    const archivedRows = await readArchivedRows('conArchiveTerms');
    const normalizedUploadedRows = uploadedRows.map(normalize);
    const normalizedArchivedRows = archivedRows.map(normalize);
    const uploaded = applyCurriculumCrosswalkToRows(dedupeEnrollmentRows([...normalizedUploadedRows, ...normalizedArchivedRows]))
      .filter(row => !isOmittedInstructionalMethod(row));
    state.consolidationInput = uploaded;
    const rows = uploaded;
    state.consolidationTerms = collectRowTerms(rows);
    state.consolidationScope = {
      uploadedTerms: collectRowTerms(normalizedUploadedRows),
      selectedArchivedTerms: getSelectedValues('conArchiveTerms'),
      selectedArchiveRowsCount: normalizedArchivedRows.length,
      totalRows: rows.length
    };
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
    const comparisonRows = allRows.filter(row => row.term && row.term !== decisionTerm);
    comparisonRows.forEach((row) => {
      const key = patternKey(row);
      const item = map.get(key) || { terms: new Set(), low: new Set() };
      item.terms.add(row.term || 'UNKNOWN');
      if (isLowEnrollmentSection(row, lowFill, lowEnroll)) item.low.add(row.term || 'UNKNOWN');
      map.set(key, item);
    });
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

  function historicalPlanningCandidates(historicalRows, decisionTerm, lowFill, lowEnroll, minSections, options = {}) {
    const rows = (historicalRows || []).filter(row => row.term && row.term !== decisionTerm);
    const termsIncluded = collectRowTerms(rows).length;
    const output = [];
    group(rows, row => `${row.subject} ${row.course}|${row.modality}|${options.sameCampus ? row.campus : 'ANY'}`).forEach((courseRows, key) => {
      const byTerm = group(courseRows, row => row.term || 'UNKNOWN');
      const termStats = [...byTerm.entries()].map(([term, termRows]) => {
        const sections = termRows.length;
        const capacity = sum(termRows, 'cap');
        const enrollment = termRows.reduce((total, row) => total + enrollmentForBasis(row, options.vacancyBasis), 0);
        const fill = safeDiv(enrollment, capacity);
        return {
          term,
          sections,
          capacity,
          enrollment,
          fill,
          low: sections >= minSections && (lowEnroll == null ? fill <= lowFill : enrollment <= lowEnroll)
        };
      });
      const lowTerms = termStats.filter(item => item.low).length;
      if (!lowTerms) return;
      const [course, modality, campus] = key.split('|');
      const avgSections = Math.round(average(termStats.map(item => item.sections)));
      const avgEnrollment = Math.round(average(termStats.map(item => item.enrollment)));
      const avgCapacity = Math.round(average(termStats.map(item => item.capacity)));
      const avgFill = safeDiv(avgEnrollment, avgCapacity);
      const score = Math.min(85, 45 + Math.min(25, lowTerms * 8) + (avgFill <= lowFill ? 10 : 0) + (termsIncluded >= 3 ? 5 : 0));
      output.push({
        type: 'Historical Planning Candidate',
        decisionTerm,
        score,
        label: termsIncluded < (options.minHist ?? 3) ? 'Limited History Review' : score >= 75 ? 'High Review Priority' : score >= 55 ? 'Review Candidate' : 'Lower Confidence Review',
        confidenceLevel: termsIncluded < (options.minHist ?? 3) ? 'Limited History' : score >= 75 ? 'High' : score >= 55 ? 'Medium' : 'Low',
        course,
        sectionsReviewed: avgSections,
        potentialSectionsRemoved: '',
        availableReceivingCapacity: Math.max(0, avgCapacity - avgEnrollment),
        expectedEnrollment: avgEnrollment,
        potentialSeatsRecovered: '',
        projectionSource: `Historical pattern only (${termsIncluded} comparison term${termsIncluded === 1 ? '' : 's'})`,
        finalEnrollmentContext: `Average historical ${options.vacancyBasis === 'actual' ? 'final/current' : 'census'} enrollment ${avgEnrollment}`,
        sourceSummary: `${avgSections} average historical section(s); ${pct(avgFill)} average fill`,
        targetSummary: 'No future CRN exists. Review future schedule build for possible section count adjustment.',
        recommendation: 'Review future schedule build for possible section count adjustment.',
        matchReason: `${lowTerms} historical term(s) met the selected low-enrollment rule.`,
        historicalTerms: termsIncluded,
        chronicLowFill: safeDiv(lowTerms, Math.max(1, termStats.length)) >= (options.chronicThreshold ?? 0.75) ? 'Yes' : 'No',
        tba: courseRows.some(row => row.dayPattern === 'TBA'),
        modality,
        campus
      });
    });
    return output;
  }

  function flattenOpportunity(row) {
    const isOnline = row.type === 'Online Reduction';
    const isHistoricalPlanning = row.type === 'Historical Planning Candidate';
    const removed = row.removedSections || [];
    const receiving = row.receivingSections || [];
    const removedList = removed.map(describe).join('; ');
    const receivingList = receiving.map(describe).join('; ');
    const targetOpenSeats = row.target ? expectedOpenSeats(row.target) : row.targetOpenSeats;
    const recommendation = isOnline
      ? `Reduce by ${row.recommendedReductions ?? 0} online section(s); retain buffer after ${row.possibleReductions ?? 0} possible reduction(s).`
      : isHistoricalPlanning
        ? (row.recommendation || 'Review future schedule build for possible section count adjustment.')
        : `Remove ${removedList || 'selected low-enrollment section(s)'}; redistribute ${row.requiredSeats ?? 0} projected students into remaining sections.`;
    const projectedRedistribution = isOnline ? '' : `${row.requiredSeats ?? 0} students`;
    const sourceSummary = isOnline
      ? `Online aggregate; census-based expected enrollment ${row.sourceEnroll}; fill ${pct(row.sourceFill)}`
      : `Remove: ${removedList || 'N/A'}`;
    const targetSummary = isOnline
      ? ''
      : `Receive into: ${receivingList || 'remaining matching sections'}; available receiving capacity ${row.availableReceivingCapacity ?? 0}`;
    const onlineSummary = isOnline
      ? `${row.vacancies ?? 0} decision-term expected vacancies; historical avg enrollment ${row.historicalAverageEnrollment ?? row.sourceEnroll ?? 'N/A'}; historical avg vacancies ${row.historicalAverageVacancies ?? 'N/A'}; decision vacancies ${row.decisionVacancies ?? 'N/A'}; median cap ${row.sectionCap ?? 0}; possible reductions ${row.possibleReductions ?? 0}`
      : '';
    const sourceSection = row.source
      ? describe(row.source)
      : isOnline
        ? 'Online aggregate'
        : removedList || row.sourceSection || 'In-person aggregate';
    const netAvailable = row.netAvailableCapacity ?? (isOnline ? row.vacancies : Math.max(0, Number(row.availableReceivingCapacity || 0) - Number(row.requiredSeats || 0)));
    const capacityWarning = !isOnline && Number(row.requiredSeats || 0) > Number(row.availableReceivingCapacity || 0);
    const recommendationWithWarnings = capacityWarning
      ? `Review manually: insufficient receiving capacity for ${row.requiredSeats ?? 0} projected students. ${recommendation}`
      : recommendation;
    return {
      type: row.type || 'In-Person Consolidation',
      term: row.term || row.decisionTerm || row.source?.term || row.target?.term || '',
      decisionTerm: row.decisionTerm || row.term || row.source?.term || row.target?.term || '',
      selectedDecisionTerm: row.selectedDecisionTerm || row.decisionTerm || '',
      selectedArchivedTerms: row.selectedArchivedTerms || '',
      uploadedTermsUsed: row.uploadedTermsUsed || '',
      historicalComparisonTermsUsed: row.historicalComparisonTermsUsed || '',
      score: row.score,
      label: row.label,
      confidenceLevel: row.confidenceLevel || '',
      course: row.course,
      sectionsReviewed: row.sectionsReviewed || row.sections || row.sectionCount || '',
      potentialSectionsRemoved: row.potentialSectionsRemoved || row.recommendedReductions || '',
      expectedEnrollment: row.expectedEnrollment ?? row.sourceEnroll ?? '',
      availableReceivingCapacity: row.availableReceivingCapacity ?? row.vacancies ?? targetOpenSeats ?? '',
      projectedRedistribution,
      netAvailableCapacity: netAvailable,
      potentialSeatsRecovered: row.potentialSeatsRecovered ?? row.freedSeats ?? '',
      projectionSource: row.projectionSource || (row.historicalTerms ? `Historical Average (${row.historicalTerms} terms)` : 'N/A'),
      finalEnrollmentContext: row.finalEnrollmentContext || 'N/A',
      sourceSummary: row.sourceSummary || sourceSummary,
      sourceSection,
      sourceEnroll: row.source ? expectedEnrollment(row.source) : row.sourceEnroll,
      sourceFill: row.source ? pct(expectedFillRate(row.source)) : pct(row.sourceFill),
      targetSummary: row.targetSummary || targetSummary,
      targetSection: row.target ? describe(row.target) : '',
      targetEnroll: row.target ? expectedEnrollment(row.target) : '',
      targetOpenSeats,
      onlineSummary,
      vacancies: row.vacancies ?? '',
      sectionCap: row.sectionCap ?? '',
      possibleReductions: row.possibleReductions ?? '',
      recommendedReductions: row.recommendedReductions ?? '',
      recommendation: recommendationWithWarnings,
      freedSeats: row.freedSeats,
      matchReason: row.matchReason,
      historicalTerms: row.historicalTerms,
      historicalTermsIncluded: row.historicalTermsIncluded ?? row.historicalTerms ?? '',
      chronicLowFill: row.chronicLowFill,
      tbaConfidence: row.tba ? 'Capped at 70' : '',
      dataQualityWarnings: row.dataQualityWarnings || '',
      calculationBasis: row.calculationBasis || ''
    };
  }

  function renderConsolidationTables(rows) {
    const node = document.getElementById('consolidationTable');
    if (!node) return;
    const online = rows.filter(row => row.type === 'Online Reduction');
    const inPerson = rows.filter(row => row.type !== 'Online Reduction');
    const columns = ['type', 'score', 'label', 'confidenceLevel', 'course', 'sectionsReviewed', 'potentialSectionsRemoved', 'expectedEnrollment', 'availableReceivingCapacity', 'projectedRedistribution', 'netAvailableCapacity', 'potentialSeatsRecovered', 'projectionSource', 'finalEnrollmentContext', 'sourceSummary', 'targetSummary', 'recommendation', 'matchReason', 'historicalTermsIncluded', 'dataQualityWarnings', 'chronicLowFill', 'tbaConfidence'];
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
        ['Work Experience Rows Included', 'Metric card. Count of separate Work Experience Enrollment Upload rows included in the dashboard because the include Work Experience toggle is on. These rows contribute to enrollment and FTES summaries, but not physical room/time reports.'],
        ['Work Experience FTES Warnings', 'Metric card. Count of included Work Experience rows where FTES was not directly provided and could not be estimated from available units/contact-hour fields.'],
        ['Registration Pace Monitor', 'Current focus-term enrollment versus average expected enrollment from comparable same-season historical terms by Course, Division, Modality, Campus, Day Pattern, and Time Block. The selected focus term and future terms are excluded. Status is Ahead of Pace, On Pace, Behind Pace, or N/A.'],
        ['Growth Opportunities', 'Courses with waitlist pressure or very high fill. Added capacity is considered only when viable open seats appear insufficient after reviewing same modality, online, same campus, time-window, and compatible-day seats.'],
        ['Reduction Opportunities', 'Top rows from the existing consolidation report output. Open the consolidation report for the full methodology and candidate details.'],
        ['Student Presence Analytics', 'In-person and hybrid student load by campus, day, and hour. Online rows are excluded.'],
        ['Schedule Structure', 'Prime/off-peak section and enrollment split plus modality mix for the selected filters.'],
        ['Course Rotation Analysis', 'Course offering cadence based on loaded historical terms, including terms offered, average gap, rotation cycle, last offered, expected next offering, and rotation status.'],
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
      ['Planning Term Excluded', 'Optional active, future, or otherwise non-final term removed from the historical trend. No current/decision term is required to run this report.'],
      ['Course Historical Terms Included', 'Number of completed historical terms where this specific row grouping appears after filters are applied. The excluded planning term is not included.'],
      ['Overall Historical Terms Included', 'Number of selected completed historical terms used after filters are applied. The excluded planning/future term is not included.'],
      ['Historical Sections', 'Distinct CRNs from selected completed historical terms only.'],
      ['Historical Overall Attrition', 'Historical Census 1 to End/Final attrition from selected completed terms only. The excluded planning term never contributes to this rate.'],
      ['Historical Census 1 to Census 2 Attrition', 'Historical Census 1 minus Census 2 divided by Census 1 for matched CRNs. This shows how enrollment moved between the two Banner census milestones.'],
      ['Historical Census 2 to End Attrition', 'Historical Census 2 minus End/Final divided by Census 2 for matched CRNs. Negative percentages mean enrollment increased after Census 2.'],
      ['Work Experience Rows Included', 'Metric card. Count of rows loaded from the separate Work Experience Enrollment Upload and included by the report toggle. These rows are eligible for enrollment, lifecycle, demand, and FTES calculations, but not physical room/time reports.'],
      ['Work Experience FTES Warnings', 'Metric card. Count of included Work Experience rows where direct FTES was not provided and the upload also lacked enough units/contact-hour fields to estimate FTES. Those rows still count for enrollment/lifecycle metrics, but FTES should be treated as unavailable rather than a confirmed zero.'],
      ['Total Seats', 'Total MAX ENROLL capacity across the row grouping and included terms.'],
      ['Census Enrollment', 'CENSUS_ENROLL/Census 1 across included terms. If CENSUS_ENROLL is missing for a section, ACTUAL_ENROLL is used for that section.'],
      ['Census 2 Enrollment', 'CENSUS_ENROLL2 across included terms where present. Missing Census 2 values remain unavailable and do not become zero.'],
      ['Final Enrollment', 'ACTUAL_ENROLL across included terms. This remains visible for attrition/retention context and does not drive consolidation or forecast recommendations.'],
      ['Total Milestone Enrollment', 'Historical Census 1, Census 2, and End/Final totals sum all valid values for each milestone independently. They do not become zero or N/A simply because the CRN populations differ.'],
      ['Matched CRNs', 'For each attrition interval, only CRNs with both required milestone values are included. Example: Census 2 to End uses only CRNs with valid Census 2 and valid End/Final values.'],
      ['Start to End Attrition', 'First Day minus End/Final divided by First Day for matched CRNs. Shows N/A when no CRNs have both values.'],
      ['Start to Census 1 Attrition', 'First Day minus Census 1 divided by First Day for matched CRNs. Shows N/A when First Day snapshots are unavailable.'],
      ['Start to Census 2 Attrition', 'First Day minus Census 2 divided by First Day for matched CRNs. Shows N/A when no CRNs have both values.'],
      ['Census 1 to Census 2 Attrition', 'Census 1 minus Census 2 divided by Census 1 for CRNs with both Census 1 and Census 2.'],
      ['Census 1 to End Attrition', 'Census 1 minus End/Final divided by Census 1 for CRNs with both values. This is also the Overall Attrition rate.'],
      ['Census 2 to End Attrition', 'Census 2 minus End/Final divided by Census 2 for CRNs with both values.'],
      ['Overall Attrition', 'Census 1 to End/Final attrition unless a more official lifecycle standard is adopted later.'],
      ['Lifecycle Readiness', 'First Day comes from stored First Day snapshots when available. Census 1 comes from CENSUS_ENROLL. Census 2 comes from CENSUS_ENROLL2. End/Final comes from ACTUAL_ENROLL or Final Enrollment. Missing milestone fields display as N/A, not zero.'],
      ['Negative Attrition', 'A negative rate means enrollment increased between the two matched milestones. Formula remains (start enrollment - end enrollment) / start enrollment.'],
      ['Attrition Count', 'Historical Census 1 minus Final Enrollment. Negative values indicate enrollment growth between milestones.'],
      ['Attrition Rate', 'Historical Attrition Count divided by Census 1. Negative percentages indicate enrollment growth between milestones.'],
      ['Diagnostic Attrition Rates', 'Separate table showing historical trend rates for First Day to Census 1, First Day to Census 2, First Day to End/Final, Census 1 to Census 2, Census 1 to End/Final, and Census 2 to End/Final.'],
      ['Milestone Population Warning', 'Shown as a concise data-quality note when milestone populations differ. The warning is diagnostic only; interval percentages are still calculated from matched CRNs for each comparison.'],
      ['Historical Attrition Rate', 'Historical attrition from selected completed terms only; it excludes the selected planning term.'],
      ['Census Fill Rate', 'Census Enrollment divided by Total Seats. Values above 100% mean sections exceeded listed capacity.'],
      ['Final Fill Rate', 'Final Enrollment divided by Total Seats. Values above 100% mean sections exceeded listed capacity.'],
      ['Empty Seats at Census', 'Total Seats minus Census Enrollment, floored at zero.'],
      ['Empty Seats at Final', 'Total Seats minus Final Enrollment, floored at zero.']
    ];
    renderMethodologyPanel(legend, {
      title: 'Enrollment Attrition Trend Methodology & Data Dictionary',
      purpose: 'Reviews completed historical milestone enrollment movement and data coverage so attrition trends can be interpreted for planning.',
      methodology: 'Enrollment Attrition Trend is intended to review completed historical milestone enrollment movement and data coverage. A planning term can be selected only to exclude active, future, or otherwise non-final data from the historical trend. Census 1 and Census 2 are Banner-captured milestone values from CENSUS_ENROLL and CENSUS_ENROLL2. End/Final uses ACTUAL_ENROLL/current enrollment after term completion and should be treated as final only for completed historical terms. Because milestone populations may differ, attrition rates are diagnostic and should be interpreted alongside CRN coverage counts. Attrition percentages use matched CRNs for each comparison so the numerator and denominator are apples-to-apples. Negative attrition indicates enrollment growth between milestones. Negative Census 2 values are treated as invalid/missing. Tutoring/Open Lab sections are excluded by default because they behave differently from standard scheduled instruction. Work Experience upload rows are flagged as Work Experience source rows and included only when the report toggle is on.',
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
      ['Consolidation CSV(s)', 'Optional upload for this report. Calculations use only selected Consolidation CSV upload files and archived terms selected in the Consolidation archived-term selector. The report does not silently pull every archived term or the current room grid.'],
      ['Instructional methods', 'Online, In-Person, and Hybrid are derived from instructional method codes. Online codes include ONL, 71, 72, O1, OL, ONN, ONS, OO, OS, OSS, OT, OTS, ON, and OSL. In-person codes include IP, 02, 22, 022, 02H, 02O, 02S, 02T, 02N, 04, 06, 07, 08, 09, 12, XX, and YY. Hybrid codes include HYB, OH, OHF, FLX, and OHS. CPL, DE, CBE, 20, and unmapped archived code 98 are omitted from this report.'],
      ['Decision term', 'The term being reviewed for planned consolidation opportunities. For in-person rows, the decision term supplies planned sections, meeting patterns, and capacity, not the enrollment demand used to trigger recommendations.'],
      ['Curriculum Crosswalk', 'Configured curriculum/CCN crosswalk rows map old course numbers to current/synonym course numbers before historical demand, online reduction, and in-person consolidation groupings are calculated. Example: ENGL 001 history can support ENGL C1000 when that crosswalk row exists.'],
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
      ['Confidence Level', 'High, Medium, Low, or Limited History. Rows with fewer than three historical terms are labeled Limited History and should not be treated as high-confidence recommendations.'],
      ['Data Quality Warnings', 'Audit notes such as limited history or insufficient receiving capacity. Warning rows should be reviewed manually before any schedule decision.'],
      ['Calculation Basis', 'Plain-language summary of whether the row was calculated from online decision-term vacancy math or in-person/hybrid receiving-capacity math.'],
      ['Final Enrollment Context', 'Final/current enrollment context from removed sections when present. Missing or zero context displays N/A. Final enrollment does not drive recommendations.'],
      ['Source Summary', 'For consolidation rows, the section(s) recommended for review/removal. For online rows, the course-level online aggregate.'],
      ['Target Summary', 'For consolidation rows, the remaining matching sections available to receive projected enrollment and the expected receiving capacity.'],
      ['Vacancies', 'For online reduction rows, expected open seats across decision-term online sections. Formula: selected decision-term online capacity minus average historical enrollment, floored at zero. Historical average vacancies remain visible only as audit context and do not by themselves create a reduction recommendation.'],
      ['Section Cap', 'For online reduction rows, the median online section cap used as the standard section size.'],
      ['Possible Reductions', 'For online rows, Vacancies divided by Section Cap, rounded down.'],
      ['Recommended Reductions', 'A conservative online reduction count. It leaves one reducible section of buffer when Possible Reductions is greater than one.'],
      ['Recommendation', 'Explicit action text showing what to remove or reduce, projected redistribution, and remaining capacity. This is a planning indicator, not an automatic cancellation instruction.']
    ];
    renderMethodologyPanel(legend, {
      title: 'Consolidation Opportunities Methodology & Data Dictionary',
      purpose: 'Identifies planning candidates where low-filled sections may be reviewed for consolidation with minimal expected enrollment impact.',
      methodology: 'This report separates online reduction math from in-person/hybrid consolidation. Online rows are course-level reduction candidates where decision-term offered online capacity is compared against historical average enrollment. In-person and hybrid rows are grouped by course, modality, campus, and meeting pattern so reciprocal source-target pairs do not double-count a single opportunity.',
      assumptions: 'The default retention planning assumption is conservative review, not automatic cancellation. Consolidation rows require pooled receiving capacity based on the selected Absorb % threshold. Online rows require positive decision-term expected vacancy before any section reduction is shown.',
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
      ['Work Experience Rows Included', 'Metric card. Count of rows loaded from the separate Work Experience Enrollment Upload and included in the forecast input. Default is ON because Work Experience contributes to enrollment and FTES planning.'],
      ['Work Experience FTES Warnings', 'Metric card. Count of included Work Experience rows where direct FTES was not provided and FTES could not be estimated from available units/contact-hour fields. These rows remain in enrollment demand counts, while FTES is treated as unavailable for review.'],
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
      ['Average FTES', 'Table column. Average historical FTES across included finalized terms. Uses uploaded FTES when present; otherwise estimates FTES from ACCOUNTING METHOD and available contact-hour fields. W/IW/unknown use census enrollment x weekly hours x 17.5 / 525. D/ID/P/E use census enrollment x TOTAL_CONTACT_HOURS / 525. If contact hours are unavailable but units are present, fallback formula is census enrollment x units / 30. For Work Experience upload rows with no direct FTES and no usable contact-hour/unit fields, FTES is flagged as unavailable for review.'],
      ['Historical Census Fill Rate', 'Table column. Average of term-level census fill rates. Formula per term: sum(census enrollment) / sum(MAX ENROLL).'],
      ['Historical Final Fill Rate', 'Table column. Average of term-level final fill rates. Formula per term: sum(ACTUAL_ENROLL) / sum(MAX ENROLL).'],
      ['Historical Avg Attrition Count', 'Table column. Average of term-level attrition counts. Formula per term: census enrollment - actual enrollment. Negative values indicate enrollment growth. This is context only and does not drive cancellation logic.'],
      ['Historical Avg Attrition Rate', 'Table column. Average of term-level attrition rates. Formula per term: (census enrollment - actual enrollment) / census enrollment. Negative values indicate enrollment growth. This is context only and does not drive cancellation logic.'],
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
      ['Work Experience Upload Source', 'Separate Work Experience upload rows override the normal ACCOUNTING METHOD I omission because they are the supplemental source for Work Experience enrollment/FTES that does not appear in Section Seating. Direct FTES is used when present. If direct FTES is absent, FTES is estimated only when units or contact-hour fields are available; otherwise the row is counted for enrollment and flagged as FTES unavailable.'],
      ['Not Included', 'This report does not use applications, registration intent, student education plans, section-level waitlist snapshots over time, room constraints, faculty availability, budget limits, or external labor-market demand. It also excludes rows omitted by instructional-method rules such as CPL, DE, CBE, and unmapped archived code 98, plus any rows removed by active filters.'],
      ['Data Limitations', 'Forecasts depend on uploaded columns. Missing FTES, contact-hour, unit, and accounting-method columns reduce FTES reliability. Missing Work Experience FTES inputs are flagged rather than treated as a confirmed zero. Missing waitlist columns make waitlist demand unknown, not zero. Missing division, department, or course title values appear blank or UNKNOWN. Terms that are still enrolling should not be selected as historical archives unless they are intentionally being reviewed as incomplete scenario data.']
    ];
    renderMethodologyPanel(legend, {
      title: 'Enrollment Demand Forecast Methodology & Data Dictionary',
      purpose: 'Forecasts future enrollment demand from finalized historical growth patterns at the college, division, discipline, and course levels. It supports schedule planning, enrollment growth, apportionment context, FTES cap planning, and capacity assumptions.',
      methodology: 'Forecast growth blends course, discipline, division, and college trends, then applies the optional modifier. Single-term forecasts compare like terms only. Academic-year forecasts aggregate Summer, Fall, and Spring into FY/AY buckets before calculating growth.',
      assumptions: 'Forecast growth is capped between -75% and +150%. FTES is direct-upload FTES when present; otherwise it is estimated from ACCOUNTING METHOD, census enrollment, and contact-hour fields. I and O accounting methods are omitted from ordinary Section Seating rows. Separate Work Experience upload rows are included when toggled on because they are not available in Section Seating. E is treated as open-entry/open-exit positive attendance.',
      limitations: 'Forecasts are planning estimates, not guarantees. Positive attendance and Work Experience FTES are estimated from available fields unless official production values are entered directly. Missing waitlist, FTES, contact-hour, unit, division, department, or title fields reduce reliability.',
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
      scope: 'Scope',
      calculation: 'Calculation',
      startMilestone: 'Start Milestone',
      endMilestone: 'End Milestone',
      startEnrollment: 'Start Enrollment',
      endEnrollment: 'End Enrollment',
      matchedCrns: 'Matched CRNs',
      missingStartCrns: 'Missing Start CRNs',
      missingEndCrns: 'Missing End CRNs',
      note: 'Note',
      subject: 'Discipline',
      decisionTerm: 'Decision Term',
      excludedPlanningTerm: 'Planning Term Excluded',
      decisionSections: 'Decision Sections',
      decisionCensus: 'Decision Census 1',
      decisionCensus2: 'Decision Census 2',
      decisionFinal: 'Decision End/Final',
      decisionOverallAttritionRate: 'Decision Overall Attrition',
      decisionStartToEndAttritionRate: 'Decision Start to End Attrition',
      decisionStartToCensus1AttritionRate: 'Decision Start to Census 1 Attrition',
      decisionStartToCensus2AttritionRate: 'Decision Start to Census 2 Attrition',
      decisionCensus1ToCensus2AttritionRate: 'Decision Census 1 to Census 2 Attrition',
      decisionCensus1ToEndAttritionRate: 'Decision Census 1 to End Attrition',
      decisionCensus2ToEndAttritionRate: 'Decision Census 2 to End Attrition',
      firstDayToCensus1Attrition: 'First Day to Census 1 Attrition',
      firstDayToCensus2Attrition: 'First Day to Census 2 Attrition',
      firstDayToEndFinalAttrition: 'First Day to End/Final Attrition',
      census1ToCensus2Attrition: 'Census 1 to Census 2 Attrition',
      census1ToEndFinalAttrition: 'Census 1 to End/Final Attrition',
      census2ToEndFinalAttrition: 'Census 2 to End/Final Attrition',
      firstDayToCensus1MatchedCrns: 'First Day to Census 1 Matched CRNs',
      firstDayToCensus2MatchedCrns: 'First Day to Census 2 Matched CRNs',
      firstDayToEndFinalMatchedCrns: 'First Day to End/Final Matched CRNs',
      census1ToCensus2DiagnosticMatchedCrns: 'Census 1 to Census 2 Matched CRNs',
      census1ToEndFinalMatchedCrns: 'Census 1 to End/Final Matched CRNs',
      census2ToEndFinalMatchedCrns: 'Census 2 to End/Final Matched CRNs',
      dataQualityNotes: 'Data Quality Notes',
      census1ToCensus2MatchedCrns: 'C1 to C2 Matched CRNs',
      census2ToEndMatchedCrns: 'C2 to End Matched CRNs',
      census1ToEndMatchedCrns: 'C1 to End Matched CRNs',
      census1ToCensus2AttritionRate: 'C1 to C2 Attrition',
      census2ToEndAttritionRate: 'C2 to End Attrition',
      census1ToEndAttritionRate: 'C1 to End Attrition',
      invalidCensus2Count: 'Invalid Census 2 Count',
      missingCensus2Count: 'Missing Census 2 Count',
      missingFinalCount: 'Missing Final Count',
      historyCensus: 'Historical Census 1',
      historyCensus2: 'Historical Census 2',
      historyFinal: 'Historical End/Final',
      historyStartToEndAttritionRate: 'Historical Start to End Attrition',
      historyStartToCensus1AttritionRate: 'Historical Start to Census 1 Attrition',
      historyStartToCensus2AttritionRate: 'Historical Start to Census 2 Attrition',
      historyCensus1ToCensus2AttritionRate: 'Historical Census 1 to Census 2 Attrition',
      historyCensus1ToEndAttritionRate: 'Historical Census 1 to End Attrition',
      historyCensus2ToEndAttritionRate: 'Historical Census 2 to End Attrition',
      historyOverallAttritionRate: 'Historical Overall Attrition',
      totalSeats: 'Total Seats',
      emptySeatsAtCensus: 'Empty Seats at Census',
      emptySeatsAtFinal: 'Empty Seats at Final',
      courseHistoricalTermsIncluded: 'Course Historical Terms Included',
      overallHistoricalTermsIncluded: 'Overall Historical Terms Included',
      totalUploadedTerms: 'Historical Terms Included',
      decisionTermIncluded: 'Planning Term Included',
      historySections: 'Historical Sections',
      historicalAttritionRate: 'Historical Attrition Rate',
      historicalAttritionCount: 'Historical Avg Attrition Count',
      sections: 'All Terms Sections',
      census: 'Census Enrollment',
      census2: 'Census 2 Enrollment',
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
      conflictType: 'Conflict Type',
      sourceTerm: 'Source Term',
      instructionalMethod: 'Instructional Method',
      timeBlock: 'Time Block',
      censusEnrollment: 'Census Enrollment',
      day: 'Overlap Day',
      timeOverlap: 'Time Overlap',
      meetingDays1: 'Meeting Days 1',
      crn1: 'CRN 1',
      course1: 'Course 1',
      instructor1: 'Instructor 1',
      room1: 'Room 1',
      startDate1: 'Start Date 1',
      endDate1: 'End Date 1',
      dateRange1: 'Date Range 1',
      meetingDays2: 'Meeting Days 2',
      crn2: 'CRN 2',
      course2: 'Course 2',
      instructor2: 'Instructor 2',
      room2: 'Room 2',
      startDate2: 'Start Date 2',
      endDate2: 'End Date 2',
      dateRange2: 'Date Range 2',
      overlapMinutes: 'Overlap Minutes',
      studentsPresent: 'Students Present',
      sectionsActive: 'Sections Active',
      distinctCrns: 'Distinct CRNs',
      meetingRowsIncluded: 'Meeting Rows Included',
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
    if (value == null && /attrition/i.test(column)) return 'N/A';
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
      selected === REPORTS.conflictCheck ? 'conflictLegend' :
      selected === REPORTS.studentPresence ? 'studentPresenceLegend' :
      selected === REPORTS.instructorAvailability ? 'instructorAvailabilityLegend' : '';
    const text = document.getElementById(legendId)?.innerText || '';
    return [divisionFilterContextText(selected), text.trim()].filter(Boolean).join('\n\n');
  }

  function divisionFilterContextText(selectedReport) {
    const prefix = selectedReport === REPORTS.dashboard ? 'dash' :
      selectedReport === REPORTS.attrition ? 'attr' :
      selectedReport === REPORTS.consolidation ? 'con' :
      selectedReport === REPORTS.conflictCheck ? 'conflict' :
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
    if (state.dashboardInput.length) return 'Selected dashboard CSV and/or archived term rows';
    if (state.workExperienceInput.length) return 'Currently loaded schedule rows with Work Experience rows included';
    return 'Currently loaded schedule rows';
  }

  function normalizeRole(role) {
    const key = String(role || '').toLowerCase().replace(/[^a-z]/g, '');
    if (key === 'developer') return 'development';
    return ROLE_LEVEL[key] ? key : 'general';
  }

  function clearRoleSession() {
    [ROLE_STORAGE_KEY, ROLE_TOKEN_KEY, ROLE_EXPIRES_KEY, LEGACY_EM_TOKEN_KEY, LEGACY_EM_EXPIRES_KEY, 'cos-em-unlocked'].forEach(key => {
      sessionStorage.removeItem(key);
    });
  }

  function roleSession() {
    const role = normalizeRole(sessionStorage.getItem(ROLE_STORAGE_KEY) || 'general');
    const expiresAt = Number(sessionStorage.getItem(ROLE_EXPIRES_KEY) || 0);
    const token = sessionStorage.getItem(ROLE_TOKEN_KEY) || '';
    if (token && (!expiresAt || expiresAt <= Date.now())) {
      clearRoleSession();
      return { role: 'general', token: '', expiresAt: 0 };
    }
    const legacyExpiresAt = Number(sessionStorage.getItem(LEGACY_EM_EXPIRES_KEY) || 0);
    const legacyToken = sessionStorage.getItem(LEGACY_EM_TOKEN_KEY) || '';
    if (!token && legacyToken && legacyExpiresAt > Date.now()) {
      return { role: 'em', token: legacyToken, expiresAt: legacyExpiresAt };
    }
    return { role, token, expiresAt };
  }

  function currentAccessRole() {
    return roleSession().role;
  }

  function canAccessRole(requiredRole) {
    return ROLE_LEVEL[currentAccessRole()] >= ROLE_LEVEL[normalizeRole(requiredRole)];
  }

  function canAccess(reportName) {
    return canAccessRole(REPORT_ACCESS[reportName] || 'general');
  }

  function isEnrollmentManagementUnlocked() {
    return canAccessRole('em');
  }

  function enrollmentManagementToken() {
    return roleSession().token || '';
  }

  function requestReportAccess(reportName = '', requiredRole = '') {
    if (window.COS_APP_CONFIG?.features?.enrollmentManagement === false) return;
    state.pendingAccessReport = reportName;
    state.pendingAccessRole = normalizeRole(requiredRole || REPORT_ACCESS[reportName] || 'general');
    const panel = document.getElementById('emPasswordPanel');
    const input = document.getElementById('emPasswordInput');
    const label = document.getElementById('emPasswordLabelText');
    const hint = document.getElementById('emRequiredAccessHint');
    if (label) label.textContent = `${ROLE_LABEL[state.pendingAccessRole]} Password`;
    if (hint) {
      const reportLabel = reportName && canAccess(reportName) ? REPORT_LABEL[reportName] || reportName : 'the selected locked report';
      hint.textContent = `Unlock ${reportLabel}. Requires ${ROLE_LABEL[state.pendingAccessRole]} or higher; higher roles inherit lower permissions.`;
    }
    if (panel) panel.hidden = false;
    input?.focus();
  }

  async function unlockEnrollmentManagement() {
    if (window.COS_APP_CONFIG?.features?.enrollmentManagement === false) return;
    if (!window.BACKEND_BASE_URL) {
      alert('Backend is not configured, so role access cannot be opened.');
      return;
    }
    const panel = document.getElementById('emPasswordPanel');
    const input = document.getElementById('emPasswordInput');
    if (panel?.hidden) {
      requestReportAccess('', 'general');
      return;
    }
    const password = input?.value || '';
    if (!password) {
      alert('Enter the report password.');
      input?.focus();
      return;
    }
    const requestedRole = normalizeRole(state.pendingAccessRole || 'general');
    let response = await fetch(`${window.BACKEND_BASE_URL}/api/auth/role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, requestedRole })
    });
    if (response.status === 404 && ROLE_LEVEL[requestedRole] <= ROLE_LEVEL.em) {
      response = await fetch(`${window.BACKEND_BASE_URL}/api/auth/enrollment-management`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
    }
    if (!response.ok) {
      alert(`${ROLE_LABEL[requestedRole]} password was not accepted.`);
      return;
    }
    const payload = await response.json();
    const role = normalizeRole(payload.role || (ROLE_LEVEL[requestedRole] <= ROLE_LEVEL.em ? 'em' : requestedRole));
    sessionStorage.setItem(ROLE_STORAGE_KEY, role);
    sessionStorage.setItem(ROLE_TOKEN_KEY, payload.token || '');
    sessionStorage.setItem(ROLE_EXPIRES_KEY, String(Date.parse(payload.expiresAt || '') || Date.now()));
    sessionStorage.setItem(LEGACY_EM_TOKEN_KEY, payload.token || '');
    sessionStorage.setItem(LEGACY_EM_EXPIRES_KEY, String(Date.parse(payload.expiresAt || '') || Date.now()));
    if (input) input.value = '';
    if (panel) panel.hidden = true;
    state.pendingAccessRole = '';
    const pendingReport = state.pendingAccessReport;
    state.pendingAccessReport = '';
    if (pendingReport && canAccess(pendingReport)) {
      const select = document.getElementById('emReportSelect');
      if (select) select.value = pendingReport;
    }
    updateVisibility();
  }

  function lockEnrollmentReports() {
    clearRoleSession();
    state.pendingAccessRole = '';
    state.pendingAccessReport = '';
    const panel = document.getElementById('emPasswordPanel');
    const input = document.getElementById('emPasswordInput');
    if (input) input.value = '';
    if (panel) panel.hidden = true;
    updateVisibility();
  }

  function updateReportAccessOptions() {
    const select = document.getElementById('emReportSelect');
    const selected = selectedEnrollmentReport();
    Array.from(select?.options || []).forEach(option => {
      const report = option.value;
      const requiredRole = REPORT_ACCESS[report] || 'general';
      const locked = !canAccess(report);
      option.dataset.requiredRole = requiredRole;
      option.dataset.locked = locked ? 'true' : 'false';
      option.textContent = locked ? 'Locked report ••••••••' : (REPORT_LABEL[report] || report);
    });
    document.querySelectorAll('.em-report-button[data-report-target]').forEach(button => {
      const report = button.dataset.reportTarget || '';
      const requiredRole = REPORT_ACCESS[report] || 'general';
      const locked = !canAccess(report);
      button.classList.toggle('is-active', report === selected);
      button.classList.toggle('is-locked', locked);
      button.setAttribute('aria-current', report === selected ? 'page' : 'false');
      button.setAttribute('aria-disabled', locked ? 'true' : 'false');
      const label = button.querySelector('span');
      if (label) label.textContent = locked ? 'Locked report ••••••••' : (REPORT_LABEL[report] || report);
      const note = button.querySelector('small');
      if (note) note.textContent = locked ? 'Locked - unlock to view name' : ROLE_LABEL[requiredRole];
    });
  }

  function renderLockedReportPanel(reportName) {
    const panel = document.getElementById('lockedReportPanel');
    if (!panel) return;
    if (!reportName || canAccess(reportName)) {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }
    const requiredRole = REPORT_ACCESS[reportName] || 'general';
    panel.hidden = false;
    panel.innerHTML = `
      <h3>Locked report ••••••••</h3>
      <p>This report requires <strong>${escapeAttr(ROLE_LABEL[requiredRole])}</strong> access or higher.</p>
      <button type="button" data-unlock-report="${escapeAttr(reportName)}">Unlock This Report</button>
    `;
  }

  function setReportDisplay(reportName, elementId) {
    const node = document.getElementById(elementId);
    if (!node) return;
    node.style.display = canAccess(reportName) && selectedEnrollmentReport() === reportName ? 'block' : 'none';
  }

  function updateVisibility() {
    const selected = selectedEnrollmentReport();
    const wrap = document.getElementById('analyticsReports');
    if (!wrap) return;
    const selectedAccessible = canAccess(selected);
    updateReportAccessOptions();
    wrap.style.display = 'block';
    document.getElementById('emReportControls').hidden = false;
    document.getElementById('workExperienceUploadPanel').hidden = !selectedAccessible || selected !== REPORTS.workExperience;
    document.getElementById('unlockEnrollmentManagement').hidden = currentAccessRole() === 'admin';
    document.getElementById('lockEnrollmentReports').hidden = currentAccessRole() === 'general' && !enrollmentManagementToken();
    const access = document.getElementById('currentAccessLevel');
    if (access) access.textContent = ROLE_LABEL[currentAccessRole()];
    const note = document.querySelector('.em-access-note');
    if (note) note.textContent = selectedAccessible
      ? `${ROLE_LABEL[currentAccessRole()]} access is active for this browser session.`
      : `A locked report requires ${ROLE_LABEL[REPORT_ACCESS[selected] || 'general']} access.`;
    renderLockedReportPanel(selected);
    setReportDisplay(REPORTS.dashboard, 'dashboardReport');
    setReportDisplay(REPORTS.attrition, 'attritionReport');
    setReportDisplay(REPORTS.consolidation, 'consolidationReport');
    setReportDisplay(REPORTS.demand, 'demandReport');
    setReportDisplay(REPORTS.conflictCheck, 'conflictCheckReport');
    setReportDisplay(REPORTS.archiveInspection, 'archiveInspectionReport');
    setReportDisplay(REPORTS.roomFit, 'roomFitReport');
    setReportDisplay(REPORTS.snapshotManager, 'snapshotManagerReport');
    setReportDisplay(REPORTS.studentPresence, 'studentPresenceReport');
    setReportDisplay(REPORTS.instructorAvailability, 'instructorAvailabilityReport');
    setReportDisplay(REPORTS.facultyModality, 'facultyModalityReport');
    setReportDisplay(REPORTS.primeTimeAnalysis, 'primeTimeAnalysisReport');
    setReportDisplay(REPORTS.supplyDemand, 'supplyDemandReport');
    setReportDisplay(REPORTS.busyTimeDashboard, 'busyTimeDashboardReport');
    setReportDisplay(REPORTS.studentChoiceOpportunity, 'studentChoiceOpportunityReport');
    setReportDisplay(REPORTS.recommendationEngine, 'recommendationEngineReport');
    setReportDisplay(REPORTS.facultyHeatmap, 'facultyHeatmapReport');
    const utilizationTool = document.getElementById('utilization-tool');
    if (utilizationTool) utilizationTool.style.display = selectedAccessible && selected === REPORTS.utilization ? 'block' : 'none';
    const heatmapTool = document.getElementById('heatmap-tool');
    if (heatmapTool) heatmapTool.style.display = selectedAccessible && selected === REPORTS.heatmap ? 'block' : 'none';
    const modalityTool = document.getElementById('modality-tool');
    if (modalityTool) modalityTool.style.display = selectedAccessible && selected === REPORTS.modality ? 'block' : 'none';
    const linechartTool = document.getElementById('linechart-tool');
    if (linechartTool) linechartTool.style.display = selectedAccessible && selected === REPORTS.duration ? 'block' : 'none';
    if (!selectedAccessible) return;
    if (selected === REPORTS.dashboard) {
      rerunDashboard();
    }
    if (selected === REPORTS.attrition && !state.attritionRan) {
      const rows = rowsWithWorkExperience(state.enrollment.length ? state.enrollment : currentRows().filter(row => !isOmittedInstructionalMethod(row)), 'attr');
      updateDecisionTermOptions(state.attritionTerms.length ? state.attritionTerms : collectTerms(rows));
      populateAnalyticsFilters('attr', rows);
      document.getElementById('attritionTable').innerHTML = '<p class="analytics-empty">Upload enrollment CSV files, then click Run.</p>';
    }
    if (selected === REPORTS.consolidation) {
      populateAnalyticsFilters('con', state.consolidationInput || []);
      updateConsolidationTermOptions(state.consolidationTerms || []);
      renderConsolidationLegend();
    }
    if (selected === REPORTS.demand && !state.demandRan) {
      const rows = rowsWithWorkExperience(state.demandInput.length ? state.demandInput : currentRows().filter(row => !isOmittedInstructionalMethod(row)), 'dem');
      updateDemandTermOptions(state.demandTerms.length ? state.demandTerms : collectTerms(rows));
      populateAnalyticsFilters('dem', rows);
      document.getElementById('demandTable').innerHTML = '<p class="analytics-empty">Upload or select archived historical CSV files, then click Run.</p>';
      renderDemandLegend();
    }
    if (selected === REPORTS.conflictCheck && !state.conflictRan) {
      loadConflictRows().then(() => {
        document.getElementById('conflictTable').innerHTML = '<p class="analytics-empty">Upload/select schedule CSVs or use the current loaded schedule, then click Run.</p>';
        renderConflictLegend();
      }).catch(err => console.warn(err));
    }
    if (selected === REPORTS.archiveInspection) {
      setArchiveInspectionTermOptions();
      if (!state.archiveInspectionRows.length) {
        metric('archiveInspectionMetrics', [
          ['Parsed Rows', 0],
          ['Distinct CRNs', 0],
          ['Detected Terms', 'N/A']
        ]);
        document.getElementById('archiveInspectionSummary').innerHTML = '<p class="analytics-empty">Select an archived term, then click Inspect Archived Schedule.</p>';
        document.getElementById('archiveInspectionSamples').innerHTML = '<p class="analytics-empty">No archive inspection has been run.</p>';
      }
    }
    if (selected === REPORTS.utilization) {
      window.COSScheduleApp?.renderUtilizationMap?.();
    }
    if (selected === REPORTS.heatmap) {
      window.COSScheduleApp?.renderHeatmapAnalytics?.();
    }
    if (selected === REPORTS.modality) {
      window.COSScheduleApp?.renderModalityBalance?.();
    }
    if (selected === REPORTS.duration) {
      window.COSScheduleApp?.renderDurationAnalytics?.();
    }
    if (selected === REPORTS.roomFit) {
      window.COSScheduleApp?.renderRoomFitReport?.();
    }
    if (selected === REPORTS.studentPresence) {
      runStudentPresence().catch(err => console.warn('Student Presence failed:', err));
    }
    if (selected === REPORTS.instructorAvailability) {
      populateInstructorAvailabilityFilters(currentRows());
      runInstructorAvailability();
    }
    if (selected === REPORTS.facultyModality) {
      updateFacultyModalityFilterOptions();
      renderFacultyModality();
    }
    if (selected === REPORTS.primeTimeAnalysis) {
      updatePrimeTimeFilterOptions();
      renderPrimeTimeAnalysis();
    }
    if (selected === REPORTS.supplyDemand && !state.supplyDemandRan) {
      updateSupplyDemandFilterOptions();
      setSupplyDemandCalGetcOptions();
      document.getElementById('supplyDemandTable').innerHTML = '<p class="analytics-empty">Upload CSV files or select archived terms, then click Run.</p>';
    }
    if (selected === REPORTS.busyTimeDashboard && !state.busyTimeRan) {
      updateBusyTimeFilterOptions();
      document.getElementById('busyTimeTable').innerHTML = '<p class="analytics-empty">Upload schedule CSV files or select archived terms, then click Run.</p>';
    }
    if (selected === REPORTS.studentChoiceOpportunity && !state.studentChoiceRan) {
      updateStudentChoiceFilterOptions();
      document.getElementById('studentChoiceTable').innerHTML = '<p class="analytics-empty">Upload schedule CSV files or select archived terms, then click Run.</p>';
    }
    if (selected === REPORTS.recommendationEngine && !state.recommendationRan) {
      updateRecommendationFilterOptions();
      document.getElementById('recommendationTable').innerHTML = '<p class="analytics-empty">Upload schedule CSV files or select archived terms, then click Run.</p>';
    }
    if (selected === REPORTS.facultyHeatmap) {
      updateFacultyHeatmapFilterOptions();
      renderFacultyScheduleHeatmap();
    }
    if (selected === REPORTS.snapshotManager) {
      renderSnapshotManager();
    }
  }

  function injectStyle() {
    if (document.getElementById('analyticsReportStyles')) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="analyticsReportStyles">
      .analytics-reports{width:min(1480px,calc(100% - 2rem));margin:16px auto 24px;padding:14px;background:rgba(255,255,255,.74);border:1px solid #d8e1ec;border-radius:12px;box-shadow:none}
      .em-access-panel{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #e2eaf3}
      .em-access-status{display:flex;flex-direction:column;gap:2px;margin-right:4px;padding:7px 10px;border:1px solid #d8e1ec;border-radius:8px;background:#f8fbff;color:#51657c;font-size:11px;text-transform:uppercase;font-weight:800}
      .em-access-status strong{color:#123367;font-size:14px;text-transform:none}
      .em-unlock{min-height:32px;border:1px solid #ccd6e2;border-radius:8px;padding:0 12px;background:#f8fbff;color:#51657c;font-size:13px;font-weight:800;cursor:pointer;box-shadow:none}
      .em-unlock:hover{color:#123367;border-color:#8ba6c2;background:#fff}
      .em-access-note{color:#6b7d91;font-size:12px}
      .em-report-controls{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:18px}
      .em-report-controls label{font-weight:800;color:#51657c;font-size:13px}
      .em-report-controls .em-methodology-export{font-weight:700;color:#51657c}
      .em-report-controls .em-methodology-export input{margin-right:6px}
      .em-workbench-note{flex-basis:100%;color:#6b7d91;font-size:12px;line-height:1.35}
      .em-report-controls select{min-height:36px;border:1px solid #ccd6e2;border-radius:8px;padding:6px 10px;background:#fff;color:#123367;font-weight:700}
      .sr-only{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
      .em-report-groups{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;flex-basis:100%}
      .em-report-group{min-width:0;border:1px solid #d8e1ec;border-radius:10px;background:#f8fbff;padding:10px}
      .em-report-group h3{margin:0 0 8px;color:#123367;font-size:14px}
      .em-report-button-list{display:grid;gap:7px}
      .em-report-button{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;min-height:44px;border:1px solid #c7d5e4;border-radius:8px;background:#fff;color:#123367;text-align:left;padding:8px 10px;cursor:pointer}
      .em-report-button span{font-weight:800;line-height:1.2}
      .em-report-button small{color:#51657c;font-size:11px;line-height:1.2}
      .em-report-button:hover{border-color:#8ba6c2;background:#fafdff}
      .em-report-button.is-active{border-color:#1f7aa8;background:#e8f7fc;box-shadow:inset 4px 0 0 #1f7aa8}
      .em-report-button.is-locked{background:#f4f6f8;color:#6b7d91;border-style:dashed;opacity:.78}
      .em-report-button.is-locked small{color:#8a5660}
      .em-report-empty{margin:0;color:#6b7d91;font-size:12px}
      .analytics-report-intro{margin-bottom:16px;color:#51657c;line-height:1.45}
      .analytics-report-intro h2{margin:0 0 6px;color:#123367;font-size:24px}
      .analytics-report-intro p{margin:0;max-width:980px}
      .analytics-report-intro .analytics-direction{margin-top:8px;color:#123367}
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
      .analytics-upload-panel{margin:0 0 16px;padding:12px;border:1px solid #d8e1ec;border-radius:10px;background:#f8fbff}
      .analytics-upload-panel h3{margin:0 0 6px;color:#123367;font-size:15px}
      .analytics-upload-panel p,.analytics-note{margin:0;color:#51657c;font-size:13px;line-height:1.35}
      .analytics-locked-panel{margin:0 0 16px;padding:14px;border:1px solid #d8e1ec;border-radius:10px;background:#f8fbff;color:#334862}
      .analytics-locked-panel h3{margin:0 0 6px;color:#123367;font-size:18px}
      .analytics-locked-panel p{margin:0 0 10px}
      .analytics-locked-panel button{min-height:34px;border:0;border-radius:18px;padding:0 16px;background:#cdeffc;color:#002b5c;font-weight:800;cursor:pointer}
      .analytics-warning-list{display:grid;gap:6px;margin:0 0 12px}
      .analytics-warning-list p{margin:0;padding:8px 10px;border:1px solid #f0c36d;border-radius:8px;background:#fff7dc;color:#6d4c00;font-weight:800;line-height:1.3}
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
      #roomFitReportMetrics button.room-fit-card{border:1px solid #f59e0b;border-radius:18px;padding:14px 16px;background:linear-gradient(135deg,#fff7ed,#fed7aa);box-shadow:0 8px 18px rgba(180,83,9,.16);cursor:pointer;text-align:center}
      #roomFitReportMetrics button.room-fit-card strong{display:block;font-size:24px;color:#7c2d12}
      #roomFitReportMetrics button.room-fit-card span{display:block;margin-top:4px;color:#9a3412;font-size:12px;font-weight:900;letter-spacing:.03em;text-transform:uppercase}
      #roomFitReportMetrics button.room-fit-card.is-active,#roomFitReportMetrics button.room-fit-card:hover{background:linear-gradient(135deg,#f97316,#fb923c);border-color:#c2410c;box-shadow:0 10px 22px rgba(194,65,12,.24)}
      #roomFitReportMetrics button.room-fit-card.is-active strong,#roomFitReportMetrics button.room-fit-card:hover strong,#roomFitReportMetrics button.room-fit-card.is-active span,#roomFitReportMetrics button.room-fit-card:hover span{color:#fff7ed}
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
      .faculty-modality-card{margin:0 0 12px;padding:12px;border:1px solid #d8e1ec;border-radius:10px;background:#fff}
      .faculty-modality-card h3{margin:0 0 8px;color:#123367;font-size:15px}
      .faculty-modality-bar-row{display:grid;grid-template-columns:90px 1fr 48px;gap:10px;align-items:center;margin:7px 0;color:#334862;font-size:13px}
      .faculty-modality-bar-track{height:16px;border-radius:999px;background:#eef4f9;overflow:hidden}
      .faculty-modality-bar{height:100%;border-radius:999px;background:#1f7aa8}
      .faculty-modality-in-person{background:#1f7aa8}
      .faculty-modality-hybrid{background:#f59e0b}
      .faculty-modality-online{background:#7c3aed}
      .faculty-modality-other{background:#64748b}
      .prime-time-days span{display:flex;flex-wrap:wrap;gap:8px}
      .prime-time-days span label{display:inline-flex;flex-direction:row;align-items:center;gap:3px;font-weight:800}
      .prime-time-gauges{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:0 0 14px}
      .prime-time-gauge-card{border:1px solid #d8e1ec;border-radius:10px;background:#fff;padding:12px;text-align:center}
      .prime-time-gauge-card strong,.prime-time-gauge-card small{display:block}
      .prime-time-gauge-card strong{margin-top:8px;color:#123367}
      .prime-time-gauge-card small{margin-top:4px;color:#51657c}
      .prime-time-gauge{width:104px;height:104px;margin:0 auto;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#1f7aa8 calc(var(--pct) * 1turn),#e8eef5 0)}
      .prime-time-gauge span{display:grid;place-items:center;width:74px;height:74px;border-radius:50%;background:#fff;color:#123367;font-weight:900}
      .supply-demand-line svg{width:100%;min-height:260px;background:#fff;border:1px solid #e2eaf3;border-radius:8px}
      .supply-demand-line text{font-size:11px;fill:#51657c}
      .supply-demand-line-legend{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;color:#334862;font-size:12px}
      .supply-demand-line-legend span{display:inline-flex;align-items:center;gap:4px}
      .supply-demand-line-legend i{display:inline-block;width:12px;height:12px;border-radius:50%}
      .busy-time-bar-row{display:grid;grid-template-columns:minmax(110px,1fr) minmax(120px,2fr) auto;gap:8px;align-items:center;margin:7px 0;color:#334862;font-size:12px}
      .busy-time-bar-row div{height:12px;background:#e6edf5;border-radius:999px;overflow:hidden}
      .busy-time-bar-row i{display:block;height:100%;background:linear-gradient(90deg,#f97316,#1f7aa8);border-radius:999px}
      .busy-time-bar-row strong{color:#123367}
      .analytics-insights{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-bottom:14px}
      .analytics-insights section{border:1px solid #d8e1ec;border-radius:10px;background:#f8fbff;padding:12px}
      .analytics-insights h3{margin:0 0 8px;color:#123367;font-size:15px}
      .analytics-insights ul{margin:0;padding-left:18px;color:#334862}
      .analytics-insights li{margin:4px 0;line-height:1.3}
      .presence-curve{grid-column:1/-1}
      .presence-curve p{margin:0 0 10px;color:#51657c;font-size:13px}
      .presence-curve table{min-width:760px}
      .presence-curve td{position:relative;min-width:72px;height:34px;vertical-align:middle;overflow:hidden}
      .presence-curve .presence-bar{position:absolute;left:6px;right:auto;top:8px;bottom:8px;border-radius:999px;background:linear-gradient(90deg,#1f5f99,#2aa889);opacity:.26}
      .presence-curve td strong{position:relative;z-index:1;color:#123367}
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
    document.getElementById('emReportSelect')?.addEventListener('change', () => {
      const selected = selectedEnrollmentReport();
      if (!canAccess(selected)) requestReportAccess(selected);
      updateVisibility();
    });
    document.getElementById('unlockEnrollmentManagement')?.addEventListener('click', unlockEnrollmentManagement);
    document.getElementById('lockEnrollmentReports')?.addEventListener('click', lockEnrollmentReports);
    document.getElementById('emPasswordPanel')?.addEventListener('submit', event => {
      event.preventDefault();
      unlockEnrollmentManagement();
    });
    document.getElementById('emPasswordToggle')?.addEventListener('click', () => {
      const input = document.getElementById('emPasswordInput');
      const toggle = document.getElementById('emPasswordToggle');
      if (!input || !toggle) return;
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      toggle.textContent = showing ? 'Show' : 'Hide';
      toggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    });
    document.getElementById('emPasswordCancel')?.addEventListener('click', () => {
      const panel = document.getElementById('emPasswordPanel');
      const input = document.getElementById('emPasswordInput');
      if (input) input.value = '';
      if (panel) panel.hidden = true;
      state.pendingAccessRole = '';
      state.pendingAccessReport = '';
    });
    document.getElementById('termSelect')?.addEventListener('change', () => {
      if (!canAccess(selectedEnrollmentReport())) return;
      if (selectedEnrollmentReport() === REPORTS.dashboard) rerunDashboard();
      if (selectedEnrollmentReport() === REPORTS.consolidation) runConsolidation();
      if (selectedEnrollmentReport() === REPORTS.demand) runDemand();
      if (selectedEnrollmentReport() === REPORTS.studentPresence) runStudentPresence().catch(err => console.warn(err));
    });
    document.getElementById('runDashboard')?.addEventListener('click', rerunDashboard);
    document.getElementById('dashboardCsv')?.addEventListener('change', rerunDashboard);
    document.getElementById('dashArchiveTerms')?.addEventListener('change', rerunDashboard);
    document.getElementById('archiveDashboardUploads')?.addEventListener('click', () => archiveUploads('dashboardCsv').catch(err => alert(err.message || 'Archive failed.')));
    document.getElementById('workExperienceCsv')?.addEventListener('change', () => {
      loadWorkExperienceRows()
        .then(() => {
          const selected = selectedEnrollmentReport();
          if (selected === REPORTS.dashboard) rerunDashboard();
          if (selected === REPORTS.attrition) runAttrition().catch(handleAttritionError);
          if (selected === REPORTS.demand) runDemand();
        })
        .catch(err => alert(err.message || 'Work Experience upload failed.'));
    });
    document.getElementById('dashFocusTerm')?.addEventListener('change', () => {
      const value = document.getElementById('dashFocusTerm')?.value || '';
      const parts = termParts(value);
      const season = document.getElementById('dashDecisionSeason');
      const year = document.getElementById('dashDecisionYear');
      if (parts.season && season) season.value = parts.season;
      if (parts.year && year) year.value = String(parts.year);
      rerunDashboard();
    });
    ['dashDecisionSeason', 'dashDecisionYear'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        const select = document.getElementById('dashFocusTerm');
        if (select) select.value = '__MANUAL__';
        rerunDashboard();
      });
    });
    document.getElementById('exportDashboardSummary')?.addEventListener('click', exportDashboardSummary);
    document.getElementById('runStudentPresence')?.addEventListener('click', () => runStudentPresence().catch(err => alert(err.message || 'Student Presence failed.')));
    document.getElementById('spFocusTerm')?.addEventListener('change', () => {
      updatePresenceCompareTermOptions(dashboardAvailableTerms(state.studentPresenceSourceRows), studentPresenceFocusTerm());
      runStudentPresence().catch(err => console.warn(err));
    });
    document.getElementById('spCompareTerms')?.addEventListener('change', () => { if (state.studentPresenceRan) runStudentPresence().catch(err => console.warn(err)); });
    document.getElementById('spGroup')?.addEventListener('change', () => runStudentPresence().catch(err => console.warn(err)));
    document.getElementById('studentPresenceCsv')?.addEventListener('change', () => runStudentPresence().catch(err => console.warn(err)));
    document.getElementById('spArchiveTerms')?.addEventListener('change', () => runStudentPresence().catch(err => console.warn(err)));
    document.getElementById('spHideOnline')?.addEventListener('change', () => runStudentPresence().catch(err => console.warn(err)));
    ['spIncludeDualEnrollment', 'spIncludeOtherModalities', 'spCampusScope'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => { if (state.studentPresenceRan) runStudentPresence().catch(err => console.warn(err)); });
    });
    document.getElementById('archiveStudentPresenceUploads')?.addEventListener('click', () => archiveUploads('studentPresenceCsv').catch(err => alert(err.message || 'Archive failed.')));
    document.getElementById('exportStudentPresence')?.addEventListener('click', exportStudentPresenceRows);
    document.getElementById('runAttrition')?.addEventListener('click', () => runAttrition().catch(handleAttritionError));
    document.getElementById('dashIncludeWorkExperience')?.addEventListener('change', rerunDashboard);
    document.getElementById('attrIncludeWorkExperience')?.addEventListener('change', () => runAttrition().catch(handleAttritionError));
    document.getElementById('demIncludeWorkExperience')?.addEventListener('change', runDemand);
    document.getElementById('enrollmentCsv')?.addEventListener('change', () => loadAttritionFiles().catch(handleAttritionError));
    document.getElementById('attrArchiveTerms')?.addEventListener('change', () => loadAttritionFiles().catch(handleAttritionError));
    document.getElementById('archiveAttritionUploads')?.addEventListener('click', () => archiveUploads('enrollmentCsv').catch(err => alert(err.message || 'Archive failed.')));
    document.getElementById('clearAttrition')?.addEventListener('click', () => resetAnalyticsControls('attr'));
    document.getElementById('runConsolidation')?.addEventListener('click', runConsolidation);
    document.getElementById('consolidationCsv')?.addEventListener('change', loadConsolidationRows);
    document.getElementById('conArchiveTerms')?.addEventListener('change', loadConsolidationRows);
    document.getElementById('conDecisionTerm')?.addEventListener('change', () => {
      const parts = termParts(document.getElementById('conDecisionTerm')?.value || '');
      const season = document.getElementById('conDecisionSeason');
      const year = document.getElementById('conDecisionYear');
      if (parts.season && season) season.value = parts.season;
      if (parts.year && year) year.value = String(parts.year);
    });
    ['conDecisionSeason', 'conDecisionYear'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        const select = document.getElementById('conDecisionTerm');
        if (select) select.value = '__MANUAL__';
      });
    });
    document.getElementById('archiveConsolidationUploads')?.addEventListener('click', () => archiveUploads('consolidationCsv').catch(err => alert(err.message || 'Archive failed.')));
    document.getElementById('clearConsolidation')?.addEventListener('click', () => resetAnalyticsControls('con'));
    document.getElementById('runDemand')?.addEventListener('click', runDemand);
    document.getElementById('demandCsv')?.addEventListener('change', () => loadDemandRows().catch(err => renderEmptyDemand(`Demand source load failed: ${err.message || err}`)));
    document.getElementById('demArchiveTerms')?.addEventListener('change', () => loadDemandRows().catch(err => renderEmptyDemand(`Demand source load failed: ${err.message || err}`)));
    document.getElementById('demForecastScope')?.addEventListener('change', updateDemandTargetControls);
    ['demForecastSeason', 'demForecastYear'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        const yearInput = document.getElementById('demForecastYear');
        if (yearInput) yearInput.dataset.autoDefault = 'false';
      });
    });
    document.getElementById('archiveDemandUploads')?.addEventListener('click', () => archiveUploads('demandCsv').catch(err => alert(err.message || 'Archive failed.')));
    document.getElementById('clearDemand')?.addEventListener('click', () => resetAnalyticsControls('dem'));
    document.getElementById('runConflictCheck')?.addEventListener('click', () => runConflictCheck().catch(err => alert(err.message || 'Conflict check failed.')));
    document.getElementById('conflictCsv')?.addEventListener('change', () => loadConflictRows().catch(err => console.warn(err)));
    document.getElementById('conflictArchiveTerms')?.addEventListener('change', () => loadConflictRows().catch(err => console.warn(err)));
    document.getElementById('conflictTerm')?.addEventListener('change', () => {
      if (state.conflictRan) runConflictCheck().catch(err => console.warn(err));
      const inspection = document.getElementById('conflictArchiveInspection');
      if (inspection?.querySelector('table')) renderConflictArchiveInspection();
    });
    document.getElementById('conflictModes')?.addEventListener('change', () => { if (state.conflictRan) runConflictCheck().catch(err => console.warn(err)); });
    document.getElementById('conflictOmitCrossListed')?.addEventListener('change', () => { if (state.conflictRan) runConflictCheck().catch(err => console.warn(err)); });
    document.getElementById('conflictSeparateTypes')?.addEventListener('change', () => { if (state.conflictRan) runConflictCheck().catch(err => console.warn(err)); });
    document.getElementById('archiveConflictUploads')?.addEventListener('click', () => archiveUploads('conflictCsv').catch(err => alert(err.message || 'Archive failed.')));
    document.getElementById('clearConflictCheck')?.addEventListener('click', () => {
      resetAnalyticsControls('conflict');
      state.conflictRows = [];
      document.getElementById('conflictTable').innerHTML = '<p class="analytics-empty">Conflict filters cleared. Click Run to scan again.</p>';
      const inspection = document.getElementById('conflictArchiveInspection');
      if (inspection) inspection.innerHTML = '';
    });
    document.getElementById('exportConflictCheck')?.addEventListener('click', () => exportRows(state.conflictRows, `conflict-check-${document.getElementById('conflictTerm')?.value || 'term'}.csv`));
    document.getElementById('inspectConflictArchive')?.addEventListener('click', () => loadConflictRows()
      .then(renderConflictArchiveInspection)
      .catch(err => alert(err.message || 'Parsed schedule inspection failed.')));
    document.getElementById('exportConflictArchiveInspection')?.addEventListener('click', () => loadConflictRows()
      .then(() => exportRowsWithoutMethodology(conflictInspectionRows(), `parsed-schedule-${document.getElementById('conflictTerm')?.value || 'selected-terms'}.csv`))
      .catch(err => alert(err.message || 'Parsed schedule export failed.')));
    document.getElementById('inspectArchivedSchedule')?.addEventListener('click', () => inspectArchivedSchedule()
      .catch(err => {
        renderArchiveInspectionError(err.message || 'Archived schedule inspection failed.');
        alert(err.message || 'Archived schedule inspection failed.');
      }));
    document.getElementById('archiveInspectionTerm')?.addEventListener('change', () => {
      state.archiveInspectionRows = [];
      state.archiveInspectionTerm = '';
      renderArchiveInspectionError('Archived term changed. Click Inspect Archived Schedule to load the selected term.');
    });
    document.getElementById('exportArchiveInspection')?.addEventListener('click', () => {
      const rows = archiveInspectionRows();
      if (!rows.length) {
        renderArchiveInspectionError('Run Inspect Archived Schedule before exporting.');
        return;
      }
      exportRowsWithoutMethodology(rows, `archive-inspection-${state.archiveInspectionTerm || 'selected-term'}.csv`);
    });
    document.getElementById('runRoomFit')?.addEventListener('click', () => window.COSScheduleApp?.renderRoomFitReport?.());
    document.getElementById('exportRoomFitReport')?.addEventListener('click', () => window.COSScheduleApp?.exportRoomFitReport?.());
    document.getElementById('clearRoomFit')?.addEventListener('click', () => {
      ['roomFitTerm', 'roomFitCampus', 'roomFitBuilding', 'roomFitRoom', 'roomFitDivision', 'roomFitSubject', 'roomFitCourse', 'roomFitFlag'].forEach(id => {
        const node = document.getElementById(id);
        if (node) node.value = '';
      });
      const excludeTutoring = document.getElementById('roomFitExcludeTutoringOpenLab');
      if (excludeTutoring) excludeTutoring.checked = true;
      window.COSScheduleApp?.renderRoomFitReport?.();
    });
    ['roomFitTerm', 'roomFitCampus', 'roomFitBuilding', 'roomFitRoom', 'roomFitDivision', 'roomFitSubject', 'roomFitCourse', 'roomFitFlag', 'roomFitExcludeTutoringOpenLab'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => window.COSScheduleApp?.renderRoomFitReportTable?.());
    });
    document.getElementById('saveSnapshotBatch')?.addEventListener('click', () => saveSnapshotBatch().catch(err => alert(err.message || 'Snapshot save failed.')));
    document.getElementById('snapSeason')?.addEventListener('change', () => renderSnapshotManager());
    document.getElementById('snapYear')?.addEventListener('change', () => renderSnapshotManager());
    document.getElementById('viewStoredSnapshots')?.addEventListener('click', () => renderSnapshotManager());
    document.getElementById('exportStoredSnapshots')?.addEventListener('click', () => exportRows(state.enrollmentSnapshots, 'enrollment-snapshots.csv'));
    document.getElementById('clearSnapshotBatch')?.addEventListener('click', () => clearSelectedSnapshotBatch().catch(err => alert(err.message || 'Snapshot clear failed.')));
    document.getElementById('iaDivision')?.addEventListener('change', () => {
      populateInstructorAvailabilityFilters(currentRows());
      runInstructorAvailability();
    });
    document.getElementById('iaSubject')?.addEventListener('change', () => {
      populateInstructorAvailabilityFilters(currentRows());
      runInstructorAvailability();
    });
    document.getElementById('iaSelectVisible')?.addEventListener('click', () => {
      const select = document.getElementById('iaInstructor');
      if (select) [...select.options].forEach(option => { option.selected = true; });
      runInstructorAvailability();
    });
    document.getElementById('runInstructorAvailability')?.addEventListener('click', runInstructorAvailability);
    document.getElementById('clearInstructorAvailability')?.addEventListener('click', clearInstructorAvailability);
    document.getElementById('loadFacultyModality')?.addEventListener('click', () => loadFacultyModality().catch(err => alert(err.message || 'Faculty Modality load failed.')));
    document.getElementById('facultyModalityCsv')?.addEventListener('change', () => loadFacultyModality().catch(err => console.warn(err)));
    ['fmTerm', 'fmCampus', 'fmModality'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', renderFacultyModality);
    });
    ['fmDivision', 'fmDepartment', 'fmCourse'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        updateFacultyModalityFilterOptions();
        renderFacultyModality();
      });
    });
    document.getElementById('clearFacultyModality')?.addEventListener('click', clearFacultyModality);
    document.getElementById('exportFacultyModality')?.addEventListener('click', () => exportRowsWithoutMethodology(state.facultyModalityTableRows, 'faculty-modality.csv'));
    document.getElementById('loadPrimeTimeAnalysis')?.addEventListener('click', () => loadPrimeTimeAnalysis().catch(err => alert(err.message || 'Prime Time Analysis load failed.')));
    document.getElementById('primeTimeCsv')?.addEventListener('change', () => loadPrimeTimeAnalysis().catch(err => console.warn(err)));
    ['ptTerm', 'ptCampus', 'ptStart', 'ptEnd', 'ptModality'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', renderPrimeTimeAnalysis);
    });
    ['ptDivision', 'ptDepartment', 'ptCourse'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        updatePrimeTimeFilterOptions();
        renderPrimeTimeAnalysis();
      });
    });
    document.querySelectorAll('.ptDay').forEach(node => node.addEventListener('change', renderPrimeTimeAnalysis));
    document.getElementById('clearPrimeTimeAnalysis')?.addEventListener('click', clearPrimeTimeAnalysis);
    document.getElementById('exportPrimeTimeAnalysis')?.addEventListener('click', () => exportRowsWithoutMethodology(state.primeTimeTableRows, 'prime-time-analysis.csv'));
    document.getElementById('runSupplyDemand')?.addEventListener('click', () => runSupplyDemand().catch(err => alert(err.message || 'Supply vs Demand failed.')));
    document.getElementById('supplyDemandCsv')?.addEventListener('change', () => runSupplyDemand().catch(err => console.warn(err)));
    document.getElementById('sdArchiveTerms')?.addEventListener('change', () => runSupplyDemand().catch(err => console.warn(err)));
    document.getElementById('archiveSupplyDemandUploads')?.addEventListener('click', () => archiveUploads('supplyDemandCsv').catch(err => alert(err.message || 'Archive failed.')));
    ['sdView', 'sdMetric', 'sdTerm', 'sdCampus', 'sdCalGetc', 'sdModality'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => { if (state.supplyDemandRan) runSupplyDemand().catch(err => console.warn(err)); });
    });
    ['sdDivision', 'sdDepartment', 'sdCourse'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        updateSupplyDemandFilterOptions();
        if (state.supplyDemandRan) runSupplyDemand().catch(err => console.warn(err));
      });
    });
    document.getElementById('clearSupplyDemand')?.addEventListener('click', clearSupplyDemand);
    document.getElementById('exportSupplyDemand')?.addEventListener('click', () => exportRowsWithoutMethodology(state.supplyDemandBucketRows, 'supply-vs-demand.csv'));
    document.getElementById('runBusyTimeDashboard')?.addEventListener('click', () => runBusyTimeDashboard().catch(err => alert(err.message || 'Busy Time Dashboard failed.')));
    document.getElementById('busyTimeCsv')?.addEventListener('change', () => runBusyTimeDashboard().catch(err => console.warn(err)));
    document.getElementById('busyTimeFacultyCsv')?.addEventListener('change', () => runBusyTimeDashboard().catch(err => console.warn(err)));
    document.getElementById('busyTimeArchiveTerms')?.addEventListener('change', () => runBusyTimeDashboard().catch(err => console.warn(err)));
    document.getElementById('archiveBusyTimeUploads')?.addEventListener('click', () => archiveUploads('busyTimeCsv').catch(err => alert(err.message || 'Archive failed.')));
    ['busyTimeTerm', 'busyTimeCampus', 'busyTimeModality'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => { if (state.busyTimeRan) renderBusyTimeDashboard(); });
    });
    ['busyTimeDivision', 'busyTimeDepartment', 'busyTimeCourse'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        updateBusyTimeFilterOptions();
        if (state.busyTimeRan) renderBusyTimeDashboard();
      });
    });
    document.getElementById('clearBusyTimeDashboard')?.addEventListener('click', clearBusyTimeDashboard);
    document.getElementById('exportBusyTimeDashboard')?.addEventListener('click', () => exportRowsWithoutMethodology(state.busyTimeTableRows, 'busy-time-dashboard.csv'));
    document.getElementById('runStudentChoiceOpportunity')?.addEventListener('click', () => runStudentChoiceOpportunity().catch(err => alert(err.message || 'Student Choice Opportunity failed.')));
    document.getElementById('studentChoiceCsv')?.addEventListener('change', () => runStudentChoiceOpportunity().catch(err => console.warn(err)));
    document.getElementById('studentChoiceFacultyCsv')?.addEventListener('change', () => runStudentChoiceOpportunity().catch(err => console.warn(err)));
    document.getElementById('studentChoiceArchiveTerms')?.addEventListener('change', () => runStudentChoiceOpportunity().catch(err => console.warn(err)));
    document.getElementById('archiveStudentChoiceUploads')?.addEventListener('click', () => archiveUploads('studentChoiceCsv').catch(err => alert(err.message || 'Archive failed.')));
    ['studentChoiceView', 'studentChoiceMetric', 'studentChoiceTerm', 'studentChoiceCampus', 'studentChoiceCalGetc', 'studentChoiceModality', 'studentChoiceFacultyType', 'studentChoiceExcludeTutoring'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => { if (state.studentChoiceRan) renderStudentChoiceOpportunity(); });
    });
    ['studentChoiceDivision', 'studentChoiceDepartment', 'studentChoiceDiscipline', 'studentChoiceCourse'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        updateStudentChoiceFilterOptions();
        if (state.studentChoiceRan) renderStudentChoiceOpportunity();
      });
    });
    document.getElementById('clearStudentChoiceOpportunity')?.addEventListener('click', clearStudentChoiceOpportunity);
    document.getElementById('exportStudentChoiceOpportunity')?.addEventListener('click', () => exportRowsWithoutMethodology(state.studentChoiceBucketRows.filter(row => row.sections || row.seats || row.enrollment || row.waitlist), 'student-choice-opportunity.csv'));
    document.getElementById('runRecommendationEngine')?.addEventListener('click', () => runRecommendationEngine().catch(err => alert(err.message || 'Recommendation Engine failed.')));
    document.getElementById('recommendationCsv')?.addEventListener('change', () => runRecommendationEngine().catch(err => console.warn(err)));
    document.getElementById('recommendationFacultyCsv')?.addEventListener('change', () => runRecommendationEngine().catch(err => console.warn(err)));
    document.getElementById('recommendationArchiveTerms')?.addEventListener('change', () => runRecommendationEngine().catch(err => console.warn(err)));
    document.getElementById('archiveRecommendationUploads')?.addEventListener('click', () => archiveUploads('recommendationCsv').catch(err => alert(err.message || 'Archive failed.')));
    ['recommendationCategory', 'recommendationConfidence', 'recommendationTerm', 'recommendationCampus', 'recommendationTimeBlock', 'recommendationModality', 'recommendationFacultyType', 'recommendationExcludeTutoring'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => { if (state.recommendationRan) renderRecommendationEngine(); });
    });
    ['recommendationDivision', 'recommendationDepartment', 'recommendationDiscipline', 'recommendationCourse'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        updateRecommendationFilterOptions();
        if (state.recommendationRan) renderRecommendationEngine();
      });
    });
    document.getElementById('clearRecommendationEngine')?.addEventListener('click', clearRecommendationEngine);
    document.getElementById('exportRecommendationCsv')?.addEventListener('click', () => exportRowsWithoutMethodology(state.recommendationOutputRows, 'scheduling-recommendations.csv'));
    document.getElementById('exportRecommendationPdf')?.addEventListener('click', () => exportRecommendationPdf().catch(err => alert(err.message || 'PDF export failed.')));
    document.getElementById('loadFacultyScheduleHeatmap')?.addEventListener('click', () => loadFacultyScheduleHeatmap().catch(err => alert(err.message || 'Faculty Schedule load failed.')));
    document.getElementById('facultyScheduleCsv')?.addEventListener('change', () => loadFacultyScheduleHeatmap().catch(err => console.warn(err)));
    ['fhMetric', 'fhFacultyType', 'fhMeetingType', 'fhTerm', 'fhCampus', 'fhModality'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', renderFacultyScheduleHeatmap);
    });
    ['fhDivision', 'fhDepartment', 'fhSubject', 'fhCourse'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        updateFacultyHeatmapFilterOptions();
        renderFacultyScheduleHeatmap();
      });
    });
    document.getElementById('clearFacultyHeatmap')?.addEventListener('click', clearFacultyScheduleHeatmap);
    document.getElementById('exportAttrition')?.addEventListener('click', () => exportRows(state.attritionRows, `enrollment-attrition-trend-${attritionDecisionTerm() || currentTerm() || 'term'}.csv`));
    document.getElementById('exportConsolidation')?.addEventListener('click', () => exportRows(state.consolidationRows.map(flattenOpportunity), `section-consolidation-${consolidationDecisionTerm() || currentTerm() || 'term'}.csv`));
    document.getElementById('exportDemand')?.addEventListener('click', () => exportRows(state.demandRows, `enrollment-demand-forecast-${demandTargetSlug()}.csv`));
    document.getElementById('exportDemandExcel')?.addEventListener('click', () => exportRowsExcel(state.demandRows, demandColumns(), `enrollment-demand-forecast-${demandTargetSlug()}.xls`));
    document.getElementById('exportRotation')?.addEventListener('click', () => exportRows(state.rotationRows, `course-rotation-analysis-${currentTerm() || 'term'}.csv`));
    document.getElementById('analyticsReports')?.addEventListener('click', (event) => {
      const modalityQuickButton = event.target.closest('[data-modality-quick]');
      if (modalityQuickButton) {
        const selectId = modalityQuickButton.dataset.modalityQuick;
        setModalitySelectValues(selectId, (modalityQuickButton.dataset.modalityValues || '').split('|').filter(Boolean));
        document.getElementById(selectId)?.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
      const unlockButton = event.target.closest('[data-unlock-report]');
      if (unlockButton) {
        requestReportAccess(unlockButton.dataset.unlockReport);
        return;
      }
      const targetButton = event.target.closest('[data-report-target],[data-scroll-target]');
      if (targetButton) {
        const targetReport = targetButton.dataset.reportTarget;
        const reportSelect = document.getElementById('emReportSelect');
        if (targetReport && reportSelect) {
          reportSelect.value = targetReport;
          if (!canAccess(targetReport)) requestReportAccess(targetReport);
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
    initializeDevelopmentModalityFilters();
    injectStyle();
    wire();
    refreshAnalyticsArchiveOptions();
    loadEnrollmentSnapshots().catch(err => console.warn('Enrollment snapshot preload skipped:', err));
    updateVisibility();
  }

  window.COSEnrollmentAnalytics = {
    ROLE_LEVEL,
    ROLE_LABEL,
    REPORT_ACCESS,
    REPORT_LABEL,
    normalizeRole,
    canAccessRole,
    canAccess,
    normalizeRow: normalize,
    modalityNormalizer: window.COSModalityNormalizer,
    displayModalityLabel,
    modalityMatchesLabelList,
    facultyModalityMatchesLabelList,
    isOnlinePlaceholderTime,
    rowInstructionModality,
    hasUsablePhysicalInterval,
    physicalIntervalRows,
    buildSupplyDemandBuckets,
    buildStudentChoiceBuckets,
    buildSchedulingRecommendations,
    buildFacultyHeatmapBuckets,
    primeTimeAnalysisRows,
    tutoringOpenLabConfig: TUTORING_OPEN_LAB_CONFIG,
    isTutoringOpenLabSection,
    instructorScheduleRows,
    dashboardAvailableTerms,
    dashboardCurrentRows,
    dashboardHistoricalRows,
    dashboardScopeContext,
    dashboardScopeWarnings,
    summaryLifecycleAvailability,
    buildSnapshotRecords,
    upsertSnapshotRecords,
    mergeSnapshotsIntoRows,
    snapshotCoverage,
    snapshotSourceValue,
    normalizeSnapshotType,
    lifecycleMetrics,
    emptyAttritionRecord,
    addAttritionLifecycle,
    lifecycleMetricLabel,
    conflictRows,
    fixedMeetingRecords,
    applyCurriculumCrosswalkToRows
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
