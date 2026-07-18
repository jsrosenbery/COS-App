(function (root, factory) {
  const api = factory();
  root.COSScheduleBuilder = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const DAY_ORDER = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  const DAY_LABELS = { MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday', FR: 'Friday', SA: 'Saturday', SU: 'Sunday' };
  const DAY_ALIASES = {
    M: 'MO', MO: 'MO', MON: 'MO', MONDAY: 'MO',
    T: 'TU', TU: 'TU', TUE: 'TU', TUESDAY: 'TU',
    W: 'WE', WE: 'WE', WED: 'WE', WEDNESDAY: 'WE',
    R: 'TH', TH: 'TH', THU: 'TH', THURSDAY: 'TH',
    F: 'FR', FR: 'FR', FRI: 'FR', FRIDAY: 'FR',
    S: 'SA', SA: 'SA', SAT: 'SA', SATURDAY: 'SA',
    U: 'SU', SU: 'SU', SUN: 'SU', SUNDAY: 'SU'
  };

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

  function normalizeCourseKey(value) {
    return canon(value).replace(/\s+/g, ' ');
  }

  function minutesFromTime(value) {
    const text = compact(value);
    const match = text.match(/^(\d{1,2})(?::?(\d{2}))?\s*(AM|PM)?$/i);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    const ap = match[3]?.toUpperCase();
    if (ap === 'AM' && hour === 12) hour = 0;
    if (ap === 'PM' && hour !== 12) hour += 12;
    if (hour > 23 || minute > 59) return null;
    return hour * 60 + minute;
  }

  function timeLabel(minutes) {
    if (!Number.isFinite(minutes)) return '';
    const hour24 = Math.floor((((minutes % 1440) + 1440) % 1440) / 60);
    const minute = (((minutes % 1440) + 1440) % 1440) % 60;
    const ap = hour24 < 12 ? 'AM' : 'PM';
    const hour12 = hour24 % 12 || 12;
    return `${hour12}:${String(minute).padStart(2, '0')} ${ap}`;
  }

  function normalizeDays(value) {
    if (Array.isArray(value)) return [...new Set(value.map(normalizeDay).filter(Boolean))];
    const text = canon(value);
    if (!text || /ONLINE|TBA/.test(text)) return [];
    if (/[,\s/]+/.test(text)) return [...new Set(text.split(/[,\s/]+/).map(normalizeDay).filter(Boolean))];
    const long = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    const found = long.filter(day => text.includes(day)).map(day => DAY_ALIASES[day]);
    if (found.length) return [...new Set(found)];
    return [...new Set(text.replace(/[^MTWRFSU]/g, '').split('').map(normalizeDay).filter(Boolean))];
  }

  function normalizeDay(value) {
    return DAY_ALIASES[canon(value)] || '';
  }

  function normalizeDate(value) {
    const text = compact(value);
    if (!text) return null;
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
  }

  function dateRangesOverlap(a, b) {
    const aStart = a.startDate || '0000-01-01';
    const aEnd = a.endDate || '9999-12-31';
    const bStart = b.startDate || '0000-01-01';
    const bEnd = b.endDate || '9999-12-31';
    return aStart <= bEnd && bStart <= aEnd;
  }

  function normalizeModality(value, row = {}) {
    if (typeof globalThis !== 'undefined' && globalThis.COSModalityNormalizer?.normalize) {
      const normalized = globalThis.COSModalityNormalizer.normalize(value, row.raw || row);
      return displayModality(normalized);
    }
    const text = canon(value);
    if (/DUAL/.test(text) || text === 'DE') return 'Dual Enrollment';
    if (/HYBRID|HYB|OH|FLX/.test(text)) return 'Hybrid';
    if (/ONLINE|ONL|WEB|ASYNC|OL|ONN|ONS|OO|O1/.test(text)) return /SYNC/.test(text) && !/ASYNC/.test(text) ? 'Synchronous Online' : 'Asynchronous Online';
    if (/IN PERSON|FACE|CLASSROOM|IP|02|04/.test(text)) return 'In-Person';
    return compact(value) || 'Other/Unknown';
  }

  function displayModality(value) {
    const text = canon(value);
    if (text === 'IN PERSON' || text === 'IN-PERSON') return 'In-Person';
    if (text === 'HYBRID') return 'Hybrid';
    if (text === 'ONLINE') return 'Asynchronous Online';
    if (text === 'DUAL ENROLLMENT') return 'Dual Enrollment';
    if (text === 'OMIT') return 'Other/Unknown';
    return compact(value) || 'Other/Unknown';
  }

  function isAsyncOnline(section) {
    const modality = canon(section.modality);
    return modality.includes('ASYNCHRONOUS ONLINE') || (modality.includes('ONLINE') && !section.meetings.some(meeting => meeting.timed));
  }

  function isHybrid(section) {
    return canon(section.modality).includes('HYBRID');
  }

  function sectionCourseKey(row = {}) {
    const subject = compact(row.subject || row.Subject || row.SUBJECT || row.discipline || row.Discipline);
    const course = compact(row.course || row.Course || row.COURSE || row.courseNumber || row.Catalog || row.CATALOG);
    const combined = compact(row.courseCode || row.Subject_Course || row['Subject Course'] || row['Course ID']);
    return normalizeCourseKey(combined || [subject, course].filter(Boolean).join(' '));
  }

  function normalizeMeeting(row = {}) {
    const days = normalizeDays(row.days || row.Days || row.DAY_PATTERN || row.dayPattern || row['Meeting Days']);
    const startRaw = row.start || row.startTime || row.Start_Time || row['Start Time'] || row.START_TIME;
    const endRaw = row.end || row.endTime || row.End_Time || row['End Time'] || row.END_TIME;
    const startMinutes = minutesFromTime(startRaw);
    const endMinutes = minutesFromTime(endRaw);
    const timed = days.length > 0 && startMinutes != null && endMinutes != null && endMinutes > startMinutes;
    return {
      days,
      start: timed ? timeLabel(startMinutes) : '',
      end: timed ? timeLabel(endMinutes) : '',
      startMinutes,
      endMinutes,
      timed,
      campus: compact(row.campus || row.Campus),
      building: compact(row.building || row.Building),
      room: compact(row.roomOnly || row.room || row.Room),
      startDate: normalizeDate(row.startDate || row.Start_Date || row['Start Date']),
      endDate: normalizeDate(row.endDate || row.End_Date || row['End Date']),
      component: compact(row.scheduleType || row.SCHD_CODE_SSRMEET || row.meetingType || row.component || '')
    };
  }

  function normalizeSections(rows = []) {
    const groups = new Map();
    (rows || []).forEach(row => {
      const crn = canon(row.crn || row.CRN);
      const courseKey = sectionCourseKey(row);
      if (!crn || !courseKey) return;
      if (!groups.has(crn)) {
        const modality = normalizeModality(row.modality || row.Modality || row.instructionalMethod || row.INSTRUCTIONAL_METHOD || row.INSM_CODE || row.raw?.INSTRUCTIONAL_METHOD || row.raw?.INSTRUCTIONAL_METHOD_CODE, row);
        const seats = num(row.cap ?? row.sectionCap ?? row.maxEnroll ?? row['Max Enrollment'] ?? row.Capacity);
        const enrollment = num(row.census ?? row.censusEnrollment ?? row.CENSUS_ENROLL ?? row.actual ?? row.actualEnroll ?? row.ACTUAL_ENROLL ?? row.Enrollment);
        const waitlist = num(row.waitlist ?? row.WAITLIST ?? row.waitlistCount ?? row['Waitlist Count']);
        groups.set(crn, {
          crn,
          term: compact(row.term || row.Term),
          courseKey,
          subject: compact(row.subject || row.Subject || row.discipline || row.Discipline),
          course: compact(row.course || row.Course || row.courseNumber),
          title: compact(row.title || row.courseTitle || row['Course Title'] || row.Title),
          section: compact(row.section || row.Section),
          units: num(row.units ?? row.Units ?? row.Credits),
          campus: compact(row.campus || row.Campus),
          modality,
          seats,
          enrollment,
          waitlist,
          openSeats: Math.max(0, seats - enrollment),
          seatStatusKnown: seats > 0 || enrollment > 0,
          full: seats > 0 && enrollment >= seats,
          meetings: [],
          rawRows: []
        });
      }
      const section = groups.get(crn);
      section.rawRows.push(row);
      const meeting = normalizeMeeting(row);
      const meetingKey = [meeting.days.join(''), meeting.startMinutes, meeting.endMinutes, meeting.campus, meeting.building, meeting.room, meeting.component, meeting.startDate, meeting.endDate].join('|');
      if (!section.meetings.some(existing => [existing.days.join(''), existing.startMinutes, existing.endMinutes, existing.campus, existing.building, existing.room, existing.component, existing.startDate, existing.endDate].join('|') === meetingKey)) {
        section.meetings.push(meeting);
      }
      if (!section.campus && meeting.campus) section.campus = meeting.campus;
    });
    return [...groups.values()].map(section => {
      if (!section.meetings.length) {
        section.meetings.push({ days: [], timed: false, startMinutes: null, endMinutes: null, start: '', end: '', campus: section.campus });
      }
      if (isHybrid(section)) section.warnings = ['Hybrid section: verify meeting dates/pattern before registration.'];
      else section.warnings = [];
      if (!section.seatStatusKnown) section.warnings.push('Seat status unknown in uploaded data.');
      return section;
    });
  }

  function courseMatches(section, request) {
    const query = normalizeCourseKey(request.course || request.query || request);
    if (!query) return false;
    return section.courseKey === query || section.courseKey.includes(query) || canon(section.title).includes(query);
  }

  function meetingConflicts(a, b, transitionMinutes = 0) {
    if (!a.timed || !b.timed) return false;
    if (!dateRangesOverlap(a, b)) return false;
    if (!a.days.some(day => b.days.includes(day))) return false;
    return a.startMinutes < b.endMinutes + transitionMinutes && b.startMinutes < a.endMinutes + transitionMinutes;
  }

  function sectionsConflict(a, b, preferences = {}) {
    const transition = Number(preferences.minimumTransitionMinutes || preferences.minimumTransitionTime || 0) || 0;
    for (const left of a.meetings) {
      for (const right of b.meetings) {
        if (meetingConflicts(left, right, transition)) {
          return { conflict: true, reason: `${a.courseKey} ${a.crn} overlaps ${b.courseKey} ${b.crn}` };
        }
      }
    }
    return { conflict: false, reason: '' };
  }

  function sectionEligible(section, preferences = {}) {
    const warnings = [...(section.warnings || [])];
    const allowedDays = new Set((preferences.allowedDays || []).map(normalizeDay).filter(Boolean));
    const excludedDays = new Set((preferences.excludedDays || []).map(normalizeDay).filter(Boolean));
    const allowedModalities = new Set((preferences.allowedModalities || []).map(canon));
    const campuses = new Set((preferences.preferredCampuses || preferences.campuses || []).map(canon).filter(Boolean));
    if (!preferences.includeFullSections && section.full) return { eligible: false, reason: 'Section is full.' };
    if (!preferences.includeWaitlistedSections && section.waitlist > 0) return { eligible: false, reason: 'Section has waitlist activity.' };
    if (!preferences.includeUnknownSeatStatus && !section.seatStatusKnown) return { eligible: false, reason: 'Seat status is unknown.' };
    if (allowedModalities.size && !allowedModalities.has(canon(section.modality))) return { eligible: false, reason: `${section.modality} modality is not allowed.` };
    if (campuses.size && section.campus && !campuses.has(canon(section.campus))) return { eligible: false, reason: `${section.campus} campus is not preferred.` };
    const earliest = minutesFromTime(preferences.earliestStart);
    const latest = minutesFromTime(preferences.latestEnd);
    for (const meeting of section.meetings) {
      if (!meeting.timed) continue;
      if (allowedDays.size && !meeting.days.some(day => allowedDays.has(day))) return { eligible: false, reason: 'Meeting day is outside allowed days.' };
      if (meeting.days.some(day => excludedDays.has(day))) return { eligible: false, reason: `All ${section.courseKey} sections were excluded because they occur on ${meeting.days.filter(day => excludedDays.has(day)).map(day => DAY_LABELS[day]).join('/')}.` };
      if (earliest != null && meeting.startMinutes < earliest) return { eligible: false, reason: 'Section starts before earliest allowed start.' };
      if (latest != null && meeting.endMinutes > latest) return { eligible: false, reason: 'Section ends after latest allowed end.' };
    }
    if (isAsyncOnline(section)) warnings.push('Asynchronous online section has no fixed meeting conflict in this builder.');
    return { eligible: true, reason: '', warnings };
  }

  function campusDays(sections) {
    const days = new Set();
    sections.forEach(section => {
      if (isAsyncOnline(section)) return;
      section.meetings.forEach(meeting => {
        if (meeting.timed) meeting.days.forEach(day => days.add(day));
      });
    });
    return days;
  }

  function totalGapMinutes(sections) {
    let total = 0;
    DAY_ORDER.forEach(day => {
      const blocks = [];
      sections.forEach(section => {
        section.meetings.forEach(meeting => {
          if (meeting.timed && meeting.days.includes(day)) blocks.push(meeting);
        });
      });
      blocks.sort((a, b) => a.startMinutes - b.startMinutes);
      for (let i = 1; i < blocks.length; i += 1) total += Math.max(0, blocks[i].startMinutes - blocks[i - 1].endMinutes);
    });
    return total;
  }

  function summarizeSchedule(sections, requests, preferences = {}) {
    const allMeetings = sections.flatMap(section => section.meetings.filter(meeting => meeting.timed));
    const earliest = allMeetings.length ? Math.min(...allMeetings.map(meeting => meeting.startMinutes)) : null;
    const latest = allMeetings.length ? Math.max(...allMeetings.map(meeting => meeting.endMinutes)) : null;
    const warnings = sections.flatMap(section => section.warnings || []);
    const requestedKeys = new Set((requests || []).map(request => normalizeCourseKey(request.course || request.query || request)));
    const includedKeys = new Set(sections.map(section => section.courseKey));
    const omittedOptionalCourses = (requests || [])
      .filter(request => request.optional || request.required === false)
      .map(request => normalizeCourseKey(request.course || request.query || request))
      .filter(key => key && !includedKeys.has(key));
    const gaps = totalGapMinutes(sections);
    const days = campusDays(sections);
    return {
      sections,
      totalUnits: sections.reduce((sum, section) => sum + (section.units || 0), 0),
      campusDays: days.size,
      totalWeeklyGapMinutes: gaps,
      earliestStart: earliest == null ? 'N/A' : timeLabel(earliest),
      latestEnd: latest == null ? 'N/A' : timeLabel(latest),
      openSeats: sections.reduce((sum, section) => sum + (section.openSeats || 0), 0),
      waitlist: sections.reduce((sum, section) => sum + (section.waitlist || 0), 0),
      warnings: [...new Set(warnings)],
      omittedOptionalCourses,
      complete: [...requestedKeys].every(key => includedKeys.has(key) || omittedOptionalCourses.includes(key)),
      scoreExplanation: ''
    };
  }

  function scheduleViolatesAggregate(summary, preferences = {}) {
    if (preferences.minUnits != null && summary.totalUnits < Number(preferences.minUnits)) return 'Only partial schedules are available within the selected unit limit.';
    if (preferences.maxUnits != null && summary.totalUnits > Number(preferences.maxUnits)) return 'Schedule exceeds maximum units.';
    if (preferences.maxDaysOnCampus != null && summary.campusDays > Number(preferences.maxDaysOnCampus)) return 'Schedule exceeds maximum days on campus.';
    if (preferences.maxGapMinutes != null && summary.totalWeeklyGapMinutes > Number(preferences.maxGapMinutes)) return 'Schedule exceeds maximum weekly gap time.';
    return '';
  }

  function scoreSchedule(summary, ranking = 'best') {
    const warnings = summary.warnings.length;
    const values = {
      best: summary.openSeats - summary.totalWeeklyGapMinutes / 15 - warnings * 20 - summary.campusDays * 5,
      fewestDays: -summary.campusDays,
      shortestGaps: -summary.totalWeeklyGapMinutes,
      earliestFinish: -(minutesFromTime(summary.latestEnd) ?? 1440),
      latestStart: minutesFromTime(summary.earliestStart) ?? 0,
      openSeats: summary.openSeats,
      preferredModality: -warnings,
      fewestWarnings: -warnings
    };
    return values[ranking] ?? values.best;
  }

  function buildScheduleOptions(rows = [], requests = [], preferences = {}) {
    const sections = normalizeSections(rows);
    const allowSameCourse = preferences.allowMultipleSectionsOfSameCourse === true;
    const normalizedRequests = (requests || []).map((request, index) => ({
      course: normalizeCourseKey(request.course || request.query || request),
      label: compact(request.course || request.query || request),
      required: request.required !== false && !request.optional,
      optional: request.optional || request.required === false,
      order: index
    })).filter(request => request.course).filter((request, index, list) => {
      return allowSameCourse || list.findIndex(item => item.course === request.course) === index;
    });
    const availability = normalizedRequests.map(request => {
      const courseSections = sections.filter(section => courseMatches(section, request));
      const eligible = [];
      const excludedReasons = [];
      courseSections.forEach(section => {
        const check = sectionEligible(section, preferences);
        if (check.eligible) eligible.push({ ...section, warnings: [...new Set([...(section.warnings || []), ...(check.warnings || [])])] });
        else excludedReasons.push(check.reason);
      });
      return { ...request, sections: eligible, totalSections: courseSections.length, excludedReasons };
    });
    const unavailable = availability.filter(item => item.required && !item.sections.length);
    const maxResults = Number(preferences.maxResults || 10) || 10;
    const requireAll = preferences.requireAllRequestedCourses !== false;
    const coursesToSearch = availability.filter(item => item.sections.length && (item.required || !requireAll));
    const results = [];
    const partials = [];
    const maxVisited = Number(preferences.maxVisited || 25000) || 25000;
    let visited = 0;

    function visit(index, selected, selectedCourses) {
      visited += 1;
      if (visited > maxVisited || results.length >= maxResults * 8) return;
      if (index >= coursesToSearch.length) {
        const summary = summarizeSchedule(selected, normalizedRequests, preferences);
        const aggregateIssue = scheduleViolatesAggregate(summary, preferences);
        if (!aggregateIssue) results.push(summary);
        else partials.push({ ...summary, warnings: [...summary.warnings, aggregateIssue], complete: false });
        return;
      }
      const request = coursesToSearch[index];
      if (request.optional) visit(index + 1, selected, selectedCourses);
      request.sections.forEach(section => {
        if (!allowSameCourse && selectedCourses.has(section.courseKey)) return;
        const conflict = selected.map(other => sectionsConflict(section, other, preferences)).find(item => item.conflict);
        if (conflict) {
          partials.push({ ...summarizeSchedule(selected, normalizedRequests, preferences), complete: false, warnings: [conflict.reason] });
          return;
        }
        visit(index + 1, [...selected, section], new Set([...selectedCourses, section.courseKey]));
      });
    }

    if (!normalizedRequests.length) {
      return { schedules: [], partialSchedules: [], availability, diagnostics: ['Add at least one desired course.'], maxResults, pruned: false, dataPrivacy: 'Anonymous browser-side calculation only.' };
    }
    if (unavailable.length && requireAll) {
      return {
        schedules: [],
        partialSchedules: availability.filter(item => item.sections.length).flatMap(item => item.sections.slice(0, 1)).length ? [summarizeSchedule(availability.filter(item => item.sections.length).map(item => item.sections[0]), normalizedRequests, preferences)] : [],
        availability,
        diagnostics: unavailable.map(item => `${item.label || item.course} has no sections in the selected term.`),
        maxResults,
        pruned: false,
        dataPrivacy: 'Anonymous browser-side calculation only.'
      };
    }
    visit(0, [], new Set());
    const ranked = results.map(summary => {
      const score = scoreSchedule(summary, preferences.ranking || 'best');
      return {
        ...summary,
        score,
        scoreExplanation: `Ranked by ${rankingLabel(preferences.ranking || 'best')}: ${rankingExplanation(summary, preferences.ranking || 'best')}`
      };
    }).sort((a, b) => b.score - a.score).slice(0, maxResults);
    return {
      schedules: ranked,
      partialSchedules: partials.slice(0, maxResults),
      availability,
      diagnostics: ranked.length ? [] : ['No conflict-free schedule satisfies every selected requirement.'],
      maxResults,
      pruned: visited > maxVisited || results.length >= maxResults * 8,
      visited,
      dataPrivacy: 'Anonymous browser-side calculation only.'
    };
  }

  function rankingLabel(value) {
    const labels = {
      best: 'Best Overall Match',
      fewestDays: 'Fewest Days on Campus',
      shortestGaps: 'Shortest Total Gaps',
      earliestFinish: 'Earliest Finish',
      latestStart: 'Latest Start',
      openSeats: 'Most Open Seats',
      preferredModality: 'Preferred Modality',
      fewestWarnings: 'Fewest Warnings'
    };
    return labels[value] || labels.best;
  }

  function rankingExplanation(summary, ranking) {
    const base = `${summary.totalUnits} units, ${summary.campusDays} campus day(s), ${summary.totalWeeklyGapMinutes} weekly gap minute(s), ${summary.openSeats} open seat(s), ${summary.warnings.length} warning(s).`;
    return base + (ranking === 'best' ? ' Best Overall Match balances seats, gaps, warnings, and campus days.' : '');
  }

  return {
    DAY_ORDER,
    DAY_LABELS,
    normalizeCourseKey,
    normalizeSections,
    sectionEligible,
    sectionsConflict,
    buildScheduleOptions,
    minutesFromTime,
    timeLabel,
    rankingLabel
  };
});
