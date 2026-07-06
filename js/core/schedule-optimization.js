(function (root, factory) {
  const api = factory();
  root.COSScheduleOptimization = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const DAY_KEYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const DAY_LABELS = {
    SU: 'Sunday',
    MO: 'Monday',
    TU: 'Tuesday',
    WE: 'Wednesday',
    TH: 'Thursday',
    FR: 'Friday',
    SA: 'Saturday'
  };
  const DAY_ALIASES = {
    U: 'SU',
    SU: 'SU',
    SUN: 'SU',
    SUNDAY: 'SU',
    M: 'MO',
    MO: 'MO',
    MON: 'MO',
    MONDAY: 'MO',
    T: 'TU',
    TU: 'TU',
    TUE: 'TU',
    TUESDAY: 'TU',
    W: 'WE',
    WE: 'WE',
    WED: 'WE',
    WEDNESDAY: 'WE',
    R: 'TH',
    TH: 'TH',
    THU: 'TH',
    THURSDAY: 'TH',
    F: 'FR',
    FR: 'FR',
    FRI: 'FR',
    FRIDAY: 'FR',
    S: 'SA',
    SA: 'SA',
    SAT: 'SA',
    SATURDAY: 'SA'
  };
  const DIVISION_ALIASES = new Map([
    ['LANG & COMM', 'Language & Communication'],
    ['LANG AND COMM', 'Language & Communication'],
    ['LANGUAGE', 'Language & Communication'],
    ['LANGUAGE COMMUNICATION', 'Language & Communication'],
    ['ENGLISH', 'Language & Communication'],
    ['MATH', 'Math'],
    ['MATHEMATICS', 'Math'],
    ['SCIENCE', 'Science'],
    ['SCIENCES', 'Science'],
    ['SOC SCI', 'Social Science'],
    ['SOCIAL SCIENCES', 'Social Science'],
    ['SOCIAL SCIENCE', 'Social Science'],
    ['BUSINESS', 'Business'],
    ['FINE ARTS', 'Fine Arts'],
    ['ARTS', 'Fine Arts'],
    ['PE', 'Physical Education'],
    ['P E', 'Physical Education'],
    ['PHYSICAL EDUCATION', 'Physical Education'],
    ['CFS', 'Consumer/Family Studies'],
    ['C F S', 'Consumer/Family Studies'],
    ['CONSUMER FAMILY STUDIES', 'Consumer/Family Studies'],
    ['NURSING', 'Nursing'],
    ['COUNSELING', 'Counseling'],
    ['STUDENT SUCCESS', 'Student Success'],
    ['LIBRARY', 'Library'],
    ['INDUSTRY AND TECHNOLOGY', 'Industry and Technology'],
    ['INDUSTRY & TECHNOLOGY', 'Industry and Technology'],
    ['CTE', 'Industry and Technology'],
    ['ADMINISTRATION', 'Administration'],
    ['UNASSIGNED', 'Unassigned'],
    ['NONE', 'None']
  ]);
  const PEOPLE_PLACEHOLDERS = new Set(['KRISTIN', 'LOUANN']);

  function compact(value) {
    return String(value ?? '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function canon(value) {
    return compact(value).replace(/[./]/g, '').replace(/&/g, ' AND ').replace(/\s+/g, ' ').toUpperCase();
  }

  function num(value) {
    const parsed = Number(String(value ?? '').replace(/[%,$]/g, '').trim());
    if (Number.isFinite(parsed)) return parsed;
    const match = String(value ?? '').match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  function normalizeDivisionName(value) {
    const text = compact(value);
    if (!text) return '';
    const key = canon(text);
    return DIVISION_ALIASES.get(key) || text;
  }

  function normalizeRoomPriority(rawValue) {
    const raw = compact(Array.isArray(rawValue) ? rawValue.join('; ') : rawValue);
    if (!raw) {
      return {
        rawRoomPriority: '',
        primaryPriorityArea: 'Unassigned',
        secondaryPriorityArea: '',
        priorityNotes: '',
        priorityMatchConfidence: 'Low',
        matchMethod: 'blank',
        matchNote: 'No room priority value was provided.'
      };
    }
    const notes = [];
    let working = raw;
    const parenMatches = [...working.matchAll(/\(([^)]+)\)/g)].map(match => match[1]);
    parenMatches.forEach(note => notes.push(note));
    working = working.replace(/\([^)]*\)/g, ' ');
    const adminPriority = raw.match(/priority\s*:\s*([^)\/;]+)/i);
    const parts = working
      .split(/\s*(?:\/|;|,|\band\b|\bsecond\b|\bsecondary\b)\s*/i)
      .map(part => part.replace(/\b(priority|primary|second|secondary)\b/ig, ' ').trim())
      .filter(Boolean);
    if (adminPriority?.[1]) parts.unshift(adminPriority[1]);
    const normalized = [];
    parts.forEach(part => {
      const key = canon(part);
      if (PEOPLE_PLACEHOLDERS.has(key)) {
        notes.push(`People-based placeholder: ${part}`);
        return;
      }
      const value = normalizeDivisionName(part);
      if (value && !normalized.includes(value)) normalized.push(value);
    });
    if (!normalized.length && canon(raw).includes('ADMINISTRATION')) normalized.push('Administration');
    const primary = normalized[0] || 'Unassigned';
    const secondary = normalized.find(value => value !== primary && value !== 'Unassigned' && value !== 'None') || '';
    return {
      rawRoomPriority: raw,
      primaryPriorityArea: primary,
      secondaryPriorityArea: secondary,
      priorityNotes: notes.join('; '),
      priorityMatchConfidence: primary === 'Unassigned' ? 'Low' : (secondary ? 'High' : 'Medium'),
      matchMethod: secondary ? 'primary-secondary-parse' : 'primary-parse',
      matchNote: `Normalized "${raw}" to ${[primary, secondary].filter(Boolean).join(' / ')}.`
    };
  }

  function roomKey(room) {
    const building = compact(room?.building || room?.Building || room?.BUILDING);
    const roomNumber = cleanRoomNumber(building, room?.room || room?.Room || room?.ROOM);
    return compact(room?.buildingRoom || room?.roomKey || room?.['Room Key'] || room?.RoomKey || [building, roomNumber].filter(Boolean).join('-'));
  }

  function cleanRoomNumber(buildingValue, roomValue) {
    const building = compact(buildingValue);
    const room = compact(roomValue);
    if (!building || !room) return room;
    const buildingKey = canon(building);
    const parts = room.split(/\s+/).filter(part => canon(part) !== buildingKey);
    return compact(parts.join(' ')) || room;
  }

  function normalizeRoomCatalog(rooms = []) {
    return (rooms || []).map(room => {
      const rawPriority = compact(room.rawRoomPriority || room.rawPriorityDivision1 || room.priorityDivision1 || room.priority || room.roomPriority || room['Room Priority'] || room['Priority Division 1'] || room['Priority Division'] || room['Priority Area']);
      const secondary = compact(room.rawPriorityDivision2 || room.priorityDivision2 || room['Priority Division 2'] || room['Room Priority_2'] || room['Room Priority 2']);
      const priority = normalizeRoomPriority([rawPriority, secondary].filter(Boolean).join(' / '));
      const key = roomKey(room);
      return {
        campus: compact(room.campus || room.Campus),
        building: compact(room.building || room.Building),
        room: compact(room.room || room.Room),
        roomKey: key,
        buildingRoom: key,
        capacity: num(room.capacity ?? room.Capacity ?? room.cap),
        roomType: compact(room.roomType || room.type || room.Type || room['Room Type']),
        rawRoomPriority: rawPriority || secondary || priority.rawRoomPriority,
        primaryPriorityArea: priority.primaryPriorityArea,
        secondaryPriorityArea: priority.secondaryPriorityArea,
        priorityNotes: priority.priorityNotes,
        priorityMatchConfidence: priority.priorityMatchConfidence,
        matchMethod: priority.matchMethod,
        matchNote: priority.matchNote,
        source: room
      };
    }).filter(room => room.roomKey && room.capacity > 0);
  }

  function normalizeDays(value) {
    if (Array.isArray(value)) return [...new Set(value.map(normalizeDay).filter(Boolean))];
    const text = compact(value);
    if (!text) return [];
    if (/[,\s/]+/.test(text)) return [...new Set(text.split(/[,\s/]+/).map(normalizeDay).filter(Boolean))];
    return [...new Set(text.split('').map(normalizeDay).filter(Boolean))];
  }

  function normalizeDay(value) {
    return DAY_ALIASES[canon(value)] || '';
  }

  function minutesFromTime(value) {
    const text = compact(value);
    const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    const ampm = match[3]?.toUpperCase();
    if (ampm === 'AM' && hour === 12) hour = 0;
    if (ampm === 'PM' && hour !== 12) hour += 12;
    if (hour > 23 || minute > 59) return null;
    return hour * 60 + minute;
  }

  function timeLabel(minutes) {
    if (minutes == null) return '';
    const safe = ((minutes % 1440) + 1440) % 1440;
    const hour24 = Math.floor(safe / 60);
    const minute = safe % 60;
    const ap = hour24 < 12 ? 'AM' : 'PM';
    const hour12 = hour24 % 12 || 12;
    return `${hour12}:${String(minute).padStart(2, '0')} ${ap}`;
  }

  function dayTimeLabel(section) {
    const row = normalizeSection(section);
    return `${row.days.map(day => DAY_LABELS[day]).join('/')} ${timeLabel(row.startMinutes)}-${timeLabel(row.endMinutes)}`.trim();
  }

  function normalizeSection(section = {}) {
    const building = compact(section.building || section.Building || section.BUILDING);
    const room = cleanRoomNumber(building, section.room || section.Room || section.ROOM || section.roomOnly);
    const start = compact(section.start || section.startTime || section.Start_Time || section['Start Time']);
    const end = compact(section.end || section.endTime || section.End_Time || section['End Time']);
    return {
      term: compact(section.term || section.Term),
      crn: compact(section.crn || section.CRN),
      subject: compact(section.subject || section.Subject || section.discipline || section.Discipline),
      course: compact(section.course || section.Course || section.courseNumber),
      section: compact(section.section || section.Section),
      courseCode: compact(section.courseCode || section.Subject_Course || [section.subject || section.Subject, section.course || section.Course].filter(Boolean).join(' ')),
      title: compact(section.title || section.courseTitle || section.Title),
      campus: compact(section.campus || section.Campus),
      building,
      room,
      roomKey: [building, room].filter(Boolean).join('-'),
      days: normalizeDays(section.days || section.dayPattern || section.Days),
      start,
      end,
      startMinutes: minutesFromTime(start),
      endMinutes: minutesFromTime(end),
      enrollment: num(section.enrollment ?? section.census ?? section.censusEnrollment ?? section.CENSUS_ENROLL ?? section.actual ?? section.actualEnroll ?? section.ACTUAL_ENROLL),
      sectionCap: num(section.sectionCap ?? section.cap ?? section.maxEnroll ?? section.MAX_ENROLL ?? section['Max Enrollment'] ?? section.Capacity),
      roomType: compact(section.roomType || section['Room Type'] || section.scheduleType || section.meetingType),
      division: normalizeDivisionName(section.division || section.Division),
      modality: compact(section.modality || section.Modality || section.instructionalMethod || section.INSM_CODE),
      source: section
    };
  }

  function isTimeBasedSection(section) {
    const row = section.startMinutes == null ? normalizeSection(section) : section;
    if (!row.days?.length || row.startMinutes == null || row.endMinutes == null || row.endMinutes <= row.startMinutes) return false;
    const modality = canon(row.modality);
    return !/\b(ONLINE|TBA|ASYNC|ASYNCHRONOUS)\b/.test(modality);
  }

  function overlaps(a, b) {
    if (!a.days.some(day => b.days.includes(day))) return false;
    return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
  }

  function rowsArray(rows = []) {
    if (Array.isArray(rows)) return rows;
    if (Array.isArray(rows?.rows)) return rows.rows;
    if (Array.isArray(rows?.sections)) return rows.sections;
    if (Array.isArray(rows?.activeSections)) return rows.activeSections;
    if (Array.isArray(rows?.historicalRows)) return rows.historicalRows;
    return [];
  }

  function normalizedSections(rows = []) {
    return rowsArray(rows).map(row => row && Array.isArray(row.days) && row.startMinutes != null ? row : normalizeSection(row));
  }

  function mapPush(map, key, value) {
    const safeKey = key || '';
    if (!map.has(safeKey)) map.set(safeKey, []);
    map.get(safeKey).push(value);
  }

  function buildRoomIndexes(roomsInput = []) {
    const rooms = normalizeRoomCatalog(roomsInput);
    const byCampus = new Map();
    const byType = new Map();
    const byPriorityArea = new Map();
    rooms.forEach(room => {
      mapPush(byCampus, canon(room.campus), room);
      mapPush(byType, canon(room.roomType), room);
      [room.primaryPriorityArea, room.secondaryPriorityArea].filter(Boolean).forEach(area => mapPush(byPriorityArea, canon(area), room));
    });
    return { rooms, byCampus, byType, byPriorityArea };
  }

  function buildAvailabilityIndex(sectionsInput = []) {
    const sections = normalizedSections(sectionsInput).filter(isTimeBasedSection);
    const byRoom = new Map();
    const byInstructor = new Map();
    sections.forEach(section => {
      if (section.roomKey) mapPush(byRoom, section.roomKey, section);
      const instructor = compact(section.instructor || section.instructorName || section.source?.instructor || section.source?.Instructor);
      if (instructor) mapPush(byInstructor, canon(instructor), section);
    });
    return { sections, byRoom, byInstructor };
  }

  function buildHistoricalDemandIndex(rowsInput = []) {
    const rows = normalizedSections(rowsInput);
    const byCourse = new Map();
    const byCourseTime = new Map();
    rows.forEach(row => {
      const courseKey = canon(row.courseCode);
      if (!courseKey) return;
      mapPush(byCourse, courseKey, row);
      if (isTimeBasedSection(row)) mapPush(byCourseTime, `${courseKey}|${row.days.join('')}|${row.startMinutes}`, row);
    });
    const summarize = matches => {
      const caps = matches.map(row => row.sectionCap).filter(Boolean);
      const enrollments = matches.map(row => row.enrollment).filter(Boolean);
      const avg = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
      const fillRates = matches
        .filter(row => row.sectionCap)
        .map(row => row.enrollment / row.sectionCap)
        .filter(value => Number.isFinite(value));
      return {
        rows: matches,
        terms: [...new Set(matches.map(row => row.term).filter(Boolean))],
        historicalAverageEnrollment: avg(enrollments),
        historicalPeakEnrollment: Math.max(0, ...enrollments),
        historicalAverageCap: avg(caps),
        historicalPeakCap: Math.max(0, ...caps),
        historicalFillRate: avg(fillRates)
      };
    };
    const courseMetrics = new Map([...byCourse.entries()].map(([key, matches]) => [key, summarize(matches)]));
    const courseTimeMetrics = new Map([...byCourseTime.entries()].map(([key, matches]) => [key, summarize(matches)]));
    return { rows, byCourse, byCourseTime, courseMetrics, courseTimeMetrics };
  }

  function buildOptimizationIndexes({ activeRows = [], historyRows = [], rooms = [] } = {}) {
    const activeSections = normalizedSections(activeRows).filter(isTimeBasedSection);
    const historicalDemand = buildHistoricalDemandIndex(historyRows);
    const roomIndexes = buildRoomIndexes(rooms);
    const availability = buildAvailabilityIndex(activeSections);
    return {
      activeSections,
      historicalRows: historicalDemand.rows,
      rooms: roomIndexes.rooms,
      roomIndexes,
      availability,
      historicalDemand,
      warnings: []
    };
  }

  function historyForSectionIndexed(section, historicalDemand) {
    const target = normalizeSection(section);
    const metrics = historicalDemand?.courseMetrics?.get(canon(target.courseCode));
    if (!metrics) return null;
    const matches = metrics.rows.filter(row => row.term !== target.term);
    if (matches.length === metrics.rows.length) return metrics;
    return buildHistoricalDemandIndex(matches).courseMetrics.get(canon(target.courseCode)) || null;
  }

  function historyForSection(section, allSections = []) {
    const target = normalizeSection(section);
    const matches = rowsArray(allSections)
      .map(normalizeSection)
      .filter(row => row.courseCode && row.courseCode === target.courseCode && row.term !== target.term);
    const caps = matches.map(row => row.sectionCap).filter(Boolean);
    const enrollments = matches.map(row => row.enrollment).filter(Boolean);
    const avg = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    return {
      terms: [...new Set(matches.map(row => row.term).filter(Boolean))],
      historicalAverageEnrollment: avg(enrollments),
      historicalPeakEnrollment: Math.max(0, ...enrollments),
      historicalAverageCap: avg(caps),
      historicalPeakCap: Math.max(0, ...caps)
    };
  }

  function courseProfiles(sectionsInput = []) {
    const profiles = new Map();
    rowsArray(sectionsInput).map(normalizeSection).forEach(row => {
      const subject = compact(row.subject || (row.courseCode.match(/^[A-Z]+/) || [''])[0]);
      const course = compact(row.course || row.courseCode.replace(subject, '').trim());
      const key = canon([subject, course].filter(Boolean).join(' ')) || canon(row.courseCode);
      if (!key) return;
      if (!profiles.has(key)) {
        profiles.set(key, {
          subject,
          course,
          courseCode: row.courseCode || [subject, course].filter(Boolean).join(' '),
          division: row.division,
          campus: row.campus,
          modality: row.modality,
          typicalRoomType: row.roomType,
          sections: [],
          caps: [],
          enrollments: [],
          patterns: new Map()
        });
      }
      const profile = profiles.get(key);
      profile.sections.push({
        term: row.term,
        crn: row.crn,
        section: row.section,
        courseCode: row.courseCode,
        division: row.division,
        campus: row.campus,
        modality: row.modality,
        roomType: row.roomType,
        cap: row.sectionCap,
        enrollment: row.enrollment,
        dayTime: isTimeBasedSection(row) ? dayTimeLabel(row) : 'No fixed meeting time'
      });
      if (row.sectionCap) profile.caps.push(row.sectionCap);
      if (row.enrollment) profile.enrollments.push(row.enrollment);
      if (isTimeBasedSection(row)) {
        const patternKey = `${row.days.join('')}-${row.startMinutes}-${row.endMinutes}`;
        profile.patterns.set(patternKey, (profile.patterns.get(patternKey) || 0) + 1);
      }
      if (!profile.division && row.division) profile.division = row.division;
      if (!profile.campus && row.campus) profile.campus = row.campus;
      if (!profile.modality && row.modality) profile.modality = row.modality;
      if (!profile.typicalRoomType && row.roomType) profile.typicalRoomType = row.roomType;
    });
    const avg = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    return [...profiles.values()].map(profile => ({
      ...profile,
      historicalCap: Math.round(avg(profile.caps) || 0),
      typicalEnrollment: Math.round(avg(profile.enrollments) || 0),
      historicalPeakEnrollment: Math.max(0, ...profile.enrollments),
      commonDayTimePatterns: [...profile.patterns.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([key, count]) => {
          const [, daysPart, startPart, endPart] = key.match(/^([A-Z]+)-(\d+)-(\d+)$/) || [];
          const days = normalizeDays(daysPart || '');
          return { label: `${days.map(day => DAY_LABELS[day]).join('/')} ${timeLabel(Number(startPart))}-${timeLabel(Number(endPart))}`, count };
        })
    })).sort((a, b) => a.courseCode.localeCompare(b.courseCode, undefined, { numeric: true }));
  }

  function countCompetingSections(candidate, sectionsInput = []) {
    const row = normalizeSection(candidate);
    if (!isTimeBasedSection(row)) return 0;
    return rowsArray(sectionsInput).map(normalizeSection).filter(other => {
      if (!isTimeBasedSection(other)) return false;
      const sameCourse = row.courseCode && other.courseCode && canon(row.courseCode) === canon(other.courseCode);
      const sameSubject = row.subject && other.subject && canon(row.subject) === canon(other.subject);
      return (sameCourse || sameSubject) && overlaps(row, other);
    }).length;
  }

  function demandEvidence(candidate, historyRows = []) {
    const target = normalizeSection(candidate);
    const historicalDemand = historyRows?.courseMetrics ? historyRows : null;
    const history = historicalDemand ? (historyForSectionIndexed(target, historicalDemand) || historyForSection(target, [])) : historyForSection(target, historyRows);
    const avgFill = history.historicalFillRate || 0;
    const hasHistory = Boolean(history.terms?.length);
    return {
      ...history,
      historicalFillRate: avgFill,
      demandGapIndicator: avgFill >= 0.9 ? 'High unmet-demand signal' : (avgFill >= 0.75 ? 'Moderate demand signal' : (hasHistory ? 'Limited demand pressure' : 'Limited history'))
    };
  }

  function evaluateProposedTime(input = {}, sectionsInput = [], roomsInput = [], options = {}) {
    const indexes = options.indexes || null;
    const historyRows = options.historicalDemand || indexes?.historicalDemand || options.historyRows || sectionsInput;
    const start = minutesFromTime(input.proposedStart || input.preferredStart || input.start || '09:00') ?? 9 * 60;
    const end = minutesFromTime(input.proposedEnd || input.end || '') ?? (start + (num(input.durationMinutes || input.duration || 75) || 75));
    const proposed = normalizeSection({
      crn: 'PROPOSED',
      subject: input.subject || '',
      course: input.courseNumber || input.course || '',
      courseCode: input.course || input.subjectCourse || [input.subject, input.courseNumber].filter(Boolean).join(' '),
      campus: input.proposedCampus || input.campus || '',
      roomType: input.proposedRoomType || input.roomType || '',
      division: input.division || input.priorityArea || '',
      enrollment: input.expectedEnrollment || input.cap || 0,
      cap: input.cap || input.expectedEnrollment || 0,
      days: input.proposedDayPattern || input.preferredDayPattern || input.days || 'MW',
      start: timeLabel(start),
      end: timeLabel(end),
      modality: input.modality || 'In-Person'
    });
    const rooms = indexes?.rooms || normalizeRoomCatalog(roomsInput);
    const availability = indexes?.availability || buildAvailabilityIndex(sectionsInput);
    const scopedOptions = { ...options, availability, historicalDemand: indexes?.historicalDemand || options.historicalDemand, roomIndexes: indexes?.roomIndexes };
    const prefilteredRooms = candidateRoomsForSection(proposed, rooms, scopedOptions);
    const roomOptions = prefilteredRooms
      .map(room => ({ room, fit: roomFitScore(proposed, room, historyRows, scopedOptions) }))
      .filter(candidate => !candidate.fit.priority.blocks)
      .sort((a, b) => b.fit.score - a.fit.score);
    const evidence = demandEvidence(proposed, historyRows);
    const competing = countCompetingSections(proposed, sectionsInput);
    const prime = proposed.startMinutes >= 9 * 60 && proposed.startMinutes < 15 * 60;
    const bestFit = roomOptions[0]?.fit || roomFitScore(proposed, rooms[0] || {}, historyRows, scopedOptions);
    const score = Math.round((bestFit.score || 0) + (evidence.historicalFillRate * 20) - (competing * 4) - (prime && competing >= 2 ? 8 : 0));
    return {
      course: proposed.courseCode,
      proposedDayTime: dayTimeLabel(proposed),
      proposedCampus: proposed.campus,
      proposedRoomType: proposed.roomType,
      expectedEnrollment: proposed.enrollment,
      proposedTimeScore: score,
      availableRoomCount: roomOptions.length,
      bestRoomFit: roomOptions[0]?.room?.roomKey || 'No available room found',
      historicalFillRate: evidence.historicalFillRate,
      expectedFillDemandSupport: evidence.demandGapIndicator,
      studentPresenceAlignment: prime ? 'Prime-time campus presence window' : 'Distributes activity outside core prime time',
      primeTimePressure: prime ? (competing ? 'Adds pressure to an already active prime-time block' : 'Prime-time request with limited same-course competition') : 'Lower prime-time pressure',
      competingSections: competing,
      roomFitQuality: bestFit.flags?.join('; ') || 'General fit',
      historicalPerformance: evidence.terms.length ? `${evidence.terms.length} historical term(s); avg fill ${Math.round(evidence.historicalFillRate * 100)}%` : 'Limited historical evidence',
      saturatedPattern: competing >= 3 ? 'May duplicate saturated offering pattern' : 'No saturated same/similar-course pattern detected',
      scheduleGapFit: roomOptions.length >= 3 && competing <= 1 ? 'Fills a schedule gap with multiple room options' : 'Limited schedule-gap evidence',
      facultyNote: compact(input.facultyNote),
      roomOptions: roomOptions.slice(0, 5).map(candidate => ({
        room: candidate.room.roomKey,
        capacity: candidate.room.capacity,
        roomType: candidate.room.roomType,
        priorityAlignment: candidate.fit.priority.status,
        score: Math.round(candidate.fit.score)
      }))
    };
  }

  function recommendBetterTimes(input = {}, sectionsInput = [], roomsInput = [], options = {}) {
    const proposed = evaluateProposedTime(input, sectionsInput, roomsInput, options);
    const baseStart = minutesFromTime(input.proposedStart || input.preferredStart || input.start || '09:00') ?? 9 * 60;
    const duration = (minutesFromTime(input.proposedEnd || input.end || '') ?? (baseStart + (num(input.durationMinutes || input.duration || 75) || 75))) - baseStart;
    const dayPatterns = ['MW', 'TR', 'M', 'T', 'W', 'R', 'F'];
    const starts = [8 * 60, 9 * 60 + 30, 11 * 60, 13 * 60, 14 * 60 + 30, 16 * 60];
    return dayPatterns.flatMap(days => starts.map(start => ({ days, start })))
      .filter(candidate => !(canon(candidate.days) === canon(input.proposedDayPattern || input.preferredDayPattern || input.days || 'MW') && candidate.start === baseStart))
      .map(candidate => {
        const recInput = { ...input, proposedDayPattern: candidate.days, proposedStart: timeLabel(candidate.start), proposedEnd: timeLabel(candidate.start + duration) };
        const evaluation = evaluateProposedTime(recInput, sectionsInput, roomsInput, options);
        return {
          suggestedDayTime: evaluation.proposedDayTime,
          suggestedRoom: evaluation.bestRoomFit,
          expectedEnrollmentFillSupport: evaluation.expectedFillDemandSupport,
          historicalDemandEvidence: evaluation.historicalPerformance,
          studentPresenceEvidence: evaluation.studentPresenceAlignment,
          roomAvailabilityEvidence: `${evaluation.availableRoomCount} available room option(s)`,
          primeTimeImpact: evaluation.primeTimePressure,
          proposedTimeScore: proposed.proposedTimeScore,
          recommendedTimeScore: evaluation.proposedTimeScore,
          historicalFillRateAtProposedTime: proposed.historicalFillRate,
          historicalFillRateAtRecommendedTime: evaluation.historicalFillRate,
          competingSectionsNearProposedTime: proposed.competingSections,
          competingSectionsNearRecommendedTime: evaluation.competingSections,
          availableRoomCount: evaluation.availableRoomCount,
          bestRoomFit: evaluation.bestRoomFit,
          demandGapIndicator: evaluation.expectedFillDemandSupport,
          studentPresenceAlignment: evaluation.studentPresenceAlignment,
          confidence: evaluation.historicalPerformance.includes('Limited') ? 'Low' : (evaluation.availableRoomCount >= 2 ? 'Medium' : 'Low'),
          whyThisIsBetter: evaluation.proposedTimeScore > proposed.proposedTimeScore
            ? `Compared with ${proposed.proposedDayTime}, ${evaluation.proposedDayTime} improves the score by ${evaluation.proposedTimeScore - proposed.proposedTimeScore}, has ${evaluation.availableRoomCount} available room option(s), and shows ${evaluation.expectedFillDemandSupport.toLowerCase()}.`
            : `This option is not clearly better than the faculty-proposed time; keep it only as an alternative if operational constraints require it.`
        };
      })
      .filter(row => row.recommendedTimeScore > proposed.proposedTimeScore)
      .sort((a, b) => b.recommendedTimeScore - a.recommendedTimeScore)
      .slice(0, options.limit || 10);
  }

  function priorityComparison(room, section, behavior = 'prefer') {
    const division = normalizeDivisionName(section.division);
    const primary = room.primaryPriorityArea;
    const secondary = room.secondaryPriorityArea;
    const assigned = [primary, secondary].filter(value => value && !['Unassigned', 'None'].includes(value));
    const matches = division && assigned.some(value => canon(value) === canon(division));
    const unassigned = !assigned.length;
    const violates = Boolean(division && assigned.length && !matches);
    const score = matches ? 15 : (unassigned ? 0 : (behavior === 'advisory' ? -3 : -12));
    return {
      status: matches ? 'Respects priority alignment' : (unassigned ? 'No priority assignment' : 'Violates priority alignment'),
      matches,
      violates,
      blocks: behavior === 'strict' && violates,
      score,
      note: matches ? `${room.roomKey} priority aligns with ${division}.` : (violates ? `${room.roomKey} priority is ${assigned.join(' / ')}, not ${division}.` : `${room.roomKey} is unassigned for priority.`)
    };
  }

  function roomTypeMatches(room, section) {
    const needed = canon(section.roomType);
    if (!needed) return true;
    const actual = canon(room.roomType);
    if (!actual) return false;
    return actual.includes(needed) || needed.includes(actual) || (needed.includes('LAB') && actual.includes('LAB')) || (needed.includes('CLASS') && actual.includes('CLASS'));
  }

  function roomFitScore(sectionInput, roomInput, allSections = [], options = {}) {
    const section = normalizeSection(sectionInput);
    const room = roomInput?.roomKey && roomInput?.capacity != null ? roomInput : (normalizeRoomCatalog([roomInput])[0] || roomInput);
    const history = options.history || historyForSectionIndexed(section, options.historicalDemand) || historyForSection(section, allSections);
    const expected = Math.max(section.enrollment, history.historicalAverageEnrollment || 0);
    const capTarget = Math.max(section.sectionCap || 0, history.historicalPeakCap || 0, history.historicalPeakEnrollment || 0, expected);
    const capacity = room.capacity || 0;
    const flags = [];
    if (history.historicalPeakCap && capacity < history.historicalPeakCap) flags.push('Room too small for historical cap');
    if (section.sectionCap && capacity < section.sectionCap) flags.push('Room too small for section cap');
    if (expected && capacity > expected * 1.75 && capacity - expected >= 15) flags.push('Room too large for expected enrollment');
    if (capacity < Math.max(section.enrollment, history.historicalPeakEnrollment || 0)) flags.push('Over-capacity risk');
    if (expected && capacity >= expected && capacity <= expected * 1.25) flags.push('Capacity fit');
    if (!roomTypeMatches(room, section)) flags.push('Room type mismatch');
    const priority = priorityComparison(room, section, options.priorityBehavior || 'prefer');
    if (priority.violates) flags.push('Priority mismatch');
    const capacityGap = capTarget ? Math.abs(capacity - capTarget) : 0;
    const capacityFit = Math.max(0, 30 - Math.min(30, capacityGap));
    const historicalCapFit = history.historicalPeakCap ? Math.max(0, 20 - Math.min(20, Math.abs(capacity - history.historicalPeakCap))) : 10;
    const typeMatch = roomTypeMatches(room, section) ? 15 : -15;
    const campusFit = !section.campus || !room.campus || canon(section.campus) === canon(room.campus) ? 10 : -20;
    const utilizationFit = expected && capacity ? Math.max(0, 10 - Math.abs((expected / capacity) - 0.82) * 20) : 5;
    const scoreComponents = {
      capacityFit: Math.round(capacityFit),
      historicalCapFit: Math.round(historicalCapFit),
      roomTypeMatch: typeMatch,
      campusFit,
      roomPriorityMatch: priority.score,
      demandFillHistory: history.historicalAverageEnrollment ? 8 : 0,
      studentPresenceImpact: capacity >= expected ? 5 : -10,
      primeTimePressure: 0,
      timeShiftSize: 0,
      conflictRisk: 10
    };
    const score = Object.values(scoreComponents).reduce((sum, value) => sum + value, 0);
    return {
      score,
      scoreComponents,
      flags,
      priority,
      history,
      expectedEnrollment: expected,
      capTarget,
      confidence: history.terms.length >= 3 ? 'High' : (history.terms.length ? 'Medium' : 'Low')
    };
  }

  function isRoomAvailable(room, sectionInput, scheduledSections = [], ignoreCrn = '') {
    const section = normalizeSection(sectionInput);
    if (!isTimeBasedSection(section)) return false;
    const indexed = scheduledSections?.byRoom ? scheduledSections.byRoom.get(room.roomKey) || [] : scheduledSections;
    return !(indexed || []).map(normalizeSection).some(other => {
      if (ignoreCrn && other.crn && other.crn === ignoreCrn) return false;
      if (other.roomKey !== room.roomKey || !isTimeBasedSection(other)) return false;
      return overlaps(section, other);
    });
  }

  function candidateRoomsForSection(sectionInput, roomsInput = [], options = {}) {
    const section = normalizeSection(sectionInput);
    const maxCandidates = Math.max(1, Number(options.maxCandidateRoomsPerSection || 10));
    const rooms = options.roomIndexes?.rooms || normalizeRoomCatalog(roomsInput);
    const campusKey = canon(section.campus);
    let candidates = options.allowCrossCampusMoves ? rooms : (options.roomIndexes?.byCampus?.get(campusKey) || rooms.filter(room => !section.campus || !room.campus || canon(room.campus) === campusKey));
    if (!options.flexibleRoomType) {
      candidates = candidates.filter(room => roomTypeMatches(room, section));
    }
    const needed = Math.max(section.enrollment || 0, section.sectionCap || 0);
    if (needed && !options.evaluateCapacityRisk) {
      candidates = candidates.filter(room => room.capacity >= needed);
    }
    const rightSized = needed ? candidates.filter(room => room.capacity <= Math.max(needed * 1.75, needed + 20)) : candidates;
    if (rightSized.length) candidates = rightSized;
    return candidates
      .filter(room => room.roomKey !== section.roomKey)
      .filter(room => isRoomAvailable(room, { ...section, roomKey: room.roomKey }, options.availability || options.sections || [], section.crn))
      .sort((a, b) => {
        const aGap = needed ? Math.abs(a.capacity - needed) : 0;
        const bGap = needed ? Math.abs(b.capacity - needed) : 0;
        return aGap - bGap || a.roomKey.localeCompare(b.roomKey);
      })
      .slice(0, maxCandidates);
  }

  function recommendationBase(section, currentRoom, suggestedRoom, currentFit, suggestedFit) {
    return {
      crn: section.crn,
      course: section.courseCode,
      section: section.section,
      currentCampus: section.campus,
      currentRoom: section.roomKey,
      suggestedRoom: suggestedRoom.roomKey,
      currentCapacity: currentRoom?.capacity || 0,
      suggestedCapacity: suggestedRoom.capacity || 0,
      currentEnrollment: section.enrollment,
      sectionCap: section.sectionCap,
      historicalAverageEnrollment: Math.round(currentFit.history.historicalAverageEnrollment || suggestedFit.history.historicalAverageEnrollment || 0),
      historicalPeakEnrollment: Math.round(currentFit.history.historicalPeakEnrollment || suggestedFit.history.historicalPeakEnrollment || 0),
      roomTypeComparison: `${currentRoom?.roomType || 'Unknown'} -> ${suggestedRoom.roomType || 'Unknown'}`,
      roomPriorityComparison: suggestedFit.priority.status,
      confidence: suggestedFit.confidence,
      score: Math.round(suggestedFit.score - currentFit.score),
      scoreComponents: suggestedFit.scoreComponents,
      tradeoffs: suggestedFit.priority.violates ? suggestedFit.priority.note : 'No major tradeoff identified.',
      reason: `Move CRN ${section.crn || ''} from ${section.roomKey || 'unassigned room'} to ${suggestedRoom.roomKey} because the suggested room improves ${suggestedFit.flags.includes('Capacity fit') ? 'capacity fit' : 'overall room fit'} and ${suggestedFit.priority.status.toLowerCase()}.`
    };
  }

  function generateRoomMoveRecommendations(sectionsInput = [], roomsInput = [], options = {}) {
    const indexes = options.indexes || null;
    const sections = indexes?.activeSections || sectionsInput.map(normalizeSection).filter(isTimeBasedSection);
    const historyRows = options.historyRows || sectionsInput;
    const rooms = indexes?.rooms || normalizeRoomCatalog(roomsInput);
    const availability = indexes?.availability || buildAvailabilityIndex(sections);
    const historicalDemand = options.historicalDemand || indexes?.historicalDemand;
    const recommendations = [];
    let candidateRoomsEvaluated = 0;
    sections.forEach(section => {
      const currentRoom = rooms.find(room => room.roomKey === section.roomKey) || { roomKey: section.roomKey, capacity: 0, roomType: '' };
      const scopedOptions = { ...options, availability, historicalDemand, roomIndexes: indexes?.roomIndexes };
      const currentFit = roomFitScore(section, currentRoom, historyRows, scopedOptions);
      const prefiltered = candidateRoomsForSection(section, rooms, scopedOptions);
      candidateRoomsEvaluated += prefiltered.length;
      const candidates = prefiltered
        .map(room => ({ room, fit: roomFitScore(section, room, historyRows, scopedOptions) }))
        .filter(candidate => !candidate.fit.priority.blocks)
        .filter(candidate => candidate.fit.score > currentFit.score + 8)
        .sort((a, b) => b.fit.score - a.fit.score);
      if (candidates[0]) recommendations.push(recommendationBase(section, currentRoom, candidates[0].room, currentFit, candidates[0].fit));
    });
    if (options.stats) {
      options.stats.sectionsEvaluated = sections.length;
      options.stats.candidateRoomsEvaluated = (options.stats.candidateRoomsEvaluated || 0) + candidateRoomsEvaluated;
      options.stats.roomMoveRecommendations = recommendations.length;
    }
    return recommendations.sort((a, b) => b.score - a.score).slice(0, options.limit || 100);
  }

  function shiftedSection(section, offsetMinutes) {
    return {
      ...section,
      startMinutes: section.startMinutes + offsetMinutes,
      endMinutes: section.endMinutes + offsetMinutes,
      start: timeLabel(section.startMinutes + offsetMinutes),
      end: timeLabel(section.endMinutes + offsetMinutes)
    };
  }

  function generateTimeShiftRecommendations(sectionsInput = [], roomsInput = [], options = {}) {
    const allowed = Number(options.allowedShiftMinutes || 0);
    if (!allowed) return [];
    const steps = [];
    for (let offset = -allowed; offset <= allowed; offset += 30) {
      if (offset) steps.push(offset);
    }
    const indexes = options.indexes || null;
    const sections = indexes?.activeSections || sectionsInput.map(normalizeSection).filter(isTimeBasedSection);
    const historyRows = options.historyRows || sectionsInput;
    const rooms = indexes?.rooms || normalizeRoomCatalog(roomsInput);
    const availability = indexes?.availability || buildAvailabilityIndex(sections);
    const recs = [];
    let candidateTimeShiftsEvaluated = 0;
    sections.forEach(section => {
      const currentRoom = rooms.find(room => room.roomKey === section.roomKey);
      if (!currentRoom) return;
      const currentFit = roomFitScore(section, currentRoom, historyRows, { ...options, historicalDemand: indexes?.historicalDemand || options.historicalDemand });
      const best = steps.map(offset => {
        candidateTimeShiftsEvaluated += 1;
        const shifted = shiftedSection(section, offset);
        if (shifted.startMinutes < 6 * 60 || shifted.endMinutes > 22 * 60) return null;
        if (!isRoomAvailable(currentRoom, shifted, availability, section.crn)) return null;
        const fit = { ...currentFit, score: currentFit.score + Math.max(0, 12 - Math.abs(offset) / 10), scoreComponents: { ...currentFit.scoreComponents, timeShiftSize: -Math.round(Math.abs(offset) / 10), conflictRisk: 15 } };
        return { offset, shifted, fit };
      }).filter(Boolean).sort((a, b) => b.fit.score - a.fit.score)[0];
      if (best && best.fit.score > currentFit.score) {
        recs.push({
          crn: section.crn,
          course: section.courseCode,
          currentDayTime: `${section.days.map(day => DAY_LABELS[day]).join('/')} ${timeLabel(section.startMinutes)}-${timeLabel(section.endMinutes)}`,
          suggestedDayTime: `${section.days.map(day => DAY_LABELS[day]).join('/')} ${timeLabel(best.shifted.startMinutes)}-${timeLabel(best.shifted.endMinutes)}`,
          currentRoom: section.roomKey,
          suggestedRoom: section.roomKey,
          timeShiftAmount: `${best.offset > 0 ? '+' : ''}${best.offset} minutes`,
          improvementReason: 'Same-room time shift avoids conflicts within the selected tolerance and preserves meeting pattern.',
          conflictsAvoided: 'No overlapping scheduled room conflict after shift.',
          confidence: currentFit.confidence,
          tradeoffs: 'Review instructor and student schedule impacts before changing published times.',
          score: Math.round(best.fit.score - currentFit.score),
          scoreComponents: best.fit.scoreComponents
        });
      }
    });
    if (options.stats) {
      options.stats.candidateTimeShiftsEvaluated = (options.stats.candidateTimeShiftsEvaluated || 0) + candidateTimeShiftsEvaluated;
      options.stats.timeShiftRecommendations = recs.length;
    }
    return recs.sort((a, b) => b.score - a.score).slice(0, options.limit || 100);
  }

  function addClassPlacement(input = {}, sectionsInput = [], roomsInput = [], options = {}) {
    const indexes = options.indexes || null;
    const rooms = indexes?.rooms || normalizeRoomCatalog(roomsInput);
    const days = normalizeDays(input.preferredDayPattern || input.days || 'MW');
    const start = minutesFromTime(input.preferredStart || input.start || '09:00 AM') ?? 9 * 60;
    const duration = num(input.durationMinutes || input.duration || 75) || 75;
    const candidateSection = normalizeSection({
      crn: 'NEW',
      subject: input.course || input.subjectCourse || '',
      courseCode: input.course || input.subjectCourse || '',
      campus: input.campus || '',
      roomType: input.roomType || '',
      division: input.division || input.priorityArea || '',
      enrollment: input.expectedEnrollment || input.cap || 0,
      cap: input.cap || input.expectedEnrollment || 0,
      days,
      start: timeLabel(start),
      end: timeLabel(start + duration),
      modality: input.modality || 'In-Person'
    });
    const availability = indexes?.availability || buildAvailabilityIndex(sectionsInput);
    const scopedOptions = { ...options, availability, historicalDemand: indexes?.historicalDemand, roomIndexes: indexes?.roomIndexes };
    const candidateRooms = candidateRoomsForSection(candidateSection, rooms, scopedOptions);
    if (options.stats) options.stats.addClassCandidateRoomsEvaluated = (options.stats.addClassCandidateRoomsEvaluated || 0) + candidateRooms.length;
    return candidateRooms
      .map(room => ({ room, fit: roomFitScore(candidateSection, room, sectionsInput, scopedOptions) }))
      .filter(candidate => !candidate.fit.priority.blocks)
      .map(candidate => ({
        course: candidateSection.courseCode,
        bestRoom: candidate.room.roomKey,
        bestDayTime: `${days.map(day => DAY_LABELS[day]).join('/')} ${timeLabel(candidateSection.startMinutes)}-${timeLabel(candidateSection.endMinutes)}`,
        capacity: candidate.room.capacity,
        expectedEnrollment: candidateSection.enrollment,
        expectedFillRate: candidate.room.capacity ? candidateSection.enrollment / candidate.room.capacity : 0,
        historicalDemandSupport: options.includeHistory ? 'Historical demand included when matching course history is available.' : 'Historical demand not requested.',
        roomFit: candidate.fit.flags.join('; ') || 'General fit',
        priorityAlignment: candidate.fit.priority.status,
        utilizationImpact: candidateSection.enrollment && candidate.room.capacity ? `${Math.round((candidateSection.enrollment / candidate.room.capacity) * 100)}% expected room fill` : 'Unknown',
        primeTimePressure: candidateSection.startMinutes >= 9 * 60 && candidateSection.startMinutes < 15 * 60 ? 'May increase prime-time pressure' : 'Outside core prime-time window',
        score: Math.round(candidate.fit.score),
        scoreComponents: candidate.fit.scoreComponents,
        why: `Place ${candidateSection.courseCode || 'new section'} in ${candidate.room.roomKey} because it is available, fits expected enrollment, and ${candidate.fit.priority.status.toLowerCase()}.`
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit || 25);
  }

  function roomPriorityAudit(rooms = []) {
    return normalizeRoomCatalog(rooms).map(room => ({
      campus: room.campus,
      building: room.building,
      room: room.room,
      roomKey: room.roomKey,
      capacity: room.capacity,
      roomType: room.roomType,
      rawRoomPriority: room.rawRoomPriority,
      primaryPriorityArea: room.primaryPriorityArea,
      secondaryPriorityArea: room.secondaryPriorityArea,
      priorityNotes: room.priorityNotes,
      matchConfidence: room.priorityMatchConfidence,
      matchMethod: room.matchMethod,
      matchNote: room.matchNote
    }));
  }

  return {
    normalizeDivisionName,
    normalizeRoomPriority,
    normalizeRoomCatalog,
    normalizeSection,
    normalizeDays,
    isTimeBasedSection,
    minutesFromTime,
    timeLabel,
    buildRoomIndexes,
    buildAvailabilityIndex,
    buildHistoricalDemandIndex,
    buildOptimizationIndexes,
    candidateRoomsForSection,
    historyForSection,
    priorityComparison,
    roomFitScore,
    isRoomAvailable,
    generateRoomMoveRecommendations,
    generateTimeShiftRecommendations,
    addClassPlacement,
    courseProfiles,
    evaluateProposedTime,
    recommendBetterTimes,
    roomPriorityAudit
  };
});
